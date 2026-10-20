from urllib.parse import parse_qsl, urlencode
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import ValidationError

from api.config import settings
from api.dependencies import get_current_user, get_db
from api.models.oauth import AuthorizationRequest, ClientRegistration, OAuthHTTPException
from api.services import oauth


router = APIRouter()


async def parse_form(request: Request) -> dict[str, str]:
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/x-www-form-urlencoded":
        raise OAuthHTTPException("invalid_request", "Expected form encoded request")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 16384:
            raise OAuthHTTPException("invalid_request", "Request is too large")
    try:
        fields = parse_qsl(body.decode("utf-8"), keep_blank_values=True, strict_parsing=True, max_num_fields=20)
    except (ValueError, UnicodeDecodeError):
        raise OAuthHTTPException("invalid_request", "Invalid form encoding") from None
    if len({name for name, value in fields}) != len(fields):
        raise OAuthHTTPException("invalid_request", "Duplicate form parameters")
    return dict(fields)


@router.get("/.well-known/oauth-authorization-server")
async def authorization_metadata() -> dict[str, object]:
    issuer = settings.api_public_url.rstrip("/")
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/oauth/authorize",
        "token_endpoint": f"{issuer}/oauth/token",
        "registration_endpoint": f"{issuer}/oauth/register",
        "revocation_endpoint": f"{issuer}/oauth/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
        "scopes_supported": sorted(oauth.SCOPES),
    }


@router.post("/oauth/register", status_code=201)
async def register(input: ClientRegistration, db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    return await oauth.register_client(input, db)


@router.get("/oauth/consent")
async def consent(client_id: str, redirect_uri: str, db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    return await oauth.get_consent(client_id, redirect_uri, db)


@router.get("/oauth/authorize")
async def authorization_redirect(request: Request, db: asyncpg.Connection = Depends(get_db)) -> RedirectResponse:
    if len(request.url.query) > 8192 or len(request.query_params) != len(request.query_params.multi_items()):
        raise OAuthHTTPException("invalid_request", "Invalid authorization parameters")
    try:
        input = AuthorizationRequest.model_validate(dict(request.query_params))
    except ValidationError:
        raise OAuthHTTPException("invalid_request", "Authorization requires code response, S256 PKCE, scopes and registered redirect URI") from None
    await oauth.validate_authorization(input, db)
    parameters = input.model_dump(exclude_none=True)
    return RedirectResponse(f"{settings.dashboard_url.rstrip('/')}/connections/authorize?{urlencode(parameters)}", status_code=302, headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


@router.post("/oauth/authorize")
async def authorize(input: AuthorizationRequest, response: Response, user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db)) -> dict[str, str]:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return await oauth.authorize(input, user, db)


@router.post("/oauth/token")
async def token(request: Request, response: Response, db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return await oauth.exchange_token(await parse_form(request), db)


@router.post("/oauth/introspect")
async def introspect(response: Response, authorization: str = Header(default=""), db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    response.headers["Cache-Control"] = "no-store"
    scheme, separator, credential = authorization.partition(" ")
    user = await oauth.get_user_by_access_token(credential, db) if separator and scheme.lower() == "bearer" else None
    if user is None:
        raise OAuthHTTPException("invalid_token", "Invalid or expired access token", 401)
    return {"active": True, "scope": user["oauth_scope"], "namespace": user["oauth_namespace"], "client_id": user["oauth_client_id"], "expires_at": user["oauth_expires_at"]}


@router.get("/oauth/connections")
async def connections(user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    return await oauth.list_connections(user, db)


@router.delete("/oauth/connections/{connection_id}", status_code=204)
async def disconnect(connection_id: UUID, user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db)) -> Response:
    await oauth.revoke_connection(connection_id, user, db)
    return Response(status_code=204)


@router.post("/oauth/revoke")
async def revoke(request: Request, db: asyncpg.Connection = Depends(get_db)) -> Response:
    form = await parse_form(request)
    await oauth.revoke_token(form.get("token", ""), form.get("client_id", ""), db)
    return Response(status_code=200, headers={"Cache-Control": "no-store"})
