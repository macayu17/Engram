from api.services.providers.base import ExtractionProvider
from api.services.providers.gemini import GeminiExtractionProvider
from api.services.providers.ollama import OllamaExtractionProvider
from api.services.providers.openai import OpenAIExtractionProvider
from api.services.provider_keys import ResolvedProvider


def build_extraction_provider(resolved: ResolvedProvider) -> ExtractionProvider:
    if resolved.name == "openai":
        return OpenAIExtractionProvider(resolved)
    if resolved.name == "gemini":
        return GeminiExtractionProvider(resolved)
    if resolved.name == "ollama":
        return OllamaExtractionProvider(resolved)
    if resolved.name == "anthropic":
        raise RuntimeError("Anthropic is not yet supported for memory extraction")
    raise RuntimeError(f"Unsupported extraction provider: {resolved.name}")
