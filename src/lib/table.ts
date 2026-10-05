// Table QR codes link to /order?table=5. Until the `tables` table exists, any
// whole number in range is accepted; later this is checked against active tables.
export const MAX_TABLE_NUMBER = 99;

export function parseTableParam(value: string | string[] | undefined): number | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;

  const table = Number(raw);
  return table >= 1 && table <= MAX_TABLE_NUMBER ? table : null;
}

export function withTable(path: string, table: number | null) {
  return table ? `${path}?table=${table}` : path;
}
