import base64
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import ipaddress
import re
import secrets
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

from api.config import settings
from api.models.oauth import AuthorizationRequest, ClientRegistration, OAuthHTTPException


SCOPES = {"memory:read", "memory:write"}


async def validate_redirect_uri(redirect_uri: str) -> None:
    try:
        parsed = urlsplit(redirect_uri)
        port = parsed.port
        hostname = parsed.hostname
        loopback = hostname == "localhost"
        if hostname and not loopback:
            try:
                loopback = ipaddress.ip_address(hostname).is_loopback
            except ValueError:
                loopback = False
        valid_scheme = parsed.scheme == "https" or parsed.scheme == "http" and loopback
        if not valid_scheme or not hostname or parsed.username is not None or parsed.password is not None or parsed.fragment or any(ord(char) <= 32 or ord(char) == 127 for char in redirect_uri) or "\\" in redirect_uri:
            raise ValueError
        if port is not None and port < 1:
            raise ValueError
    except ValueError:
        raise OAuthHTTPException("invalid_redirect_uri", "Redirect URI must use HTTPS or loopback HTTP without credentials or fragments") from None


async def validate_scope(scope: str) -> str:
    requested = set(scope.split())
    if not requested or not requested <= SCOPES:
        raise OAuthHTTPException("invalid_scope", "Supported scopes are memory:read and memory:write")
    return " ".join(sorted(requested))


async def validate_resource(resource: str | None) -> str:
    expected = settings.mcp_public_url.rstrip("/")
    if resource is not None and resource != expected:
        raise OAuthHTTPException("invalid_target", "Resource does not identify this MCP server")
    return expected


async def register_client(input: ClientRegistration, db: asyncpg.Connection) -> dict[str, object]:
    for redirect_uri in input.redirect_uris:
        await validate_redirect_uri(redirect_uri)
    client_id = secrets.token_urlsafe(32)
    await db.execute("INSERT INTO oauth_clients (id, client_name, redirect_uris) VALUES ($1, $2, $3)", client_id, input.client_name, input.redirect_uris)
    return {"client_id": client_id, **input.model_dump()}


async def get_consent(client_id: str, redirect_uri: str, db: asyncpg.Connection) -> dict[str, object]:
    await validate_redirect_uri(redirect_uri)
    client = await db.fetchrow("SELECT client_name, redirect_uris FROM oauth_clients WHERE id = $1", client_id)
    if client is None or redirect_uri not in client["redirect_uris"]:
        raise OAuthHTTPException("invalid_request", "Unknown client or unregistered redirect URI")
    return {"client_name": client["client_name"], "redirect_uri": redirect_uri, "scopes_supported": sorted(SCOPES)}


async def validate_authorization(input: AuthorizationRequest, db: asyncpg.Connection) -> None:
    await get_consent(input.client_id, input.redirect_uri, db)
    await validate_scope(input.scope)
    await validate_resource(input.resource)
    if input.namespace == "personal":
        raise OAuthHTTPException("invalid_request", "OAuth connections must select a project namespace")


async def authorize(input: AuthorizationRequest, user: asyncpg.Record, db: asyncpg.Connection) -> dict[str, str]:
    await validate_authorization(input, db)
    code = secrets.token_urlsafe(48)
    async with db.transaction():
        membership = await db.fetchrow("SELECT role FROM org_memberships WHERE user_id = $1 AND org_id = $2 FOR SHARE", user["id"], user["org_id"])
        if membership is None:
            raise OAuthHTTPException("access_denied", "Workspace membership is required", 403)
        grant = await db.fetchrow(
            """INSERT INTO oauth_grants (client_id, user_id, org_id, namespace, scope, resource, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
            input.client_id, user["id"], user["org_id"], input.namespace, await validate_scope(input.scope), await validate_resource(input.resource), datetime.now(UTC) + timedelta(days=settings.oauth_refresh_token_days),
        )
        await db.execute("INSERT INTO oauth_codes (code_hash, grant_id, redirect_uri, code_challenge, expires_at) VALUES ($1, $2, $3, $4, $5)", hashlib.sha256(code.encode()).hexdigest(), grant["id"], input.redirect_uri, input.code_challenge, datetime.now(UTC) + timedelta(minutes=5))
    parsed = urlsplit(input.redirect_uri)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.append(("code", code))
    if input.state is not None:
        query.append(("state", input.state))
    return {"redirect_url": urlunsplit(parsed._replace(query=urlencode(query)))}


async def issue_tokens(grant: asyncpg.Record, db: asyncpg.Connection) -> dict[str, object]:
    access_token = secrets.token_urlsafe(48)
    refresh_token = secrets.token_urlsafe(48)
    access_expiry = min(datetime.now(UTC) + timedelta(seconds=settings.oauth_access_token_seconds), grant["expires_at"])
    await db.execute(
        """INSERT INTO oauth_tokens (token_hash, grant_id, token_type, expires_at)
        VALUES ($1, $2, 'access', $3), ($4, $2, 'refresh', $5)""",
        hashlib.sha256(access_token.encode()).hexdigest(), grant["id"], access_expiry, hashlib.sha256(refresh_token.encode()).hexdigest(), grant["expires_at"],
    )
    return {"access_token": access_token, "token_type": "Bearer", "expires_in": max(0, int((access_expiry - datetime.now(UTC)).total_seconds())), "refresh_token": refresh_token, "scope": grant["scope"]}


async def exchange_token(form: dict[str, str], db: asyncpg.Connection) -> dict[str, object]:
    grant_type = form.get("grant_type")
    client_id = form.get("client_id", "")
    if grant_type not in {"authorization_code", "refresh_token"}:
        raise OAuthHTTPException("unsupported_grant_type", "Use authorization_code or refresh_token")
    resource = await validate_resource(form.get("resource"))
    secret = form.get("code" if grant_type == "authorization_code" else "refresh_token", "")
    if not secret or len(secret) > 512 or not client_id:
        raise OAuthHTTPException("invalid_grant", "Invalid grant")
    replayed = False
    result: dict[str, object] | None = None
    async with db.transaction():
        table = "oauth_codes" if grant_type == "authorization_code" else "oauth_tokens"
        hash_column = "code_hash" if grant_type == "authorization_code" else "token_hash"
        credential = await db.fetchrow(f"SELECT * FROM {table} WHERE {hash_column} = $1 FOR UPDATE", hashlib.sha256(secret.encode()).hexdigest())
        if credential is None or grant_type == "refresh_token" and credential["token_type"] != "refresh":
            raise OAuthHTTPException("invalid_grant", "Invalid grant")
        grant = await db.fetchrow(
            """SELECT grants.* FROM oauth_grants AS grants
            JOIN org_memberships AS membership ON membership.user_id = grants.user_id AND membership.org_id = grants.org_id
            WHERE grants.id = $1 AND grants.client_id = $2 AND grants.resource = $3
              AND grants.revoked_at IS NULL AND grants.expires_at > now() FOR UPDATE OF grants""",
            credential["grant_id"], client_id, resource,
        )
        if grant is None or credential["expires_at"] <= datetime.now(UTC):
            raise OAuthHTTPException("invalid_grant", "Invalid or expired grant")
        if credential["used_at"] is not None:
            await db.execute("UPDATE oauth_grants SET revoked_at = now() WHERE id = $1", grant["id"])
            replayed = True
        else:
            if grant_type == "authorization_code":
                verifier = form.get("code_verifier", "")
                if not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier):
                    raise OAuthHTTPException("invalid_grant", "Invalid PKCE verifier")
                challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
                if form.get("redirect_uri") != credential["redirect_uri"] or not hmac.compare_digest(challenge, credential["code_challenge"]):
                    raise OAuthHTTPException("invalid_grant", "Redirect URI or PKCE verifier does not match")
            if "scope" in form and await validate_scope(form["scope"]) != grant["scope"]:
                raise OAuthHTTPException("invalid_scope", "Scope changes require new authorization")
            await db.execute(f"UPDATE {table} SET used_at = now() WHERE {hash_column} = $1", hashlib.sha256(secret.encode()).hexdigest())
            result = await issue_tokens(grant, db)
    if replayed or result is None:
        raise OAuthHTTPException("invalid_grant", "Grant has already been used")
    return result


async def get_user_by_access_token(token: str, db: asyncpg.Connection) -> asyncpg.Record | None:
    if not token or len(token) > 512:
        return None
    row = await db.fetchrow(
        """SELECT users.id, grants.org_id, membership.role, users.external_id, users.created_at,
            users.max_memories_injected, users.retrieval_threshold, users.dedup_threshold, users.retrieval_mode,
            orgs.extraction_provider, orgs.extraction_model, orgs.openai_api_key_encrypted,
            orgs.gemini_api_key_encrypted, orgs.anthropic_api_key_encrypted,
            grants.scope AS oauth_scope, grants.namespace AS oauth_namespace,
            grants.client_id AS oauth_client_id, tokens.expires_at AS oauth_expires_at, grants.id AS oauth_grant_id
        FROM oauth_tokens AS tokens
        JOIN oauth_grants AS grants ON grants.id = tokens.grant_id
        JOIN users ON users.id = grants.user_id
        JOIN orgs ON orgs.id = grants.org_id
        JOIN org_memberships AS membership ON membership.user_id = users.id AND membership.org_id = grants.org_id
        WHERE tokens.token_hash = $1 AND tokens.token_type = 'access' AND tokens.expires_at > now()
          AND grants.revoked_at IS NULL AND grants.expires_at > now() AND grants.resource = $2""",
        hashlib.sha256(token.encode()).hexdigest(), await validate_resource(None),
    )
    if row is not None:
        await db.execute("UPDATE oauth_grants SET last_used_at = now() WHERE id = $1", row["oauth_grant_id"])
    return row


async def list_connections(user: asyncpg.Record, db: asyncpg.Connection) -> dict[str, object]:
    rows = await db.fetch(
        """SELECT grants.id, clients.client_name, grants.namespace, grants.scope, grants.created_at, grants.last_used_at, grants.expires_at
        FROM oauth_grants AS grants JOIN oauth_clients AS clients ON clients.id = grants.client_id
        WHERE grants.user_id = $1 AND grants.org_id = $2 AND grants.revoked_at IS NULL AND grants.expires_at > now()
        ORDER BY grants.created_at DESC""", user["id"], user["org_id"],
    )
    return {"connections": [dict(row) for row in rows]}


async def revoke_connection(connection_id: object, user: asyncpg.Record, db: asyncpg.Connection) -> None:
    await db.execute("UPDATE oauth_grants SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND org_id = $3", connection_id, user["id"], user["org_id"])


async def revoke_token(token: str, client_id: str, db: asyncpg.Connection) -> None:
    if not token or len(token) > 512 or not client_id:
        return
    await db.execute(
        """UPDATE oauth_grants SET revoked_at = now() WHERE client_id = $1 AND id IN
        (SELECT grant_id FROM oauth_tokens WHERE token_hash = $2)""", client_id, hashlib.sha256(token.encode()).hexdigest(),
    )
