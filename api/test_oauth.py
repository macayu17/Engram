import base64
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
import hashlib
from pathlib import Path
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from api.dependencies import get_db
from api.models.oauth import AuthorizationRequest, OAuthHTTPException
from api.routes.oauth import router
from api.services import oauth


class OAuthDb:
    def __init__(self, credential: dict[str, object] | None = None, grant: dict[str, object] | None = None) -> None:
        self.credential = credential
        self.grant = grant
        self.committed = False
        self.fetchrow = AsyncMock(side_effect=[credential, grant])
        self.execute = AsyncMock(return_value="UPDATE 1")

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[None]:
        yield
        self.committed = True


@pytest.mark.asyncio
@pytest.mark.parametrize("uri", ["https://client.example/callback", "http://localhost:8240/callback", "http://127.0.0.1/callback", "http://[::1]/callback"])
async def test_redirect_uri_allows_https_and_loopback(uri: str) -> None:
    await oauth.validate_redirect_uri(uri)


@pytest.mark.asyncio
@pytest.mark.parametrize("uri", ["http://client.example/callback", "javascript:alert(1)", "https://user:pass@client.example/callback", "https://client.example/callback#fragment", "https://client.example\\@evil.example", "https://client.example/\ncallback", "http://localhost.evil.example/callback", "https://client.example:bad/callback"])
async def test_redirect_uri_rejects_unsafe_urls(uri: str) -> None:
    with pytest.raises(OAuthHTTPException):
        await oauth.validate_redirect_uri(uri)


@pytest.mark.asyncio
async def test_scopes_and_resource_are_explicit_and_bounded() -> None:
    assert await oauth.validate_scope("memory:write memory:read memory:read") == "memory:read memory:write"
    for scope in ["", "admin", "memory:read users:write"]:
        with pytest.raises(OAuthHTTPException):
            await oauth.validate_scope(scope)
    with pytest.raises(OAuthHTTPException):
        await oauth.validate_resource("https://other.example/mcp")


@pytest.mark.asyncio
async def test_consent_requires_exact_registered_redirect() -> None:
    db = AsyncMock()
    db.fetchrow.return_value = {"client_name": "Client", "redirect_uris": ["https://client.example/callback"]}
    assert (await oauth.get_consent("client", "https://client.example/callback", db))["client_name"] == "Client"
    with pytest.raises(OAuthHTTPException):
        await oauth.get_consent("client", "https://client.example/callback?extra=true", db)




@pytest.mark.asyncio
async def test_code_pkce_binding_replay_expiry_and_refresh_rotation() -> None:
    verifier = "a" * 43
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    expiry = datetime.now(UTC) + timedelta(days=1)
    credential = {"grant_id": "grant", "redirect_uri": "https://client.example/callback", "code_challenge": challenge, "expires_at": expiry, "used_at": None}
    grant = {"id": "grant", "expires_at": expiry, "scope": "memory:read"}
    form = {"grant_type": "authorization_code", "client_id": "client", "code": "secret-code", "redirect_uri": credential["redirect_uri"], "code_verifier": verifier}
    for changed in [{"code_verifier": "b" * 43}, {"redirect_uri": "https://client.example/other"}, {"code_verifier": "bad"}]:
        db = OAuthDb(credential, grant)
        with pytest.raises(OAuthHTTPException):
            await oauth.exchange_token({**form, **changed}, db)
        db.execute.assert_not_awaited()
    db = OAuthDb(credential, grant)
    result = await oauth.exchange_token(form, db)
    assert result["token_type"] == "Bearer"
    assert result["access_token"] != result["refresh_token"]
    assert result["scope"] == "memory:read"
    insert_parameters = db.execute.await_args_list[-1].args[1:]
    assert result["access_token"] not in insert_parameters
    assert result["refresh_token"] not in insert_parameters
    assert hashlib.sha256(result["access_token"].encode()).hexdigest() in insert_parameters
    assert db.committed
    replay_db = OAuthDb({**credential, "used_at": datetime.now(UTC)}, grant)
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token(form, replay_db)
    assert replay_db.committed
    assert "revoked_at" in replay_db.execute.await_args.args[0]
    expired_db = OAuthDb({**credential, "expires_at": datetime.now(UTC) - timedelta(seconds=1)}, grant)
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token(form, expired_db)
    expired_db.execute.assert_not_awaited()
    refresh_db = OAuthDb({**credential, "token_type": "refresh"}, grant)
    rotated = await oauth.exchange_token({"grant_type": "refresh_token", "client_id": "client", "refresh_token": "old-refresh"}, refresh_db)
    assert rotated["refresh_token"] != "old-refresh"
    assert "used_at = now()" in refresh_db.execute.await_args_list[0].args[0]
    replay_refresh_db = OAuthDb({**credential, "token_type": "refresh", "used_at": datetime.now(UTC)}, grant)
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token({"grant_type": "refresh_token", "client_id": "client", "refresh_token": "old-refresh"}, replay_refresh_db)
    assert replay_refresh_db.committed
    assert "revoked_at" in replay_refresh_db.execute.await_args.args[0]


@pytest.mark.asyncio
async def test_membership_revocation_and_scope_changes_block_exchange() -> None:
    credential = {"grant_id": "grant", "expires_at": datetime.now(UTC) + timedelta(days=1), "used_at": None, "token_type": "refresh"}
    form = {"grant_type": "refresh_token", "refresh_token": "old-refresh", "client_id": "client"}
    db = OAuthDb(credential, None)
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token(form, db)
    grant_query = db.fetchrow.await_args.args[0]
    assert "JOIN org_memberships" in grant_query
    assert "revoked_at IS NULL" in grant_query
    db.execute.assert_not_awaited()
    db = OAuthDb(credential, {"id": "grant", "scope": "memory:read", "expires_at": credential["expires_at"]})
    with pytest.raises(OAuthHTTPException):
        await oauth.exchange_token({**form, "scope": "memory:read memory:write"}, db)
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_access_auth_checks_membership_expiry_audience_each_time() -> None:
    db = AsyncMock()
    db.fetchrow.return_value = None
    assert await oauth.get_user_by_access_token("unknown-token", db) is None
    query = db.fetchrow.await_args.args[0]
    assert "JOIN org_memberships" in query
    assert "tokens.expires_at > now()" in query
    assert "grants.expires_at > now()" in query
    assert "grants.revoked_at IS NULL" in query
    assert "grants.resource = $2" in query
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_authorize_checks_membership_and_encodes_bound_state() -> None:
    verifier = "a" * 43
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    input = AuthorizationRequest(response_type="code", client_id="client", redirect_uri="https://client.example/callback?foo=bar", code_challenge=challenge, code_challenge_method="S256", scope="memory:read", state="opaque&state=one")
    db = OAuthDb()
    client = {"client_name": "Client", "redirect_uris": [input.redirect_uri]}
    db.fetchrow.side_effect = [client, None]
    with pytest.raises(OAuthHTTPException):
        await oauth.authorize(input, {"id": "user", "org_id": "org"}, db)
    db.execute.assert_not_awaited()
    db.fetchrow.side_effect = [client, {"role": "owner"}, {"id": "grant"}]
    response = await oauth.authorize(input, {"id": "user", "org_id": "org"}, db)
    query = parse_qs(urlsplit(response["redirect_url"]).query)
    assert query["state"] == [input.state]
    assert query["foo"] == ["bar"]
    assert len(query["code"][0]) >= 43
    assert query["code"][0] not in db.execute.await_args.args
    personal = input.model_copy(update={"namespace": "personal"})
    db.fetchrow.side_effect = [client]
    with pytest.raises(OAuthHTTPException):
        await oauth.authorize(personal, {"id": "user", "org_id": "org"}, db)


@pytest.mark.asyncio
async def test_revocation_scopes_to_public_client_without_echo() -> None:
    db = AsyncMock()
    await oauth.revoke_token("refresh-secret", "client", db)
    query, client_id, token_hash = db.execute.await_args.args
    assert "client_id = $1" in query
    assert client_id == "client"
    assert token_hash == hashlib.sha256(b"refresh-secret").hexdigest()
    await oauth.revoke_connection("grant", {"id": "user", "org_id": "org"}, db)
    assert db.execute.await_args.args[1:] == ("grant", "user", "org")
    assert "user_id = $2 AND org_id = $3" in db.execute.await_args.args[0]


def test_token_form_rejects_duplicate_and_oversized_requests() -> None:
    app = FastAPI()
    app.include_router(router)
    db = AsyncMock()

    async def override_db() -> AsyncIterator[AsyncMock]:
        yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        response = client.post("/oauth/token", content="grant_type=refresh_token&grant_type=authorization_code", headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert response.status_code == 400
        response = client.post("/oauth/token", content="token=" + "a" * 17000, headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert response.status_code == 400
        response = client.post("/oauth/token", json={"grant_type": "refresh_token"})
        assert response.status_code == 400
    db.execute.assert_not_awaited()


def test_oauth_schema_is_server_only_and_stores_hashes() -> None:
    schema = (Path(__file__).parent / "db" / "oauth.sql").read_text(encoding="utf-8")
    for table in ["oauth_clients", "oauth_grants", "oauth_codes", "oauth_tokens"]:
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY" in schema
    assert "FROM PUBLIC" in schema
    assert "ARRAY['anon', 'authenticated']" in schema
    assert "token_hash TEXT PRIMARY KEY" in schema
    assert "code_hash TEXT PRIMARY KEY" in schema
