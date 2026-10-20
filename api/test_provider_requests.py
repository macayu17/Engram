import json

import httpx
import pytest

from api.services.providers.factory import build_extraction_provider
from api.services.provider_keys import ResolvedProvider


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_name", ["openai", "gemini", "ollama"])
async def test_chat_extraction_preserves_provider_request(
    monkeypatch: pytest.MonkeyPatch, provider_name: str,
) -> None:
    requests: list[httpx.Request] = []
    timeouts: list[int] = []
    client_type = httpx.AsyncClient

    async def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": '["User prefers Python"]'}}]})

    def create_client(timeout: int) -> httpx.AsyncClient:
        timeouts.append(timeout)
        return client_type(transport=httpx.MockTransport(respond), timeout=timeout)

    monkeypatch.setattr(httpx, "AsyncClient", create_client)
    resolved = ResolvedProvider(provider_name, None if provider_name == "ollama" else "provider-key", "https://provider.test/v1", "model", "test")

    assert await build_extraction_provider(resolved).extract("Extract facts") == ["User prefers Python"]
    assert str(requests[0].url) == "https://provider.test/v1/chat/completions"
    assert timeouts == [120 if provider_name == "ollama" else 60]
    payload = json.loads(requests[0].content)
    assert payload["messages"] == [{"role": "user", "content": "Extract facts"}]
    assert payload["model"] == "model"
    assert payload["temperature"] == 0
    if provider_name == "ollama":
        assert "authorization" not in requests[0].headers
        assert payload["stream"] is False
    else:
        assert requests[0].headers["authorization"] == "Bearer provider-key"


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_name", ["openai", "gemini"])
async def test_paid_extraction_requires_provider_key(provider_name: str) -> None:
    resolved = ResolvedProvider(provider_name, None, "https://provider.test/v1", "model", "test")

    with pytest.raises(RuntimeError, match="API key is required"):
        await build_extraction_provider(resolved).extract("Extract facts")


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code,content,error_type", [
    (401, "bad key", httpx.HTTPStatusError),
    (200, '{"choices":[{"message":{"content":"[123]"}}]}', ValueError),
])
async def test_chat_extraction_rejects_upstream_errors(
    monkeypatch: pytest.MonkeyPatch, status_code: int, content: str, error_type: type[Exception],
) -> None:
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(status_code, text=content))
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: client_type(transport=transport, **kwargs))
    resolved = ResolvedProvider("openai", "provider-key", "https://provider.test/v1", "model", "test")

    with pytest.raises(error_type):
        await build_extraction_provider(resolved).extract("Extract facts")


@pytest.mark.asyncio
async def test_standalone_extraction_resolves_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.config import settings
    from api.test_extraction import main

    captured: list[ResolvedProvider] = []

    async def extract(conversation: str, resolved: ResolvedProvider) -> list[str]:
        assert "FastAPI" in conversation
        captured.append(resolved)
        return []

    monkeypatch.setattr(settings, "extraction_provider", "ollama")
    monkeypatch.setattr("api.services.extraction.extract_memories", extract)

    await main()

    assert captured[0].name == "ollama"
