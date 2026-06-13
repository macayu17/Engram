import os
from dataclasses import asdict

import pytest
from cryptography.fernet import Fernet

from api.services import provider_keys, security
from api.services.security import (
    decrypt_provider_key,
    encrypt_provider_key,
    mask_provider_key,
)


@pytest.fixture
def configured_master_key(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", key)
    return key


def test_encrypt_decrypt_round_trip(configured_master_key) -> None:
    blob = encrypt_provider_key("sk-abc123-very-secret")
    assert blob.startswith(b"v1")
    assert decrypt_provider_key(blob) == "sk-abc123-very-secret"


def test_encrypt_produces_unique_ciphertexts(configured_master_key) -> None:
    a = encrypt_provider_key("same-secret")
    b = encrypt_provider_key("same-secret")
    assert a != b


def test_decrypt_rejects_unknown_version(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    blob = encrypt_provider_key("hello")
    bad = b"v9" + blob[2:]
    with pytest.raises(ValueError):
        decrypt_provider_key(bad)


def test_decrypt_rejects_wrong_master(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    blob = encrypt_provider_key("hello")
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    with pytest.raises(ValueError):
        decrypt_provider_key(blob)


def test_encrypt_without_master_key(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", "")
    with pytest.raises(RuntimeError):
        encrypt_provider_key("oops")


def test_mask_provider_key_redacts_middle() -> None:
    assert mask_provider_key("sk-abcdefgh12345678ijklmnop") == "sk-a" + "*" * 16 + "mnop"
    assert mask_provider_key("short") == "*****"
    assert mask_provider_key(None) is None


def test_resolve_user_provider_uses_user_key(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    user = {
        "id": "u1",
        "external_id": "alice",
        "extraction_provider": "gemini",
        "openai_api_key_encrypted": None,
        "gemini_api_key_encrypted": encrypt_provider_key("user-gemini"),
        "anthropic_api_key_encrypted": None,
    }
    resolved = provider_keys.resolve_user_provider(user)
    assert resolved.name == "gemini"
    assert resolved.api_key == "user-gemini"
    assert resolved.source == "user"


def test_resolve_user_provider_override_key_wins(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    user = {
        "id": "u1",
        "external_id": "alice",
        "extraction_provider": "openai",
        "openai_api_key_encrypted": encrypt_provider_key("stored"),
        "gemini_api_key_encrypted": None,
        "anthropic_api_key_encrypted": None,
    }
    resolved = provider_keys.resolve_user_provider(user, override_provider="openai", override_key="ephemeral")
    assert resolved.api_key == "ephemeral"
    assert resolved.source == "override"


def test_resolve_user_provider_rejects_unknown_provider() -> None:
    with pytest.raises(provider_keys.ProviderConfigError):
        provider_keys.resolve_user_provider({"extraction_provider": "deepseek", "openai_api_key_encrypted": None, "gemini_api_key_encrypted": None, "anthropic_api_key_encrypted": None})


def test_resolve_user_provider_rejects_override_for_anthropic() -> None:
    with pytest.raises(provider_keys.ProviderConfigError):
        provider_keys.resolve_user_provider(
            {"extraction_provider": "anthropic", "openai_api_key_encrypted": None, "gemini_api_key_encrypted": None, "anthropic_api_key_encrypted": None},
            override_key="anything",
        )


def test_resolve_user_provider_falls_back_to_server_env(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    monkeypatch.setattr(security.settings, "openai_api_key", "server-openai")
    user = {
        "id": "u1",
        "extraction_provider": "openai",
        "openai_api_key_encrypted": None,
        "gemini_api_key_encrypted": None,
        "anthropic_api_key_encrypted": None,
    }
    resolved = provider_keys.resolve_user_provider(user)
    assert resolved.api_key == "server-openai"
    assert resolved.source == "server"


def test_settings_accepts_engram_prefixed_env_var(monkeypatch) -> None:
    monkeypatch.delenv("ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    import importlib
    import api.config as config_module
    importlib.reload(config_module)
    assert config_module.settings.provider_key_encryption_key


def test_summarize_provider_for_response_masks_key(monkeypatch) -> None:
    monkeypatch.setattr(security.settings, "provider_key_encryption_key", Fernet.generate_key().decode())
    user = {
        "extraction_provider": "openai",
        "openai_api_key_encrypted": encrypt_provider_key("sk-supersecretvalue12345"),
        "gemini_api_key_encrypted": None,
        "anthropic_api_key_encrypted": None,
    }
    summary = provider_keys.summarize_provider_for_response(user)
    assert summary["has_user_api_key"] is True
    assert summary["user_api_key_preview"] is not None
    assert "supersecretvalue" not in summary["user_api_key_preview"]
    assert summary["extraction_provider"] == "openai"
