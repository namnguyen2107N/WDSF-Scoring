import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  Athlete,
  CategoryId,
  Criterion,
  Dance,
  DanceEvent,
  GroupScores,
  HistoryEntry,
  Judge,
  MarkSlots,
  RoundMarks,
  RoundType,
  Settings,
  TieResolution,
} from '../types';
import {
  createEmptyState,
  createSampleState,
  DEFAULT_CRITERIA,
  settingsDefaults,
} from './seed';
import {
  createGroupScores,
  createRoundMarks,
  emptySlots,
} from '../lib/rounds';
import { nowISO, uid } from '../lib/utils';
import { tieKeyOf } from '../lib/skating';
import { autoAdvanceEvent } from '../lib/eventFlow';

const STORAGE_KEY = 'wdsf-dance-scoring-v1';

export function isEventLocked(event: DanceEvent): boolean {
  return event.status === 'done' && !event.unlocked;
}

export function judgeUsageCount(state: AppState, judgeId: string): number {
  let count = 0;
  for (const event of state.events) {
    if (event.semifinal) {
      for (const dance of event.dances) {
        count += (event.semifinal.marks[dance]?.[judgeId] ?? []).filter(Boolean).length;
      }
    }
    if (event.final) {
      for (const dance of event.dances) {
        count += (event.final.marks[dance]?.[judgeId] ?? []).filter(Boolean).length;
      }
    }
    const scores = event.groupScores?.[judgeId];
    if (scores) {
      for (const teamId of Object.keys(scores)) {
        count += Object.values(scores[teamId]).filter(
          (value) => value !== null && value !== undefined,
        ).length;
      }
    }
  }
  return count;
}

export function athleteUsageCount(state: AppState, athleteId: string): number {
  return state.events.filter((event) => event.athleteIds.includes(athleteId)).length;
}

type LogInput = { action: string; detail: string; eventId?: string; actor?: string };

function appendLogs(state: AppState, logs: LogInput[], actor: string): AppState {
  if (!logs.length) return state;
  const now = nowISO();
  const entries: HistoryEntry[] = logs.map((log) => ({
    id: uid('hist'),
    at: now,
    actor: log.actor ?? actor,
    action: log.action,
    detail: log.detail,
    eventId: log.eventId,
  }));
  // Log mới nhất lên đầu; giữ tối đa 1500 mục
  return { ...state, history: [...entries.reverse(), ...state.history].slice(0, 1500) };
}

function updateEventInState(
  state: AppState,
  eventId: string,
  updater: (event: DanceEvent) => DanceEvent,
): AppState {
  return {
    ...state,
    events: state.events.map((event) => (event.id === eventId ? updater(event) : event)),
  };
}

function loadInitialState(): AppState {
  if (typeof window === 'undefined') return createSampleState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSampleState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.events)) {
      return createSampleState();
    }
    const state = parsed as AppState;
    return {
      ...state,
      settings: {
        ...settingsDefaults(),
        ...state.settings,
        criteria:
          Array.isArray(state.settings?.criteria) && state.settings.criteria.length
            ? state.settings.criteria
            : DEFAULT_CRITERIA,
      },
      judges: Array.isArray(state.judges) ? state.judges : [],
      athletes: Array.isArray(state.athletes) ? state.athletes : [],
      events: state.events.map((event) => ({
        ...event,
        resolutions: Array.isArray(event.resolutions) ? event.resolutions : [],
        athleteIds: Array.isArray(event.athleteIds) ? event.athleteIds : [],
        dances: Array.isArray(event.dances) ? event.dances : [],
      })),
      history: Array.isArray(state.history) ? state.history : [],
    };
  } catch {
    return createSampleState();
  }
}

export type EventDraft = {
  name: string;
  category: CategoryId;
  dances: Dance[];
  notes?: string;
  dropHighLow?: boolean;
};

export type AppActions = {
  updateSettings: (patch: Partial<Settings>) => void;
  updateCriterion: (id: string, patch: Partial<Criterion>) => void;
  addCriterion: () => void;
  removeCriterion: (id: string) => void;
  resetCriteria: () => void;

  addJudge: (input: { code: string; name: string }) => void;
  updateJudge: (id: string, patch: Partial<Judge>) => void;
  deleteJudge: (id: string) => void;

  addAthlete: (input: Omit<Athlete, 'id'>) => Athlete;
  updateAthlete: (id: string, patch: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  addAthletes: (inputs: Omit<Athlete, 'id'>[]) => number;

  addEvent: (draft: EventDraft) => DanceEvent;
  updateEvent: (id: string, patch: Partial<EventDraft>) => void;
  deleteEvent: (id: string) => void;
  registerAthletes: (eventId: string, athleteIds: string[]) => void;
  unregisterAthlete: (eventId: string, athleteId: string) => void;
  startEvent: (eventId: string) => void;
  resetEvent: (eventId: string) => void;
  unlockEvent: (eventId: string) => void;
  lockEvent: (eventId: string) => void;

  setMark: (
    eventId: string,
    round: RoundType,
    dance: Dance,
    judgeId: string,
    placeIndex: number,
    athleteId: string | null,
  ) => void;
  clearJudgeDance: (
    eventId: string,
    round: RoundType,
    dance: Dance,
    judgeId: string,
  ) => void;
  copyJudgeDance: (
    eventId: string,
    round: RoundType,
    dance: Dance,
    fromJudgeId: string,
    toJudgeId: string,
  ) => void;

  setGroupScore: (
    eventId: string,
    judgeId: string,
    teamId: string,
    criterionId: string,
    value: number | null,
  ) => void;

  finalizeSemifinal: (eventId: string, finalistIds: string[], note?: string) => void;
  resolveTie: (input: {
    eventId: string;
    scope: 'dance' | 'overall';
    dance?: Dance;
    athleteIds: string[];
    order: string[];
    note?: string;
  }) => void;
  clearTieResolution: (eventId: string, resolutionId: string) => void;

  restoreState: (state: AppState) => void;
  resetData: (mode: 'sample' | 'empty') => void;
};

type StoreContextValue = {
  state: AppState;
  actions: AppActions;
  savedAt: string | null;
  saveError: string | null;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSavedAt(nowISO());
        setSaveError(null);
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? `Không lưu được dữ liệu: ${error.message}`
            : 'Không lưu được dữ liệu vào trình duyệt.',
        );
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const flush = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      } catch {
        // Trình duyệt có thể chặn localStorage; lỗi đã được hiển thị ở header.
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const act = useCallback(
    (updater: (current: AppState) => AppState) => {
      setState((current) => updater(current));
    },
    [],
  );

  const addLog = useCallback(
    (current: AppState, logs: LogInput[]): AppState =>
      appendLogs(current, logs, current.settings.secretary || 'Ban thư ký'),
    [],
  );

  // Tự động chuyển trạng thái sau khi sửa điểm
  const commitEvent = useCallback(
    (current: AppState, event: DanceEvent, extraLogs: LogInput[] = []): AppState => {
      const auto = autoAdvanceEvent(
        event,
        current.judges,
        current.settings.criteria,
      );
      const next = updateEventInState(current, event.id, () => auto.event);
      return addLog(next, [...extraLogs, ...auto.logs]);
    },
    [addLog],
  );

  const actions = useMemo<AppActions>(() => {
    const settingsLog = (current: AppState, detail: string) =>
      addLog(current, [{ action: 'Cập nhật thiết lập', detail }]);

    return {
      updateSettings(patch) {
        act((current) => {
          const next = {
            ...current,
            settings: { ...current.settings, ...patch },
          };
          return settingsLog(next, 'Thay đổi thông tin giải đấu / ban tổ chức.');
        });
      },

      updateCriterion(id, patch) {
        act((current) => {
          const next = {
            ...current,
            settings: {
              ...current.settings,
              criteria: current.settings.criteria.map((c) =>
                c.id === id ? { ...c, ...patch } : c,
              ),
            },
          };
          return settingsLog(next, `Cập nhật tiêu chí đồng diễn.`);
        });
      },

      addCriterion() {
        act((current) => {
          if (current.settings.criteria.length >= 8) return current;
          const next = {
            ...current,
            settings: {
              ...current.settings,
              criteria: [
                ...current.settings.criteria,
                {
                  id: uid('crit'),
                  name: `Tiêu chí ${current.settings.criteria.length + 1}`,
                  min: 0,
                  max: 10,
                  step: 0.1,
                },
              ],
            },
          };
          return settingsLog(next, 'Thêm tiêu chí chấm đồng diễn.');
        });
      },

      removeCriterion(id) {
        act((current) => {
          if (current.settings.criteria.length <= 2) return current;
          const next = {
            ...current,
            settings: {
              ...current.settings,
              criteria: current.settings.criteria.filter((c) => c.id !== id),
            },
          };
          return settingsLog(next, 'Xóa một tiêu chí chấm đồng diễn.');
        });
      },

      resetCriteria() {
        act((current) => {
          const next = {
            ...current,
            settings: { ...current.settings, criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })) },
          };
          return settingsLog(next, 'Khôi phục 5 tiêu chí đồng diễn mặc định.');
        });
      },

      addJudge(input) {
        act((current) =>
          addLog(
            {
              ...current,
              judges: [
                ...current.judges,
                { id: uid('judge'), code: input.code.trim(), name: input.name.trim() },
              ],
            },
            [
              {
                action: 'Thêm giám khảo',
                detail: `${input.code.trim()} – ${input.name.trim()}`,
              },
            ],
          ),
        );
      },

      updateJudge(id, patch) {
        act((current) =>
          addLog(
            {
              ...current,
              judges: current.judges.map((j) => (j.id === id ? { ...j, ...patch } : j)),
            },
            [{ action: 'Sửa giám khảo', detail: `Mã ${patch.code ?? id}` }],
          ),
        );
      },

      deleteJudge(id) {
        act((current) => {
          const judge = current.judges.find((j) => j.id === id);
          if (!judge) return current;
          if (judgeUsageCount(current, id) > 0) return current;
          const events = current.events.map((event) => {
            const next = { ...event };
            if (next.groupScores?.[id]) {
              const { [id]: _removed, ...rest } = next.groupScores;
              next.groupScores = rest as GroupScores;
            }
            return next;
          });
          return addLog(
            { ...current, judges: current.judges.filter((j) => j.id !== id), events },
            [{ action: 'Xóa giám khảo', detail: `${judge.code} – ${judge.name}` }],
          );
        });
      },

      addAthlete(input) {
        const athlete: Athlete = { ...input, id: uid('ath') };
        act((current) =>
          addLog(
            { ...current, athletes: [...current.athletes, athlete] },
            [
              {
                action: 'Thêm vận động viên',
                detail: `SBD ${athlete.bib}`,
              },
            ],
          ),
        );
        return athlete;
      },

      updateAthlete(id, patch) {
        act((current) =>
          addLog(
            {
              ...current,
              athletes: current.athletes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
            },
            [{ action: 'Sửa vận động viên', detail: `SBD ${patch.bib ?? ''}` }],
          ),
        );
      },

      deleteAthlete(id) {
        act((current) => {
          const athlete = current.athletes.find((a) => a.id === id);
          if (!athlete) return current;
          if (athleteUsageCount(current, id) > 0) return current;
          return addLog(
            { ...current, athletes: current.athletes.filter((a) => a.id !== id) },
            [{ action: 'Xóa vận động viên', detail: `SBD ${athlete.bib}` }],
          );
        });
      },

      addAthletes(inputs) {
        const current = stateRef.current;
        const bibs = new Set(current.athletes.map((a) => a.bib.trim()));
        const added: Athlete[] = [];
        for (const input of inputs) {
          const bib = input.bib.trim();
          if (!bib || bibs.has(bib)) continue;
          bibs.add(bib);
          added.push({ ...input, bib, id: uid('ath') });
        }
        if (!added.length) return 0;
        act((stateNow) =>
          addLog(
            { ...stateNow, athletes: [...stateNow.athletes, ...added] },
            [
              {
                action: 'Nhập danh sách vận động viên',
                detail: `Thêm ${added.length} VĐV/đội từ Excel/CSV.`,
              },
            ],
          ),
        );
        return added.length;
      },

      addEvent(draft) {
        const now = nowISO();
        const event: DanceEvent = {
          id: uid('evt'),
          name: draft.name.trim(),
          category: draft.category,
          dances: draft.category === 'show' ? [] : draft.dances,
          athleteIds: [],
          status: 'pending',
          resolutions: [],
          notes: draft.notes,
          dropHighLow: draft.dropHighLow,
          createdAt: now,
          updatedAt: now,
        };
        act((current) =>
          addLog(
            { ...current, events: [event, ...current.events] },
            [{ action: 'Tạo sự kiện', detail: event.name, eventId: event.id }],
          ),
        );
        return event;
      },

      updateEvent(id, patch) {
        act((current) =>
          addLog(
            {
              ...current,
              events: current.events.map((event) => {
                if (event.id !== id) return event;
                const pending = event.status === 'pending';
                const nextCategory =
                  pending && patch.category ? patch.category : event.category;
                const nextDances =
                  pending && patch.dances !== undefined
                    ? nextCategory === 'show'
                      ? []
                      : patch.dances
                    : event.dances;
                return {
                  ...event,
                  name: patch.name ?? event.name,
                  notes: patch.notes ?? event.notes,
                  dropHighLow:
                    patch.dropHighLow !== undefined ? patch.dropHighLow : event.dropHighLow,
                  category: nextCategory,
                  dances: nextDances,
                  updatedAt: nowISO(),
                };
              }),
            },
            [{ action: 'Sửa sự kiện', detail: patch.name ?? id, eventId: id }],
          ),
        );
      },

      deleteEvent(id) {
        act((current) => {
          const event = current.events.find((e) => e.id === id);
          if (!event) return current;
          return addLog(
            { ...current, events: current.events.filter((e) => e.id !== id) },
            [{ action: 'Xóa sự kiện', detail: event.name, eventId: id }],
          );
        });
      },

      registerAthletes(eventId, athleteIds) {
        act((current) =>
          addLog(
            {
              ...current,
              events: current.events.map((event) => {
                if (event.id !== eventId || event.status !== 'pending') return event;
                const ids = [...new Set([...event.athleteIds, ...athleteIds])];
                return { ...event, athleteIds: ids, updatedAt: nowISO() };
              }),
            },
            [
              {
                action: 'Đăng ký VĐV',
                detail: `Thêm ${athleteIds.length} VĐV vào sự kiện.`,
                eventId,
              },
            ],
          ),
        );
      },

      unregisterAthlete(eventId, athleteId) {
        act((current) =>
          addLog(
            {
              ...current,
              events: current.events.map((event) =>
                event.id === eventId && event.status === 'pending'
                  ? {
                      ...event,
                      athleteIds: event.athleteIds.filter((id) => id !== athleteId),
                      updatedAt: nowISO(),
                    }
                  : event,
              ),
            },
            [{ action: 'Bỏ đăng ký VĐV', detail: 'Cập nhật danh sách thi.', eventId }],
          ),
        );
      },

      startEvent(eventId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || event.status !== 'pending') return current;
          if (event.athleteIds.length < 2 || current.judges.length === 0) return current;
          const judgeIds = current.judges.map((j) => j.id);
          let next: DanceEvent;
          let detail: string;
          if (event.category === 'show') {
            next = {
              ...event,
              status: 'final',
              groupScores: createGroupScores(
                judgeIds,
                event.athleteIds,
                current.settings.criteria,
              ),
              unlocked: false,
              updatedAt: nowISO(),
            };
            detail = `${event.name}: bắt đầu chấm đồng diễn với ${event.athleteIds.length} đội.`;
          } else if (event.athleteIds.length >= 7) {
            next = {
              ...event,
              status: 'semifinal',
              semifinal: createRoundMarks(event.dances, judgeIds, event.athleteIds, 6),
              final: undefined,
              finalists: undefined,
              unlocked: false,
              updatedAt: nowISO(),
            };
            detail = `${event.name}: ${event.athleteIds.length} VĐV – bắt đầu bán kết (chọn 6 vào chung kết).`;
          } else {
            next = {
              ...event,
              status: 'final',
              finalists: [...event.athleteIds],
              final: createRoundMarks(
                event.dances,
                judgeIds,
                event.athleteIds,
                event.athleteIds.length,
              ),
              semifinal: undefined,
              unlocked: false,
              updatedAt: nowISO(),
            };
            detail = `${event.name}: ${event.athleteIds.length} VĐV – thi trực tiếp chung kết.`;
          }
          return addLog(updateEventInState(current, eventId, () => next), [
            { action: 'Bắt đầu sự kiện', detail, eventId },
          ]);
        });
      },

      resetEvent(eventId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event) return current;
          const next: DanceEvent = {
            ...event,
            status: 'pending',
            semifinal: undefined,
            final: undefined,
            finalists: undefined,
            groupScores: undefined,
            unlocked: false,
            resolutions: [],
            updatedAt: nowISO(),
          };
          return addLog(updateEventInState(current, eventId, () => next), [
            {
              action: 'Đưa sự kiện về chưa thi',
              detail: `${event.name}: xóa toàn bộ điểm và vòng thi.`,
              eventId,
            },
          ]);
        });
      },

      unlockEvent(eventId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || event.status !== 'done') return current;
          const next = { ...event, unlocked: true, updatedAt: nowISO() };
          return addLog(updateEventInState(current, eventId, () => next), [
            {
              action: 'Mở khóa sự kiện',
              detail: `${event.name}: Chủ tịch HĐ mở khóa để xem/sửa điểm.`,
              eventId,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            },
          ]);
        });
      },

      lockEvent(eventId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || event.status !== 'done') return current;
          const next = { ...event, unlocked: false, updatedAt: nowISO() };
          return addLog(updateEventInState(current, eventId, () => next), [
            {
              action: 'Khóa lại sự kiện',
              detail: `${event.name}: khóa kết quả sau khi kiểm tra.`,
              eventId,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            },
          ]);
        });
      },

      setMark(eventId, round, dance, judgeId, placeIndex, athleteId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || isEventLocked(event)) return current;
          const roundData: RoundMarks | undefined = event[round];
          if (!roundData) return current;
          const participants =
            round === 'semifinal' ? event.athleteIds : event.finalists ?? [];
          const slots = participants.length
            ? round === 'semifinal'
              ? 6
              : participants.length
            : 6;
          const currentSlots: MarkSlots = [
            ...(roundData.marks[dance]?.[judgeId] ?? emptySlots(slots)),
          ];
          while (currentSlots.length < slots) currentSlots.push(null);
          if (athleteId) {
            for (let i = 0; i < currentSlots.length; i += 1) {
              if (currentSlots[i] === athleteId) currentSlots[i] = null;
            }
          }
          currentSlots[placeIndex] = athleteId;
          const nextRound: RoundMarks = {
            ...roundData,
            marks: {
              ...roundData.marks,
              [dance]: {
                ...roundData.marks[dance],
                [judgeId]: currentSlots,
              },
            },
          };
          const nextEvent: DanceEvent = {
            ...event,
            [round]: nextRound,
            updatedAt: nowISO(),
          };
          const logs: LogInput[] = [];
          if (event.status === 'done') {
            const athlete = current.athletes.find((a) => a.id === athleteId);
            logs.push({
              action: 'Sửa điểm khi mở khóa',
              detail: `${event.name} · ${round === 'final' ? 'Chung kết' : 'Bán kết'} · ${dance} · GK ${current.judges.find((j) => j.id === judgeId)?.code ?? judgeId} · Hạng ${placeIndex + 1}${athlete ? ` · SBD ${athlete.bib}` : ' · bỏ trống'}.`,
              eventId,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            });
          }
          return commitEvent(current, nextEvent, logs);
        });
      },

      clearJudgeDance(eventId, round, dance, judgeId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || isEventLocked(event)) return current;
          const roundData = event[round];
          if (!roundData) return current;
          const participants =
            round === 'semifinal' ? event.athleteIds : event.finalists ?? [];
          const slots = round === 'semifinal' ? 6 : participants.length;
          const nextEvent: DanceEvent = {
            ...event,
            [round]: {
              ...roundData,
              marks: {
                ...roundData.marks,
                [dance]: {
                  ...roundData.marks[dance],
                  [judgeId]: emptySlots(slots),
                },
              },
            },
            updatedAt: nowISO(),
          };
          const logs: LogInput[] = event.status === 'done'
            ? [
                {
                  action: 'Xóa điểm khi mở khóa',
                  detail: `${event.name} · ${dance} · GK ${current.judges.find((j) => j.id === judgeId)?.code ?? judgeId}.`,
                  eventId,
                  actor: current.settings.president || 'Chủ tịch hội đồng',
                },
              ]
            : [];
          return commitEvent(current, nextEvent, logs);
        });
      },

      copyJudgeDance(eventId, round, dance, fromJudgeId, toJudgeId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || isEventLocked(event)) return current;
          const roundData = event[round];
          if (!roundData) return current;
          const source = roundData.marks[dance]?.[fromJudgeId];
          if (!source) return current;
          const nextEvent: DanceEvent = {
            ...event,
            [round]: {
              ...roundData,
              marks: {
                ...roundData.marks,
                [dance]: {
                  ...roundData.marks[dance],
                  [toJudgeId]: [...source],
                },
              },
            },
            updatedAt: nowISO(),
          };
          return commitEvent(current, nextEvent);
        });
      },

      setGroupScore(eventId, judgeId, teamId, criterionId, value) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || isEventLocked(event)) return current;
          const scores: GroupScores = event.groupScores
            ? {
                ...event.groupScores,
                [judgeId]: {
                  ...(event.groupScores[judgeId] ?? {}),
                  [teamId]: {
                    ...(event.groupScores[judgeId]?.[teamId] ?? {}),
                    [criterionId]: value,
                  },
                },
              }
            : {
                [judgeId]: {
                  [teamId]: { [criterionId]: value },
                },
              };
          const nextEvent: DanceEvent = {
            ...event,
            groupScores: scores,
            updatedAt: nowISO(),
          };
          const logs: LogInput[] = [];
          if (event.status === 'done') {
            const team = current.athletes.find((a) => a.id === teamId);
            logs.push({
              action: 'Sửa điểm đồng diễn khi mở khóa',
              detail: `${event.name} · GK ${current.judges.find((j) => j.id === judgeId)?.code ?? judgeId} · Đội ${team?.teamName ?? teamId} · ${value ?? 'bỏ trống'}.`,
              eventId,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            });
          }
          return commitEvent(current, nextEvent, logs);
        });
      },

      finalizeSemifinal(eventId, finalistIds, note) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event || event.status !== 'semifinal') return current;
          const unique = [...new Set(finalistIds)].filter((id) =>
            event.athleteIds.includes(id),
          );
          if (unique.length < 2) return current;
          const finalRound = createRoundMarks(
            event.dances,
            current.judges.map((j) => j.id),
            unique,
            unique.length,
          );
          const next: DanceEvent = {
            ...event,
            status: 'final',
            finalists: unique,
            final: finalRound,
            updatedAt: nowISO(),
          };
          return addLog(updateEventInState(current, eventId, () => next), [
            {
              action: 'Chốt danh sách chung kết',
              detail: `${event.name}: Chủ tịch HĐ chọn ${unique.length} VĐV vào chung kết${note ? ` – ${note}` : ''}.`,
              eventId,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            },
          ]);
        });
      },

      resolveTie(input) {
        act((current) => {
          const event = current.events.find((e) => e.id === input.eventId);
          if (!event) return current;
          if (
            input.order.length !== input.athleteIds.length ||
            !input.athleteIds.every((id) => input.order.includes(id))
          ) {
            return current;
          }
          const resolution: TieResolution = {
            id: uid('tie'),
            scope: input.scope,
            dance: input.dance,
            athleteIds: [...input.athleteIds],
            order: [...input.order],
            note: input.note,
            at: nowISO(),
            by: current.settings.president || 'Chủ tịch hội đồng',
          };
          const resolutions = event.resolutions.filter(
            (r) =>
              !(
                r.scope === input.scope &&
                r.dance === input.dance &&
                tieKeyOf(r.athleteIds) === tieKeyOf(input.athleteIds)
              ),
          );
          const next = {
            ...event,
            resolutions: [...resolutions, resolution],
            updatedAt: nowISO(),
          };
          return addLog(updateEventInState(current, event.id, () => next), [
            {
              action: 'Phân định hòa',
              detail: `${event.name}${input.dance ? ` · ${input.dance}` : ''}: Chủ tịch HĐ xếp thứ tự ${input.order
                .map((id) => current.athletes.find((a) => a.id === id)?.bib ?? id)
                .join(' → ')}${input.note ? ` (${input.note})` : ''}.`,
              eventId: event.id,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            },
          ]);
        });
      },

      clearTieResolution(eventId, resolutionId) {
        act((current) => {
          const event = current.events.find((e) => e.id === eventId);
          if (!event) return current;
          const resolution = event.resolutions.find((r) => r.id === resolutionId);
          const next = {
            ...event,
            resolutions: event.resolutions.filter((r) => r.id !== resolutionId),
            updatedAt: nowISO(),
          };
          return addLog(updateEventInState(current, eventId, () => next), [
            {
              action: 'Hủy phân định hòa',
              detail: `${event.name}${resolution?.dance ? ` · ${resolution.dance}` : ''}: trả về kết quả theo thuật toán.`,
              eventId,
              actor: current.settings.president || 'Chủ tịch hội đồng',
            },
          ]);
        });
      },

      restoreState(nextState) {
        if (!nextState || nextState.version !== 1 || !Array.isArray(nextState.events)) {
          return;
        }
        const safeState: AppState = {
          ...nextState,
          judges: Array.isArray(nextState.judges) ? nextState.judges : [],
          athletes: Array.isArray(nextState.athletes) ? nextState.athletes : [],
          history: Array.isArray(nextState.history) ? nextState.history : [],
          settings: {
            ...settingsDefaults(),
            ...nextState.settings,
            criteria:
              Array.isArray(nextState.settings?.criteria) && nextState.settings.criteria.length
                ? nextState.settings.criteria
                : DEFAULT_CRITERIA,
          },
          events: nextState.events.map((event) => ({
            ...event,
            athleteIds: Array.isArray(event.athleteIds) ? event.athleteIds : [],
            dances: Array.isArray(event.dances) ? event.dances : [],
            resolutions: Array.isArray(event.resolutions) ? event.resolutions : [],
          })),
        };
        act(() =>
          addLog(safeState, [
            {
              action: 'Khôi phục dữ liệu',
              detail: `Khôi phục bộ dữ liệu "${safeState.settings.competitionName}".`,
            },
          ]),
        );
      },

      resetData(mode) {
        if (mode === 'sample') {
          setState(createSampleState());
        } else {
          setState(createEmptyState());
        }
      },
    };
  }, [act, addLog, commitEvent]);

  const value = useMemo<StoreContextValue>(
    () => ({ state, actions, savedAt, saveError }),
    [state, actions, savedAt, saveError],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useApp phải được dùng trong AppStoreProvider');
  return context;
}
