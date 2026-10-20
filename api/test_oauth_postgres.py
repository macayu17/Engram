import base64
from collections.abc import AsyncIterator
import hashlib
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

from api.config import settings
from api.models.oauth import AuthorizationRequest, ClientRegistration, OAuthHTTPException
from api.services import oauth


@pytest_asyncio.fixture
async def oauth_database() -> AsyncIterator[asyncpg.Connection]:
    database_url = getattr(settings, "engram_test_database_url", "")
    if not database_url:
        pytest.skip("ENGRAM_TEST_DATABASE_URL is not configured")
    connection = await asyncpg.connect(database_url, timeout=10)
    transaction = connection.transaction()
    await transaction.start()
    try:
        yield connection
    finally:
        await transaction.rollback()
        await connection.close()


async def create_authorization(db: asyncpg.Connection) -> tuple[dict[str, object], dict[str, str]]:
    user_id = uuid4()
    org_id = uuid4()
    await db.execute("INSERT INTO users (id, external_id, api_key_hash) VALUES ($1, $2, $3)", user_id, f"oauth-test-{user_id}", hashlib.sha256(str(user_id).encode()).hexdigest())
    await db.execute("INSERT INTO orgs (id, name) VALUES ($1, 'OAuth transactional test')", org_id)
    await db.execute("INSERT INTO org_memberships (user_id, org_id, role) VALUES ($1, $2, 'owner')", user_id, org_id)
    client = await oauth.register_client(ClientRegistration(client_name="Transactional client", redirect_uris=["https://client.example/callback"]), db)
    verifier = "integration-pkce-verifier-" + "a" * 43
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    request = AuthorizationRequest(response_type="code", client_id=client["client_id"], redirect_uri="https://client.example/callback", code_challenge=challenge, code_challenge_method="S256", scope="memory:read memory:write", namespace="integration.project", resource=settings.mcp_public_url.rstrip("/"))
    user = {"id": user_id, "org_id": org_id}
    authorization = await oauth.authorize(request, user, db)
    form = {"grant_type": "authorization_code", "client_id": client["client_id"], "code": parse_qs(urlsplit(authorization["redirect_url"]).query)["code"][0], "redirect_uri": request.redirect_uri, "code_verifier": verifier, "resource": request.resource}
    return user, form


@pytest.mark.asyncio
async def test_postgres_pkce_one_time_code_and_hashed_tokens(oauth_database: asyncpg.Connection) -> None:
    user, form = await create_authorization(oauth_database)
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token({**form, "code_verifier": "wrong" * 12}, oauth_database)
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token({**form, "redirect_uri": "https://client.example/other"}, oauth_database)
    tokens = await oauth.exchange_token(form, oauth_database)
    authenticated = await oauth.get_user_by_access_token(tokens["access_token"], oauth_database)
    assert authenticated is not None
    assert authenticated["id"] == user["id"]
    assert authenticated["org_id"] == user["org_id"]
    assert authenticated["oauth_namespace"] == "integration.project"
    assert authenticated["oauth_scope"] == "memory:read memory:write"
    hashes = await oauth_database.fetch("SELECT token_hash FROM oauth_tokens WHERE grant_id = $1", authenticated["oauth_grant_id"])
    assert {row["token_hash"] for row in hashes} == {hashlib.sha256(tokens[name].encode()).hexdigest() for name in ["access_token", "refresh_token"]}
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token(form, oauth_database)
    assert await oauth.get_user_by_access_token(tokens["access_token"], oauth_database) is None


@pytest.mark.asyncio
async def test_postgres_refresh_rotation_and_revocation(oauth_database: asyncpg.Connection) -> None:
    user, form = await create_authorization(oauth_database)
    tokens = await oauth.exchange_token(form, oauth_database)
    refresh_form = {"grant_type": "refresh_token", "client_id": form["client_id"], "refresh_token": tokens["refresh_token"]}
    rotated = await oauth.exchange_token(refresh_form, oauth_database)
    assert rotated["refresh_token"] != tokens["refresh_token"]
    assert await oauth.get_user_by_access_token(rotated["access_token"], oauth_database) is not None
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token(refresh_form, oauth_database)
    assert await oauth.get_user_by_access_token(rotated["access_token"], oauth_database) is None
    user, form = await create_authorization(oauth_database)
    tokens = await oauth.exchange_token(form, oauth_database)
    authenticated = await oauth.get_user_by_access_token(tokens["access_token"], oauth_database)
    await oauth.revoke_connection(authenticated["oauth_grant_id"], user, oauth_database)
    assert await oauth.get_user_by_access_token(tokens["access_token"], oauth_database) is None


@pytest.mark.asyncio
async def test_postgres_membership_removal_and_expiry_block_access(oauth_database: asyncpg.Connection) -> None:
    user, form = await create_authorization(oauth_database)
    tokens = await oauth.exchange_token(form, oauth_database)
    await oauth_database.execute("DELETE FROM org_memberships WHERE user_id = $1 AND org_id = $2", user["id"], user["org_id"])
    assert await oauth.get_user_by_access_token(tokens["access_token"], oauth_database) is None
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token({"grant_type": "refresh_token", "client_id": form["client_id"], "refresh_token": tokens["refresh_token"]}, oauth_database)
    await oauth_database.execute("INSERT INTO org_memberships (user_id, org_id, role) VALUES ($1, $2, 'owner')", user["id"], user["org_id"])
    await oauth_database.execute("UPDATE oauth_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = $1", hashlib.sha256(tokens["access_token"].encode()).hexdigest())
    assert await oauth.get_user_by_access_token(tokens["access_token"], oauth_database) is None
    user, form = await create_authorization(oauth_database)
    await oauth_database.execute("UPDATE oauth_codes SET expires_at = now() - interval '1 second' WHERE code_hash = $1", hashlib.sha256(form["code"].encode()).hexdigest())
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token(form, oauth_database)
