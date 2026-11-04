import type {
  Athlete,
  AthleteKind,
  CategoryId,
  Dance,
  DanceEvent,
  EventStatus,
} from '../types';

export const DANCE_INFO: Record<
  Dance,
  { name: string; short: string; group: 'Latin' | 'Standard' }
> = {
  S: { name: 'Samba', short: 'S', group: 'Latin' },
  C: { name: 'Cha cha cha', short: 'C', group: 'Latin' },
  R: { name: 'Rumba', short: 'R', group: 'Latin' },
  J: { name: 'Jive', short: 'J', group: 'Latin' },
  PD: { name: 'Paso Doble', short: 'PD', group: 'Latin' },
  SW: { name: 'Slow Waltz', short: 'SW', group: 'Standard' },
  T: { name: 'Tango', short: 'T', group: 'Standard' },
  VW: { name: 'Viennese Waltz', short: 'VW', group: 'Standard' },
  SF: { name: 'Slow Foxtrot', short: 'SF', group: 'Standard' },
  Q: { name: 'Quickstep', short: 'Q', group: 'Standard' },
};

export const ALL_DANCES = Object.keys(DANCE_INFO) as Dance[];
export const LATIN_DANCES: Dance[] = ['S', 'C', 'R', 'PD', 'J'];
export const STANDARD_DANCES: Dance[] = ['SW', 'T', 'VW', 'SF', 'Q'];

export function danceLabel(dance: Dance): string {
  return `${DANCE_INFO[dance].name} (${DANCE_INFO[dance].short})`;
}

export function danceNames(dances: Dance[]): string {
  return dances.map((d) => DANCE_INFO[d].name).join(' · ');
}

export type CategoryInfo = {
  id: CategoryId;
  label: string;
  short: string;
  kind: AthleteKind;
  description: string;
};

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'show',
    label: 'Đồng diễn',
    short: 'ĐD',
    kind: 'team',
    description: 'Mỗi đội chấm 5 tiêu chí, tổng điểm của các giám khảo.',
  },
  {
    id: 'solo',
    label: 'Solo',
    short: 'Solo',
    kind: 'solo',
    description: 'Một vận động viên, xếp hạng theo Skating System.',
  },
  {
    id: 'couple',
    label: 'Couple',
    short: 'Couple',
    kind: 'couple',
    description: 'Một cặp Nam – Nữ, xếp hạng theo Skating System.',
  },
  {
    id: 'newbie-solo',
    label: 'Newbie Solo',
    short: 'NB Solo',
    kind: 'solo',
    description: 'Nội dung mới, một vận động viên, một điệu.',
  },
  {
    id: 'newbie-couple',
    label: 'Newbie Couple',
    short: 'NB Couple',
    kind: 'couple',
    description: 'Nội dung mới, một cặp Nam – Nữ, một điệu.',
  },
];

export function categoryInfo(id: CategoryId): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function athleteKindForCategory(category: CategoryId): AthleteKind {
  return categoryInfo(category).kind;
}

export const STATUS_INFO: Record<
  EventStatus,
  { label: string; short: string; tone: 'gray' | 'blue' | 'green' | 'amber' }
> = {
  pending: { label: 'Chưa thi', short: 'Chưa thi', tone: 'gray' },
  semifinal: { label: 'Đang bán kết', short: 'Bán kết', tone: 'blue' },
  final: { label: 'Đang chung kết', short: 'Chung kết', tone: 'blue' },
  done: { label: 'Hoàn tất', short: 'Hoàn tất', tone: 'green' },
};

export function athleteDisplayName(a: Athlete): string {
  if (a.kind === 'couple') {
    const male = a.male?.trim() || 'Nam';
    const female = a.female?.trim() || 'Nữ';
    return `${male} / ${female}`;
  }
  if (a.kind === 'team') return a.teamName?.trim() || a.name?.trim() || 'Đội';
  return a.name?.trim() || 'Chưa có tên';
}

export function athleteSubLabel(a: Athlete): string {
  if (a.kind === 'team') return a.unit?.trim() || '';
  if (a.kind === 'couple') return a.ageGroup?.trim() || '';
  return a.ageGroup?.trim() || '';
}

export function athleteKindLabel(kind: AthleteKind): string {
  if (kind === 'solo') return 'Solo';
  if (kind === 'couple') return 'Couple';
  return 'Đội';
}

export const KIND_OPTIONS: { value: AthleteKind; label: string }[] = [
  { value: 'solo', label: 'Solo (1 VĐV)' },
  { value: 'couple', label: 'Couple (Nam / Nữ)' },
  { value: 'team', label: 'Đội (Đồng diễn)' },
];

// ---------------------------------------------------------------------------
// Bộ sự kiện mặc định theo yêu cầu
// ---------------------------------------------------------------------------

type Template = { name: string; dances: Dance[] };

const SOLO_EVENTS: Template[] = [
  { name: 'Solo Latin – 5 điệu', dances: ['S', 'C', 'R', 'PD', 'J'] },
  { name: 'Solo Latin – 4 điệu', dances: ['S', 'C', 'R', 'J'] },
  { name: 'Solo Latin – 3 điệu', dances: ['C', 'R', 'J'] },
  { name: 'Solo Latin – Cha cha cha & Rumba', dances: ['C', 'R'] },
  { name: 'Solo Latin – Samba & Cha cha cha', dances: ['S', 'C'] },
  { name: 'Solo Latin – Samba', dances: ['S'] },
  { name: 'Solo Latin – Cha cha cha', dances: ['C'] },
  { name: 'Solo Latin – Rumba', dances: ['R'] },
  { name: 'Solo Latin – Paso Doble', dances: ['PD'] },
  { name: 'Solo Latin – Jive', dances: ['J'] },
  { name: 'Solo Standard – Slow Waltz', dances: ['SW'] },
  { name: 'Solo Standard – Tango', dances: ['T'] },
  { name: 'Solo Standard – Viennese Waltz', dances: ['VW'] },
  { name: 'Solo Standard – Slow Foxtrot', dances: ['SF'] },
  { name: 'Solo Standard – Quickstep', dances: ['Q'] },
];

const COUPLE_EVENTS: Template[] = SOLO_EVENTS.map((t) => ({
  name: t.name.replace(/^Solo/, 'Couple'),
  dances: t.dances,
}));

const NEWBIE_SOLO_EVENTS: Template[] = (
  ['S', 'C', 'R', 'PD', 'J'] as Dance[]
).map((d) => ({ name: `Newbie Solo – ${DANCE_INFO[d].name}`, dances: [d] }));

const NEWBIE_COUPLE_EVENTS: Template[] = NEWBIE_SOLO_EVENTS.map((t) => ({
  name: t.name.replace('Newbie Solo', 'Newbie Couple'),
  dances: t.dances,
}));

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function defaultEventTemplates(): {
  category: CategoryId;
  name: string;
  dances: Dance[];
  id: string;
}[] {
  const groups: { category: CategoryId; templates: Template[] }[] = [
    { category: 'show', templates: [{ name: 'Đồng diễn', dances: [] }] },
    { category: 'solo', templates: SOLO_EVENTS },
    { category: 'couple', templates: COUPLE_EVENTS },
    { category: 'newbie-solo', templates: NEWBIE_SOLO_EVENTS },
    { category: 'newbie-couple', templates: NEWBIE_COUPLE_EVENTS },
  ];

  return groups.flatMap((group) =>
    group.templates.map((t) => ({
      category: group.category,
      name: t.name,
      dances: t.dances,
      id: `evt-${slug(t.name)}`,
    })),
  );
}

export function buildDefaultEvents(): DanceEvent[] {
  const now = new Date().toISOString();
  return defaultEventTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    dances: t.dances,
    athleteIds: [],
    status: 'pending',
    resolutions: [],
    createdAt: now,
    updatedAt: now,
  }));
}
