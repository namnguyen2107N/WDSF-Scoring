import type {
  AppState,
  Athlete,
  Criterion,
  Dance,
  DanceEvent,
  HistoryEntry,
  Judge,
  RoundMarks,
} from '../types';
import { buildDefaultEvents, defaultEventTemplates } from '../lib/constants';
import { computeSemifinal } from '../lib/semifinal';
import { createGroupScores, createRoundMarks } from '../lib/rounds';
import { nowISO } from '../lib/utils';

// ---------------------------------------------------------------------------
// Sinh dữ liệu mẫu 1 giải giả lập: 7 giám khảo, 24 VĐV, 7 sự kiện có dữ liệu
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SAMPLE_JUDGES: Judge[] = [
  { id: 'judge-a', code: 'A', name: 'Nguyễn Thu Hằng' },
  { id: 'judge-b', code: 'B', name: 'Trần Quốc Bảo' },
  { id: 'judge-c', code: 'C', name: 'Lê Hoàng Nam' },
  { id: 'judge-d', code: 'D', name: 'Phạm Ngọc Anh' },
  { id: 'judge-e', code: 'E', name: 'Vũ Đức Thịnh' },
  { id: 'judge-f', code: 'F', name: 'Đỗ Mai Linh' },
  { id: 'judge-g', code: 'G', name: 'Hoàng Thanh Tùng' },
];

const SOLO_NAMES = [
  'Nguyễn Khánh Linh',
  'Trần Minh Anh',
  'Lê Bảo Ngọc',
  'Phạm Hải Yến',
  'Vũ Hoàng My',
  'Đỗ Gia Hân',
  'Hoàng Nhật Minh',
  'Bùi Thanh Trúc',
  'Ngô Khánh Vy',
  'Đặng Quỳnh Anh',
  'Trịnh Gia Bảo',
  'Lý Mai Chi',
];

const COUPLES: [string, string][] = [
  ['Minh Quân', 'Thu Trang'],
  ['Đức Anh', 'Ngọc Diệp'],
  ['Hoàng Long', 'Mai Phương'],
  ['Tuấn Kiệt', 'Thanh Hà'],
  ['Quốc Huy', 'Kim Ngân'],
  ['Văn Nam', 'Thuỳ Dương'],
  ['Gia Hưng', 'Bảo Châu'],
  ['Đình Phong', 'Hải Yến'],
];

const TEAMS: [string, string][] = [
  ['Ánh Sáng', 'CLB Sao Mai'],
  ['Sắc Màu', 'CLB Hà Nội'],
  ['Bình Minh', 'CLB Đà Nẵng'],
  ['Gió Mùa', 'CLB Sài Gòn'],
];

const AGE_GROUPS = ['Trẻ', 'Thanh niên', 'Trung niên'];

const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'crit-1', name: 'Kỹ thuật', min: 0, max: 10, step: 0.1 },
  { id: 'crit-2', name: 'Độ chính xác nhịp điệu', min: 0, max: 10, step: 0.1 },
  { id: 'crit-3', name: 'Cảm xúc & biểu cảm', min: 0, max: 10, step: 0.1 },
  { id: 'crit-4', name: 'Hình thể & tư thế', min: 0, max: 10, step: 0.1 },
  { id: 'crit-5', name: 'Trình diễn & kết nối', min: 0, max: 10, step: 0.1 },
];

export function buildSampleAthletes(): Athlete[] {
  const solo: Athlete[] = SOLO_NAMES.map((name, index) => ({
    id: `ath-solo-${index + 1}`,
    bib: String(101 + index),
    kind: 'solo',
    name,
    ageGroup: AGE_GROUPS[index % AGE_GROUPS.length],
  }));

  const couples: Athlete[] = COUPLES.map(([male, female], index) => ({
    id: `ath-couple-${index + 1}`,
    bib: String(201 + index),
    kind: 'couple',
    male,
    female,
    ageGroup: AGE_GROUPS[index % AGE_GROUPS.length],
  }));

  const teams: Athlete[] = TEAMS.map(([teamName, unit], index) => ({
    id: `ath-team-${index + 1}`,
    bib: String(301 + index),
    kind: 'team',
    teamName,
    unit,
    ageGroup: 'Mở',
  }));

  return [...solo, ...couples, ...teams];
}

export function skillMap(athletes: Athlete[], seed = 20261114): Record<string, number> {
  const rng = mulberry32(seed);
  return Object.fromEntries(
    athletes.map((athlete) => [athlete.id, 65 + rng() * 20]),
  );
}

function shuffledOrder(
  athleteIds: string[],
  skills: Record<string, number>,
  rng: () => number,
  spread = 14,
): string[] {
  const scored = athleteIds.map((id) => ({
    id,
    score: (skills[id] ?? 70) + rng() * spread,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.id);
}

function makeSemifinalMarks(
  dances: Dance[],
  allJudges: Judge[],
  filledJudges: Judge[],
  athleteIds: string[],
  skills: Record<string, number>,
  rng: () => number,
): RoundMarks {
  const round = createRoundMarks(dances, allJudges.map((j) => j.id), athleteIds, 6);
  for (const dance of dances) {
    for (const judge of filledJudges) {
      const order = shuffledOrder(athleteIds, skills, rng, 20).slice(0, 6);
      round.marks[dance][judge.id] = order;
    }
  }
  return round;
}

function makeFinalMarks(
  dances: Dance[],
  allJudges: Judge[],
  filledJudges: Judge[],
  athletes: string[],
  skills: Record<string, number>,
  rng: () => number,
): RoundMarks {
  const round = createRoundMarks(dances, allJudges.map((j) => j.id), athletes, athletes.length);
  for (const dance of dances) {
    for (const judge of filledJudges) {
      const order = shuffledOrder(athletes, skills, rng, 17);
      round.marks[dance][judge.id] = order;
    }
  }
  round.completedAt = nowISO();
  return round;
}

function findEvent(events: DanceEvent[], name: string): DanceEvent {
  const event = events.find((e) => e.name === name);
  if (!event) throw new Error(`Không tìm thấy sự kiện mẫu: ${name}`);
  return event;
}

function addRegistration(event: DanceEvent, ids: string[]): void {
  event.athleteIds = [...new Set([...event.athleteIds, ...ids])];
}

export function createSampleState(): AppState {
  const events = buildDefaultEvents();
  const athletes = buildSampleAthletes();
  const judges = SAMPLE_JUDGES;
  const skills = skillMap(athletes);
  const rng = mulberry32(987654321);
  const solo = athletes.filter((a) => a.kind === 'solo').map((a) => a.id);
  const couples = athletes.filter((a) => a.kind === 'couple').map((a) => a.id);
  const teams = athletes.filter((a) => a.kind === 'team').map((a) => a.id);

  // 1. Solo Latin 5 điệu – 9 VĐV, có bán kết, đã hoàn tất
  const e1 = findEvent(events, 'Solo Latin – 5 điệu');
  addRegistration(e1, solo.slice(0, 9));
  e1.semifinal = makeSemifinalMarks(e1.dances, judges, judges, e1.athleteIds, skills, rng);
  const semi1 = computeSemifinal({
    contestantIds: e1.athleteIds,
    judgeIds: judges.map((j) => j.id),
    dances: e1.dances,
    marks: e1.semifinal.marks,
  });
  e1.finalists = semi1.qualifiers;
  const finalists1 = semi1.qualifiers;
  e1.final = makeFinalMarks(e1.dances, judges, judges, finalists1, skills, rng);
  e1.status = 'done';

  // 2. Couple Latin 3 điệu – 8 VĐV, có bán kết, đã hoàn tất
  const e2 = findEvent(events, 'Couple Latin – 3 điệu');
  addRegistration(e2, couples.slice(0, 8));
  e2.semifinal = makeSemifinalMarks(e2.dances, judges, judges, e2.athleteIds, skills, rng);
  const semi2 = computeSemifinal({
    contestantIds: e2.athleteIds,
    judgeIds: judges.map((j) => j.id),
    dances: e2.dances,
    marks: e2.semifinal.marks,
  });
  e2.finalists = semi2.qualifiers;
  const finalists2 = semi2.qualifiers;
  e2.final = makeFinalMarks(e2.dances, judges, judges, finalists2, skills, rng);
  e2.status = 'done';

  // 3. Standard Tango – 7 VĐV, đang bán kết (4/7 giám khảo đã nhập)
  const e3 = findEvent(events, 'Solo Standard – Tango');
  addRegistration(e3, [solo[0], solo[2], solo[4], solo[6], solo[8], solo[10], solo[11]]);
  e3.semifinal = makeSemifinalMarks(
    e3.dances,
    judges,
    judges.slice(0, 4),
    e3.athleteIds,
    skills,
    rng,
  );
  e3.status = 'semifinal';

  // 4. Newbie Couple Cha cha cha – 5 VĐV, chung kết trực tiếp, hoàn tất
  const e4 = findEvent(events, 'Newbie Couple – Cha cha cha');
  addRegistration(e4, couples.slice(0, 5));
  e4.finalists = [...e4.athleteIds];
  e4.final = makeFinalMarks(e4.dances, judges, judges, e4.finalists, skills, rng);
  e4.status = 'done';

  // 5. Đồng diễn – 4 đội, đã hoàn tất, bật bỏ điểm cao nhất/thấp nhất
  const e5 = findEvent(events, 'Đồng diễn');
  addRegistration(e5, teams);
  e5.status = 'done';
  e5.dropHighLow = true;
  e5.groupScores = createGroupScores(judges.map((j) => j.id), e5.athleteIds, DEFAULT_CRITERIA);
  const groupScores = e5.groupScores;
  for (const judge of judges) {
    for (const teamId of e5.athleteIds) {
      for (const criterion of DEFAULT_CRITERIA) {
        const value = Math.round((6.4 + rng() * 3.2) * 10) / 10;
        groupScores[judge.id][teamId][criterion.id] = value;
      }
    }
  }

  // 6. Solo Samba – 7 VĐV, chưa thi
  const e6 = findEvent(events, 'Solo Latin – Samba');
  addRegistration(e6, [
    solo[1],
    solo[3],
    solo[5],
    solo[7],
    solo[9],
    solo[10],
    solo[11],
  ]);

  // 7. Solo Slow Waltz – 5 VĐV, chung kết đang chấm (3/7 giám khảo)
  const e7 = findEvent(events, 'Solo Standard – Slow Waltz');
  addRegistration(e7, [solo[1], solo[2], solo[3], solo[4], solo[5]]);
  e7.finalists = [...e7.athleteIds];
  e7.final = makeFinalMarks(
    e7.dances,
    judges,
    judges.slice(0, 3),
    e7.finalists,
    skills,
    rng,
  );
  e7.status = 'final';

  const now = Date.now();
  const history: HistoryEntry[] = [
    {
      id: 'hist-1',
      at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      actor: 'Ban thư ký',
      action: 'Khởi tạo giải',
      detail: 'Dữ liệu mẫu gồm 7 giám khảo, 24 VĐV/đội và 7 sự kiện có kết quả.',
    },
    {
      id: 'hist-2',
      at: new Date(now - 2.5 * 60 * 60 * 1000).toISOString(),
      actor: 'Ban thư ký',
      action: 'Chốt bán kết',
      detail: 'Solo Latin – 5 điệu: 6 VĐV vào chung kết.',
      eventId: e1.id,
    },
    {
      id: 'hist-3',
      at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      actor: 'Ban thư ký',
      action: 'Hoàn tất sự kiện',
      detail: 'Solo Latin – 5 điệu đã khóa kết quả.',
      eventId: e1.id,
    },
    {
      id: 'hist-4',
      at: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
      actor: 'Ban thư ký',
      action: 'Hoàn tất sự kiện',
      detail: 'Couple Latin – 3 điệu đã khóa kết quả.',
      eventId: e2.id,
    },
    {
      id: 'hist-5',
      at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      actor: 'Ban thư ký',
      action: 'Hoàn tất sự kiện',
      detail: 'Đồng diễn đã khóa kết quả (áp dụng bỏ điểm cao nhất và thấp nhất).',
      eventId: e5.id,
    },
  ];

  return {
    version: 1,
    settings: {
      competitionName: 'Giải Khiêu vũ Thể thao Mở rộng 2026',
      venue: 'Nhà thi đấu Phú Thọ, TP. Hồ Chí Minh',
      eventDate: '2026-11-14',
      president: 'Trần Minh Quân',
      secretary: 'Lê Thu Hà',
      criteria: DEFAULT_CRITERIA,
    },
    judges,
    athletes,
    events,
    history,
  };
}

export function settingsDefaults() {
  return {
    competitionName: 'Giải Khiêu vũ Thể thao',
    venue: '',
    eventDate: new Date().toISOString().slice(0, 10),
    president: 'Chủ tịch hội đồng',
    secretary: 'Ban thư ký',
    criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })),
  };
}

export function createEmptyState(): AppState {
  const now = nowISO();
  return {
    version: 1,
    settings: settingsDefaults(),
    judges: [],
    athletes: [],
    events: defaultEventTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      dances: t.dances,
      athleteIds: [],
      status: 'pending',
      resolutions: [],
      createdAt: now,
      updatedAt: now,
    })),
    history: [
      {
        id: 'hist-empty',
        at: now,
        actor: 'Hệ thống',
        action: 'Tạo giải mới',
        detail: 'Bắt đầu với danh sách sự kiện mặc định, chưa có giám khảo và VĐV.',
      },
    ],
  };
}

export { DEFAULT_CRITERIA };
