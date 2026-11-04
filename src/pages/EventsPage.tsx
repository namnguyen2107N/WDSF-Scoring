import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  Athlete,
  CategoryId,
  Dance,
  DanceEvent,
  EventStatus,
} from '../types';
import { useApp } from '../store/AppStore';
import {
  athleteKindForCategory,
  CATEGORIES,
  categoryInfo,
  DANCE_INFO,
  danceNames,
  LATIN_DANCES,
  STANDARD_DANCES,
  STATUS_INFO,
} from '../lib/constants';
import {
  computeFinalResults,
  computeGroupForEvent,
  computeSemifinalResults,
} from '../lib/results';
import { validateGroupAgainstCriteria } from '../lib/semifinal';
import { cn, formatDate, normalizeText, sortBibs } from '../lib/utils';
import {
  AthleteLabel,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  DanceTags,
  EmptyState,
  EventStatusBadge,
  Field,
  IconButton,
  JudgeTick,
  Modal,
  PageHeader,
  ProgressBar,
  SearchInput,
  Toggle,
} from '../components/ui';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  TrophyIcon,
  UnlockIcon,
  UsersIcon,
} from '../components/icons';

const CATEGORY_ORDER = CATEGORIES.map((c) => c.id);

type Notice = { tone: 'success' | 'info' | 'warning'; text: string };

export default function EventsPage() {
  const { state, actions } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CategoryId>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<{ event?: DanceEvent } | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DanceEvent | null>(null);
  const [resetTarget, setResetTarget] = useState<DanceEvent | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<DanceEvent | null>(null);
  const [startTarget, setStartTarget] = useState<DanceEvent | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const notify = (tone: Notice['tone'], text: string) => setNotice({ tone, text });

  const selectedId = params.get('event');
  const fallback = useMemo(() => {
    return (
      state.events.find((e) => e.status === 'final' || e.status === 'semifinal') ??
      state.events.find((e) => e.status === 'done') ??
      state.events[0]
    );
  }, [state.events]);
  const selected = state.events.find((e) => e.id === selectedId) ?? fallback;

  useEffect(() => {
    if (!selectedId && fallback) {
      setParams({ event: fallback.id }, { replace: true });
    }
  }, [selectedId, fallback, setParams]);

  const selectEvent = (id: string) => {
    setParams({ event: id });
  };

  const filteredEvents = useMemo(() => {
    const query = normalizeText(search);
    return state.events
      .filter((event) => {
        if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && event.status !== statusFilter) return false;
        if (!query) return true;
        return normalizeText(
          `${event.name} ${event.dances.map((d) => DANCE_INFO[d].name).join(' ')}`,
        ).includes(query);
      })
      .sort((a, b) => {
        const ca = CATEGORY_ORDER.indexOf(a.category);
        const cb = CATEGORY_ORDER.indexOf(b.category);
        if (ca !== cb) return ca - cb;
        return 0;
      });
  }, [state.events, search, categoryFilter, statusFilter]);

  const grouped = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      events: filteredEvents.filter((event) => event.category === category.id),
    })).filter((group) => group.events.length > 0);
  }, [filteredEvents]);

  const counts = {
    total: state.events.length,
    pending: state.events.filter((e) => e.status === 'pending').length,
    running: state.events.filter((e) => e.status === 'semifinal' || e.status === 'final').length,
    done: state.events.filter((e) => e.status === 'done').length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Điều hành giải"
        title="Sự kiện"
        description="Đăng ký vận động viên, bắt đầu vòng thi và theo dõi tiến độ từng nội dung. Sự kiện từ 7 VĐV trở lên tự động có bán kết."
        actions={
          <Button variant="primary" onClick={() => setEditor({})}>
            <PlusIcon size={18} /> Thêm sự kiện
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-value">{counts.total}</div>
          <div className="stat-label">Tổng sự kiện</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-slate-600">{counts.pending}</div>
          <div className="stat-label">Chưa thi</div>
        </div>
        <div className="stat-card border-blue-200 bg-blue-50/60">
          <div className="stat-value text-brand-800">{counts.running}</div>
          <div className="stat-label">Đang thi</div>
        </div>
        <div className="stat-card border-emerald-200 bg-emerald-50/60">
          <div className="stat-value text-emerald-800">{counts.done}</div>
          <div className="stat-label">Hoàn tất</div>
        </div>
      </div>

      {notice && (
        <div className="mb-4">
          <Callout tone={notice.tone} title={notice.text} />
        </div>
      )}

      <div className="mb-4 lg:hidden">
        <label className="label" htmlFor="mobile-event-select">
          Chọn sự kiện
        </label>
        <select
          id="mobile-event-select"
          className="select"
          value={selected?.id ?? ''}
          onChange={(inputEvent) => selectEvent(inputEvent.target.value)}
        >
          {CATEGORIES.map((category) => {
            const events = state.events.filter((event) => event.category === category.id);
            if (!events.length) return null;
            return (
              <optgroup key={category.id} label={category.label}>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} · {STATUS_INFO[event.status].label} · {event.athleteIds.length} VĐV
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <aside className="hidden min-w-0 lg:block">
          <div className="app-card lg:sticky lg:top-[140px]">
            <div className="space-y-3 border-b border-slate-200 p-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Tìm sự kiện hoặc điệu…"
              />
              <div className="flex gap-2">
                <select
                  className="select flex-1"
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value as 'all' | CategoryId)
                  }
                  aria-label="Lọc theo nội dung"
                >
                  <option value="all">Tất cả nội dung</option>
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <select
                  className="select flex-1"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | EventStatus)
                  }
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="all">Mọi trạng thái</option>
                  {(Object.keys(STATUS_INFO) as EventStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_INFO[status].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2">
              {grouped.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Không có sự kiện phù hợp bộ lọc.
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.category.id} className="mb-2">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                        {group.category.label}
                      </span>
                      <span className="tabular text-[11px] font-bold text-slate-500">
                        {group.events.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.events.map((event) => (
                        <EventListItem
                          key={event.id}
                          event={event}
                          selected={event.id === selected?.id}
                          onClick={() => selectEvent(event.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-3 hidden text-xs leading-relaxed text-slate-500 lg:block">
            Mẹo: dùng ô tìm kiếm để lọc nhanh theo tên điệu, ví dụ “Tango”.
          </div>
        </aside>

        <section className="min-w-0">
          {selected ? (
            <EventDetail
              event={selected}
              onEdit={() => setEditor({ event: selected })}
              onRegister={() => setRegistrationOpen(true)}
              onDelete={() => setDeleteTarget(selected)}
              onReset={() => setResetTarget(selected)}
              onUnlock={() => setUnlockTarget(selected)}
              onStart={() => setStartTarget(selected)}
              onNotify={notify}
            />
          ) : (
            <div className="app-card card-pad">
              <EmptyState
                icon={<ClipboardIcon size={36} />}
                title="Chọn một sự kiện"
                description="Chọn sự kiện ở danh sách bên cạnh để xem chi tiết, đăng ký VĐV và bắt đầu chấm điểm."
              />
            </div>
          )}
        </section>
      </div>

      {editor && (
        <EventEditorModal
          event={editor.event}
          events={state.events}
          onClose={() => setEditor(null)}
          onSaved={(event, isNew) => {
            notify('success', isNew ? `Đã tạo sự kiện “${event.name}”.` : 'Đã cập nhật sự kiện.');
            setEditor(null);
            if (isNew) selectEvent(event.id);
          }}
        />
      )}

      {registrationOpen && selected && (
        <RegistrationModal
          event={selected}
          onClose={() => setRegistrationOpen(false)}
          onSaved={(added, removed) => {
            setRegistrationOpen(false);
            notify(
              'success',
              `Đã cập nhật danh sách: thêm ${added}, bỏ ${removed} VĐV.`,
            );
          }}
        />
      )}

      {startTarget && (
        <StartEventDialog
          event={startTarget}
          judgeCount={state.judges.length}
          onClose={() => setStartTarget(null)}
          onStart={() => {
            actions.startEvent(startTarget.id);
            notify(
              'success',
              startTarget.category === 'show' || startTarget.athleteIds.length <= 6
                ? 'Đã bắt đầu vòng chung kết.'
                : 'Đã bắt đầu bán kết.',
            );
            setStartTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title={`Xóa sự kiện “${deleteTarget.name}”?`}
          description="Toàn bộ đăng ký, điểm số và lịch sử liên quan đến sự kiện sẽ bị xóa khỏi dữ liệu hiện tại."
          confirmLabel="Xóa sự kiện"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const wasSelected = deleteTarget.id === selected?.id;
            const next = state.events.find((e) => e.id !== deleteTarget.id);
            actions.deleteEvent(deleteTarget.id);
            notify('success', `Đã xóa sự kiện “${deleteTarget.name}”.`);
            setDeleteTarget(null);
            if (wasSelected && next) selectEvent(next.id);
          }}
        >
          <Callout tone="danger" title="Không thể hoàn tác">
            Nếu chỉ muốn chấm lại, hãy dùng “Đưa về chưa thi” để giữ lại danh sách VĐV.
          </Callout>
        </ConfirmDialog>
      )}

      {resetTarget && (
        <ConfirmDialog
          open
          title={`Đưa “${resetTarget.name}” về chưa thi?`}
          description="Danh sách đăng ký được giữ lại, nhưng toàn bộ điểm và vòng thi sẽ bị xóa."
          confirmLabel="Xóa điểm & đưa về chưa thi"
          onCancel={() => setResetTarget(null)}
          onConfirm={() => {
            actions.resetEvent(resetTarget.id);
            notify('success', 'Đã đưa sự kiện về trạng thái chưa thi.');
            setResetTarget(null);
          }}
        >
          <Callout tone="danger" title="Dữ liệu điểm sẽ mất">
            Hành động này không thể hoàn tác. Hãy sao lưu dữ liệu ở trang Xuất trước nếu cần.
          </Callout>
        </ConfirmDialog>
      )}

      {unlockTarget && (
        <ConfirmDialog
          open
          tone="warning"
          title={`Mở khóa “${unlockTarget.name}”?`}
          description="Chỉ Chủ tịch hội đồng nên thực hiện thao tác này."
          confirmLabel="Mở khóa để sửa"
          onCancel={() => setUnlockTarget(null)}
          onConfirm={() => {
            actions.unlockEvent(unlockTarget.id);
            notify('warning', 'Sự kiện đã mở khóa. Mọi sửa điểm sẽ được ghi lịch sử.');
            setUnlockTarget(null);
          }}
        >
          <Callout tone="warning" title="Kết quả có thể thay đổi">
            Sự kiện đã hoàn tất và đang khóa. Sau khi mở khóa, giám khảo có thể sửa điểm; mọi
            thay đổi được ghi vào lịch sử. Hãy khóa lại sau khi kiểm tra xong.
          </Callout>
        </ConfirmDialog>
      )}
    </div>
  );
}

function EventListItem({
  event,
  selected,
  onClick,
}: {
  event: DanceEvent;
  selected: boolean;
  onClick: () => void;
}) {
  const info = STATUS_INFO[event.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-brand-300 bg-brand-50'
          : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] font-bold',
            event.status === 'pending' && 'text-slate-500',
            event.status === 'semifinal' && 'text-blue-700',
            event.status === 'final' && 'text-blue-700',
            event.status === 'done' && 'text-emerald-700',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              event.status === 'pending' && 'bg-slate-400',
              event.status === 'semifinal' && 'bg-blue-600',
              event.status === 'final' && 'bg-blue-600',
              event.status === 'done' && 'bg-emerald-600',
            )}
          />
          {info.label}
        </span>
        <span className="tabular text-[11px] font-semibold text-slate-500">
          {event.athleteIds.length} VĐV
        </span>
      </div>
      <div
        className={cn(
          'mt-1 truncate text-sm font-bold',
          selected ? 'text-brand-900' : 'text-slate-800',
        )}
      >
        {event.name}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {event.category === 'show' ? (
          <span className="text-[11px] text-slate-500">5 tiêu chí · tính điểm</span>
        ) : (
          event.dances.map((dance) => (
            <span
              key={dance}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200"
              title={DANCE_INFO[dance].name}
            >
              {DANCE_INFO[dance].short}
            </span>
          ))
        )}
      </div>
    </button>
  );
}

function EventDetail({
  event,
  onEdit,
  onRegister,
  onDelete,
  onReset,
  onUnlock,
  onStart,
  onNotify,
}: {
  event: DanceEvent;
  onEdit: () => void;
  onRegister: () => void;
  onDelete: () => void;
  onReset: () => void;
  onUnlock: () => void;
  onStart: () => void;
  onNotify: (tone: Notice['tone'], text: string) => void;
}) {
  const { state, actions } = useApp();
  const category = categoryInfo(event.category);
  const isShow = event.category === 'show';
  const isLocked = event.status === 'done' && !event.unlocked;
  const isDone = event.status === 'done';
  const athletes = event.athleteIds
    .map((id) => state.athletes.find((a) => a.id === id))
    .filter(Boolean) as Athlete[];
  const judges = state.judges;

  const semifinal = event.status === 'semifinal' ? computeSemifinalResults(event, judges) : null;
  const final = event.status === 'final' || event.status === 'done'
    ? computeFinalResults(event, judges)
    : null;
  const group = isShow
    ? computeGroupForEvent(event, judges, state.settings.criteria)
    : null;
  const groupValidation = isShow
    ? validateGroupAgainstCriteria(event, judges, state.settings.criteria)
    : null;

  const roundValidation =
    event.status === 'semifinal'
      ? semifinal?.validation
      : event.status === 'final' || event.status === 'done'
        ? final?.validation
        : null;
  const groupText = group ? `${group.judgeCount} giám khảo` : '';

  const canStart = event.status === 'pending' && athletes.length >= 2 && judges.length > 0;
  const startReason =
    judges.length === 0
      ? 'Chưa có giám khảo. Hãy thêm giám khảo ở Thiết lập.'
      : athletes.length < 2
        ? 'Cần ít nhất 2 VĐV/đội để bắt đầu.'
        : event.status !== 'pending'
          ? 'Sự kiện đã bắt đầu.'
          : '';

  return (
    <div className="space-y-5">
      <div className="app-card overflow-hidden">
        <div className="card-pad">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="eyebrow">{category.label}</div>
              <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{event.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <EventStatusBadge status={event.status} />
                {isLocked && (
                  <Badge tone="dark">
                    <LockIcon size={12} /> Đã khóa
                  </Badge>
                )}
                {event.unlocked && <Badge tone="amber">Đang mở khóa</Badge>}
                <Badge tone="gray">{athletes.length} VĐV/đội</Badge>
                <Badge tone="gray">{judges.length} giám khảo</Badge>
                {event.category === 'show' ? (
                  <Badge tone="gray">5 tiêu chí</Badge>
                ) : (
                  <Badge tone="blue">{event.dances.length} điệu</Badge>
                )}
              </div>
              {event.dances.length > 0 && (
                <div className="mt-3">
                  <DanceTags dances={event.dances} size="sm" />
                </div>
              )}
              {event.notes && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {event.notes}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {event.status === 'pending' && (
                <Button
                  variant="primary"
                  onClick={onStart}
                  disabled={!canStart}
                  title={startReason || undefined}
                >
                  <ClipboardIcon size={18} /> Bắt đầu chấm
                </Button>
              )}
              {(event.status === 'semifinal' || event.status === 'final' || event.status === 'done') && (
                <Link
                  to={`/cham-diem?event=${encodeURIComponent(event.id)}`}
                  className="btn-primary"
                >
                  <ClipboardIcon size={18} />
                  {isLocked ? 'Xem bảng điểm' : 'Chấm điểm'}
                </Link>
              )}
              <Link
                to={`/xep-hang?event=${encodeURIComponent(event.id)}`}
                className="btn-secondary"
              >
                <TrophyIcon size={18} /> Xếp hạng
              </Link>
              {isDone && isLocked && (
                <Button variant="warning" onClick={onUnlock}>
                  <UnlockIcon size={18} /> Mở khóa
                </Button>
              )}
              {isDone && event.unlocked && (
                <Button
                  variant="success"
                  disabled={isShow ? !groupValidation?.complete : !final?.complete}
                  title={
                    (isShow ? groupValidation?.complete : final?.complete)
                      ? 'Khóa lại kết quả'
                      : 'Cần nhập đủ điểm trước khi khóa'
                  }
                  onClick={() => {
                    actions.lockEvent(event.id);
                    onNotify('success', 'Đã khóa lại kết quả sự kiện.');
                  }}
                >
                  <LockIcon size={18} /> Khóa lại
                </Button>
              )}
              <IconButton label="Sửa sự kiện" variant="secondary" onClick={onEdit}>
                <PencilIcon size={19} />
              </IconButton>
              <IconButton label="Xóa sự kiện" variant="danger" onClick={onDelete}>
                <TrashIcon size={19} />
              </IconButton>
            </div>
          </div>
          {!canStart && event.status === 'pending' && startReason && (
            <div className="mt-4">
              <Callout tone="warning" title={startReason}>
                {judges.length === 0 && (
                  <Link to="/thiet-lap" className="font-bold underline">
                    Đi tới Thiết lập để thêm giám khảo
                  </Link>
                )}
                {athletes.length < 2 && judges.length > 0 && (
                  <span>Hãy đăng ký thêm VĐV/đội cho sự kiện này.</span>
                )}
              </Callout>
            </div>
          )}
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-3">
          <div className="bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Thể thức</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {isShow
                ? 'Chấm điểm 5 tiêu chí'
                : event.status === 'pending'
                  ? athletes.length >= 7
                    ? 'Bán kết → Chung kết'
                    : 'Thi trực tiếp chung kết'
                  : event.status === 'semifinal'
                    ? 'Bán kết → chọn 6 vào chung kết'
                    : 'Chung kết'}
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Điểm đã nhập</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {isShow
                ? groupValidation
                  ? `${groupValidation.filled}/${groupValidation.total} ô`
                  : '—'
                : roundValidation
                  ? `${roundValidation.filled}/${roundValidation.total} ô`
                  : '—'}
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Cập nhật</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {formatDate(event.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      <div className="app-card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Danh sách đăng ký</h3>
            <p className="muted mt-1">
              {event.status === 'pending'
                ? `Chỉ đăng ký VĐV loại ${category.label}. Danh sách có thể sửa đến khi bắt đầu.`
                : 'Danh sách đã khóa theo vòng thi. Đưa sự kiện về “Chưa thi” nếu cần thay đổi.'}
            </p>
          </div>
          {event.status === 'pending' ? (
            <Button onClick={onRegister}>
              <UsersIcon size={18} /> Quản lý đăng ký ({athletes.length})
            </Button>
          ) : (
            <Badge tone="gray">{athletes.length} VĐV</Badge>
          )}
        </div>

        {athletes.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Chưa đăng ký VĐV nào"
              description={
                isShow
                  ? 'Thêm các đội đồng diễn vào sự kiện để bắt đầu.'
                  : 'Thêm VĐV phù hợp loại nội dung để bắt đầu chấm.'
              }
              action={
                event.status === 'pending' ? (
                  <Button variant="primary" onClick={onRegister}>
                    <PlusIcon size={18} /> Đăng ký VĐV
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-14">STT</th>
                  <th>Số báo danh / Tên</th>
                  <th className="hidden sm:table-cell">Nhóm</th>
                  <th className="text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {sortBibs(athletes).map((athlete, index) => {
                  const finalist = event.finalists?.includes(athlete.id);
                  return (
                    <tr key={athlete.id}>
                      <td className="tabular text-slate-500">{index + 1}</td>
                      <td>
                        <AthleteLabel athlete={athlete} />
                      </td>
                      <td className="hidden sm:table-cell text-sm text-slate-600">
                        {athlete.ageGroup || '—'}
                      </td>
                      <td className="text-right">
                        {event.status === 'pending' ? (
                          <button
                            type="button"
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                            onClick={() => {
                              actions.unregisterAthlete(event.id, athlete.id);
                              onNotify('success', `Đã bỏ đăng ký SBD ${athlete.bib}.`);
                            }}
                          >
                            <TrashIcon size={15} /> Bỏ
                          </button>
                        ) : finalist ? (
                          <Badge tone="blue">Chung kết</Badge>
                        ) : event.status === 'semifinal' ? (
                          <Badge tone="gray">Bán kết</Badge>
                        ) : (
                          <Badge tone="gray">Đã thi</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(event.status === 'semifinal' || event.status === 'final' || event.status === 'done') && (
        <div className="app-card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Tiến độ chấm điểm</h3>
              <p className="muted mt-1">
                {isShow
                  ? 'Mỗi giám khảo nhập điểm 5 tiêu chí cho từng đội.'
                  : `Mỗi giám khảo xếp hạng ${event.finalists?.length ?? '—'} VĐV ở mỗi điệu.`}
              </p>
            </div>
            <Link
              to={`/cham-diem?event=${encodeURIComponent(event.id)}`}
              className="btn-secondary"
            >
              Mở bảng chấm <ChevronRightIcon size={16} />
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
            <div>
              {judges.length === 0 ? (
                <Callout tone="warning" title="Chưa có giám khảo">
                  Hãy thêm giám khảo để bắt đầu chấm.
                </Callout>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {judges.map((judge) => {
                    const complete = isShow
                      ? Boolean(groupValidation?.judgeComplete[judge.id])
                      : Boolean(roundValidation?.judgeComplete[judge.id]);
                    return (
                      <Link
                        key={judge.id}
                        to={`/cham-diem?event=${encodeURIComponent(event.id)}&judge=${encodeURIComponent(judge.id)}`}
                        className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-brand-300 hover:bg-brand-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-xs font-extrabold text-slate-700">
                            {judge.code}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{judge.name}</span>
                        </span>
                        <JudgeTick complete={complete} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {isShow && groupValidation ? (
                <ProgressBar value={groupValidation.filled} total={groupValidation.total} />
              ) : roundValidation ? (
                <ProgressBar value={roundValidation.filled} total={roundValidation.total} />
              ) : null}
              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {isShow ? (
                  <>
                    <div className="font-bold text-slate-800">Đồng diễn</div>
                    <p className="mt-1">{groupText} · {event.dropHighLow ? 'Bỏ điểm cao nhất & thấp nhất' : 'Cộng toàn bộ điểm giám khảo'}</p>
                  </>
                ) : event.status === 'semifinal' ? (
                  <>
                    <div className="font-bold text-slate-800">Bán kết</div>
                    <p className="mt-1">
                      Mỗi giám khảo chọn 6 VĐV/điệu. Tổng hợp theo số lượt chọn, sau đó tổng hạng.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-slate-800">Chung kết</div>
                    <p className="mt-1">
                      {event.dances.length > 1
                        ? 'Tổng hạng các điệu theo Rule 11; hòa sẽ được cảnh báo.'
                        : 'Xếp hạng theo Skating System (Rule 9 & 10).'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {semifinal && (
            <SemifinalPreview
              event={event}
              result={semifinal.result}
              complete={semifinal.complete}
            />
          )}

          {!isShow && final && final.complete && (
            <FinalPreview event={event} result={final} />
          )}

          {isShow && group && groupValidation?.complete && (
            <GroupPreview event={event} group={group} />
          )}
        </div>
      )}

      {(event.status === 'semifinal' || (event.status === 'final' && event.athleteIds.length >= 7)) && (
        <div className="app-card card-pad">
          <h3 className="text-lg font-bold">Vòng thi</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Bán kết</span>
                <Badge tone="gray">{event.athleteIds.length} VĐV</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">Chọn 6 VĐV mỗi điệu · Top 6 vào chung kết</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Chung kết</span>
                <Badge tone={event.finalists ? 'blue' : 'gray'}>
                  {event.finalists?.length ?? 0} VĐV
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">Xếp hạng toàn bộ VĐV · Skating System</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-red-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-red-800">Vùng thao tác nguy hiểm</div>
            <p className="text-xs text-slate-500">
              Đưa sự kiện về chưa thi sẽ xóa toàn bộ điểm nhưng giữ danh sách đăng ký.
            </p>
          </div>
          <Button variant="danger" onClick={onReset} disabled={event.status === 'pending'}>
            <RefreshIcon size={18} /> Đưa về chưa thi
          </Button>
        </div>
      </div>
    </div>
  );
}

function SemifinalPreview({
  event,
  result,
  complete,
}: {
  event: DanceEvent;
  result: ReturnType<typeof computeSemifinalResults>['result'];
  complete: boolean;
}) {
  const { state } = useApp();
  if (result.totalSelections === 0) return null;
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">Tổng hợp bán kết</h4>
        {complete ? (
          result.boundaryTie ? (
            <Badge tone="amber">
              <AlertTriangleIcon size={12} /> Hòa ở vị trí thứ 6
            </Badge>
          ) : (
            <Badge tone="green">Đã đủ điểm</Badge>
          )
        ) : (
          <Badge tone="gray">Đang nhập</Badge>
        )}
      </div>
      {result.boundaryTie && (
        <div className="mt-3">
          <Callout tone="warning" title="Cần Chủ tịch hội đồng quyết định">
            Có nhiều VĐV đồng hạng ở ranh giới vào chung kết. Mở trang Chấm điểm để chọn “đưa tất
            cả vào chung kết” hoặc chọn thủ công.
          </Callout>
        </div>
      )}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-16">Hạng</th>
              <th>VĐV</th>
              <th className="text-right">Lượt chọn</th>
              <th className="text-right">Tổng hạng</th>
              <th className="text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 9).map((row) => {
              const athlete = state.athletes.find((a) => a.id === row.athleteId);
              return (
                <tr
                  key={row.athleteId}
                  className={row.tiedAtCutoff ? 'bg-amber-50' : row.qualified ? 'bg-emerald-50/40' : undefined}
                >
                  <td className="tabular font-bold">{row.position}</td>
                  <td>
                    <AthleteLabel athlete={athlete} compact />
                  </td>
                  <td className="tabular text-right font-semibold">{row.selections}</td>
                  <td className="tabular text-right">{row.rankSum}</td>
                  <td className="text-right">
                    {row.tiedAtCutoff ? (
                      <Badge tone="amber">Hòa ranh giới</Badge>
                    ) : row.qualified ? (
                      <Badge tone="green">Vào chung kết</Badge>
                    ) : (
                      <Badge tone="gray">Dừng</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {result.boundaryTie && (
        <Link
          to={`/cham-diem?event=${encodeURIComponent(event.id)}`}
          className="btn-warning mt-3"
        >
          <AlertTriangleIcon size={18} /> Xử lý tại trang Chấm điểm
        </Link>
      )}
    </div>
  );
}

function FinalPreview({
  event,
  result,
}: {
  event: DanceEvent;
  result: NonNullable<ReturnType<typeof computeFinalResults>>;
}) {
  const { state } = useApp();
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">Kết quả tạm thời</h4>
        {result.overallTies.length > 0 ? (
          <Badge tone="amber">
            <AlertTriangleIcon size={12} /> Có hòa cần xử lý
          </Badge>
        ) : (
          <Badge tone="green">Đủ điểm · Đã khóa</Badge>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {result.overall.rows.slice(0, 3).map((row) => {
          const athlete = state.athletes.find((a) => a.id === row.athleteId);
          const place = row.place;
          return (
            <div
              key={row.athleteId}
              className={cn(
                'rounded-xl border p-3',
                place === 1 && 'podium-gold',
                place === 2 && 'podium-silver',
                place === 3 && 'podium-bronze',
              )}
            >
              <div className="flex items-center justify-between">
                <Badge tone={place === 1 ? 'amber' : 'gray'}>
                  Hạng {place}
                  {row.tied ? '*' : ''}
                </Badge>
                <span className="tabular text-xs font-bold text-slate-500">
                  Tổng {row.total}
                </span>
              </div>
              <div className="mt-2">
                <AthleteLabel athlete={athlete} compact />
              </div>
            </div>
          );
        })}
      </div>
      <Link
        to={`/xep-hang?event=${encodeURIComponent(event.id)}`}
        className="btn-secondary mt-3"
      >
        <TrophyIcon size={18} /> Xem bảng xếp hạng đầy đủ
      </Link>
    </div>
  );
}

function GroupPreview({
  event,
  group,
}: {
  event: DanceEvent;
  group: ReturnType<typeof computeGroupForEvent>;
}) {
  const { state } = useApp();
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">Kết quả đồng diễn</h4>
        {group.ties.length > 0 ? (
          <Badge tone="amber">
            <AlertTriangleIcon size={12} /> Có điểm hòa
          </Badge>
        ) : (
          <Badge tone="green">Đủ điểm</Badge>
        )}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-16">Hạng</th>
              <th>Đội</th>
              <th className="text-right">Tổng điểm</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => {
              const athlete = state.athletes.find((a) => a.id === row.athleteId);
              return (
                <tr key={row.athleteId}>
                  <td className="tabular font-bold">{row.place}{row.tied ? '*' : ''}</td>
                  <td>
                    <AthleteLabel athlete={athlete} compact />
                  </td>
                  <td className="tabular text-right font-bold">{row.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Link to={`/xep-hang?event=${encodeURIComponent(event.id)}`} className="btn-secondary mt-3">
        <TrophyIcon size={18} /> Xem chi tiết
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal sự kiện
// ---------------------------------------------------------------------------

function EventEditorModal({
  event,
  events,
  onClose,
  onSaved,
}: {
  event?: DanceEvent;
  events: DanceEvent[];
  onClose: () => void;
  onSaved: (event: DanceEvent, isNew: boolean) => void;
}) {
  const { state, actions } = useApp();
  const [name, setName] = useState(event?.name ?? '');
  const [category, setCategory] = useState<CategoryId>(event?.category ?? 'solo');
  const [dances, setDances] = useState<Dance[]>(event?.dances ?? []);
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [dropHighLow, setDropHighLow] = useState(Boolean(event?.dropHighLow));
  const [error, setError] = useState('');

  const started = event ? event.status !== 'pending' : false;
  const hasRegistrations = Boolean(event && event.athleteIds.length > 0);
  const categoryLocked = started || hasRegistrations;
  const isShow = category === 'show';

  const toggleDance = (dance: Dance) => {
    setDances((current) =>
      current.includes(dance) ? current.filter((d) => d !== dance) : [...current, dance],
    );
    setError('');
  };

  const applyPreset = (preset: Dance[]) => setDances(preset);

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return setError('Vui lòng nhập tên sự kiện.');
    if (
      events.some(
        (item) =>
          item.id !== event?.id && normalizeText(item.name) === normalizeText(cleanName),
      )
    ) {
      return setError('Tên sự kiện đã tồn tại. Hãy chọn tên khác.');
    }
    if (!isShow && dances.length === 0) return setError('Chọn ít nhất một điệu thi.');
    if (isShow && hasRegistrations) {
      const hasNonTeam = event?.athleteIds.some((id) => {
        const athlete = state.athletes.find((a) => a.id === id);
        return athlete && athlete.kind !== 'team';
      });
      if (hasNonTeam) return setError('Không thể chuyển sang Đồng diễn khi đã có VĐV không phải đội.');
    }

    if (event) {
      actions.updateEvent(event.id, {
        name: cleanName,
        category,
        dances,
        notes: notes.trim(),
        dropHighLow,
      });
      const updated: DanceEvent = {
        ...event,
        name: cleanName,
        category,
        dances,
        notes: notes.trim(),
        dropHighLow,
      };
      onSaved(updated, false);
    } else {
      const created = actions.addEvent({
        name: cleanName,
        category,
        dances,
        notes: notes.trim(),
        dropHighLow,
      });
      onSaved(created, true);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={event ? `Sửa sự kiện` : 'Thêm sự kiện'}
      description={
        started
          ? 'Sự kiện đã bắt đầu: chỉ có thể sửa tên và ghi chú. Để đổi nội dung/điệu, hãy đưa sự kiện về chưa thi.'
          : 'Chọn nội dung và các điệu thi. Từ 7 VĐV trở lên hệ thống sẽ tự dùng bán kết.'
      }
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="event-editor-form">
            <CheckIcon size={18} /> {event ? 'Lưu thay đổi' : 'Tạo sự kiện'}
          </Button>
        </>
      }
    >
      <form id="event-editor-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên sự kiện" required>
            <input
              className="input"
              value={name}
              onChange={(inputEvent) => setName(inputEvent.target.value)}
              placeholder="VD: Solo Latin – 5 điệu"
              autoFocus
            />
          </Field>
          <Field
            label="Nội dung"
            hint={
              categoryLocked
                ? 'Không thể đổi nội dung khi sự kiện đã có VĐV hoặc đã bắt đầu.'
                : 'Nội dung quyết định loại VĐV được đăng ký.'
            }
          >
            <select
              className="select"
              value={category}
              onChange={(inputEvent) => {
                const next = inputEvent.target.value as CategoryId;
                setCategory(next);
                if (next === 'show') setDances([]);
                setError('');
              }}
              disabled={categoryLocked}
            >
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!isShow ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="label mb-0">
                  Các điệu thi <span className="text-red-600">*</span>
                </div>
                <p className="hint">Đã chọn {dances.length} điệu. Thứ tự hiển thị theo nhóm Latin / Standard.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset(['S', 'C', 'R', 'PD', 'J'])}
                  disabled={started}
                >
                  Latin 5
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset(['S', 'C', 'R', 'J'])}
                  disabled={started}
                >
                  Latin 4
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset(['C', 'R', 'J'])}
                  disabled={started}
                >
                  Latin 3
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset([])}
                  disabled={started}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <DanceGroup
                title="Latin"
                dances={LATIN_DANCES}
                selected={dances}
                onToggle={toggleDance}
                disabled={started}
              />
              <DanceGroup
                title="Standard"
                dances={STANDARD_DANCES}
                selected={dances}
                onToggle={toggleDance}
                disabled={started}
              />
            </div>
            {dances.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Đã chọn: {danceNames(dances)}
              </p>
            )}
          </div>
        ) : (
          <Callout tone="info" title="Nội dung Đồng diễn">
            Mỗi đội được chấm 5 tiêu chí. Cấu hình tiêu chí và thang điểm tại Thiết lập → Tiêu chí
            đồng diễn.
          </Callout>
        )}

        {isShow && (
          <Toggle
            checked={dropHighLow}
            onChange={setDropHighLow}
            label="Bỏ điểm cao nhất và thấp nhất"
            hint="Chỉ áp dụng khi có từ 3 giám khảo trở lên. Ví dụ 5 giám khảo: bỏ 1 tổng điểm cao nhất và 1 tổng điểm thấp nhất, cộng 3 tổng còn lại."
          />
        )}

        <Field label="Ghi chú" hint="Tùy chọn – hiển thị trong chi tiết sự kiện.">
          <textarea
            className="input min-h-[80px]"
            value={notes}
            onChange={(inputEvent) => setNotes(inputEvent.target.value)}
            placeholder="VD: Chung kết bắt đầu lúc 19:30"
          />
        </Field>

        {error && <Callout tone="danger" title={error} />}
      </form>
    </Modal>
  );
}

function DanceGroup({
  title,
  dances,
  selected,
  onToggle,
  disabled,
}: {
  title: string;
  dances: Dance[];
  selected: Dance[];
  onToggle: (dance: Dance) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-2">
        {dances.map((dance) => {
          const active = selected.includes(dance);
          return (
            <button
              key={dance}
              type="button"
              onClick={() => onToggle(dance)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="text-xs font-extrabold">{DANCE_INFO[dance].short}</span>
              {DANCE_INFO[dance].name}
              {active && <CheckIcon size={15} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal đăng ký
// ---------------------------------------------------------------------------

function RegistrationModal({
  event,
  onClose,
  onSaved,
}: {
  event: DanceEvent;
  onClose: () => void;
  onSaved: (added: number, removed: number) => void;
}) {
  const { state, actions } = useApp();
  const requiredKind = athleteKindForCategory(event.category);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(event.athleteIds));

  const candidates = useMemo(() => {
    const query = normalizeText(search);
    return sortBibs(
      state.athletes.filter((athlete) => {
        if (athlete.kind !== requiredKind && !event.athleteIds.includes(athlete.id)) return false;
        if (!query) return true;
        return normalizeText(
          [
            athlete.bib,
            athlete.name,
            athlete.male,
            athlete.female,
            athlete.teamName,
            athlete.unit,
            athlete.ageGroup,
          ]
            .filter(Boolean)
            .join(' '),
        ).includes(query);
      }),
    );
  }, [state.athletes, requiredKind, event.athleteIds, search]);

  const additions = [...selected].filter((id) => !event.athleteIds.includes(id));
  const removals = event.athleteIds.filter((id) => !selected.has(id));

  const save = () => {
    if (additions.length) actions.registerAthletes(event.id, additions);
    removals.forEach((id) => actions.unregisterAthlete(event.id, id));
    onSaved(additions.length, removals.length);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Đăng ký VĐV · ${event.name}`}
      description={`Chỉ hiển thị ${categoryInfo(event.category).label.toLowerCase()} phù hợp. Đã chọn ${selected.size} VĐV/đội.`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={save} disabled={!additions.length && !removals.length}>
            <CheckIcon size={18} /> Lưu danh sách ({additions.length} thêm, {removals.length} bỏ)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm VĐV theo SBD, tên…"
            className="min-w-[220px] flex-1"
          />
          <Button
            size="sm"
            onClick={() =>
              setSelected(new Set([...selected, ...candidates.map((a) => a.id)]))
            }
          >
            Chọn tất cả
          </Button>
          <Button size="sm" onClick={() => setSelected(new Set())}>
            Bỏ chọn
          </Button>
        </div>

        {candidates.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={32} />}
            title="Không có VĐV phù hợp"
            description={`Chưa có ${requiredKind === 'team' ? 'đội' : requiredKind === 'couple' ? 'cặp đôi' : 'VĐV solo'} nào trong danh sách, hoặc không khớp tìm kiếm.`}
            action={
              <Link to="/thiet-lap" className="btn-secondary">
                Đi tới Thiết lập
              </Link>
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((athlete) => {
              const checked = selected.has(athlete.id);
              const isRegistered = event.athleteIds.includes(athlete.id);
              return (
                <label
                  key={athlete.id}
                  className={cn(
                    'flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
                    checked
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(athlete.id)) next.delete(athlete.id);
                        else next.add(athlete.id);
                        return next;
                      });
                    }}
                    className="h-5 w-5 shrink-0 accent-brand-700"
                  />
                  <div className="min-w-0">
                    <AthleteLabel athlete={athlete} compact />
                  </div>
                  {isRegistered && (
                    <span className="ml-auto shrink-0">
                      <Badge tone="green">Đã đăng ký</Badge>
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {selected.size < 2 && (
          <Callout tone="warning" title="Cần ít nhất 2 VĐV/đội">
            Có thể lưu danh sách, nhưng chỉ bắt đầu chấm khi có từ 2 VĐV trở lên.
          </Callout>
        )}
      </div>
    </Modal>
  );
}

function StartEventDialog({
  event,
  judgeCount,
  onClose,
  onStart,
}: {
  event: DanceEvent;
  judgeCount: number;
  onClose: () => void;
  onStart: () => void;
}) {
  const isShow = event.category === 'show';
  const semifinal = !isShow && event.athleteIds.length >= 7;
  return (
    <ConfirmDialog
      open
      tone="primary"
      title={`Bắt đầu “${event.name}”?`}
      description="Danh sách đăng ký sẽ được khóa lại để bảo đảm tính công bằng."
      confirmLabel="Bắt đầu chấm"
      onCancel={onClose}
      onConfirm={onStart}
    >
      <div className="space-y-3 text-sm text-slate-700">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex justify-between">
            <span>Số VĐV/đội</span>
            <b className="tabular">{event.athleteIds.length}</b>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Số giám khảo</span>
            <b className="tabular">{judgeCount}</b>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Thể thức</span>
            <b>
              {isShow
                ? 'Chung kết · 5 tiêu chí'
                : semifinal
                  ? 'Bán kết → Chung kết'
                  : 'Chung kết trực tiếp'}
            </b>
          </div>
        </div>
        {semifinal && (
          <p className="text-xs leading-relaxed text-slate-600">
            Có từ 7 VĐV: hệ thống tạo vòng bán kết. Mỗi giám khảo chọn 6 VĐV/điệu; top 6 tự vào
            chung kết khi đủ điểm và không có hòa ở ranh giới.
          </p>
        )}
        <p className="text-xs leading-relaxed text-slate-600">
          Nếu cần sửa danh sách sau khi bắt đầu, hãy dùng “Đưa về chưa thi” và đăng ký lại.
        </p>
      </div>
    </ConfirmDialog>
  );
}
