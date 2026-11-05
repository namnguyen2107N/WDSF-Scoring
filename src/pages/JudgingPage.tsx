import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Dance, DanceEvent, Judge, RoundType } from '../types';
import { isEventLocked, useApp } from '../store/AppStore';
import {
  computeFinalResults,
  computeSemifinalResults,
} from '../lib/results';
import { validateGroupAgainstCriteria, validateRound } from '../lib/semifinal';
import { DANCE_INFO, STATUS_INFO } from '../lib/constants';
import { cn } from '../lib/utils';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  EventStatusBadge,
  JudgeTick,
  PageHeader,
  ProgressBar,
} from '../components/ui';
import { JudgingMatrix } from '../components/JudgingMatrix';
import { SemifinalSummary } from '../components/SemifinalSummary';
import { GroupJudging } from '../components/GroupJudging';
import {
  CheckIcon,
  ClipboardIcon,
  LockIcon,
  TrophyIcon,
  UnlockIcon,
  UsersIcon,
} from '../components/icons';

type Notice = { tone: 'success' | 'info' | 'warning'; text: string };

export default function JudgingPage() {
  const { state, actions } = useApp();
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event');
  const judgeParam = params.get('judge');
  const [round, setRound] = useState<RoundType | ''>('');
  const [dance, setDance] = useState<Dance | ''>('');
  const [judgeId, setJudgeId] = useState<string | null>(judgeParam);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const previousStatus = useRef<{ id: string; status: string } | null>(null);

  useEffect(() => {
    setRound('');
    setDance('');
  }, [eventId]);

  useEffect(() => {
    if (judgeParam) setJudgeId(judgeParam);
  }, [judgeParam]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const notify = (tone: Notice['tone'], text: string) => setNotice({ tone, text });

  const fallback = useMemo(() => {
    return (
      state.events.find((e) => e.status === 'semifinal' || e.status === 'final') ??
      state.events.find((e) => e.status === 'done') ??
      state.events.find((e) => e.athleteIds.length > 0) ??
      state.events[0]
    );
  }, [state.events]);
  const event = state.events.find((e) => e.id === eventId) ?? fallback;

  useEffect(() => {
    if ((!eventId || !state.events.some((e) => e.id === eventId)) && fallback) {
      setParams({ event: fallback.id }, { replace: true });
    }
  }, [eventId, fallback, state.events, setParams]);

  const judges = state.judges;
  const activeJudge = judges.find((judge) => judge.id === judgeId) ?? judges[0];

  const availableRounds = useMemo<RoundType[]>(() => {
    if (!event) return [];
    const rounds: RoundType[] = [];
    if (event.semifinal) rounds.push('semifinal');
    if (event.final) rounds.push('final');
    return rounds;
  }, [event]);

  const defaultRound: RoundType =
    event?.status === 'semifinal' && availableRounds.includes('semifinal')
      ? 'semifinal'
      : availableRounds.includes('final')
        ? 'final'
        : 'semifinal';
  const activeRound = round && availableRounds.includes(round) ? round : defaultRound;
  const activeDance = event && event.dances.includes(dance as Dance) ? (dance as Dance) : event?.dances[0];

  const roundValidation = useMemo(() => {
    if (!event || (activeRound === ('semifinal' as RoundType) && !event.semifinal)) return null;
    if (activeRound === 'final' && !event.final) return null;
    return validateRound(event, activeRound, judges);
  }, [event, activeRound, judges]);

  const groupValidation = useMemo(() => {
    if (!event || event.category !== 'show') return null;
    return validateGroupAgainstCriteria(event, judges, state.settings.criteria);
  }, [event, judges, state.settings.criteria]);

  const finalResults = useMemo(() => {
    if (!event || event.category === 'show') return null;
    if (event.status === 'final' || event.status === 'done') return computeFinalResults(event, judges);
    return null;
  }, [event, judges]);

  const semifinalResults = useMemo(() => {
    if (!event || event.category === 'show' || !event.semifinal) return null;
    return computeSemifinalResults(event, judges);
  }, [event, judges]);

  useEffect(() => {
    if (!event) return;
    const previous = previousStatus.current;
    if (previous && previous.id === event.id && previous.status !== event.status) {
      if (previous.status === 'semifinal' && event.status === 'final') {
        setNotice({
          tone: 'success',
          text: 'Đã đủ điểm bán kết – hệ thống tự tạo vòng chung kết. Chuyển sang tab Chung kết để chấm tiếp.',
        });
      }
      if (previous.status === 'final' && event.status === 'done') {
        setNotice({
          tone: 'success',
          text: 'Đã đủ điểm. Sự kiện tự động hoàn tất và khóa kết quả.',
        });
      }
    }
    previousStatus.current = { id: event.id, status: event.status };
  }, [event]);

  if (!event) {
    return (
      <div>
        <PageHeader title="Chấm điểm" eyebrow="Hội đồng giám khảo" />
        <EmptyState
          title="Chưa có sự kiện"
          description="Hãy tạo sự kiện ở trang Sự kiện trước khi chấm điểm."
          action={
            <Link to="/su-kien" className="btn-primary">
              Đi tới Sự kiện
            </Link>
          }
        />
      </div>
    );
  }

  const isShow = event.category === 'show';
  const isLocked = isEventLocked(event);
  const finalExists = Boolean(event.final);
  const semifinalReadOnly = activeRound === 'semifinal' && finalExists;
  const readOnly = isLocked || semifinalReadOnly;
  const validationForActive = isShow ? groupValidation : roundValidation;
  const selectedJudgeComplete = activeJudge
    ? isShow
      ? Boolean(groupValidation?.judgeComplete[activeJudge.id])
      : Boolean(roundValidation?.judgeComplete[activeJudge.id])
    : false;

  const completedJudges = validationForActive
    ? Object.values(validationForActive.judgeComplete).filter(Boolean).length
    : 0;

  const judgeDancesDone =
    activeJudge && !isShow
      ? event.dances.filter((item) => {
          const slots = event[activeRound]?.marks?.[item]?.[activeJudge.id] ?? [];
          const expected =
            activeRound === 'semifinal' ? 6 : (event.finalists?.length ?? event.athleteIds.length);
          return expected > 0 && slots.slice(0, expected).filter(Boolean).length === expected;
        }).length
      : 0;

  const selectEvent = (id: string) => {
    setParams({ event: id });
    setRound('');
    setDance('');
  };

  const eventsRunning = state.events.filter(
    (item) => item.status === 'semifinal' || item.status === 'final',
  );
  const eventsPending = state.events.filter((item) => item.status === 'pending');
  const eventsDone = state.events.filter((item) => item.status === 'done');

  const canStart =
    event.status === 'pending' && event.athleteIds.length >= 2 && judges.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Hội đồng giám khảo"
        title="Chấm điểm"
        description="Chọn sự kiện, giám khảo và điệu thi. Điểm được lưu ngay trên trình duyệt; giám khảo nhập đủ sẽ hiện dấu tick xanh."
        actions={
          <>
            <Link to={`/xep-hang?event=${encodeURIComponent(event.id)}`} className="btn-secondary">
              <TrophyIcon size={18} /> Xếp hạng
            </Link>
            <Link to={`/su-kien?event=${encodeURIComponent(event.id)}`} className="btn-secondary">
              <ClipboardIcon size={18} /> Chi tiết sự kiện
            </Link>
          </>
        }
      />

      <div className="app-card mb-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="label" htmlFor="judging-event-select">
              Sự kiện đang chấm
            </label>
            <select
              id="judging-event-select"
              className="select max-w-2xl"
              value={event.id}
              onChange={(inputEvent) => selectEvent(inputEvent.target.value)}
            >
              {eventsRunning.length > 0 && (
                <optgroup label="Đang thi">
                  {eventsRunning.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {STATUS_INFO[item.status].label}
                    </option>
                  ))}
                </optgroup>
              )}
              {eventsPending.length > 0 && (
                <optgroup label="Chưa thi">
                  {eventsPending.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.athleteIds.length} VĐV
                    </option>
                  ))}
                </optgroup>
              )}
              {eventsDone.length > 0 && (
                <optgroup label="Hoàn tất">
                  {eventsDone.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · Đã khóa
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <EventStatusBadge status={event.status} />
            {event.category !== 'show' && (
              <Badge tone="gray">
                {event.dances.length} điệu · {event.athleteIds.length} VĐV
              </Badge>
            )}
            {event.category === 'show' && (
              <Badge tone="gray">{event.athleteIds.length} đội</Badge>
            )}
            {isLocked && (
              <Badge tone="dark">
                <LockIcon size={12} /> Đã khóa
              </Badge>
            )}
            {event.unlocked && <Badge tone="amber">Đang mở khóa</Badge>}
          </div>
        </div>
      </div>

      {notice && (
        <div className="mb-4">
          <Callout tone={notice.tone} title={notice.text} />
        </div>
      )}

      {isLocked && (
        <div className="mb-4">
          <Callout
            tone="warning"
            title="Sự kiện đã hoàn tất và đang khóa"
            action={
              <Button variant="warning" onClick={() => setUnlockOpen(true)}>
                <UnlockIcon size={18} /> Chủ tịch HĐ mở khóa
              </Button>
            }
          >
            Bảng điểm chỉ được xem. Việc mở khóa và sửa điểm sẽ được ghi vào lịch sử.
          </Callout>
        </div>
      )}

      {event.status === 'done' && event.unlocked && (
        <div className="mb-4">
          <Callout
            tone="warning"
            title="Đang mở khóa để sửa điểm"
            action={
              <Button
                variant="success"
                disabled={isShow ? !groupValidation?.complete : !finalResults?.complete}
                onClick={() => {
                  actions.lockEvent(event.id);
                  notify('success', 'Đã khóa lại kết quả sau khi kiểm tra.');
                }}
              >
                <LockIcon size={18} /> Khóa lại
              </Button>
            }
          >
            Mọi thay đổi của giám khảo được ghi lịch sử. Hãy nhập đủ điểm rồi khóa lại.
          </Callout>
        </div>
      )}

      {event.status === 'pending' ? (
        <StartPanel event={event} canStart={canStart} onStart={() => setStartOpen(true)} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="stat-card">
              <div className="stat-value">
                {validationForActive?.filled ?? 0}
                <span className="text-base font-semibold text-slate-500">
                  /{validationForActive?.total ?? 0}
                </span>
              </div>
              <div className="stat-label">Ô điểm đã nhập</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {completedJudges}
                <span className="text-base font-semibold text-slate-500">/{judges.length}</span>
              </div>
              <div className="stat-label">Giám khảo nhập đủ</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {isShow ? state.settings.criteria.length : event.dances.length}
              </div>
              <div className="stat-label">{isShow ? 'Tiêu chí' : 'Điệu thi'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{isShow ? event.athleteIds.length : activeRound === 'semifinal' ? event.athleteIds.length : event.finalists?.length ?? 0}</div>
              <div className="stat-label">{isShow ? 'Đội thi' : 'VĐV vòng này'}</div>
            </div>
          </div>

          {!isShow && availableRounds.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card">
              {availableRounds.map((item) => {
                const validation = item === activeRound ? validationForActive : null;
                const complete = item === 'final' ? finalResults?.complete : semifinalResults?.complete;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRound(item)}
                    className={cn(
                      'inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors sm:flex-none',
                      activeRound === item
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {item === 'semifinal' ? 'Bán kết' : 'Chung kết'}
                    {complete ? (
                      <CheckIcon size={16} className={activeRound === item ? 'text-white' : 'text-emerald-600'} />
                    ) : validation && validation.filled > 0 ? (
                      <span
                        className={cn(
                          'tabular rounded-full px-1.5 py-0.5 text-[10px]',
                          activeRound === item ? 'bg-white text-brand-800' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {validation.filled}/{validation.total}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {semifinalReadOnly && (
                <span className="ml-auto px-3 text-xs font-semibold text-amber-700">
                  Bán kết đã chốt · chỉ xem
                </span>
              )}
              {event.final && activeRound === 'semifinal' && (
                <Button size="sm" variant="primary" onClick={() => setRound('final')}>
                  Sang chung kết
                </Button>
              )}
            </div>
          )}

          {semifinalReadOnly && (
            <div className="mb-4">
              <Callout tone="info" title="Bán kết đã chốt danh sách chung kết">
                Điểm bán kết chỉ để đối chiếu. Nếu cần sửa điểm bán kết, hãy đưa sự kiện về chưa
                thi và tổ chức lại vòng thi.
              </Callout>
            </div>
          )}

          {judges.length === 0 ? (
            <div className="app-card card-pad">
              <EmptyState
                icon={<UsersIcon size={36} />}
                title="Chưa có giám khảo"
                description="Thêm giám khảo ở trang Thiết lập để bắt đầu chấm điểm."
                action={
                  <Link to="/thiet-lap" className="btn-primary">
                    Thêm giám khảo
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="app-card mb-4 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Giám khảo
                  </span>
                  {activeJudge && (
                    <JudgeTick
                      complete={selectedJudgeComplete}
                      label={selectedJudgeComplete ? 'Giám khảo đã xong' : 'Giám khảo chưa xong'}
                    />
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
                  {judges.map((judge) => {
                    const complete = isShow
                      ? Boolean(groupValidation?.judgeComplete[judge.id])
                      : Boolean(roundValidation?.judgeComplete[judge.id]);
                    const active = activeJudge?.id === judge.id;
                    return (
                      <button
                        key={judge.id}
                        type="button"
                        onClick={() => setJudgeId(judge.id)}
                        className={cn(
                          'flex min-h-[48px] w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-sm font-bold transition-colors',
                          active
                            ? 'border-brand-700 bg-brand-700 text-white'
                            : complete
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                        )}
                        aria-pressed={active}
                      >
                        <span
                          className={cn(
                            'inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 text-xs font-extrabold',
                            active ? 'bg-white text-brand-800' : 'bg-slate-100 text-slate-700',
                          )}
                        >
                          {judge.code}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{judge.name}</span>
                        {complete ? (
                          <CheckIcon
                            size={16}
                            className={cn('shrink-0', active ? 'text-white' : 'text-emerald-600')}
                          />
                        ) : (
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              active ? 'bg-white/60' : 'bg-slate-300',
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeJudge && (
                <div className="app-card p-4 sm:p-5">
                  {isShow ? (
                    <GroupJudging event={event} judge={activeJudge} readOnly={readOnly} />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold">Phiếu chấm của GK {activeJudge.code}</h2>
                            <Badge tone={selectedJudgeComplete ? 'green' : 'amber'}>
                              {judgeDancesDone}/{event.dances.length} điệu hoàn tất
                            </Badge>
                          </div>
                          <p className="muted mt-1">
                            {roundValidation
                              ? `${roundValidation.filled}/${roundValidation.total} ô điểm của vòng ${activeRound === 'semifinal' ? 'bán kết' : 'chung kết'}.`
                              : 'Chọn vòng thi để bắt đầu.'}
                          </p>
                        </div>
                        {activeDance && (
                          <div className="w-full sm:max-w-xs">
                            <ProgressBar
                              value={judgeDancesDone}
                              total={event.dances.length}
                              tone={selectedJudgeComplete ? 'green' : 'amber'}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Chọn điệu thi
                        </div>
                        <DanceTabBar
                          event={event}
                          round={activeRound}
                          judge={activeJudge}
                          activeDance={activeDance}
                          onSelect={setDance}
                        />
                      </div>

                      {activeDance ? (
                        <JudgingMatrix
                          event={event}
                          round={activeRound}
                          dance={activeDance}
                          judge={activeJudge}
                          readOnly={readOnly}
                          onRequestClear={() => setClearOpen(true)}
                        />
                      ) : (
                        <Callout tone="warning" title="Sự kiện chưa có điệu thi">
                          Hãy sửa sự kiện và chọn ít nhất một điệu.
                        </Callout>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isShow && activeRound === 'final' && finalResults && (
                <FinalStatus
                  event={event}
                  complete={finalResults.complete}
                  finalTies={finalResults.overallTies.length}
                />
              )}
            </>
          )}

          {!isShow && activeRound === 'semifinal' && event.semifinal && (
            <div className="mt-4">
              <SemifinalSummary event={event} />
            </div>
          )}
        </>
      )}

      {activeJudge && activeDance && (
        <ConfirmDialog
          open={clearOpen}
          title={`Xóa điểm điệu ${DANCE_INFO[activeDance].name} của GK ${activeJudge.code}?`}
          description="Các hạng đã nhập cho giám khảo này ở điệu đang chọn sẽ bị xóa."
          confirmLabel="Xóa điểm điệu"
          onCancel={() => setClearOpen(false)}
          onConfirm={() => {
            actions.clearJudgeDance(event.id, activeRound, activeDance, activeJudge.id);
            notify('success', 'Đã xóa điểm của điệu đang chọn.');
            setClearOpen(false);
          }}
        >
          <p className="text-sm text-slate-600">
            Điểm của các giám khảo khác và các điệu khác không bị ảnh hưởng.
          </p>
        </ConfirmDialog>
      )}

      <ConfirmDialog
        open={unlockOpen}
        tone="warning"
        title={`Mở khóa “${event.name}”?`}
        description="Chỉ Chủ tịch hội đồng nên thực hiện thao tác này."
        confirmLabel="Mở khóa"
        onCancel={() => setUnlockOpen(false)}
        onConfirm={() => {
          actions.unlockEvent(event.id);
          setUnlockOpen(false);
          notify('warning', 'Đã mở khóa. Mọi sửa điểm sẽ được ghi vào lịch sử.');
        }}
      >
        <Callout tone="warning" title="Kết quả có thể thay đổi">
          Sau khi mở khóa, bảng điểm có thể sửa. Hãy khóa lại sau khi kiểm tra xong để bảo vệ kết
          quả.
        </Callout>
      </ConfirmDialog>

      <ConfirmDialog
        open={startOpen}
        tone="primary"
        title={`Bắt đầu “${event.name}”?`}
        description="Danh sách đăng ký sẽ được khóa lại."
        confirmLabel="Bắt đầu chấm"
        onCancel={() => setStartOpen(false)}
        onConfirm={() => {
          actions.startEvent(event.id);
          setStartOpen(false);
          notify('success', 'Đã bắt đầu sự kiện.');
        }}
      >
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            {event.athleteIds.length} VĐV/đội · {judges.length} giám khảo.
          </p>
          <p className="text-xs text-slate-500">
            {event.category === 'show'
              ? 'Đồng diễn: chấm trực tiếp 5 tiêu chí.'
              : event.athleteIds.length >= 7
                ? 'Có từ 7 VĐV: hệ thống tạo bán kết trước.'
                : 'Dưới 7 VĐV: thi trực tiếp chung kết.'}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function StartPanel({
  event,
  canStart,
  onStart,
}: {
  event: DanceEvent;
  canStart: boolean;
  onStart: () => void;
}) {
  const { state } = useApp();
  const isShow = event.category === 'show';
  const semifinal = !isShow && event.athleteIds.length >= 7;
  return (
    <div className="app-card card-pad">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-800">
          <ClipboardIcon size={28} />
        </div>
        <h2 className="mt-3 text-xl font-extrabold">Sự kiện chưa bắt đầu</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {isShow
            ? 'Đồng diễn chấm 5 tiêu chí cho mỗi đội.'
            : semifinal
              ? `${event.athleteIds.length} VĐV: hệ thống sẽ tạo bán kết, sau đó tự chốt 6 VĐV vào chung kết.`
              : `${event.athleteIds.length} VĐV: thi trực tiếp chung kết.`}
        </p>
        <div className="mt-4 grid gap-2 text-left sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="tabular text-xl font-extrabold">{event.athleteIds.length}</div>
            <div className="text-xs text-slate-500">{isShow ? 'Đội' : 'VĐV/đội'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="tabular text-xl font-extrabold">{state.judges.length}</div>
            <div className="text-xs text-slate-500">Giám khảo</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="text-sm font-extrabold">
              {isShow ? '5 tiêu chí' : semifinal ? 'Bán kết + CK' : 'Chung kết'}
            </div>
            <div className="text-xs text-slate-500">Thể thức</div>
          </div>
        </div>
        {!canStart && (
          <div className="mt-4 text-left">
            <Callout tone="warning" title="Chưa thể bắt đầu">
              {state.judges.length === 0
                ? 'Chưa có giám khảo. Thêm giám khảo ở trang Thiết lập.'
                : 'Cần ít nhất 2 VĐV/đội. Hãy đăng ký thêm ở trang Sự kiện.'}
            </Callout>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onStart} disabled={!canStart}>
            <ClipboardIcon size={18} /> Bắt đầu chấm điểm
          </Button>
          <Link to={`/su-kien?event=${encodeURIComponent(event.id)}`} className="btn-secondary">
            Quản lý đăng ký
          </Link>
        </div>
      </div>
    </div>
  );
}

function DanceTabBar({
  event,
  round,
  judge,
  activeDance,
  onSelect,
}: {
  event: DanceEvent;
  round: RoundType;
  judge: Judge;
  activeDance?: Dance;
  onSelect: (dance: Dance) => void;
}) {
  const slotsFor = (dance: Dance) => {
    const expected = round === 'semifinal' ? 6 : event.finalists?.length ?? 0;
    const slots = event[round]?.marks?.[dance]?.[judge.id] ?? [];
    return {
      filled: slots.slice(0, expected).filter(Boolean).length,
      expected,
    };
  };
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {event.dances.map((dance) => {
        const { filled, expected } = slotsFor(dance);
        const complete = expected > 0 && filled === expected;
        const active = activeDance === dance;
        return (
          <button
            key={dance}
            type="button"
            onClick={() => onSelect(dance)}
            className={cn(
              'inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors',
              active
                ? 'border-brand-700 bg-brand-700 text-white'
                : complete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
            aria-pressed={active}
            title={`${DANCE_INFO[dance].name} – đã nhập ${filled}/${expected}`}
          >
            <span
              className={cn(
                'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-xs font-extrabold',
                active ? 'bg-white text-brand-800' : 'bg-slate-100 text-slate-700',
              )}
            >
              {DANCE_INFO[dance].short}
            </span>
            <span className="hidden sm:inline">{DANCE_INFO[dance].name}</span>
            {complete ? (
              <CheckIcon size={15} className={active ? 'text-white' : 'text-emerald-600'} />
            ) : (
              <span className={cn('text-[10px] font-semibold', active ? 'text-white' : 'text-slate-500')}>
                {filled}/{expected}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function FinalStatus({
  event,
  complete,
  finalTies,
}: {
  event: DanceEvent;
  complete: boolean;
  finalTies: number;
}) {
  return (
    <div className="mt-4">
      {complete ? (
        <Callout
          tone={finalTies ? 'warning' : 'success'}
          title={
            finalTies
              ? 'Đã đủ điểm nhưng còn trường hợp hòa'
              : 'Chung kết đã đủ điểm'
          }
          action={
            <Link to={`/xep-hang?event=${encodeURIComponent(event.id)}`} className="btn-primary">
              <TrophyIcon size={18} /> Xem kết quả
            </Link>
          }
        >
          {finalTies
            ? 'Chủ tịch hội đồng cần phân định tại trang Xếp hạng trước khi công bố chính thức.'
            : 'Kết quả đã được tính theo Skating System. Mở trang Xếp hạng để xem chi tiết và in.'}
        </Callout>
      ) : (
        <Callout tone="info" title="Chung kết đang chấm">
          Cần đủ điểm tất cả giám khảo và tất cả điệu để tự động hoàn tất. Hiện chưa đủ.
        </Callout>
      )}
    </div>
  );
}
