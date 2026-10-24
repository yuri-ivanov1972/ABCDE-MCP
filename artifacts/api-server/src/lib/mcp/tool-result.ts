export const MAX_TOOL_RESULT_BYTES = 256 * 1024;

export function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function jsonToolResult<T extends object>(
  value: T,
  summary: string,
) {
  // Some clients expose content, but not structuredContent, to the model.
  // A separate JSON text block stays parseable even when catalogue strings
  // contain quotes, newlines, Markdown fences, or instruction-like text.
  const result = {
    content: [
      { type: "text" as const, text: summary },
      { type: "text" as const, text: JSON.stringify(value) },
    ],
    structuredContent: value as Record<string, unknown>,
  };
  // Bound the entire serialized result, including both copies, escaped JSON
  // text, the summary, and content-block overhead (not just the source value).
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_TOOL_RESULT_BYTES) {
    return errorResult(
      "The verified result is too large. Request fewer products or a smaller basket.",
    );
  }
  return result;
}
