import os
from uuid import uuid4

import httpx


def require_success(response: httpx.Response) -> dict[str, object]:
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("Expected a JSON object")
    return payload


def api_headers(api_key: str) -> dict[str, str]:
    return {"X-Engram-Key": api_key}


def main() -> None:
    base_url = os.getenv("ENGRAM_API_URL", "http://localhost:8000").rstrip("/")
    service_key = os.getenv("ENGRAM_SERVICE_KEY", "").strip()
    if not service_key:
        raise RuntimeError("ENGRAM_SERVICE_KEY is required")
    suffix = uuid4().hex
    keys: list[str] = []
    with httpx.Client(base_url=base_url, timeout=60) as client:
        try:
            for index in range(2):
                provisioned = require_success(
                    client.post(
                        "/users/service-key",
                        headers={"X-Engram-Service-Key": service_key},
                        json={
                            "external_id": f"isolation:{suffix}:{index}",
                            "workspace_name": f"Isolation {index}",
                            "key_name": "isolation-test",
                        },
                    )
                )
                keys.append(str(provisioned["api_key"]))
            contents = [f"workspace alpha {suffix}", f"workspace beta {suffix}"]
            memories = [
                require_success(client.post("/memories", headers=api_headers(keys[index]), json={"content": contents[index]}))
                for index in range(2)
            ]
            for index in range(2):
                other_index = 1 - index
                listed = require_success(client.get("/memories", headers=api_headers(keys[index])))
                listed_contents = {str(item["content"]) for item in listed["memories"]}
                if contents[index] not in listed_contents or contents[other_index] in listed_contents:
                    raise RuntimeError("Workspace list isolation failed")
                searched = require_success(
                    client.post(
                        "/memories/search",
                        headers=api_headers(keys[index]),
                        json={"query": suffix, "limit": 20, "threshold": 0},
                    )
                )
                search_contents = {str(item["memory"]["content"]) for item in searched["results"]}
                if contents[other_index] in search_contents:
                    raise RuntimeError("Workspace search isolation failed")
                own_id = str(memories[index]["id"])
                other_id = str(memories[other_index]["id"])
                client.get(f"/memories/{own_id}", headers=api_headers(keys[index])).raise_for_status()
                if client.get(f"/memories/{other_id}", headers=api_headers(keys[index])).status_code != 404:
                    raise RuntimeError("Workspace resource isolation failed")
        finally:
            for api_key in keys:
                client.delete("/users/me", headers=api_headers(api_key))
    print("workspace isolation verified")


if __name__ == "__main__":
    main()
