from api.services.providers.anthropic import AnthropicExtractionProvider
from api.services.providers.base import ExtractionProvider
from api.services.providers.gemini import GeminiExtractionProvider
from api.services.providers.ollama import OllamaExtractionProvider
from api.services.providers.openai import OpenAIExtractionProvider
from api.services.provider_keys import ResolvedProvider


def build_extraction_provider(resolved: ResolvedProvider) -> ExtractionProvider:
    if resolved.name == "anthropic":
        return AnthropicExtractionProvider(resolved)
    if resolved.name == "openai":
        return OpenAIExtractionProvider(resolved)
    if resolved.name == "gemini":
        return GeminiExtractionProvider(resolved)
    if resolved.name == "ollama":
        return OllamaExtractionProvider(resolved)
    raise RuntimeError(f"Unsupported extraction provider: {resolved.name}")
