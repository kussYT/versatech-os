export function formatServerError(error: unknown) {
  if (error instanceof Error) {
    const code =
      "code" in error && typeof error.code === "string" ? error.code : null;
    return code ? `${error.name} code=${code}` : error.name;
  }

  return "unknown";
}
