export function normalizeEmail(raw: string) {
  return String(raw ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}
