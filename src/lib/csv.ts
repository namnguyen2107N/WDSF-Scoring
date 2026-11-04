import type { Athlete, AthleteKind } from '../types';
import { athleteDisplayName } from './constants';
import { normalizeText } from './utils';

export type ParsedAthlete = Omit<Athlete, 'id'>;

export type AthleteImportIssue = {
  line: number;
  message: string;
};

export type AthleteImportResult = {
  rows: ParsedAthlete[];
  issues: AthleteImportIssue[];
  delimiter: string;
  usedHeader: boolean;
  headers: string[];
  totalRows: number;
};

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 8);
  const candidates = ['\t', ';', ','];
  let best = ',';
  let bestScore = 0;
  for (const delimiter of candidates) {
    const counts = lines.map((line) => line.split(delimiter).length);
    const score = counts.reduce((total, count) => total + Math.max(0, count - 1), 0);
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** Bộ phân tích CSV/TSV có hỗ trợ dấu ngoặc kép và xuống dòng trong ô. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field !== '' || row.length) pushRow();
  return rows;
}

function normalizeHeader(header: string): string {
  return normalizeText(header).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const ALIASES: Record<keyof ParsedAthlete | 'name', string[]> = {
  bib: ['sbd', 'so bao danh', 'so bao danh', 'bib', 'stt', 'so', 'ma so', 'sbd '],
  kind: ['loai', 'kind', 'type', 'nhom', 'noi dung'],
  name: ['ten', 'ho ten', 'ten vdv', 'ten van dong vien', 'name', 'ten solo', 'ten thi sinh'],
  male: ['nam', 'ten nam', 'male', 'ban nam', 'partner nam', 'nam vdv'],
  female: ['nu', 'ten nu', 'female', 'ban nu', 'partner nu', 'nu vdv'],
  teamName: ['doi', 'ten doi', 'team', 'team name', 'ten doi nhom', 'ten doi tuyen'],
  unit: ['don vi', 'unit', 'clb', 'cau lac bo', 'donvi', 'don vi cong tac'],
  ageGroup: ['nhom tuoi', 'hang tuoi', 'tuoi', 'age', 'age group', 'nhom'],
  note: ['ghi chu', 'note', 'ghi chu them'],
};

function matchField(header: string): keyof ParsedAthlete | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(ALIASES) as [
    keyof ParsedAthlete,
    string[],
  ][]) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

function resolveKind(
  rawKind: string,
  male: string,
  female: string,
  teamName: string,
  unit: string,
): AthleteKind {
  const kind = normalizeText(rawKind);
  if (male || female) return 'couple';
  if (teamName || unit) return 'team';
  if (kind.includes('couple') || kind.includes('cap') || kind.includes('doi doi')) return 'couple';
  if (kind.includes('team') || kind.includes('do i') || kind.includes('dong dien')) return 'team';
  if (kind === 'doi' || kind === 'đội') return 'team';
  return 'solo';
}

/**
 * Dán từ Excel (tab) hoặc CSV. Nên có hàng tiêu đề:
 * SBD, Loại, Tên, Nam, Nữ, Đội, Đơn vị, Nhóm tuổi
 */
export function parseAthleteImport(text: string): AthleteImportResult {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      rows: [],
      issues: [{ line: 0, message: 'Chưa có dữ liệu để nhập.' }],
      delimiter: ',',
      usedHeader: false,
      headers: [],
      totalRows: 0,
    };
  }
  const delimiter = detectDelimiter(trimmed);
  const matrix = parseDelimited(trimmed, delimiter);
  if (!matrix.length) {
    return {
      rows: [],
      issues: [{ line: 0, message: 'Không đọc được dòng dữ liệu nào.' }],
      delimiter,
      usedHeader: false,
      headers: [],
      totalRows: 0,
    };
  }

  const firstRow = matrix[0].map((cell) => cell.trim());
  const mapped = firstRow.map(matchField);
  const headerLikely = mapped.some(Boolean) && mapped.includes('bib');
  const fieldIndexes: Partial<Record<keyof ParsedAthlete, number>> = {};

  let dataRows: string[][];
  if (headerLikely) {
    mapped.forEach((field, index) => {
      if (field && fieldIndexes[field] === undefined) fieldIndexes[field] = index;
    });
    dataRows = matrix.slice(1);
  } else {
    fieldIndexes.bib = 0;
    fieldIndexes.name = 1;
    fieldIndexes.ageGroup = 2;
    dataRows = matrix;
  }

  const rows: ParsedAthlete[] = [];
  const issues: AthleteImportIssue[] = [];
  const seenBibs = new Set<string>();

  dataRows.forEach((cells, index) => {
    const line = headerLikely ? index + 2 : index + 1;
    const get = (field: keyof ParsedAthlete): string => {
      const cellIndex = fieldIndexes[field];
      return cellIndex === undefined ? '' : (cells[cellIndex] ?? '').trim();
    };
    const bib = get('bib');
    const name = get('name');
    const male = get('male');
    const female = get('female');
    const teamName = get('teamName');
    const unit = get('unit');
    const ageGroup = get('ageGroup');
    const note = get('note');
    const kind = resolveKind(get('kind'), male, female, teamName, unit);

    if (!bib) {
      issues.push({ line, message: 'Thiếu số báo danh – bỏ qua dòng.' });
      return;
    }
    if (seenBibs.has(bib)) {
      issues.push({ line, message: `SBD ${bib} bị trùng trong tệp – bỏ qua.` });
      return;
    }
    if (kind === 'solo' && !name) {
      issues.push({ line, message: `SBD ${bib}: thiếu tên VĐV solo – bỏ qua.` });
      return;
    }
    if (kind === 'couple' && (!male || !female)) {
      issues.push({ line, message: `SBD ${bib}: cần đủ tên Nam và Nữ – bỏ qua.` });
      return;
    }
    if (kind === 'team' && !teamName) {
      issues.push({ line, message: `SBD ${bib}: thiếu tên đội – bỏ qua.` });
      return;
    }
    seenBibs.add(bib);
    rows.push({
      bib,
      kind,
      name: kind === 'solo' ? name : undefined,
      male: kind === 'couple' ? male || undefined : undefined,
      female: kind === 'couple' ? female || undefined : undefined,
      teamName: kind === 'team' ? teamName : undefined,
      unit: unit || undefined,
      ageGroup: ageGroup || undefined,
      note: note || undefined,
    });
  });

  return {
    rows,
    issues,
    delimiter: delimiter === '\t' ? 'Tab' : delimiter,
    usedHeader: headerLikely,
    headers: firstRow,
    totalRows: dataRows.length,
  };
}

export function athleteCsvTemplate(): string {
  return [
    'SBD,Loại,Tên,Nam,Nữ,Đội,Đơn vị,Nhóm tuổi',
    '501,Solo,Nguyễn Văn A,,,,,Trẻ',
    '502,Couple,,Minh Quân,Thu Trang,,,Thanh niên',
    '503,Đội,,,,Đội Mặt Trời,CLB Hà Nội,Mở',
  ].join('\r\n');
}

export function describeAthlete(athlete: ParsedAthlete): string {
  return athleteDisplayName({ ...athlete, id: '' });
}

/** Dán danh sách giám khảo: mỗi dòng "Mã, Họ tên" hoặc "Mã<Tab>Họ tên". */
export function parseJudgeImport(text: string): {
  rows: { code: string; name: string }[];
  issues: string[];
} {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { rows: [], issues: ['Chưa có dữ liệu.'] };
  const delimiter = detectDelimiter(trimmed);
  const matrix = parseDelimited(trimmed, delimiter);
  const rows: { code: string; name: string }[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  matrix.forEach((cells, index) => {
    const first = (cells[0] ?? '').trim();
    const rest = cells.slice(1).map((c) => c.trim()).filter(Boolean).join(' ').trim();
    if (!first && !rest) return;
    if (normalizeText(first) === 'ma' || normalizeText(first) === 'ma giam khao') return;
    const code = first.toUpperCase();
    const name = rest || (cells.length === 1 ? '' : first);
    if (!code || !name) {
      issues.push(`Dòng ${index + 1}: cần đủ mã và họ tên.`);
      return;
    }
    if (seen.has(code)) {
      issues.push(`Dòng ${index + 1}: mã ${code} bị trùng.`);
      return;
    }
    seen.add(code);
    rows.push({ code, name });
  });
  return { rows, issues };
}
