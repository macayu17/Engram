import pytest
from pydantic import ValidationError

from api.models.user import ServiceUserKeyCreate, UserCreate, UserProviderConfigUpdate, UserUpdate


def test_user_external_id_is_stripped() -> None:
    assert UserCreate(external_id="  ayush  ").external_id == "ayush"
    assert UserUpdate(external_id="  engram-user  ").external_id == "engram-user"
    assert ServiceUserKeyCreate(external_id="  clerk-user  ").external_id == "clerk-user"


def test_user_external_id_rejects_whitespace_only() -> None:
    with pytest.raises(ValidationError):
        UserCreate(external_id="   ")


def test_extraction_provider_config_rejects_anthropic() -> None:
    with pytest.raises(ValidationError):
        UserProviderConfigUpdate(extraction_provider="anthropic")
