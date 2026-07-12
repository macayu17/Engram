from pydantic import ValidationError
import pytest

from api.config import Settings


def test_hosted_mode_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="Hosted mode requires explicit CORS origins"):
        Settings(_env_file=None, engram_service_key="service", cors_origins="*")


def test_self_hosted_mode_accepts_explicit_local_cors() -> None:
    configured = Settings(
        _env_file=None,
        engram_service_key="",
        cors_origins="http://localhost:3001,http://localhost:3011",
    )

    assert configured.cors_origin_list == ["http://localhost:3001", "http://localhost:3011"]
