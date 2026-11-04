// ---------------------------------------------------------------------------
// Kiểu dữ liệu dùng chung cho toàn bộ ứng dụng
// ---------------------------------------------------------------------------

export type Dance = 'S' | 'C' | 'R' | 'J' | 'PD' | 'SW' | 'T' | 'VW' | 'SF' | 'Q';

export type CategoryId = 'show' | 'solo' | 'couple' | 'newbie-solo' | 'newbie-couple';

export type AthleteKind = 'solo' | 'couple' | 'team';

export type EventStatus = 'pending' | 'semifinal' | 'final' | 'done';

export type RoundType = 'semifinal' | 'final';

export type MarkSlots = (string | null)[];

export type RoundMarks = {
  /** dance -> judgeId -> mảng vị trí (index 0 = hạng 1) */
  marks: Record<string, Record<string, MarkSlots>>;
  startedAt?: string;
  completedAt?: string;
};

export type GroupScores = Record<
  string,
  Record<string, Record<string, number | null>>
>;

export type Criterion = {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
};

export type Athlete = {
  id: string;
  bib: string;
  kind: AthleteKind;
  name?: string;
  male?: string;
  female?: string;
  teamName?: string;
  unit?: string;
  ageGroup?: string;
  note?: string;
};

export type Judge = {
  id: string;
  code: string;
  name: string;
};

export type TieResolution = {
  id: string;
  scope: 'dance' | 'overall';
  dance?: Dance;
  athleteIds: string[];
  order: string[];
  note?: string;
  at: string;
  by: string;
};

export type DanceEvent = {
  id: string;
  name: string;
  category: CategoryId;
  dances: Dance[];
  athleteIds: string[];
  status: EventStatus;
  semifinal?: RoundMarks;
  final?: RoundMarks;
  finalists?: string[];
  /** Chỉ dùng cho Đồng diễn */
  groupScores?: GroupScores;
  dropHighLow?: boolean;
  /** Chủ tịch HĐ mở khóa sự kiện đã hoàn tất để sửa điểm */
  unlocked?: boolean;
  resolutions: TieResolution[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  competitionName: string;
  venue: string;
  eventDate: string;
  president: string;
  secretary: string;
  criteria: Criterion[];
};

export type HistoryEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  eventId?: string;
};

export type AppState = {
  version: 1;
  settings: Settings;
  judges: Judge[];
  athletes: Athlete[];
  events: DanceEvent[];
  history: HistoryEntry[];
};

export type MarkMode = 'table' | 'quick';

export type TieGroup = {
  /** Khóa ổn định theo tập VĐV, dùng để lưu quyết định phân định */
  key: string;
  athleteIds: string[];
  places: number[];
  dance?: Dance;
};
