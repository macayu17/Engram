from http.server import BaseHTTPRequestHandler, HTTPServer
import json


class MockOpenAIHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        content_length = int(self.headers.get("content-length", "0"))
        payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        messages = payload.get("messages", [])
        combined_text = json.dumps(messages)
        if "MEMORIES (JSON array only)" in combined_text:
            if "FastAPI" in combined_text and "TypeScript" in combined_text:
                content = json.dumps(
                    [
                        "User prefers FastAPI for backend development",
                        "User prefers TypeScript for frontend work",
                    ]
                )
            else:
                content = "[]"
        elif "[MEMORY CONTEXT]" in combined_text and "FastAPI" in combined_text and "TypeScript" in combined_text:
            content = "Use FastAPI for the backend and TypeScript for the frontend."
        else:
            content = "I recorded your preferences."
        body = {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        }
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    server = HTTPServer(("0.0.0.0", 18080), MockOpenAIHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
