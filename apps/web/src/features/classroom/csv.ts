/** Minimal RFC 4180 parser: quotes, escaped quotes, CRLF/LF, UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface RosterRow {
  email: string;
  student_code: string;
  display_name: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const headerAliases: Record<keyof RosterRow, string[]> = {
  email: ['email', 'e-mail', 'อีเมล', 'email address', 'อีเมลแอดเดรส'],
  student_code: ['student_code', 'student id', 'รหัส', 'รหัสนักเรียน', 'รหัสนักศึกษา', 'id'],
  display_name: ['display_name', 'name', 'ชื่อ', 'ชื่อ-สกุล', 'ชื่อ-นามสกุล', 'full name'],
};

/** Maps a CSV (with header row) to roster rows; also accepts a Google Classroom/Sheets export. */
export function rosterFromCsv(rows: string[][]): {
  valid: RosterRow[];
  invalid: { line: number; value: string }[];
} {
  const [header, ...body] = rows;
  if (!header) return { valid: [], invalid: [] };
  const norm = header.map((h) => h.trim().toLowerCase());
  const col = (key: keyof RosterRow) => norm.findIndex((h) => headerAliases[key].includes(h));
  let emailCol = col('email');
  if (emailCol < 0)
    emailCol = norm.findIndex((_, i) => body.some((r) => EMAIL.test((r[i] ?? '').trim())));
  const codeCol = col('student_code');
  const nameCol = col('display_name');
  const seen = new Set<string>();
  const valid: RosterRow[] = [];
  const invalid: { line: number; value: string }[] = [];
  body.forEach((r, i) => {
    const email = (r[emailCol] ?? '').trim().toLowerCase();
    if (!EMAIL.test(email)) {
      invalid.push({ line: i + 2, value: r.join(', ') });
      return;
    }
    if (seen.has(email)) return;
    seen.add(email);
    valid.push({
      email,
      student_code: codeCol >= 0 ? (r[codeCol] ?? '').trim() : '',
      display_name: nameCol >= 0 ? (r[nameCol] ?? '').trim() : '',
    });
  });
  return { valid, invalid };
}

export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
