from typing import Annotated, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field


class OAuthHTTPException(HTTPException):
    def __init__(self, error: str, description: str, status_code: int = 400) -> None:
        super().__init__(status_code, {"error": error, "error_description": description}, headers={"Cache-Control": "no-store"})


class ClientRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_name: str = Field(default="MCP client", min_length=1, max_length=100)
    redirect_uris: list[Annotated[str, Field(min_length=1, max_length=2048)]] = Field(min_length=1, max_length=10)
    token_endpoint_auth_method: Literal["none"] = "none"
    grant_types: list[Literal["authorization_code", "refresh_token"]] = Field(default=["authorization_code", "refresh_token"], min_length=1, max_length=2)
    response_types: list[Literal["code"]] = Field(default=["code"], min_length=1, max_length=1)


class AuthorizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_id: str = Field(min_length=1, max_length=200)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    response_type: Literal["code"]
    code_challenge: str = Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$")
    code_challenge_method: Literal["S256"]
    scope: str = Field(min_length=1, max_length=100)
    state: str | None = Field(default=None, max_length=1024)
    resource: str | None = Field(default=None, max_length=2048)
    namespace: str = Field(default="default", min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")
