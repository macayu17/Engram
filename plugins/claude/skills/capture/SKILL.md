---
name: capture
description: Deliberately capture a useful conversation exchange into Engram for extraction and pending review.
---

When the user asks to remember an exchange, call capture_conversation with the actual user_message and assistant_response. Do not invent statements or send the entire host transcript. Omit secrets, credentials and unrelated personal information. Set namespace to the selected project, source to the current client name, and session_id only when the client actually provides one. Report the returned conversation or job identifier and status. Explain that extraction is asynchronous and inferred facts require review before recall. A queued capture is not proof that facts were saved or approved. This plugin cannot automatically intercept host conversations.
