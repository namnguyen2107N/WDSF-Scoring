import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import type {
  Athlete,
  AthleteKind,
  Criterion,
  Judge,
  Settings,
} from '../types';
import { useApp, judgeUsageCount, athleteUsageCount } from '../store/AppStore';
import {
  athleteDisplayName,
  athleteKindLabel,
  CATEGORIES,
  KIND_OPTIONS,
} from '../lib/constants';
import {
  formatDateTime,
  normalizeText,
  sortBibs,
  downloadText,
} from '../lib/utils';
import { parseJudgeImport } from '../lib/csv';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  StatCard,
} from '../components/ui';
import { ImportAthletesModal } from '../components/ImportAthletesModal';
import {
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
} from '../components/icons';

type Tab = 'general' | 'judges' | 'athletes' | 'criteria' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Thông tin giải' },
  { id: 'judges', label: 'Giám khảo' },
  { id: 'athletes', label: 'Vận động viên' },
  { id: 'criteria', label: 'Tiêu chí đồng diễn' },
  { id: 'history', label: 'Lịch sử thay đổi' },
];

type Notice = { tone: 'success' | 'info' | 'warning'; text: string };

export default function SetupPage() {
  const { state, actions } = useApp();
  const [tab, setTab] = useState<Tab>('general');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const notify = (tone: Notice['tone'], text: string) => setNotice({ tone, text });

  const counts: Record<Tab, number | undefined> = {
    general: undefined,
    judges: state.judges.length,
    athletes: state.athletes.length,
    criteria: state.settings.criteria.length,
    history: state.history.length,
  };

  const completed = state.events.filter((e) => e.status === 'done').length;

  return (
    <div>
      <PageHeader
        eyebrow="Ban tổ chức"
        title="Thiết lập giải"
        description="Quản lý thông tin giải, giám khảo, vận động viên và tiêu chí chấm điểm. Mọi thay đổi được lưu tự động trong trình duyệt."
        actions={
          <Link to="/su-kien" className="btn-primary">
            Tiếp tục: Sự kiện <ChevronRightIcon size={18} />
          </Link>
        }
      />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? 'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white shadow-sm'
                : 'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }
            aria-current={tab === item.id ? 'page' : undefined}
          >
            {item.label}
            {counts[item.id] !== undefined && (
              <span
                className={
                  tab === item.id
                    ? 'tabular rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold text-brand-800'
                    : 'tabular rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600'
                }
              >
                {counts[item.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-4">
          <Callout tone={notice.tone === 'info' ? 'info' : notice.tone} title={notice.text} />
        </div>
      )}

      {tab === 'general' && (
        <GeneralPanel
          settings={state.settings}
          completed={completed}
          totalEvents={state.events.length}
          judgeCount={state.judges.length}
          athleteCount={state.athletes.length}
          onSave={(patch) => {
            actions.updateSettings(patch);
            notify('success', 'Đã lưu thông tin giải.');
          }}
          onOpenJudges={() => setTab('judges')}
          onOpenAthletes={() => setTab('athletes')}
        />
      )}

      {tab === 'judges' && <JudgesPanel notify={notify} />}
      {tab === 'athletes' && <AthletesPanel notify={notify} />}
      {tab === 'criteria' && <CriteriaPanel notify={notify} />}
      {tab === 'history' && <HistoryPanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thông tin giải
// ---------------------------------------------------------------------------

function GeneralPanel({
  settings,
  completed,
  totalEvents,
  judgeCount,
  athleteCount,
  onSave,
  onOpenJudges,
  onOpenAthletes,
}: {
  settings: Settings;
  completed: number;
  totalEvents: number;
  judgeCount: number;
  athleteCount: number;
  onSave: (patch: Partial<Settings>) => void;
  onOpenJudges: () => void;
  onOpenAthletes: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    setDraft(settings);
  }, [settings]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave(draft);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Giám khảo" value={judgeCount} hint="Cần tối thiểu 1 giám khảo" tone="blue" />
        <StatCard label="Vận động viên / đội" value={athleteCount} hint="Solo, Couple và Đồng diễn" />
        <StatCard
          label="Sự kiện hoàn tất"
          value={`${completed}/${totalEvents}`}
          hint="Sự kiện đủ điểm sẽ tự khóa kết quả"
          tone="green"
        />
        <StatCard label="Chế độ" value="Offline" hint="Dữ liệu lưu trong trình duyệt" tone="gray" />
      </div>

      <form onSubmit={handleSubmit} className="app-card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Thông tin giải đấu</h2>
            <p className="muted mt-1">Các thông tin này xuất hiện trên bảng xếp hạng và bản in A4.</p>
          </div>
          <Badge tone="blue">Tự động lưu sau khi bấm Lưu</Badge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Tên giải" required>
            <input
              className="input"
              value={draft.competitionName}
              onChange={(event) => setDraft({ ...draft, competitionName: event.target.value })}
              placeholder="VD: Giải Khiêu vũ Thể thao Mở rộng 2026"
              required
            />
          </Field>
          <Field label="Địa điểm">
            <input
              className="input"
              value={draft.venue}
              onChange={(event) => setDraft({ ...draft, venue: event.target.value })}
              placeholder="Nhà thi đấu, thành phố…"
            />
          </Field>
          <Field label="Ngày thi">
            <input
              type="date"
              className="input"
              value={draft.eventDate}
              onChange={(event) => setDraft({ ...draft, eventDate: event.target.value })}
            />
          </Field>
          <Field label="Chủ tịch hội đồng" hint="Người có quyền mở khóa và phân định hòa.">
            <input
              className="input"
              value={draft.president}
              onChange={(event) => setDraft({ ...draft, president: event.target.value })}
            />
          </Field>
          <Field label="Ban thư ký" hint="Ghi nhận lịch sử thao tác.">
            <input
              className="input"
              value={draft.secretary}
              onChange={(event) => setDraft({ ...draft, secretary: event.target.value })}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-500">
            {dirty ? 'Có thay đổi chưa lưu.' : 'Thông tin đã đồng bộ với dữ liệu trình duyệt.'}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setDraft(settings)} disabled={!dirty}>
              Hoàn tác
            </Button>
            <Button variant="primary" type="submit" disabled={!dirty || !draft.competitionName.trim()}>
              <CheckIcon size={18} /> Lưu thông tin
            </Button>
          </div>
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="app-card card-pad">
          <h2 className="section-title">Quy trình gợi ý</h2>
          <ol className="mt-4 space-y-3">
            {[
              'Thêm giám khảo (mã A, B, C…) và nhập danh sách vận động viên.',
              'Vào Sự kiện, đăng ký VĐV và bắt đầu thi. Từ 7 VĐV trở lên sẽ tự tạo bán kết.',
              'Chấm điểm từng giám khảo. Đủ điểm bán kết sẽ tự chốt 6 VĐV vào chung kết.',
              'Xem Xếp hạng, xử lý hòa (nếu có), in A4 hoặc xuất Excel / sao lưu JSON.',
            ].map((text, index) => (
              <li key={text} className="flex gap-3">
                <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-800">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-700">{text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onOpenJudges}>
              <UsersIcon size={18} /> Quản lý giám khảo
            </Button>
            <Button onClick={onOpenAthletes}>
              <UsersIcon size={18} /> Quản lý VĐV
            </Button>
            <Link to="/xuat" className="btn-secondary">
              <DownloadIcon size={18} /> Sao lưu dữ liệu
            </Link>
          </div>
        </div>

        <div className="app-card card-pad">
          <h2 className="section-title">Nội dung thi đấu</h2>
          <p className="muted mt-1">
            Hệ thống đã tạo sẵn danh mục sự kiện theo yêu cầu. Có thể thêm, sửa hoặc xóa trong
            trang Sự kiện.
          </p>
          <div className="mt-4 space-y-2.5">
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800">{category.label}</div>
                  <div className="text-xs text-slate-500">{category.description}</div>
                </div>
                <Badge tone="gray">{athleteKindLabel(category.kind)}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Giám khảo
// ---------------------------------------------------------------------------

function JudgesPanel({ notify }: { notify: (tone: Notice['tone'], text: string) => void }) {
  const { state, actions } = useApp();
  const [editor, setEditor] = useState<{ judge?: Judge } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Judge | null>(null);
  const usage = deleteTarget ? judgeUsageCount(state, deleteTarget.id) : 0;

  const usedCodes = new Set(state.judges.map((j) => j.code.toUpperCase()));

  return (
    <div className="space-y-4">
      <div className="app-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title">Danh sách giám khảo</h2>
            <p className="muted mt-1">
              Mã giám khảo hiển thị trên bảng điểm. Đã có {state.judges.length} giám khảo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setImportOpen(true)}>
              <UploadIcon size={18} /> Nhập nhanh
            </Button>
            <Button variant="primary" onClick={() => setEditor({})}>
              <PlusIcon size={18} /> Thêm giám khảo
            </Button>
          </div>
        </div>

        {state.judges.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon={<UsersIcon size={36} />}
              title="Chưa có giám khảo"
              description="Thêm giám khảo với mã A, B, C… để bắt đầu chấm điểm."
              action={
                <Button variant="primary" onClick={() => setEditor({})}>
                  <PlusIcon size={18} /> Thêm giám khảo đầu tiên
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-20">Mã</th>
                  <th>Họ và tên</th>
                  <th className="hidden sm:table-cell">Điểm đã nhập</th>
                  <th className="w-28 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {state.judges.map((judge) => {
                  const count = judgeUsageCount(state, judge.id);
                  return (
                    <tr key={judge.id}>
                      <td>
                        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-slate-900 px-2 text-sm font-extrabold text-white">
                          {judge.code}
                        </span>
                      </td>
                      <td className="font-semibold">{judge.name}</td>
                      <td className="hidden sm:table-cell">
                        {count > 0 ? (
                          <Badge tone="green">{count} ô điểm</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Chưa có điểm</span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton
                            label={`Sửa giám khảo ${judge.code}`}
                            onClick={() => setEditor({ judge })}
                          >
                            <PencilIcon size={18} />
                          </IconButton>
                          <IconButton
                            label={`Xóa giám khảo ${judge.code}`}
                            variant="danger"
                            onClick={() => setDeleteTarget(judge)}
                          >
                            <TrashIcon size={18} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Callout tone="info" title="Quy tắc đa số">
        Đa số phiếu = <b>floor(N/2) + 1</b> với N là số giám khảo. Ví dụ 7 giám khảo cần 4
        phiếu; 5 giám khảo cần 3 phiếu.
      </Callout>

      {editor && (
        <JudgeEditorModal
          judge={editor.judge}
          usedCodes={usedCodes}
          onClose={() => setEditor(null)}
          onSave={(values) => {
            if (editor.judge) {
              actions.updateJudge(editor.judge.id, values);
              notify('success', `Đã cập nhật giám khảo ${values.code}.`);
            } else {
              actions.addJudge(values);
              notify('success', `Đã thêm giám khảo ${values.code}.`);
            }
            setEditor(null);
          }}
        />
      )}

      {importOpen && (
        <JudgeImportModal
          existingCodes={usedCodes}
          onClose={() => setImportOpen(false)}
          onImport={(rows) => {
            rows.forEach((row) => actions.addJudge(row));
            notify('success', `Đã thêm ${rows.length} giám khảo.`);
            setImportOpen(false);
          }}
        />
      )}

      {deleteTarget && usage === 0 && (
        <ConfirmDialog
          open
          title={`Xóa giám khảo ${deleteTarget.code}?`}
          description="Thao tác này không thể hoàn tác."
          confirmLabel="Xóa giám khảo"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            actions.deleteJudge(deleteTarget.id);
            notify('success', `Đã xóa giám khảo ${deleteTarget.code}.`);
            setDeleteTarget(null);
          }}
        >
          <p className="text-sm text-slate-600">
            Giám khảo <b>{deleteTarget.name}</b> chưa có điểm nào, có thể xóa an toàn.
          </p>
        </ConfirmDialog>
      )}

      {deleteTarget && usage > 0 && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={`Không thể xóa giám khảo ${deleteTarget.code}`}
          size="sm"
          footer={<Button onClick={() => setDeleteTarget(null)}>Đóng</Button>}
        >
          <Callout tone="warning" title="Giám khảo đã có dữ liệu chấm">
            <p>
              Giám khảo này đang có <b>{usage} ô điểm</b> trong các sự kiện. Hãy xóa điểm hoặc
              đưa sự kiện về “Chưa thi” trước khi xóa giám khảo để tránh sai kết quả.
            </p>
          </Callout>
        </Modal>
      )}
    </div>
  );
}

function JudgeEditorModal({
  judge,
  usedCodes,
  onClose,
  onSave,
}: {
  judge?: Judge;
  usedCodes: Set<string>;
  onClose: () => void;
  onSave: (values: { code: string; name: string }) => void;
}) {
  const [code, setCode] = useState(judge?.code ?? '');
  const [name, setName] = useState(judge?.name ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!judge && !code) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const next = [...alphabet].find((letter) => !usedCodes.has(letter));
      if (next) setCode(next);
      else setCode(`J${usedCodes.size + 1}`);
    }
  }, [judge, code, usedCodes]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) {
      setError('Vui lòng nhập đủ mã và họ tên giám khảo.');
      return;
    }
    const others = new Set(usedCodes);
    if (judge) others.delete(judge.code.toUpperCase());
    if (others.has(cleanCode)) {
      setError(`Mã ${cleanCode} đã được dùng cho giám khảo khác.`);
      return;
    }
    onSave({ code: cleanCode, name: cleanName });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={judge ? `Sửa giám khảo ${judge.code}` : 'Thêm giám khảo'}
      description="Mã giám khảo nên ngắn gọn (A, B, C…) để hiển thị trên bảng điểm."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="judge-editor-form">
            <CheckIcon size={18} /> Lưu giám khảo
          </Button>
        </>
      }
    >
      <form id="judge-editor-form" onSubmit={submit} className="space-y-4">
        <Field label="Mã giám khảo" required>
          <input
            className="input tabular uppercase"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={8}
            autoFocus
            placeholder="A"
          />
        </Field>
        <Field label="Họ và tên" required>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </Field>
        {error && <Callout tone="danger" title={error} />}
      </form>
    </Modal>
  );
}

function JudgeImportModal({
  existingCodes,
  onClose,
  onImport,
}: {
  existingCodes: Set<string>;
  onClose: () => void;
  onImport: (rows: { code: string; name: string }[]) => void;
}) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseJudgeImport(text), [text]);
  const hasInput = text.trim().length > 0;
  const issues = hasInput ? parsed.issues : [];
  const rows = parsed.rows.filter((row) => !existingCodes.has(row.code));
  const skipped = parsed.rows.length - rows.length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Nhập nhanh giám khảo"
      description="Mỗi dòng: Mã, Họ tên. Có thể dán từ Excel hoặc CSV (phân tách bằng Tab, dấu phẩy hoặc chấm phẩy)."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => onImport(rows)} disabled={!rows.length}>
            Thêm {rows.length || ''} giám khảo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <textarea
          className="input min-h-[180px] resize-y font-mono text-sm"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'A\tNguyễn Thu Hằng\nB\tTrần Quốc Bảo\nC\tLê Hoàng Nam'}
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge tone="green">{rows.length} hợp lệ</Badge>
          {skipped > 0 && <Badge tone="amber">{skipped} mã đã tồn tại</Badge>}
          {issues.length > 0 && <Badge tone="red">{issues.length} lỗi</Badge>}
        </div>
        {issues.length > 0 && (
          <Callout tone="warning" title="Một số dòng chưa hợp lệ">
            <ul className="space-y-1 text-xs">
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </Callout>
        )}
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Họ tên</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <td className="font-bold">{row.code}</td>
                    <td>{row.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vận động viên
// ---------------------------------------------------------------------------

function AthletesPanel({ notify }: { notify: (tone: Notice['tone'], text: string) => void }) {
  const { state, actions } = useApp();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | AthleteKind>('all');
  const [editor, setEditor] = useState<{ athlete?: Athlete } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Athlete | null>(null);
  const deleteUsage = deleteTarget ? athleteUsageCount(state, deleteTarget.id) : 0;
  const deleteEvents = deleteTarget
    ? state.events.filter((event) => event.athleteIds.includes(deleteTarget.id))
    : [];

  const filtered = useMemo(() => {
    const query = normalizeText(search);
    return sortBibs(state.athletes).filter((athlete) => {
      if (kind !== 'all' && athlete.kind !== kind) return false;
      if (!query) return true;
      const haystack = normalizeText(
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
      );
      return haystack.includes(query);
    });
  }, [state.athletes, search, kind]);

  return (
    <div className="space-y-4">
      <div className="app-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title">Danh sách vận động viên</h2>
            <p className="muted mt-1">
              {state.athletes.length} VĐV/đội. Số báo danh dùng chung cho toàn giải.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setImportOpen(true)}>
              <UploadIcon size={18} /> Nhập Excel / CSV
            </Button>
            <Button variant="primary" onClick={() => setEditor({})}>
              <PlusIcon size={18} /> Thêm VĐV
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm theo SBD, tên, đội, đơn vị…"
            className="sm:max-w-md"
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'all' as const, label: `Tất cả (${state.athletes.length})` },
              ...KIND_OPTIONS.map((option) => ({
                value: option.value,
                label: `${athleteKindLabel(option.value)} (${state.athletes.filter((a) => a.kind === option.value).length})`,
              })),
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={
                  kind === option.value
                    ? 'inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white'
                    : 'inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon={<UsersIcon size={36} />}
              title={state.athletes.length === 0 ? 'Chưa có vận động viên' : 'Không tìm thấy kết quả'}
              description={
                state.athletes.length === 0
                  ? 'Thêm từng VĐV hoặc dán danh sách từ Excel / nhập tệp CSV.'
                  : 'Thử đổi từ khóa tìm kiếm hoặc bộ lọc loại VĐV.'
              }
              action={
                state.athletes.length === 0 ? (
                  <Button variant="primary" onClick={() => setEditor({})}>
                    <PlusIcon size={18} /> Thêm VĐV đầu tiên
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Số báo danh</th>
                  <th>Tên / Đội</th>
                  <th className="hidden sm:table-cell">Loại</th>
                  <th className="hidden md:table-cell">Nhóm tuổi</th>
                  <th className="hidden lg:table-cell">Sự kiện</th>
                  <th className="w-28 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((athlete) => {
                  const eventCount = athleteUsageCount(state, athlete.id);
                  return (
                    <tr key={athlete.id}>
                      <td>
                        <span className="tabular inline-flex h-8 min-w-[48px] items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-extrabold text-white">
                          {athlete.bib}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">
                          {athleteDisplayName(athlete)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {athlete.kind === 'team'
                            ? athlete.unit || 'Đội'
                            : athlete.ageGroup || 'Chưa xếp nhóm'}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell">
                        <Badge tone="gray">{athleteKindLabel(athlete.kind)}</Badge>
                      </td>
                      <td className="hidden md:table-cell text-sm text-slate-600">
                        {athlete.ageGroup || '—'}
                      </td>
                      <td className="hidden lg:table-cell">
                        {eventCount > 0 ? (
                          <Badge tone="blue">{eventCount} sự kiện</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Chưa đăng ký</span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton
                            label={`Sửa VĐV ${athlete.bib}`}
                            onClick={() => setEditor({ athlete })}
                          >
                            <PencilIcon size={18} />
                          </IconButton>
                          <IconButton
                            label={`Xóa VĐV ${athlete.bib}`}
                            variant="danger"
                            onClick={() => setDeleteTarget(athlete)}
                          >
                            <TrashIcon size={18} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Callout tone="info" title="Mẹo nhập nhanh">
        Sao chép trực tiếp vùng dữ liệu từ Excel và dán vào hộp nhập nhanh. Hệ thống nhận dấu Tab,
        dấu phẩy hoặc chấm phẩy. Nên dùng hàng tiêu đề: <b>SBD, Loại, Tên, Nam, Nữ, Đội, Đơn vị, Nhóm tuổi</b>.
      </Callout>

      {editor && (
        <AthleteEditorModal
          athlete={editor.athlete}
          kindLocked={Boolean(editor.athlete && athleteUsageCount(state, editor.athlete.id) > 0)}
          existingBibs={new Set(
            state.athletes
              .filter((a) => a.id !== editor.athlete?.id)
              .map((a) => a.bib.trim()),
          )}
          onClose={() => setEditor(null)}
          onSave={(input) => {
            if (editor.athlete) {
              actions.updateAthlete(editor.athlete.id, input);
              notify('success', `Đã cập nhật VĐV SBD ${input.bib}.`);
            } else {
              actions.addAthlete(input);
              notify('success', `Đã thêm VĐV SBD ${input.bib}.`);
            }
            setEditor(null);
          }}
        />
      )}

      <ImportAthletesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count, skipped) =>
          notify(
            'success',
            `Đã nhập ${count} VĐV${skipped > 0 ? `, bỏ qua ${skipped} dòng không hợp lệ/trùng` : ''}.`,
          )
        }
      />

      {deleteTarget && deleteUsage === 0 && (
        <ConfirmDialog
          open
          title={`Xóa VĐV SBD ${deleteTarget.bib}?`}
          description="Thao tác này không thể hoàn tác."
          confirmLabel="Xóa VĐV"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            actions.deleteAthlete(deleteTarget.id);
            notify('success', `Đã xóa VĐV SBD ${deleteTarget.bib}.`);
            setDeleteTarget(null);
          }}
        >
          <p className="text-sm text-slate-600">
            VĐV <b>{athleteDisplayName(deleteTarget)}</b> chưa được đăng ký sự kiện nào.
          </p>
        </ConfirmDialog>
      )}

      {deleteTarget && deleteUsage > 0 && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={`Không thể xóa VĐV SBD ${deleteTarget.bib}`}
          size="sm"
          footer={<Button onClick={() => setDeleteTarget(null)}>Đóng</Button>}
        >
          <Callout tone="warning" title="VĐV đang được đăng ký">
            <p>Hãy bỏ đăng ký khỏi các sự kiện sau trước khi xóa:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {deleteEvents.map((event) => (
                <li key={event.id}>{event.name}</li>
              ))}
            </ul>
          </Callout>
          <p className="mt-3 text-sm text-slate-600">
            Các sự kiện đã bắt đầu không thể bỏ đăng ký; hãy đưa sự kiện về “Chưa thi” nếu thật sự
            cần thay đổi danh sách.
          </p>
        </Modal>
      )}
    </div>
  );
}

function AthleteEditorModal({
  athlete,
  existingBibs,
  kindLocked = false,
  onClose,
  onSave,
}: {
  athlete?: Athlete;
  existingBibs: Set<string>;
  kindLocked?: boolean;
  onClose: () => void;
  onSave: (input: Omit<Athlete, 'id'>) => void;
}) {
  const [kind, setKind] = useState<AthleteKind>(athlete?.kind ?? 'solo');
  const [bib, setBib] = useState(athlete?.bib ?? '');
  const [name, setName] = useState(athlete?.name ?? '');
  const [male, setMale] = useState(athlete?.male ?? '');
  const [female, setFemale] = useState(athlete?.female ?? '');
  const [teamName, setTeamName] = useState(athlete?.teamName ?? '');
  const [unit, setUnit] = useState(athlete?.unit ?? '');
  const [ageGroup, setAgeGroup] = useState(athlete?.ageGroup ?? '');
  const [note, setNote] = useState(athlete?.note ?? '');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanBib = bib.trim();
    if (!cleanBib) return setError('Vui lòng nhập số báo danh.');
    if (existingBibs.has(cleanBib)) return setError(`SBD ${cleanBib} đã tồn tại.`);
    if (kind === 'solo' && !name.trim()) return setError('Vui lòng nhập tên VĐV solo.');
    if (kind === 'couple' && (!male.trim() || !female.trim()))
      return setError('Vui lòng nhập đủ tên Nam và tên Nữ.');
    if (kind === 'team' && !teamName.trim()) return setError('Vui lòng nhập tên đội.');

    onSave({
      bib: cleanBib,
      kind,
      name: kind === 'solo' ? name.trim() : undefined,
      male: kind === 'couple' ? male.trim() || undefined : undefined,
      female: kind === 'couple' ? female.trim() || undefined : undefined,
      teamName: kind === 'team' ? teamName.trim() : undefined,
      unit: unit.trim() || undefined,
      ageGroup: ageGroup.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={athlete ? `Sửa VĐV SBD ${athlete.bib}` : 'Thêm vận động viên'}
      description="Chọn đúng loại để biểu mẫu hiển thị các trường phù hợp."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="athlete-editor-form">
            <CheckIcon size={18} /> Lưu VĐV
          </Button>
        </>
      }
    >
      <form id="athlete-editor-form" onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              disabled={kindLocked && kind !== option.value}
              className={
                kind === option.value
                  ? 'min-h-[44px] rounded-xl border-2 border-brand-700 bg-brand-50 px-3 text-sm font-bold text-brand-800'
                  : 'min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
              }
            >
              {athleteKindLabel(option.value)}
            </button>
          ))}
        </div>
        {kindLocked && (
          <p className="text-xs leading-relaxed text-slate-500">
            VĐV đã được đăng ký sự kiện nên không thể đổi loại. Hãy bỏ đăng ký hoặc đưa sự kiện
            về “Chưa thi” nếu thật sự cần đổi.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số báo danh" required>
            <input
              className="input tabular"
              value={bib}
              onChange={(event) => setBib(event.target.value)}
              placeholder="VD: 101"
              autoFocus
            />
          </Field>
          <Field label="Nhóm / hạng tuổi" hint="Tùy chọn, ví dụ: Trẻ, Thanh niên, Trung niên.">
            <input
              className="input"
              value={ageGroup}
              onChange={(event) => setAgeGroup(event.target.value)}
              placeholder="VD: Thanh niên"
            />
          </Field>
        </div>

        {kind === 'solo' && (
          <Field label="Họ và tên VĐV" required>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nguyễn Khánh Linh"
            />
          </Field>
        )}

        {kind === 'couple' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên Nam" required>
              <input
                className="input"
                value={male}
                onChange={(event) => setMale(event.target.value)}
                placeholder="Minh Quân"
              />
            </Field>
            <Field label="Tên Nữ" required>
              <input
                className="input"
                value={female}
                onChange={(event) => setFemale(event.target.value)}
                placeholder="Thu Trang"
              />
            </Field>
          </div>
        )}

        {kind === 'team' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên đội" required>
              <input
                className="input"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Đội Ánh Sáng"
              />
            </Field>
            <Field label="Đơn vị / CLB">
              <input
                className="input"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="CLB Sao Mai"
              />
            </Field>
          </div>
        )}

        <Field label="Ghi chú">
          <textarea
            className="input min-h-[80px]"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Thông tin thêm (không bắt buộc)"
          />
        </Field>

        {error && <Callout tone="danger" title={error} />}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tiêu chí đồng diễn
// ---------------------------------------------------------------------------

function CriteriaPanel({ notify }: { notify: (tone: Notice['tone'], text: string) => void }) {
  const { state, actions } = useApp();
  const [draft, setDraft] = useState<Criterion[]>(state.settings.criteria);
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(state.settings.criteria);
  }, [state.settings.criteria]);

  const hasGroupScores = state.events.some((event) => Boolean(event.groupScores));
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings.criteria);

  const update = (id: string, patch: Partial<Criterion>) => {
    setDraft((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setError('');
  };

  const save = () => {
    if (draft.length < 2) return setError('Cần ít nhất 2 tiêu chí.');
    for (const criterion of draft) {
      if (!criterion.name.trim()) return setError('Tên tiêu chí không được để trống.');
      if (!Number.isFinite(criterion.min) || !Number.isFinite(criterion.max))
        return setError('Thang điểm phải là số.');
      if (criterion.max <= criterion.min) return setError('Điểm tối đa phải lớn hơn điểm tối thiểu.');
      if (!Number.isFinite(criterion.step) || criterion.step <= 0)
        return setError('Bước điểm phải lớn hơn 0.');
    }
    actions.updateSettings({ criteria: draft });
    notify('success', 'Đã lưu cấu hình tiêu chí đồng diễn.');
    setError('');
  };

  return (
    <div className="space-y-4">
      <div className="app-card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">5 tiêu chí chấm Đồng diễn</h2>
            <p className="muted mt-1">
              Tên tiêu chí và thang điểm có thể thay đổi. Mặc định mỗi tiêu chí 0–10, bước 0,1.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setDraft(state.settings.criteria)}
              disabled={!dirty}
            >
              Hoàn tác
            </Button>
            <Button
              variant="primary"
              onClick={save}
              disabled={!dirty}
            >
              <CheckIcon size={18} /> Lưu tiêu chí
            </Button>
          </div>
        </div>

        {hasGroupScores && (
          <div className="mt-4">
            <Callout tone="warning" title="Đã có điểm đồng diễn">
              Thay đổi tên hoặc thang điểm có thể làm điểm cũ không còn hợp lệ. Hãy kiểm tra lại
              các sự kiện Đồng diễn sau khi lưu.
            </Callout>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {draft.map((criterion, index) => (
            <div
              key={criterion.id}
              className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-[1fr_100px_100px_110px_44px] sm:items-end"
            >
              <div>
                <label className="label">Tiêu chí {index + 1}</label>
                <input
                  className="input"
                  value={criterion.name}
                  onChange={(event) => update(criterion.id, { name: event.target.value })}
                  placeholder="Tên tiêu chí"
                />
              </div>
              <div>
                <label className="label">Tối thiểu</label>
                <input
                  type="number"
                  className="input tabular"
                  value={criterion.min}
                  step={criterion.step}
                  onChange={(event) => update(criterion.id, { min: Number(event.target.value) })}
                />
              </div>
              <div>
                <label className="label">Tối đa</label>
                <input
                  type="number"
                  className="input tabular"
                  value={criterion.max}
                  step={criterion.step}
                  onChange={(event) => update(criterion.id, { max: Number(event.target.value) })}
                />
              </div>
              <div>
                <label className="label">Bước</label>
                <input
                  type="number"
                  className="input tabular"
                  value={criterion.step}
                  min={0.01}
                  step={0.1}
                  onChange={(event) => update(criterion.id, { step: Number(event.target.value) })}
                />
              </div>
              <IconButton
                label={`Xóa tiêu chí ${index + 1}`}
                variant="danger"
                disabled={draft.length <= 2}
                onClick={() => setDraft((current) => current.filter((c) => c.id !== criterion.id))}
              >
                <TrashIcon size={18} />
              </IconButton>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <Callout tone="danger" title={error} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (draft.length >= 8) return;
                setDraft((current) => [
                  ...current,
                  {
                    id: `crit-${Date.now()}`,
                    name: `Tiêu chí ${current.length + 1}`,
                    min: 0,
                    max: 10,
                    step: 0.1,
                  },
                ]);
                setError('');
              }}
              disabled={draft.length >= 8}
            >
              <PlusIcon size={18} /> Thêm tiêu chí
            </Button>
            <Button
              onClick={() => {
                setDraft(
                  state.settings.criteria.length
                    ? state.settings.criteria.map((c) => ({ ...c }))
                    : [],
                );
              }}
            >
              <RefreshIcon size={18} /> Nạp lại
            </Button>
          </div>
          <div className="text-sm text-slate-600">
            Tổng điểm tối đa mỗi giám khảo:{' '}
            <b className="tabular">
              {draft.reduce((total, c) => total + (Number.isFinite(c.max) ? c.max : 0), 0)}
            </b>
          </div>
        </div>
      </div>

      <div className="app-card card-pad">
        <h3 className="text-base font-bold">Cách tính điểm Đồng diễn</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-bold uppercase text-slate-500">Bước 1</div>
            <p className="mt-1 text-sm text-slate-700">
              Mỗi giám khảo chấm điểm từng tiêu chí cho từng đội.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-bold uppercase text-slate-500">Bước 2</div>
            <p className="mt-1 text-sm text-slate-700">
              Tổng điểm đội = tổng điểm các tiêu chí của tất cả giám khảo.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-bold uppercase text-slate-500">Tùy chọn</div>
            <p className="mt-1 text-sm text-slate-700">
              Bật “bỏ điểm cao nhất và thấp nhất” ở từng sự kiện để giảm ảnh hưởng cực trị.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lịch sử
// ---------------------------------------------------------------------------

function HistoryPanel() {
  const { state } = useApp();
  const [search, setSearch] = useState('');

  const filtered = state.history.filter((entry) => {
    const query = normalizeText(search);
    if (!query) return true;
    return normalizeText(`${entry.action} ${entry.detail} ${entry.actor}`).includes(query);
  });

  return (
    <div className="space-y-4">
      <div className="app-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title">Lịch sử thay đổi</h2>
            <p className="muted mt-1">
              Ghi nhận thao tác quan trọng, mở khóa, sửa điểm và phân định hòa. Mới nhất ở trên
              cùng.
            </p>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm trong lịch sử…"
            className="w-full sm:w-72"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              title="Chưa có lịch sử phù hợp"
              description="Các thao tác thêm/sửa/xóa, mở khóa và chấm điểm quan trọng sẽ xuất hiện tại đây."
            />
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {filtered.map((entry) => {
              const event = entry.eventId
                ? state.events.find((e) => e.id === entry.eventId)
                : undefined;
              return (
                <li key={entry.id} className="flex gap-3 px-5 py-3.5 sm:px-6">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm font-bold text-slate-800">{entry.action}</div>
                      <time className="tabular text-xs text-slate-500">
                        {formatDateTime(entry.at)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{entry.detail}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone="gray">{entry.actor}</Badge>
                      {event && (
                        <Link
                          to={`/xep-hang?event=${encodeURIComponent(event.id)}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {event.name}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Hiển thị {filtered.length} / {state.history.length} mục.
        </span>
        <button
          type="button"
          onClick={() => downloadText(JSON.stringify(state.history, null, 2), 'lich-su-thay-doi.json', 'application/json')}
          className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-brand-700 hover:underline"
        >
          <DownloadIcon size={16} /> Tải lịch sử (JSON)
        </button>
      </div>
    </div>
  );
}
