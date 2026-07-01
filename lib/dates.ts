function fmtShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** Start date, preferring the range start but falling back to the legacy `date`. */
export function tripStart(t: { startDate?: string; date?: string }): string | undefined {
  return t.startDate ?? t.date;
}

/** "25.10.1 ~ 25.10.4", or a single date, or "날짜 미정". */
export function formatTripRange(start?: string, end?: string): string {
  if (!start) return "날짜 미정";
  if (!end || end === start) return fmtShort(start);
  return `${fmtShort(start)} ~ ${fmtShort(end)}`;
}

/** "3박 4일" for a multi-day range, else "" (single day / no range). */
export function tripNights(start?: string, end?: string): string {
  if (!start || !end || end === start) return "";
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return "";
  const nights = Math.round((e - s) / 86_400_000);
  if (nights <= 0) return "";
  return `${nights}박 ${nights + 1}일`;
}
