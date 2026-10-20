from api.services.providers.anthropic import AnthropicExtractionProvider
from api.services.providers.base import ExtractionProvider
from api.services.providers.openai import ChatCompletionsExtractionProvider
from api.services.provider_keys import ResolvedProvider


def build_extraction_provider(resolved: ResolvedProvider) -> ExtractionProvider:
    if resolved.name == "anthropic":
        return AnthropicExtractionProvider(resolved)
    if resolved.name in {"openai", "gemini", "ollama"}:
        return ChatCompletionsExtractionProvider(resolved)
    raise RuntimeError(f"Unsupported extraction provider: {resolved.name}")
