import iconv from "iconv-lite";

export function decodeISO88591(buffer: Buffer): string {
  // Some pages declare ISO-8859-1; decode accordingly then treat as UTF-8 internally
  return iconv.decode(buffer, "ISO-8859-1");
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function toSearch(text: string): string {
  const lower = text.toLowerCase();
  // Remove accents
  return lower.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

const dayOrder: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export function dayNameToNum(day: string): number {
  const key = normalizeWhitespace(day.toLowerCase());
  return dayOrder[key] ?? 0;
}

export function extractSedeFromAulaCode(aulaCode: string): string {
  const match = aulaCode.match(/^([A-Z]{2})-/);
  return match ? match[1] : aulaCode;
}

export function buildSectionId(
  termId: string,
  program: string,
  catedraId: number,
  tipo: string,
  label: string
): string {
  return `${termId}_${program}_${catedraId}_${tipo}_${label}`;
}


