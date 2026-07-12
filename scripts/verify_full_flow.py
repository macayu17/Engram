import json
import os
import socket
import subprocess
import sys
import time
from http.client import RemoteDisconnected
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
API_URL = "http://127.0.0.1:8000"
DASHBOARD_URL = "http://127.0.0.1:3001"
MOCK_PROVIDER_PORT = 18080


def command_name(name: str) -> str:
    return f"{name}.cmd" if os.name == "nt" else name


def run_command(command: list[str], cwd: Path, env: dict[str, str] | None = None) -> None:
    completed = subprocess.run(command, cwd=cwd, env=env, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {completed.returncode}: {' '.join(command)}")


def json_request(
    method: str,
    url: str,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, Any], dict[str, str]]:
    encoded_body = json.dumps(body).encode("utf-8") if body is not None else None
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    request = Request(url, data=encoded_body, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            raw_body = response.read().decode("utf-8")
            payload = json.loads(raw_body) if raw_body else {}
            return response.status, payload, dict(response.headers)
    except HTTPError as error:
        raw_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with {error.code}: {raw_body}") from error
    except URLError as error:
        raise RuntimeError(f"{method} {url} failed: {error}") from error


def wait_for_socket(host: str, port: int, timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                return
        except OSError:
            time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {host}:{port}")


def wait_for_api(timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            _, payload, _ = json_request("GET", f"{API_URL}/health")
            if payload.get("status") == "ok" and payload.get("database") == "connected":
                return
        except RuntimeError as error:
            last_error = str(error)
        time.sleep(5)
    raise RuntimeError(f"Timed out waiting for API health: {last_error}")


def wait_for_database_unavailable(timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            json_request("GET", f"{API_URL}/health")
        except RuntimeError as error:
            last_error = str(error)
            if "503" in last_error and "Database unavailable" in last_error:
                return
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for database unavailable health state: {last_error}")


def wait_for_dashboard(timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            request = Request(DASHBOARD_URL, method="GET")
            with urlopen(request, timeout=20) as response:
                if response.status == 200:
                    return
        except (HTTPError, URLError, TimeoutError, RemoteDisconnected) as error:
            last_error = str(error)
        time.sleep(5)
    raise RuntimeError(f"Timed out waiting for dashboard: {last_error}")


def wait_for_memories(api_key: str, minimum_count: int, timeout_seconds: int) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    headers = {"X-Engram-Key": api_key}
    last_payload: dict[str, Any] = {}
    while time.time() < deadline:
        _, pending_payload, _ = json_request("GET", f"{API_URL}/memories?limit=20&offset=0&status=pending", headers=headers)
        for memory in pending_payload.get("memories", []):
            json_request("PATCH", f"{API_URL}/memories/{memory['id']}", {"status": "approved"}, headers)
        _, payload, _ = json_request("GET", f"{API_URL}/memories?limit=20&offset=0", headers=headers)
        last_payload = payload
        if len(payload.get("memories", [])) >= minimum_count:
            return payload
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for extracted memories: {json.dumps(last_payload)}")


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def get_header(headers: dict[str, str], name: str, fallback: str = "") -> str:
    normalized_name = name.lower()
    for header_name, value in headers.items():
        if header_name.lower() == normalized_name:
            return value
    return fallback


def main() -> None:
    compose_env = os.environ.copy()
    postgres_stopped = False
    mock_provider = subprocess.Popen(
        [sys.executable, str(ROOT / "scripts" / "mock_openai_provider.py")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    api_key = ""
    user_deleted = False
    try:
        wait_for_socket("127.0.0.1", MOCK_PROVIDER_PORT, 30)
        compose_env.update(
            {
                "POSTGRES_PASSWORD": "engram_dev_password",
                "DATABASE_URL": "postgresql://engram:engram_dev_password@postgres:5432/engram",
                "EXTRACTION_PROVIDER": "openai",
                "OPENAI_API_KEY": "mock-openai-key",
                "OPENAI_BASE_URL": f"http://host.docker.internal:{MOCK_PROVIDER_PORT}/v1",
                "EXTRACTION_MODEL": "gpt-4o-mini",
                "API_PUBLIC_URL": API_URL,
                "MCP_SERVICE_KEY": "",
                "ENGRAM_SERVICE_KEY": "mock-service-key",
                "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "",
                "CLERK_SECRET_KEY": "",
            }
        )
        run_command(["docker", "compose", "up", "-d", "--build", "postgres", "api", "dashboard"], ROOT, compose_env)
        wait_for_api(300)
        run_command(["docker", "compose", "exec", "-T", "api", "python", "-m", "api.apply_schema"], ROOT, compose_env)
        wait_for_api(60)
        wait_for_dashboard(180)
        external_id = f"full_flow_{uuid4()}"
        _, user_payload, _ = json_request("POST", f"{API_URL}/users", {"external_id": external_id})
        api_key = str(user_payload["api_key"])
        _, config_payload, _ = json_request(
            "PATCH",
            f"{API_URL}/users/me/config",
            {"max_memories_injected": 1, "retrieval_threshold": 0, "dedup_threshold": 0.91},
            {"X-Engram-Key": api_key},
        )
        assert_true(config_payload["max_memories_injected"] == 1, "User config did not save max_memories_injected")
        assert_true(config_payload["retrieval_threshold"] == 0, "User config did not save retrieval_threshold")
        assert_true(config_payload["dedup_threshold"] == 0.91, "User config did not save dedup_threshold")
        auth_headers = {
            "X-Engram-Key": api_key,
            "X-Engram-User-ID": external_id,
            "X-Engram-Provider": "openai",
        }
        first_body = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "user",
                    "content": "I prefer FastAPI for backend development and TypeScript for frontend work.",
                }
            ],
        }
        _, first_payload, first_headers = json_request("POST", f"{API_URL}/v1/chat", first_body, auth_headers)
        assert_true(first_payload["choices"][0]["message"]["content"] == "I recorded your preferences.", "First proxy call did not return mock provider response")
        assert_true(get_header(first_headers, "X-Engram-Conversation-ID") != "", "First proxy call did not return a conversation id")
        memories_payload = wait_for_memories(api_key, 2, 90)
        memory_contents = " ".join(memory["content"] for memory in memories_payload["memories"])
        assert_true("FastAPI" in memory_contents and "TypeScript" in memory_contents, "Extraction did not store expected memories")
        second_body = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "What tech stack should I use for my next project?"}],
        }
        _, second_payload, second_headers = json_request("POST", f"{API_URL}/v1/chat", second_body, auth_headers)
        injected_count = int(get_header(second_headers, "X-Engram-Memories-Injected", "0"))
        assert_true(injected_count == 1, "Second proxy call did not respect max_memories_injected user config")
        completions_headers = {"Authorization": f"Bearer {api_key}"}
        _, completions_payload, completions_response_headers = json_request(
            "POST", f"{API_URL}/v1/chat/completions", second_body, completions_headers
        )
        assert_true(
            completions_payload["choices"][0]["message"]["content"] == "I recorded your preferences.",
            "OpenAI-compatible route did not return mock provider response",
        )
        assert_true(
            int(get_header(completions_response_headers, "X-Engram-Memories-Injected", "0")) == 1,
            "OpenAI-compatible route did not inject memories",
        )
        run_command(["docker", "compose", "stop", "postgres"], ROOT, compose_env)
        postgres_stopped = True
        wait_for_database_unavailable(60)
        third_body = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Can you still answer while the memory database is unavailable?"}],
        }
        _, third_payload, third_headers = json_request("POST", f"{API_URL}/v1/chat", third_body, auth_headers)
        assert_true(third_payload["choices"][0]["message"]["content"] == "I recorded your preferences.", "Proxy did not forward while database was unavailable")
        assert_true(int(get_header(third_headers, "X-Engram-Memories-Injected", "0")) == 0, "Database fallback proxy call should not inject memories")
        wait_for_database_unavailable(10)
        run_command(["docker", "compose", "up", "-d", "postgres"], ROOT, compose_env)
        postgres_stopped = False
        wait_for_api(180)
        _, logs_payload, _ = json_request("GET", f"{API_URL}/logs?limit=20&offset=0", headers={"X-Engram-Key": api_key})
        assert_true(logs_payload["total"] == 3, "Database fallback proxy call should not create a retrieval log")
        run_command([command_name("npm"), "run", "build"], ROOT / "mcp")
        mcp_env = os.environ.copy()
        mcp_env.update({"ENGRAM_API_URL": API_URL, "ENGRAM_API_KEY": api_key})
        completed_mcp = subprocess.run(
            ["node", str(ROOT / "scripts" / "verify_mcp_tools.mjs")],
            cwd=ROOT,
            env=mcp_env,
            text=True,
            capture_output=True,
        )
        if completed_mcp.returncode != 0:
            raise RuntimeError(completed_mcp.stderr or completed_mcp.stdout)
        mcp_payload = json.loads(completed_mcp.stdout)
        assert_true(all(mcp_payload.values()), f"MCP tool verification failed: {completed_mcp.stdout}")
        json_request("DELETE", f"{API_URL}/users/me", headers={"X-Engram-Key": api_key})
        user_deleted = True
        sys.stdout.write(json.dumps({
            "proxyFirstCall": True,
            "extractionStoredMemories": len(memories_payload["memories"]),
            "proxySecondCallInjected": injected_count,
            "proxyForwardedDuringDatabaseOutage": True,
            "logsTotal": logs_payload["total"],
            "dashboardReachable": True,
            "mcpTools": mcp_payload,
            "cleanupUserDeleted": user_deleted,
            "userConfigApplied": config_payload,
        }) + "\n")
    finally:
        if postgres_stopped:
            try:
                run_command(["docker", "compose", "up", "-d", "postgres"], ROOT, compose_env)
                wait_for_api(180)
            except RuntimeError:
                pass
        if api_key and not user_deleted:
            try:
                json_request("DELETE", f"{API_URL}/users/me", headers={"X-Engram-Key": api_key})
            except RuntimeError:
                pass
        mock_provider.terminate()
        try:
            mock_provider.wait(timeout=10)
        except subprocess.TimeoutExpired:
            mock_provider.kill()


if __name__ == "__main__":
    main()
