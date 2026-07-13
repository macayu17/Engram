import logging
from dataclasses import dataclass
from typing import Literal

import asyncpg

from api.config import settings
from api.services.security import decrypt_provider_key, mask_provider_key


logger = logging.getLogger(__name__)

ProviderName = Literal["openai", "gemini", "ollama", "anthropic"]
_ALLOWED_PROVIDERS: frozenset[str] = frozenset({"openai", "gemini", "ollama", "anthropic"})
_OVERRIDE_HEADER_PROVIDER: str = "x-engram-provider-key"
_PROVIDER_KEY_COLUMNS: dict[str, str] = {
    "openai": "openai_api_key_encrypted",
    "gemini": "gemini_api_key_encrypted",
    "anthropic": "anthropic_api_key_encrypted",
}


class ProviderConfigError(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedProvider:
    name: str
    api_key: str | None
    base_url: str
    model: str
    source: str


def normalize_provider_name(raw_name: str | None) -> str:
    if raw_name is None:
        raise ProviderConfigError("Provider is required")
    candidate = raw_name.strip().lower()
    if not candidate:
        raise ProviderConfigError("Provider is required")
    if candidate not in _ALLOWED_PROVIDERS:
        raise ProviderConfigError(
            f"Unsupported provider '{raw_name}'. Allowed: {sorted(_ALLOWED_PROVIDERS)}",
        )
    return candidate


def resolve_user_provider(
    user: asyncpg.Record | dict[str, object],
    override_provider: str | None = None,
    override_key: str | None = None,
) -> ResolvedProvider:
    chosen = normalize_provider_name(override_provider) if override_provider else normalize_provider_name(
        str(user.get("extraction_provider") or "openai"),
    )
    base_url, fallback_model = _base_url_and_model_for(chosen)
    api_key: str | None = None
    source = "local" if chosen == "ollama" else "workspace"
    if override_key:
        if not _override_key_supported(chosen):
            raise ProviderConfigError(
                f"Per-request provider key override is not supported for '{chosen}'",
            )
        api_key = override_key.strip()
        source = "override"
    if not api_key:
        decrypted = _decrypt_user_provider_key(user, chosen)
        if decrypted:
            api_key = decrypted
            source = "user"
    if not api_key and chosen != "ollama" and not settings.engram_service_key:
        api_key = _server_default_key(chosen)
        if api_key:
            source = "server"
    if not api_key and chosen != "ollama":
        raise ProviderConfigError("Configure a provider API key for this workspace")
    model = str(user.get("extraction_model") or fallback_model) if hasattr(user, "get") and user.get("extraction_model") else fallback_model
    return ResolvedProvider(name=chosen, api_key=api_key, base_url=base_url, model=model, source=source)


def _override_key_supported(provider: str) -> bool:
    return provider in {"openai", "gemini", "anthropic"}


def _base_url_and_model_for(provider: str) -> tuple[str, str]:
    if provider == "openai":
        return settings.openai_base_url, settings.extraction_model
    if provider == "gemini":
        return settings.gemini_base_url, settings.extraction_model
    if provider == "ollama":
        return f"{settings.ollama_base_url.rstrip('/')}/v1", settings.ollama_model
    return settings.anthropic_base_url, settings.extraction_model


def _decrypt_user_provider_key(user: asyncpg.Record | dict[str, object], provider: str) -> str | None:
    column = _PROVIDER_KEY_COLUMNS.get(provider)
    if column is None:
        return None
    blob = user.get(column)
    if blob is None:
        return None
    try:
        return decrypt_provider_key(blob)
    except (ValueError, RuntimeError) as error:
        logger.error("Failed to decrypt stored %s key for user %s: %s", provider, user.get("id"), error)
        raise ProviderConfigError(
            f"Stored {provider} API key could not be decrypted. Rotate the master key or re-save the key in Settings.",
        ) from error


def _server_default_key(provider: str) -> str | None:
    if provider == "openai":
        return settings.openai_api_key or None
    if provider == "gemini":
        return settings.gemini_api_key or None
    if provider == "anthropic":
        return settings.anthropic_api_key or None
    return None


def summarize_provider_for_response(
    user: asyncpg.Record | dict[str, object],
) -> dict[str, object]:
    chosen = normalize_provider_name(str(user.get("extraction_provider") or "openai"))
    decrypted = _decrypt_user_provider_key(user, chosen)
    return {
        "extraction_provider": chosen,
        "extraction_model": str(user.get("extraction_model") or settings.extraction_model),
        "has_user_api_key": decrypted is not None,
        "user_api_key_preview": mask_provider_key(decrypted),
    }
