function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextContentBlocks(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (!isRecord(part)) {
        return "";
      }
      const text = part.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function extractChatResponseContent(payload: unknown): string {
  if (!isRecord(payload)) {
    return String(payload ?? "");
  }
  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0 && isRecord(choices[0])) {
    const message = choices[0].message;
    if (isRecord(message) && typeof message.content === "string") {
      return message.content;
    }
    if (typeof choices[0].text === "string") {
      return choices[0].text;
    }
  }
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (typeof payload.content === "string") {
    return payload.content;
  }
  const contentBlocks = extractTextContentBlocks(payload.content);
  if (contentBlocks) {
    return contentBlocks;
  }
  return JSON.stringify(payload);
}
