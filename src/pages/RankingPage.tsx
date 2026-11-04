import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Athlete, Dance, DanceEvent, Judge } from '../types';
import { useApp } from '../store/AppStore';
import {
  computeFinalResults,
  computeGroupForEvent,
  computeSemifinalResults,
  type FinalResults,
} from '../lib/results';
import {
  CATEGORIES,
  categoryInfo,
  DANCE_INFO,
  STATUS_INFO,
} from '../lib/constants';
import { groupJudgeTable, type GroupResult } from '../lib/group';
import type { SemifinalResult } from '../lib/semifinal';
import { cn, formatDate, formatDateTime, sortBibs } from '../lib/utils';
import {
  AthleteLabel,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  PlaceNumber,
} from '../components/ui';
import { SkatingTables, TieResolverModal } from '../components/SkatingTables';
import {
  AlertTriangleIcon,
  ClipboardIcon,
  GavelIcon,
  LockIcon,
  MedalIcon,
  PrinterIcon,
} from '../components/icons';

type View = 'event' | 'summary';
type Tab = 'result' | 'judges' | 'skating' | 'semifinal';
type TieDialog = {
  scope: 'dance' | 'overall';
  dance?: Dance;
  athleteIds: string[];
  initialOrder: string[];
};

export default function RankingPage() {
  const { state } = useApp();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('event');
  const [tab, setTab] = useState<Tab>('result');
  const [detailJudgeId, setDetailJudgeId] = useState<string | null>(null);
  const [tieDialog, setTieDialog] = useState<TieDialog | null>(null);

  const eventId = params.get('event');
  const tabParam = params.get('tab');
  const fallback = useMemo(() => {
    return (
      state.events.find((event) => event.status === 'done') ??
      state.events.find((event) => event.final || event.groupScores) ??
      state.events.find((event) => event.status === 'final' || event.status === 'semifinal') ??
      state.events[0]
    );
  }, [state.events]);
  const event = state.events.find((item) => item.id === eventId) ?? fallback;

  useEffect(() => {
    if ((!eventId || !state.events.some((item) => item.id === eventId)) && fallback) {
      setParams({ event: fallback.id }, { replace: true });
    }
  }, [eventId, fallback, state.events, setParams]);

  useEffect(() => {
    if (
      tabParam &&
      ['result', 'judges', 'skating', 'semifinal'].includes(tabParam)
    ) {
      setTab(tabParam as Tab);
    } else {
      setTab('result');
    }
    setDetailJudgeId(null);
  }, [event?.id, tabParam]);

  const isShow = event?.category === 'show';
  const finalResults = useMemo(() => {
    if (!event || isShow) return null;
    if (event.status !== 'final' && event.status !== 'done') return null;
    return computeFinalResults(event, state.judges);
  }, [event, isShow, state.judges]);

  const groupResult = useMemo(() => {
    if (!event || !isShow) return null;
    return computeGroupForEvent(event, state.judges, state.settings.criteria);
  }, [event, isShow, state.judges, state.settings.criteria]);

  const semifinalBundle = useMemo(() => {
    if (!event || !event.semifinal) return null;
    return computeSemifinalResults(event, state.judges);
  }, [event, state.judges]);

  const availableTabs = useMemo<Tab[]>(() => {
    const tabs: Tab[] = ['result', 'judges'];
    if (!isShow && finalResults) tabs.push('skating');
    if (event?.semifinal) tabs.push('semifinal');
    return tabs;
  }, [isShow, finalResults, event?.semifinal]);
  const activeTab = availableTabs.includes(tab) ? tab : 'result';

  const selectTab = (next: Tab) => {
    setTab(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'result') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  const activeJudge =
    state.judges.find((judge) => judge.id === detailJudgeId) ?? state.judges[0];

  if (!event) {
    return (
      <div>
        <PageHeader title="Bảng xếp hạng" eyebrow="Kết quả giải đấu" />
        <EmptyState
          title="Chưa có sự kiện"
          description="Tạo sự kiện và chấm điểm trước khi xem bảng xếp hạng."
          action={
            <Link to="/su-kien" className="btn-primary">
              Đi tới Sự kiện
            </Link>
          }
        />
      </div>
    );
  }

  const printTitle =
    view === 'summary' ? 'TỔNG HỢP TOÀN GIẢI' : `BẢNG XẾP HẠNG – ${event.name}`;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          eyebrow="Kết quả giải đấu"
          title="Bảng xếp hạng"
          description="Kết quả theo Skating System WDSF, chi tiết từng giám khảo và bảng kiểm tra minh bạch. Bản in A4 sẵn sàng để công bố."
          actions={
            <>
              <Button onClick={() => window.print()}>
                <PrinterIcon size={18} /> In A4
              </Button>
              <Link to="/xuat" className="btn-secondary">
                <ClipboardIcon size={18} /> Xuất Excel / sao lưu
              </Link>
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-card">
            <button
              type="button"
              onClick={() => setView('event')}
              className={cn(
                'min-h-[44px] rounded-lg px-4 text-sm font-bold',
                view === 'event' ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              Theo sự kiện
            </button>
            <button
              type="button"
              onClick={() => setView('summary')}
              className={cn(
                'min-h-[44px] rounded-lg px-4 text-sm font-bold',
                view === 'summary' ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              Tổng hợp toàn giải
            </button>
          </div>

          {view === 'event' && (
            <>
              <select
                className="select max-w-xl flex-1"
                value={event.id}
                onChange={(inputEvent) => {
                  setParams({ event: inputEvent.target.value });
                  setTab('result');
                }}
                aria-label="Chọn sự kiện"
              >
                <optgroup label="Hoàn tất">
                  {state.events
                    .filter((item) => item.status === 'done')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Đang thi">
                  {state.events
                    .filter((item) => item.status === 'final' || item.status === 'semifinal')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {STATUS_INFO[item.status].label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Chưa thi">
                  {state.events
                    .filter((item) => item.status === 'pending')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              <Badge tone={event.unlocked ? 'amber' : 'gray'}>
                {event.unlocked ? 'Đang mở khóa' : event.status === 'done' ? 'Đã khóa' : 'Đang cập nhật'}
              </Badge>
            </>
          )}
        </div>

        {view === 'event' && (
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card">
            {[
              { id: 'result' as const, label: 'Kết quả' },
              { id: 'judges' as const, label: 'Chi tiết giám khảo' },
              ...(!isShow && finalResults ? [{ id: 'skating' as const, label: 'Bảng Skating' }] : []),
              ...(event.semifinal ? [{ id: 'semifinal' as const, label: 'Bán kết' }] : []),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={cn(
                  'min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-bold',
                  activeTab === item.id
                    ? 'bg-brand-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'summary' ? (
        <div className="print-area">
          <PrintHeader title="TỔNG HỢP TOÀN GIẢI" event={null} state={state} />
          <CompetitionSummary
            onSelect={(id) => {
              setParams({ event: id });
              setView('event');
              setTab('result');
            }}
          />
          <PrintSignature />
        </div>
      ) : (
        <div className="print-area">
          <PrintHeader title={printTitle} event={event} state={state} />

          {event.status === 'pending' ? (
            <div className="no-print">
              <EmptyState
                icon={<ClipboardIcon size={36} />}
                title="Sự kiện chưa thi"
                description="Chưa có kết quả để xếp hạng. Hãy đăng ký VĐV và bắt đầu chấm điểm."
                action={
                  <Link to={`/su-kien?event=${encodeURIComponent(event.id)}`} className="btn-primary">
                    Chuẩn bị sự kiện
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="no-print">
                <EventBanner
                  event={event}
                  finalResults={finalResults}
                  groupResult={groupResult}
                  semifinalBundle={semifinalBundle}
                />
              </div>

              {activeTab === 'result' && (
                <ResultTab
                  event={event}
                  finalResults={finalResults}
                  groupResult={groupResult}
                  semifinalBundle={semifinalBundle}
                  onResolveTie={setTieDialog}
                />
              )}

              {activeTab === 'judges' && (
                <JudgesTab
                  event={event}
                  activeJudge={activeJudge}
                  onSelectJudge={setDetailJudgeId}
                  finalResults={finalResults}
                  groupResult={groupResult}
                />
              )}

              {activeTab === 'skating' && finalResults && (
                <div className="app-card card-pad">
                  <SkatingTables event={event} result={finalResults} athletes={state.athletes} />
                </div>
              )}

              {activeTab === 'semifinal' && (
                <SemifinalTab
                  event={event}
                  semifinal={semifinalBundle}
                  finalResults={finalResults}
                />
              )}

              {activeTab === 'result' && (
                <TieSection
                  event={event}
                  finalResults={finalResults}
                  groupResult={groupResult}
                  onResolve={setTieDialog}
                />
              )}
            </>
          )}

          <PrintSignature />
        </div>
      )}

      {tieDialog && (
        <TieResolverModal
          key={`${tieDialog.scope}-${tieDialog.dance ?? 'overall'}-${tieDialog.athleteIds.join('-')}`}
          open
          onClose={() => setTieDialog(null)}
          event={event}
          scope={tieDialog.scope}
          dance={tieDialog.dance}
          athleteIds={tieDialog.athleteIds}
          initialOrder={tieDialog.initialOrder}
        />
      )}
    </div>
  );
}

function PrintHeader({
  title,
  event,
  state,
}: {
  title: string;
  event: DanceEvent | null;
  state: ReturnType<typeof useApp>['state'];
}) {
  return (
    <div className="hidden print:block mb-6 text-center">
      <div className="text-xs font-bold uppercase tracking-[0.18em]">{state.settings.competitionName}</div>
      <div className="mt-1 text-xs">
        {state.settings.venue}
        {state.settings.venue && state.settings.eventDate ? ' · ' : ''}
        {state.settings.eventDate ? formatDate(state.settings.eventDate) : ''}
      </div>
      <h1 className="mt-3 text-xl font-extrabold uppercase tracking-wide">{title}</h1>
      {event && (
        <div className="mt-1 text-sm">
          {categoryInfo(event.category).label} · {event.dances.length > 0 ? event.dances.map((d) => DANCE_INFO[d].name).join(' · ') : '5 tiêu chí'}
        </div>
      )}
      <div className="mt-1 text-[10px] text-slate-500">
        Hội đồng giám khảo: {state.judges.map((judge) => `${judge.code} – ${judge.name}`).join('; ')}
      </div>
    </div>
  );
}

function PrintSignature() {
  return (
    <div className="hidden print:grid mt-10 grid-cols-3 gap-8 text-center text-xs">
      <div>
        <div className="font-bold">CHỦ TỊCH HỘI ĐỒNG</div>
        <div className="mt-16 border-t border-slate-400 pt-1">(Ký, ghi rõ họ tên)</div>
      </div>
      <div>
        <div className="font-bold">TRƯỞNG BAN THƯ KÝ</div>
        <div className="mt-16 border-t border-slate-400 pt-1">(Ký, ghi rõ họ tên)</div>
      </div>
      <div>
        <div className="font-bold">ĐẠI DIỆN BAN TỔ CHỨC</div>
        <div className="mt-16 border-t border-slate-400 pt-1">(Ký, ghi rõ họ tên)</div>
      </div>
    </div>
  );
}

function EventBanner({
  event,
  finalResults,
  groupResult,
  semifinalBundle,
}: {
  event: DanceEvent;
  finalResults: FinalResults | null;
  groupResult: GroupResult | null;
  semifinalBundle: ReturnType<typeof computeSemifinalResults> | null;
}) {
  if (event.status === 'semifinal') {
    return (
      <Callout
        tone="info"
        title="Đang thi bán kết – kết quả dưới đây là tạm tính"
        action={
          <Link to={`/cham-diem?event=${encodeURIComponent(event.id)}`} className="btn-primary">
            <ClipboardIcon size={18} /> Chấm bán kết
          </Link>
        }
      >
        {semifinalBundle?.complete
          ? semifinalBundle.result.boundaryTie
            ? 'Đã đủ điểm nhưng có hòa ở vị trí thứ 6. Chủ tịch hội đồng cần quyết định danh sách chung kết.'
            : 'Đã đủ điểm bán kết. Hệ thống sẽ chuyển top 6 vào chung kết.'
          : 'Chưa đủ điểm bán kết. Bảng xếp hạng chỉ mang tính tạm tính.'}
      </Callout>
    );
  }
  if (event.status === 'final' && finalResults && !finalResults.complete) {
    return (
      <Callout
        tone="warning"
        title="Chung kết chưa đủ điểm"
        action={
          <Link to={`/cham-diem?event=${encodeURIComponent(event.id)}`} className="btn-primary">
            <ClipboardIcon size={18} /> Chấm tiếp
          </Link>
        }
      >
        Kết quả bên dưới là tạm tính. Cần đủ điểm tất cả giám khảo và tất cả điệu để chốt.
      </Callout>
    );
  }
  if (event.status === 'done' && !event.unlocked) {
    const hasTies = Boolean(
      finalResults?.overallTies.length ||
        finalResults?.danceTies.length ||
        groupResult?.ties.length,
    );
    return (
      <Callout
        tone={hasTies ? 'warning' : 'success'}
        title={hasTies ? 'Kết quả đã khóa nhưng còn hòa cần xử lý' : 'Kết quả đã được khóa'}
      >
        {hasTies
          ? 'Chủ tịch hội đồng phân định các trường hợp hòa bên dưới. Quyết định sẽ được ghi lịch sử.'
          : 'Bảng xếp hạng đã hoàn tất và sẵn sàng in. Có thể mở khóa tại trang Sự kiện nếu cần sửa.'}
      </Callout>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tab kết quả
// ---------------------------------------------------------------------------

type ResolveTie = (dialog: TieDialog) => void;

function ResultTab({
  event,
  finalResults,
  groupResult,
  semifinalBundle,
  onResolveTie,
}: {
  event: DanceEvent;
  finalResults: FinalResults | null;
  groupResult: GroupResult | null;
  semifinalBundle: ReturnType<typeof computeSemifinalResults> | null;
  onResolveTie: ResolveTie;
}) {
  const { state } = useApp();
  const athleteById = new Map(state.athletes.map((athlete) => [athlete.id, athlete]));

  const isShow = event.category === 'show';
  const resultRows = isShow
    ? groupResult?.rows.map((row) => ({
        athleteId: row.athleteId,
        place: row.place,
        score: row.total,
        tied: row.tied,
        raw: row.rawTotal,
      })) ?? []
    : finalResults?.overall.rows.map((row) => ({
        athleteId: row.athleteId,
        place: row.place,
        score: row.total,
        tied: row.tied,
        raw: row.rawSum,
      })) ?? [];
  const semifinalRows = semifinalBundle?.result.rows ?? [];
  const showSemifinalAsMain = event.status === 'semifinal' && !isShow;

  if (isShow && !groupResult) {
    return <EmptyState title="Chưa có kết quả đồng diễn" />;
  }
  if (!isShow && !finalResults && !showSemifinalAsMain) {
    return (
      <EmptyState
        title="Chưa có kết quả chung kết"
        description="Sự kiện cần hoàn tất chấm điểm để hiển thị bảng xếp hạng chính thức."
      />
    );
  }

  const displayRows = showSemifinalAsMain ? [] : resultRows;
  const top3 = displayRows.slice(0, 3);
  const danceTieMembers = new Set(
    finalResults?.danceTies.flatMap((entry) =>
      entry.ties.flatMap((tie) => tie.athleteIds),
    ) ?? [],
  );
  const hasTies = Boolean(
    finalResults?.overallTies.length ||
      finalResults?.danceTies.length ||
      groupResult?.ties.length,
  );

  return (
    <div className="space-y-5">
      {hasTies && !showSemifinalAsMain && event.status !== 'done' && (
        <Callout tone="warning" title="Kết quả còn trường hợp hòa chưa xử lý">
          Các hạng liên quan đang được tạm xếp để hiển thị. Chủ tịch hội đồng cần phân định ở mục
          “Xử lý hòa” bên dưới; quyết định sẽ được ghi lịch sử.
        </Callout>
      )}

      {!showSemifinalAsMain && (
        <div className="grid gap-3 sm:grid-cols-3">
          {top3.map((row, index) => {
            const athlete = athleteById.get(row.athleteId);
            const provisional = row.tied || danceTieMembers.has(row.athleteId);
            return (
              <div
                key={row.athleteId}
                className={cn(
                  'rounded-2xl border p-4 shadow-card',
                  index === 0 && 'podium-gold',
                  index === 1 && 'podium-silver',
                  index === 2 && 'podium-bronze',
                  provisional && 'ring-2 ring-amber-300',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'tabular flex h-10 w-10 items-center justify-center rounded-full text-base font-extrabold',
                        index === 0 && 'bg-amber-700 text-white',
                        index === 1 && 'bg-slate-500 text-white',
                        index === 2 && 'bg-orange-700 text-white',
                      )}
                    >
                      {row.place}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      {provisional
                        ? `Tạm xếp hạng ${row.place}`
                        : index === 0
                          ? 'Vô địch'
                          : index === 1
                            ? 'Á quân'
                            : 'Hạng ba'}
                    </span>
                  </div>
                  <MedalIcon
                    size={26}
                    className={
                      index === 0 ? 'text-amber-600' : index === 1 ? 'text-slate-500' : 'text-orange-700'
                    }
                  />
                </div>
                <div className="mt-3">
                  <AthleteLabel athlete={athlete} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 border-t border-black/5 pt-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {isShow ? 'Tổng điểm' : 'Tổng hạng'}
                  </span>
                  <span className="tabular text-2xl font-extrabold text-slate-900">
                    {row.score}
                  </span>
                </div>
                {provisional && (
                  <div className="mt-2">
                    <Badge tone="amber">Hòa – cần phân định</Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="app-card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">
              {showSemifinalAsMain
                ? 'Kết quả bán kết'
                : isShow
                  ? 'Kết quả Đồng diễn'
                  : 'Kết quả chung kết'}
            </h2>
            <p className="muted mt-1">
              {showSemifinalAsMain
                ? 'Số lượt chọn giảm dần; bằng nhau xét tổng hạng. Top 6 vào chung kết.'
                : isShow
                  ? `${state.judges.length} giám khảo · ${event.dropHighLow ? 'bỏ điểm cao nhất và thấp nhất' : 'cộng toàn bộ điểm'}`
                  : `${event.dances.length} điệu · ${state.judges.length} giám khảo · Tổng hạng nhỏ hơn xếp trên`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.status === 'done' && !event.unlocked && (
              <Badge tone="dark">
                <LockIcon size={12} /> Đã khóa
              </Badge>
            )}
            {event.status === 'done' && event.unlocked && <Badge tone="amber">Đang mở khóa</Badge>}
            {!isShow && finalResults?.validation && (
              <Badge tone={finalResults.complete ? 'green' : 'amber'}>
                {finalResults.validation.filled}/{finalResults.validation.total} ô điểm
              </Badge>
            )}
          </div>
        </div>

        {showSemifinalAsMain ? (
          <SemifinalMainTable rows={semifinalRows} event={event} />
        ) : isShow ? (
          <GroupResultTable rows={groupResult?.rows ?? []} event={event} />
        ) : (
          <FinalResultTable
            event={event}
            result={finalResults!}
            onResolveTie={onResolveTie}
          />
        )}
      </div>

      {!showSemifinalAsMain && (
        <TieSection
          event={event}
          finalResults={finalResults}
          groupResult={groupResult}
          onResolve={onResolveTie}
        />
      )}

      {showSemifinalAsMain && semifinalBundle?.result.boundaryTie && (
        <Callout
          tone="warning"
          title="Hòa ở vị trí thứ 6"
          action={
            <Link to={`/cham-diem?event=${encodeURIComponent(event.id)}`} className="btn-warning">
              <AlertTriangleIcon size={18} /> Xử lý tại trang Chấm điểm
            </Link>
          }
        >
          Danh sách chung kết chưa được chốt. Chủ tịch hội đồng cần chọn đưa tất cả đồng hạng vào
          chung kết hoặc chọn thủ công.
        </Callout>
      )}
    </div>
  );
}

function FinalResultTable({
  event,
  result,
  onResolveTie,
}: {
  event: DanceEvent;
  result: FinalResults;
  onResolveTie: ResolveTie;
}) {
  const { state } = useApp();
  const athleteById = new Map(state.athletes.map((athlete) => [athlete.id, athlete]));
  const tiedDanceMembers = new Set(
    result.danceTies.flatMap((entry) => entry.ties.flatMap((tie) => tie.athleteIds)),
  );

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-16">Hạng</th>
            <th>VĐV</th>
            {event.dances.length > 1 &&
              event.dances.map((dance) => (
                <th key={dance} className="text-center" title={DANCE_INFO[dance].name}>
                  {DANCE_INFO[dance].short}
                </th>
              ))}
            <th className="text-right">Tổng hạng</th>
            <th className="text-right">Hạng thô</th>
            <th className="text-right">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {result.overall.rows.map((row) => (
            <tr
              key={row.athleteId}
              className={cn(
                row.tied || tiedDanceMembers.has(row.athleteId)
                  ? 'bg-amber-50'
                  : row.place === 1
                    ? 'bg-amber-50/50'
                    : row.place === 2
                      ? 'bg-slate-50'
                      : row.place === 3
                        ? 'bg-orange-50/50'
                        : undefined,
              )}
            >
              <td>
                <PlaceNumber place={row.place} tied={row.tied || tiedDanceMembers.has(row.athleteId)} />
              </td>
              <td>
                <AthleteLabel athlete={athleteById.get(row.athleteId)} />
              </td>
              {event.dances.length > 1 &&
                event.dances.map((dance) => (
                  <td key={dance} className="tabular text-center font-semibold">
                    {row.dancePlaces[dance] ?? '—'}
                  </td>
                ))}
              <td className="tabular text-right text-base font-extrabold">{row.total}</td>
              <td className="tabular text-right text-slate-500">{row.rawSum}</td>
              <td className="text-right">
                {row.tied ? (
                  <div className="flex items-center justify-end gap-2">
                    <Badge tone="amber">Hòa</Badge>
                    {event.status !== 'pending' && (
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 text-xs font-bold text-amber-800 hover:bg-amber-50"
                        onClick={() =>
                          onResolveTie({
                            scope: 'overall',
                            athleteIds:
                              result.overall.ties.find((tie) =>
                                tie.athleteIds.includes(row.athleteId),
                              )?.athleteIds ?? [row.athleteId],
                            initialOrder:
                              result.overall.ties
                                .find((tie) => tie.athleteIds.includes(row.athleteId))
                                ?.athleteIds.slice()
                                .sort(
                                  (a, b) =>
                                    (result.overall.rows.find((item) => item.athleteId === a)?.place ?? 0) -
                                    (result.overall.rows.find((item) => item.athleteId === b)?.place ?? 0),
                                ) ?? [row.athleteId],
                          })
                        }
                      >
                        <GavelIcon size={14} /> Phân định
                      </button>
                    )}
                  </div>
                ) : tiedDanceMembers.has(row.athleteId) ? (
                  <Badge tone="amber">Hòa điệu – tạm xếp</Badge>
                ) : (
                  <Badge tone="gray">{row.place === 1 ? 'Vô địch' : `Hạng ${row.place}`}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupResultTable({ rows, event }: { rows: GroupResult['rows']; event: DanceEvent }) {
  const { state } = useApp();
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-16">Hạng</th>
            <th>Đội</th>
            {state.judges.map((judge) => (
              <th key={judge.id} className="text-center">
                GK {judge.code}
              </th>
            ))}
            <th className="text-right">Tổng gốc</th>
            <th className="text-right">Tổng xếp hạng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const athlete = state.athletes.find((a) => a.id === row.athleteId);
            return (
              <tr key={row.athleteId} className={row.tied ? 'bg-amber-50' : undefined}>
                <td>
                  <PlaceNumber place={row.place} tied={row.tied} />
                </td>
                <td>
                  <AthleteLabel athlete={athlete} />
                </td>
                {state.judges.map((judge) => {
                  const score = row.judgeScores.find((item) => item.judgeId === judge.id);
                  const dropped = row.droppedJudgeIds.includes(judge.id);
                  return (
                    <td key={judge.id} className="text-center">
                      <span
                        className={cn(
                          'tabular inline-flex min-w-10 justify-center rounded-md px-1.5 py-0.5 text-xs font-bold',
                          dropped
                            ? 'bg-red-50 text-red-400 line-through'
                            : 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {score?.total ?? '—'}
                      </span>
                    </td>
                  );
                })}
                <td className="tabular text-right text-slate-500">{row.rawTotal}</td>
                <td className="tabular text-right text-base font-extrabold">{row.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {event.dropHighLow && (
        <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Các điểm bị gạch: tổng cao nhất và thấp nhất của giám khảo bị bỏ khi tính điểm xếp hạng.
        </div>
      )}
    </div>
  );
}

function SemifinalMainTable({
  rows,
  event,
}: {
  rows: SemifinalResult['rows'];
  event: DanceEvent;
}) {
  const { state } = useApp();
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-14">Hạng</th>
            <th>VĐV</th>
            {event.dances.map((dance) => (
              <th key={dance} className="text-center" title={DANCE_INFO[dance].name}>
                {DANCE_INFO[dance].short}
              </th>
            ))}
            <th className="text-right">Lượt chọn</th>
            <th className="text-right">Tổng hạng</th>
            <th className="text-right">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.athleteId} className={row.tiedAtCutoff ? 'bg-amber-50' : undefined}>
              <td className="tabular font-bold">{row.position}</td>
              <td>
                <AthleteLabel athlete={state.athletes.find((a) => a.id === row.athleteId)} />
              </td>
              {event.dances.map((dance) => (
                <td key={dance} className="text-center">
                  {row.perDance[dance].selected ? (
                    <span className="tabular inline-flex h-7 min-w-7 items-center justify-center rounded bg-slate-100 px-1 text-xs font-bold">
                      {row.perDance[dance].rank}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
              ))}
              <td className="tabular text-right font-bold">{row.selections}</td>
              <td className="tabular text-right">{row.rankSum}</td>
              <td className="text-right">
                {row.tiedAtCutoff ? (
                  <Badge tone="amber">Hòa ranh giới</Badge>
                ) : row.position <= 6 ? (
                  <Badge tone="green">Vào CK</Badge>
                ) : (
                  <Badge tone="gray">Dừng</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TieSection({
  event,
  finalResults,
  groupResult,
  onResolve,
}: {
  event: DanceEvent;
  finalResults: FinalResults | null;
  groupResult: GroupResult | null;
  onResolve: ResolveTie;
}) {
  const { state, actions } = useApp();
  const [clearTarget, setClearTarget] = useState<DanceEvent['resolutions'][number] | null>(null);
  const hasTies = Boolean(
    finalResults?.overallTies.length || finalResults?.danceTies.length || groupResult?.ties.length,
  );
  if (!hasTies && event.resolutions.length === 0) return null;

  const nameOf = (id: string) => {
    const athlete = state.athletes.find((item) => item.id === id);
    return athlete ? `${athlete.bib} ${athlete.name ?? athlete.teamName ?? `${athlete.male}/${athlete.female}`}` : id;
  };

  const initialFromRows = (ids: string[], rows: { athleteId: string; place: number }[]) =>
    [...ids].sort(
      (a, b) =>
        (rows.find((row) => row.athleteId === a)?.place ?? 0) -
        (rows.find((row) => row.athleteId === b)?.place ?? 0),
    );

  return (
    <div className="app-card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Xử lý hòa</h2>
          <p className="muted mt-1">
            Quyết định của Chủ tịch hội đồng được áp dụng vào kết quả và ghi vào lịch sử.
          </p>
        </div>
        {!hasTies && <Badge tone="green">Không còn trường hợp hòa</Badge>}
      </div>

      {hasTies && (
        <div className="mt-4 space-y-3">
          {finalResults?.overallTies.map((tie) => (
            <div key={`overall-${tie.key}`} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-amber-900">
                    Hòa tổng hạng: {tie.athleteIds.map(nameOf).join(' · ')}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-800">
                    Cần xác định thứ tự cho các hạng {tie.places.join(', ')}.
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 text-sm font-bold text-amber-800 hover:bg-amber-100"
                  onClick={() =>
                    onResolve({
                      scope: 'overall',
                      athleteIds: tie.athleteIds,
                      initialOrder: initialFromRows(
                        tie.athleteIds,
                        finalResults.overall.rows,
                      ),
                    })
                  }
                >
                  <GavelIcon size={17} /> Chủ tịch phân định
                </button>
              </div>
            </div>
          ))}

          {finalResults?.danceTies.map((entry) =>
            entry.ties.map((tie) => (
              <div key={`dance-${entry.dance}-${tie.key}`} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-amber-900">
                      Hòa điệu {DANCE_INFO[entry.dance].name}: {tie.athleteIds.map(nameOf).join(' · ')}
                    </div>
                    <div className="mt-0.5 text-xs text-amber-800">
                      Cần xác định thứ tự cho các hạng {tie.places.join(', ')} trong điệu.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 text-sm font-bold text-amber-800 hover:bg-amber-100"
                    onClick={() =>
                      onResolve({
                        scope: 'dance',
                        dance: entry.dance,
                        athleteIds: tie.athleteIds,
                        initialOrder: initialFromRows(
                          tie.athleteIds,
                          finalResults.danceResults[entry.dance]?.rows ?? [],
                        ),
                      })
                    }
                  >
                    <GavelIcon size={17} /> Chủ tịch phân định
                  </button>
                </div>
              </div>
            )),
          )}

          {groupResult?.ties.map((tie) => (
            <div key={`group-${tie.key}`} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-amber-900">
                    Đồng điểm: {tie.athleteIds.map(nameOf).join(' · ')}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-800">
                    Tổng điểm bằng nhau; cần xác định thứ tự.
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 text-sm font-bold text-amber-800 hover:bg-amber-100"
                  onClick={() =>
                    onResolve({
                      scope: 'overall',
                      athleteIds: tie.athleteIds,
                      initialOrder: initialFromRows(tie.athleteIds, groupResult.rows),
                    })
                  }
                >
                  <GavelIcon size={17} /> Chủ tịch phân định
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {event.resolutions.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-bold">Quyết định phân định đã lưu</h3>
          <div className="mt-2 space-y-2">
            {event.resolutions.map((resolution) => (
              <div
                key={resolution.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="text-xs leading-relaxed text-slate-700">
                  <div className="font-bold text-slate-900">
                    {resolution.scope === 'dance'
                      ? `Điệu ${DANCE_INFO[resolution.dance as Dance]?.name ?? resolution.dance}`
                      : 'Tổng hợp'}
                    : {resolution.order.map(nameOf).join(' → ')}
                  </div>
                  <div className="mt-0.5 text-slate-500">
                    {formatDateTime(resolution.at)} · {resolution.by}
                    {resolution.note ? ` · ${resolution.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setClearTarget(resolution)}
                  disabled={event.status === 'done' && !event.unlocked}
                  title={
                    event.status === 'done' && !event.unlocked
                      ? 'Mở khóa sự kiện để hủy quyết định'
                      : 'Hủy quyết định này'
                  }
                >
                  Hủy quyết định
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(clearTarget)}
        tone="warning"
        title="Hủy quyết định phân định hòa?"
        description="Kết quả sẽ trở về cách xếp tạm tính của thuật toán cho đến khi Chủ tịch HĐ phân định lại."
        confirmLabel="Hủy quyết định"
        onCancel={() => setClearTarget(null)}
        onConfirm={() => {
          if (clearTarget) actions.clearTieResolution(event.id, clearTarget.id);
          setClearTarget(null);
        }}
      >
        <p className="text-sm text-slate-600">
          Quyết định này đã được ghi vào lịch sử. Thao tác hủy cũng sẽ được ghi nhận.
        </p>
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab chi tiết giám khảo
// ---------------------------------------------------------------------------

function JudgesTab({
  event,
  activeJudge,
  onSelectJudge,
  finalResults,
  groupResult,
}: {
  event: DanceEvent;
  activeJudge?: Judge;
  onSelectJudge: (id: string) => void;
  finalResults: FinalResults | null;
  groupResult: GroupResult | null;
}) {
  const { state } = useApp();
  if (state.judges.length === 0) {
    return <EmptyState title="Chưa có giám khảo" />;
  }
  const isShow = event.category === 'show';
  const participants = event.finalists ?? event.athleteIds;
  const roundType = event.final ? 'final' : 'semifinal';

  return (
    <div className="app-card card-pad">
      <h2 className="section-title">Chi tiết điểm từng giám khảo</h2>
      <p className="muted mt-1">
        {isShow
          ? 'Chọn giám khảo để xem điểm 5 tiêu chí của từng đội.'
          : 'Chọn giám khảo để xem phiếu xếp hạng của họ ở từng điệu.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {state.judges.map((judge) => (
          <button
            key={judge.id}
            type="button"
            onClick={() => onSelectJudge(judge.id)}
            className={cn(
              'inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold',
              activeJudge?.id === judge.id
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span
              className={cn(
                'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-xs font-extrabold',
                activeJudge?.id === judge.id
                  ? 'bg-white text-brand-800'
                  : 'bg-slate-100 text-slate-700',
              )}
            >
              {judge.code}
            </span>
            {judge.name}
          </button>
        ))}
      </div>

      {activeJudge &&
        (isShow ? (
          <GroupJudgeTable event={event} judge={activeJudge} />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="table-base">
              <thead>
                <tr>
                  <th>VĐV</th>
                  {event.dances.map((dance) => (
                    <th key={dance} className="text-center" title={DANCE_INFO[dance].name}>
                      {DANCE_INFO[dance].short}
                    </th>
                  ))}
                  <th className="text-right">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {sortBibs(
                  participants
                    .map((id) => state.athletes.find((athlete) => athlete.id === id))
                    .filter(Boolean) as Athlete[],
                ).map((athlete) => {
                  const overallRow = finalResults?.overall.rows.find(
                    (row) => row.athleteId === athlete.id,
                  );
                  return (
                    <tr key={athlete.id}>
                      <td>
                        <AthleteLabel athlete={athlete} compact />
                      </td>
                      {event.dances.map((dance) => {
                        const slots =
                          event[roundType]?.marks?.[dance]?.[activeJudge.id] ?? [];
                        const index = slots.indexOf(athlete.id);
                        return (
                          <td key={dance} className="text-center">
                            {index >= 0 ? (
                              <span className="tabular inline-flex h-7 min-w-7 items-center justify-center rounded bg-slate-100 px-1 text-xs font-bold">
                                {index + 1}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-right text-xs text-slate-500">
                        {overallRow
                          ? `Hạng ${overallRow.place}${overallRow.tied ? ' (hòa)' : ''}`
                          : roundType === 'semifinal'
                            ? 'Bán kết'
                            : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {groupResult && groupResult.ties.length > 0 && (
        <p className="mt-3 text-xs text-amber-700">
          Có trường hợp đồng điểm – xem mục Xử lý hòa ở tab Kết quả.
        </p>
      )}
    </div>
  );
}

function GroupJudgeTable({ event, judge }: { event: DanceEvent; judge: Judge }) {
  const { state } = useApp();
  const criteria = state.settings.criteria;
  const rows = groupJudgeTable(event, judge.id, criteria);
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="table-base">
        <thead>
          <tr>
            <th>Đội</th>
            {criteria.map((criterion) => (
              <th key={criterion.id} className="whitespace-normal text-center">
                {criterion.name}
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-slate-50 text-right">Tổng</th>
          </tr>
        </thead>
        <tbody>
          {(rows
            .map((row) => {
              const athlete = state.athletes.find((a) => a.id === row.teamId);
              return athlete ? { ...row, athlete } : null;
            })
            .filter(Boolean) as (typeof rows[number] & { athlete: Athlete })[])
            .sort((a, b) => a.athlete.bib.localeCompare(b.athlete.bib, 'vi', { numeric: true }))
            .map((row) => (
            <tr key={row.teamId}>
              <td>
                <AthleteLabel athlete={row.athlete} compact />
              </td>
              {criteria.map((criterion) => (
                <td key={criterion.id} className="tabular text-center">
                  {row.values[criterion.id] ?? '—'}
                </td>
              ))}
              <td className="tabular sticky right-0 z-10 border-l border-slate-100 bg-white text-right font-extrabold">{row.total ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bán kết
// ---------------------------------------------------------------------------

function SemifinalTab({
  event,
  semifinal,
  finalResults,
}: {
  event: DanceEvent;
  semifinal: ReturnType<typeof computeSemifinalResults> | null;
  finalResults: FinalResults | null;
}) {
  const { state } = useApp();
  if (!semifinal) return <EmptyState title="Không có dữ liệu bán kết" />;
  return (
    <div className="app-card card-pad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Bán kết</h2>
          <p className="muted mt-1">
            {semifinal.complete ? 'Đã đủ điểm bán kết.' : 'Chưa đủ điểm – bảng tạm tính.'}
          </p>
        </div>
        {semifinal.result.boundaryTie && <Badge tone="amber">Hòa vị trí thứ 6</Badge>}
      </div>
      <SemifinalMainTable rows={semifinal.result.rows} event={event} />
      {event.finalists && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="font-bold">Danh sách chung kết đã chốt ({event.finalists.length} VĐV)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {event.finalists.map((id) => {
              const athlete = state.athletes.find((a) => a.id === id);
              return athlete ? (
                <span key={id} className="rounded-lg bg-white px-2 py-1 text-xs font-semibold ring-1 ring-emerald-200">
                  {athlete.bib} · {athlete.name ?? athlete.teamName ?? `${athlete.male}/${athlete.female}`}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
      {finalResults && (
        <p className="mt-3 text-xs text-slate-500">
          Kết quả chung kết xem tại tab “Kết quả” hoặc “Bảng Skating”.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tổng hợp toàn giải
// ---------------------------------------------------------------------------

function CompetitionSummary({ onSelect }: { onSelect: (id: string) => void }) {
  const { state } = useApp();

  const summary = useMemo(() => {
    return CATEGORIES.map((category) => {
      const events = state.events.filter((event) => event.category === category.id);
      const rows = events.map((event) => {
        let top: { athleteId: string; place: number; score: number; tied: boolean }[] = [];
        let mode = '';
        let complete = false;
        if (event.category === 'show') {
          const group = computeGroupForEvent(event, state.judges, state.settings.criteria);
          top = group.rows.slice(0, 3).map((row) => ({
            athleteId: row.athleteId,
            place: row.place,
            score: row.total,
            tied: row.tied,
          }));
          mode = 'Tổng điểm';
          complete = group.complete;
        } else if (event.status === 'final' || event.status === 'done') {
          const result = computeFinalResults(event, state.judges);
          top =
            result?.overall.rows.slice(0, 3).map((row) => ({
              athleteId: row.athleteId,
              place: row.place,
              score: row.total,
              tied: row.tied,
            })) ?? [];
          mode = 'Tổng hạng';
          complete = Boolean(result?.complete);
        }
        return { event, top, mode, complete };
      });
      return { category, rows };
    });
  }, [state]);

  const totalDone = state.events.filter((e) => e.status === 'done').length;

  return (
    <div className="space-y-5">
      <div className="app-card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Tổng hợp toàn giải theo nội dung</h2>
            <p className="muted mt-1">
              Top 3 mỗi sự kiện đã có kết quả. Tổng cộng {totalDone}/{state.events.length} sự kiện
              hoàn tất.
            </p>
          </div>
          <Badge tone="blue">
            {state.judges.length} giám khảo · {state.athletes.length} VĐV/đội
          </Badge>
        </div>
      </div>

      {summary.map(({ category, rows }) => (
        <div key={category.id} className="app-card card-pad">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold">{category.label}</h3>
            <Badge tone="gray">{rows.length} sự kiện</Badge>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {rows.map(({ event, top, mode, complete }) => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-900">{event.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {event.dances.length > 0
                        ? event.dances.map((d) => DANCE_INFO[d].short).join(' · ')
                        : '5 tiêu chí'}{' '}
                      · {event.status === 'done' ? 'Hoàn tất' : complete ? 'Đủ điểm' : 'Chưa đủ điểm'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(event.id)}
                    className="inline-flex min-h-[44px] items-center text-xs font-bold text-brand-700 hover:underline"
                  >
                    Xem chi tiết →
                  </button>
                </div>
                {top.length === 0 ? (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Chưa có kết quả.
                  </div>
                ) : (
                  <div className="mt-2 space-y-1">
                    {top.map((row) => {
                      const athlete = state.athletes.find((a) => a.id === row.athleteId);
                      return (
                        <div
                          key={row.athleteId}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                              {row.place}
                            </span>
                            <span className="truncate text-xs font-semibold text-slate-700">
                              {athlete?.bib} · {athlete?.name ?? athlete?.teamName ?? `${athlete?.male}/${athlete?.female}`}
                            </span>
                          </div>
                          <span className="tabular shrink-0 text-xs font-bold text-slate-900">
                            {row.score} {mode === 'Tổng điểm' ? 'đ' : ''}
                            {row.tied ? '*' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          {rows.every((row) => row.top.length === 0) && (
            <p className="mt-3 text-xs text-slate-500">
              Chưa có sự kiện nào trong nội dung này có kết quả.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
