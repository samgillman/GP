const fallback =
  "The request could not be completed. Check your data and try again.";

function cleanText(text: string): string {
  let lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // Pyodide includes a Python traceback. Start at its final exception line,
  // keeping subsequent Pydantic location/message lines instead of its URL footer.
  const exception =
    /^(?:[A-Za-z_][\w]*\.)*[A-Za-z_][\w]*(?:Error|Exception):\s*/;
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--)
    if (exception.test(lines[i])) {
      start = i;
      break;
    }
  if (start >= 0) lines = lines.slice(start);
  return lines
    .map((line) => line.replace(exception, "").replace(/^Error:\s*/, ""))
    .filter(
      (line) =>
        !/^(?:For further information visit\b|https?:\/\/errors\.pydantic\.dev\/|Traceback\b|File ".*", line \d+|at \S|\^+$|\d+ validation errors? for\b)/i.test(
          line,
        ),
    )
    .map((line) =>
      line
        .replace(/\s*\[type=[\s\S]*$/, "")
        .replace(/^Value error,\s*/i, "")
        .trim(),
    )
    .filter(Boolean)
    .join("; ");
}

/** Return plain text only. Callers must render it as text, never as HTML. */
export function errorMessage(value: unknown): string {
  try {
    if (typeof value === "string") return cleanText(value) || fallback;
    if (value instanceof Error) return cleanText(value.message) || fallback;
    if (typeof value !== "object" || value === null) return fallback;
    const body = value as Record<string, unknown>;
    if (Array.isArray(body.detail)) {
      const messages = body.detail.slice(0, 20).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        if (typeof entry.msg !== "string") return [];
        const message = cleanText(entry.msg);
        if (!message) return [];
        const location = Array.isArray(entry.loc)
          ? entry.loc
              .filter(
                (part) =>
                  (typeof part === "string" || typeof part === "number") &&
                  part !== "body",
              )
              .join(".")
          : "";
        return [location ? `${location}: ${message}` : message];
      });
      return messages.join("; ") || fallback;
    }
    for (const key of ["detail", "error", "message"])
      if (typeof body[key] === "string")
        return cleanText(body[key]) || fallback;
  } catch {
    // Malformed error objects must not trigger another render failure.
  }
  return fallback;
}
