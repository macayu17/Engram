import pytest


@pytest.fixture
def inline_capture_jobs(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import extraction, jobs

    queued: dict[str, object] = {}

    async def persist(*args: object) -> bool:
        queued["args"] = args
        return True

    async def claim(*args: object, **kwargs: object) -> dict[str, object]:
        return queued

    async def process(*args: object, **kwargs: object) -> tuple[int, list[str]]:
        values = queued["args"]
        return await extraction.process_conversation_memories(
            values[0], values[1], values[2], values[3], values[4],
            extraction.build_conversation_text(values[3], values[4]), values[5], values[6], values[7], values[8],
        )

    monkeypatch.setattr(jobs, "persist_job", persist)
    monkeypatch.setattr(jobs, "claim_job", claim)
    monkeypatch.setattr(jobs, "process_claimed_job", process)
