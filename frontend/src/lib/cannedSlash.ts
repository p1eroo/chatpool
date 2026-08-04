/** Detecta un comando `/query` justo antes del cursor. */
export function getSlashQuery(
  text: string,
  cursor: number
): { query: string; start: number; end: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|[\s\n])\/([^\s\n]*)$/);
  if (!match) return null;

  const start = before.lastIndexOf("/");
  if (start < 0) return null;

  return {
    query: match[1] ?? "",
    start,
    end: cursor,
  };
}

export function filterCannedBySlashQuery<T extends { title: string; content: string }>(
  items: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
  );
}
