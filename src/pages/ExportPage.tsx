import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import type { AppState } from '../types';
import { useApp } from '../store/AppStore';
import { buildEventReport } from '../lib/report';
import {
  CATEGORIES,
  DANCE_INFO,
} from '../lib/constants';
import {
  downloadText,
  formatDate,
  formatDateTime,
  inputDateValue,
  normalizeText,
} from '../lib/utils';
import {
  Button,
  Callout,
  ConfirmDialog,
  PageHeader,
  StatCard,
} from '../components/ui';
import {
  DatabaseIcon,
  DownloadIcon,
  PrinterIcon,
  RefreshIcon,
  SheetIcon,
  TrashIcon,
  UploadIcon,
} from '../components/icons';

type Notice = { tone: 'success' | 'info' | 'warning'; text: string };
type View = 'tools' | 'print';

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.judges) &&
    Array.isArray(candidate.athletes) &&
    Boolean(candidate.settings) &&
    Array.isArray(candidate.settings?.criteria)
  );
}

export default function ExportPage() {
  const { state, actions, savedAt } = useApp();
  const [view, setView] = useState<View>('tools');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [scope, setScope] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<AppState | null>(null);
  const [resetMode, setResetMode] = useState<'sample' | 'empty' | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const notify = (tone: Notice['tone'], text: string) => setNotice({ tone, text });

  const reports = useMemo(
    () => state.events.map((event) => buildEventReport(event, state)),
    [state],
  );
  const reportsWithResults = reports.filter((report) => report.rows.length > 0);
  const completed = state.events.filter((event) => event.status === 'done').length;
  const dataSize = useMemo(() => {
    try {
      return Math.round(new Blob([JSON.stringify(state)]).size / 1024);
    } catch {
      return 0;
    }
  }, [state]);

  const backupName = useMemo(() => {
    const slug = normalizeText(state.settings.competitionName || 'giai-khieu-vu')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return `wdsf-backup-${slug || 'du-lieu'}-${inputDateValue(new Date().toISOString())}.json`;
  }, [state.settings.competitionName]);

  const handleBackup = () => {
    downloadText(JSON.stringify(state, null, 2), backupName, 'application/json');
    notify('success', 'Đã tải bản sao lưu JSON. Hãy giữ tệp này ở nơi an toàn.');
  };

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isAppState(parsed)) {
        notify('warning', 'Tệp JSON không đúng định dạng dữ liệu của hệ thống.');
        return;
      }
      setRestoreCandidate(parsed);
    } catch {
      notify('warning', 'Không đọc được tệp JSON. Hãy kiểm tra tệp sao lưu.');
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const handleExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { exportResultsWorkbook } = await import('../lib/xlsx');
      const filename = await exportResultsWorkbook(
        state,
        scope === 'all' ? undefined : scope,
      );
      notify('success', `Đã xuất Excel: ${filename}`);
    } catch (error) {
      notify(
        'warning',
        error instanceof Error ? `Không xuất được Excel: ${error.message}` : 'Không xuất được Excel.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader
          eyebrow="Kết thúc giải"
          title={view === 'tools' ? 'Xuất & sao lưu' : 'Bản in tổng hợp'}
          description={
            view === 'tools'
              ? 'Xuất kết quả Excel, sao lưu toàn bộ dữ liệu JSON và in bản tổng hợp A4. Dữ liệu chỉ nằm trong trình duyệt nên hãy sao lưu thường xuyên.'
              : 'Bản tổng hợp toàn giải theo từng nội dung, sẵn sàng in A4.'
          }
          actions={
            view === 'tools' ? (
              <>
                <Button onClick={handleBackup}>
                  <DownloadIcon size={18} /> Sao lưu JSON
                </Button>
                <Button variant="primary" onClick={() => setView('print')}>
                  <PrinterIcon size={18} /> Bản in tổng hợp
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setView('tools')}>Quay lại công cụ</Button>
                <Button variant="primary" onClick={() => window.print()}>
                  <PrinterIcon size={18} /> In A4
                </Button>
              </>
            )
          }
        />

        {notice && (
          <div className="mb-4">
            <Callout tone={notice.tone} title={notice.text} />
          </div>
        )}

        {view === 'tools' && (
          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Sự kiện hoàn tất"
              value={`${completed}/${state.events.length}`}
              tone="green"
            />
            <StatCard
              label="Sự kiện có kết quả"
              value={reportsWithResults.length}
              hint="Gồm cả kết quả tạm tính"
              tone="blue"
            />
            <StatCard
              label="Dữ liệu trong bộ nhớ"
              value={`${dataSize} KB`}
              hint="Ước tính JSON"
              tone="gray"
            />
            <StatCard
              label="Lần lưu gần nhất"
              value={savedAt ? 'Đã lưu' : '—'}
              hint={savedAt ? formatDateTime(savedAt) : 'Chưa lưu'}
              tone="gray"
            />
          </div>
        )}
      </div>

      {view === 'tools' ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="app-card card-pad">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <SheetIcon size={23} />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Xuất Excel</h2>
                  <p className="muted mt-1">
                    Tệp .xlsx gồm nhiều trang: tổng hợp, kết quả chung kết, đồng diễn, bán kết,
                    chi tiết giám khảo, danh sách VĐV và đăng ký.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label className="label" htmlFor="export-scope">
                  Phạm vi xuất
                </label>
                <select
                  id="export-scope"
                  className="select"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="all">Toàn bộ giải ({state.events.length} sự kiện)</option>
                  {CATEGORIES.map((category) => (
                    <optgroup key={category.id} label={category.label}>
                      {state.events
                        .filter((event) => event.category === category.id)
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <p className="hint">
                  Xuất theo sự kiện vẫn kèm danh sách giám khảo, VĐV và thông tin giải.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" onClick={handleExcel} disabled={exporting}>
                  <DownloadIcon size={18} /> {exporting ? 'Đang xuất…' : 'Xuất file Excel'}
                </Button>
                <Link to="/xep-hang" className="btn-secondary">
                  Kiểm tra bảng xếp hạng
                </Link>
              </div>
            </div>

            <div className="app-card card-pad">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
                  <DatabaseIcon size={23} />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Sao lưu & khôi phục</h2>
                  <p className="muted mt-1">
                    Tệp JSON chứa toàn bộ giải: giám khảo, VĐV, sự kiện, điểm, lịch sử và cấu
                    hình. Dùng để chuyển máy hoặc khôi phục khi cần.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Bản sao lưu hiện tại
                </div>
                <div className="mt-1 break-all text-sm font-semibold text-slate-800">{backupName}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {dataSize} KB · {state.events.length} sự kiện · {state.athletes.length} VĐV/đội
                </div>
                <Button className="mt-3" variant="primary" onClick={handleBackup}>
                  <DownloadIcon size={18} /> Tải bản sao lưu
                </Button>
              </div>

              <div className="mt-4">
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Chọn tệp JSON để khôi phục dữ liệu"
                  className="sr-only"
                  onChange={(event) => void handleRestoreFile(event.target.files?.[0])}
                />
                <Button onClick={() => restoreInputRef.current?.click()}>
                  <UploadIcon size={18} /> Khôi phục từ tệp JSON
                </Button>
                <p className="hint">
                  Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Hãy sao lưu trước khi khôi phục.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="app-card card-pad">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <PrinterIcon size={23} />
                </span>
                <div>
                  <h2 className="text-lg font-bold">In A4</h2>
                  <p className="muted mt-1">
                    In bảng xếp hạng từng sự kiện với đầy đủ huy chương, chi tiết giám khảo và
                    bảng Skating. Bản tổng hợp toàn giải in tất cả nội dung có kết quả.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setView('print')}>
                  <PrinterIcon size={18} /> Xem bản in tổng hợp
                </Button>
                <Link to="/xep-hang" className="btn-secondary">
                  In theo sự kiện
                </Link>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-600">
                <b>Mẹo in:</b> chọn khổ A4, lề mặc định, bật “Background graphics” nếu cần giữ
                màu huy chương. Bảng Skating sẽ tự ngắt trang theo từng điệu.
              </div>
            </div>

            <div className="app-card card-pad">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-800">
                  <RefreshIcon size={23} />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Đặt lại dữ liệu</h2>
                  <p className="muted mt-1">
                    Dùng khi muốn bắt đầu giải mới. Thao tác này xóa toàn bộ dữ liệu hiện tại.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setResetMode('sample')}>Nạp lại dữ liệu mẫu</Button>
                <Button variant="danger" onClick={() => setResetMode('empty')}>
                  <TrashIcon size={18} /> Xóa toàn bộ
                </Button>
              </div>
              <p className="hint">
                Dữ liệu mẫu gồm 7 giám khảo, 24 VĐV/đội và 7 sự kiện minh họa.
              </p>
            </div>
          </div>

          <div className="app-card card-pad">
            <h2 className="section-title">Tổng quan theo nội dung</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nội dung</th>
                    <th className="text-right">Sự kiện</th>
                    <th className="text-right">Hoàn tất</th>
                    <th className="text-right">Có kết quả</th>
                    <th className="hidden sm:table-cell">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((category) => {
                    const events = state.events.filter((event) => event.category === category.id);
                    const done = events.filter((event) => event.status === 'done').length;
                    const withResults = reports.filter(
                      (report) => report.event.category === category.id && report.rows.length > 0,
                    ).length;
                    return (
                      <tr key={category.id}>
                        <td className="font-semibold">{category.label}</td>
                        <td className="tabular text-right">{events.length}</td>
                        <td className="tabular text-right">{done}</td>
                        <td className="tabular text-right">{withResults}</td>
                        <td className="hidden text-xs text-slate-500 sm:table-cell">
                          {category.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Callout tone="warning" title="Hãy sao lưu trước khi kết thúc">
            Dữ liệu nằm trong localStorage của trình duyệt. Xóa dữ liệu trình duyệt, dùng chế độ
            ẩn danh hoặc đổi máy sẽ làm mất dữ liệu nếu chưa xuất tệp JSON.
          </Callout>
        </div>
      ) : (
        <PrintSummary reports={reports} state={state} />
      )}

      {restoreCandidate && (
        <ConfirmDialog
          open
          tone="warning"
          title="Khôi phục dữ liệu từ tệp JSON?"
          description="Toàn bộ dữ liệu hiện tại sẽ được thay thế bằng nội dung tệp."
          confirmLabel="Khôi phục"
          onCancel={() => setRestoreCandidate(null)}
          onConfirm={() => {
            actions.restoreState(restoreCandidate);
            notify('success', 'Đã khôi phục dữ liệu từ tệp JSON.');
            setRestoreCandidate(null);
          }}
        >
          <div className="space-y-3">
            <Callout tone="warning" title="Không thể hoàn tác">
              Nếu dữ liệu hiện tại quan trọng, hãy sao lưu trước khi tiếp tục.
            </Callout>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Giải</span>
                <b className="text-right">{restoreCandidate.settings.competitionName}</b>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-slate-500">Giám khảo</span>
                <b>{restoreCandidate.judges.length}</b>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-slate-500">VĐV/đội</span>
                <b>{restoreCandidate.athletes.length}</b>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-slate-500">Sự kiện</span>
                <b>{restoreCandidate.events.length}</b>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-slate-500">Lịch sử</span>
                <b>{restoreCandidate.history.length} mục</b>
              </div>
            </div>
          </div>
        </ConfirmDialog>
      )}

      {resetMode && (
        <ConfirmDialog
          open
          title={
            resetMode === 'sample'
              ? 'Nạp lại dữ liệu mẫu?'
              : 'Xóa toàn bộ dữ liệu và bắt đầu giải mới?'
          }
          description="Thao tác này thay thế dữ liệu hiện tại và không thể hoàn tác."
          confirmLabel={resetMode === 'sample' ? 'Nạp dữ liệu mẫu' : 'Xóa toàn bộ'}
          onCancel={() => setResetMode(null)}
          onConfirm={() => {
            actions.resetData(resetMode);
            notify(
              'success',
              resetMode === 'sample' ? 'Đã nạp lại dữ liệu mẫu.' : 'Đã tạo dữ liệu giải mới.',
            );
            setResetMode(null);
            setScope('all');
          }}
        >
          <Callout tone="danger" title="Dữ liệu hiện tại sẽ mất">
            Hãy dùng nút “Tải bản sao lưu” trước khi tiếp tục nếu bạn muốn giữ kết quả.
          </Callout>
        </ConfirmDialog>
      )}
    </div>
  );
}

function PrintSummary({
  reports,
  state,
}: {
  reports: ReturnType<typeof buildEventReport>[];
  state: AppState;
}) {
  return (
    <div className="print-area rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8 print:border-0 print:p-0 print:shadow-none">
      <div className="mb-6 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
          {state.settings.competitionName}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {state.settings.venue}
          {state.settings.venue && state.settings.eventDate ? ' · ' : ''}
          {state.settings.eventDate ? formatDate(state.settings.eventDate) : ''}
        </div>
        <h2 className="mt-3 text-2xl font-extrabold uppercase tracking-wide">
          Tổng hợp kết quả toàn giải
        </h2>
        <div className="mt-1 text-xs text-slate-500">
          Hội đồng giám khảo: {state.judges.map((judge) => `${judge.code} – ${judge.name}`).join('; ')}
        </div>
      </div>

      <div className="space-y-6">
        {CATEGORIES.map((category) => {
          const categoryReports = reports.filter(
            (report) =>
              report.event.category === category.id &&
              (report.kind === 'final' || report.kind === 'group') &&
              report.rows.length > 0,
          );
          return (
            <section key={category.id} className="print-page-break">
              <h3 className="border-b-2 border-slate-800 pb-1 text-lg font-extrabold uppercase">
                {category.label}
              </h3>
              {categoryReports.length === 0 ? (
                <p className="mt-3 text-sm italic text-slate-500">Chưa có sự kiện nào có kết quả.</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {categoryReports.map((report) => (
                    <div key={report.event.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-sm font-bold">
                          {report.event.name}{' '}
                          <span className="font-normal text-slate-500">
                            ({report.kind === 'group'
                              ? '5 tiêu chí'
                              : report.event.dances.map((dance) => DANCE_INFO[dance].short).join(' · ')})
                          </span>
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {report.complete ? 'Chính thức' : 'Tạm tính – chưa đủ điểm'}
                          {report.tieCount > 0 ? ' · có hòa' : ''}
                        </span>
                      </div>
                      <table className="mt-1 w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-y border-slate-300 bg-slate-50">
                            <th className="w-12 px-2 py-1 text-left">Hạng</th>
                            <th className="w-14 px-2 py-1 text-left">SBD</th>
                            <th className="px-2 py-1 text-left">VĐV / Đội</th>
                            <th className="w-24 px-2 py-1 text-right">
                              {report.kind === 'group' ? 'Tổng điểm' : 'Tổng hạng'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.rows.map((row) => {
                            const athlete = state.athletes.find((a) => a.id === row.athleteId);
                            return (
                              <tr key={row.athleteId} className="border-b border-slate-200">
                                <td className="px-2 py-1 font-bold">
                                  {row.place}
                                  {row.tied ? '*' : ''}
                                </td>
                                <td className="px-2 py-1">{athlete?.bib}</td>
                                <td className="px-2 py-1">
                                  {athlete?.kind === 'couple'
                                    ? `${athlete.male} / ${athlete.female}`
                                    : athlete?.teamName ?? athlete?.name}
                                  {athlete?.kind === 'team' && athlete.unit ? ` – ${athlete.unit}` : ''}
                                </td>
                                <td className="px-2 py-1 text-right font-semibold">{row.total}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-10 grid grid-cols-3 gap-8 text-center text-xs">
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

      <div className="mt-6 text-center text-[10px] text-slate-500">
        In lúc {formatDateTime(new Date().toISOString())} · Hệ thống chấm điểm WDSF Scoring
      </div>
    </div>
  );
}
