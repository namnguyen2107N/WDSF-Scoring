import { useMemo, useRef, useState } from 'react';
import { useApp } from '../store/AppStore';
import {
  athleteCsvTemplate,
  parseAthleteImport,
} from '../lib/csv';
import { downloadText } from '../lib/utils';
import { Button, Callout, Modal } from './ui';
import { DownloadIcon, UploadIcon } from './icons';

export function ImportAthletesModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number, skipped: number) => void;
}) {
  const { state, actions } = useApp();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseAthleteImport(text), [text]);
  const hasInput = text.trim().length > 0;
  const existingBibs = useMemo(
    () => new Set(state.athletes.map((a) => a.bib.trim())),
    [state.athletes],
  );
  const duplicates = parsed.rows.filter((row) => existingBibs.has(row.bib));
  const importable = parsed.rows.filter((row) => !existingBibs.has(row.bib));

  const reset = () => {
    setText('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    setFileName(file.name);
  };

  const handleImport = () => {
    if (!importable.length) return;
    const added = actions.addAthletes(importable);
    onImported(added, parsed.rows.length - added + parsed.issues.length);
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Nhập nhanh vận động viên"
      description="Dán trực tiếp từ Excel (phân tách bằng Tab) hoặc tải lên tệp CSV. Nên giữ hàng tiêu đề để hệ thống nhận đúng cột."
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleImport} disabled={!importable.length}>
            Nhập {importable.length > 0 ? `${importable.length} VĐV` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="label mb-0" htmlFor="athlete-import-text">
                Dữ liệu dán / nội dung CSV
              </label>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                onClick={() => downloadText(`\uFEFF${athleteCsvTemplate()}`, 'mau-nhap-van-dong-vien.csv', 'text/csv')}
              >
                <DownloadIcon size={16} /> Tải mẫu CSV
              </button>
            </div>
            <textarea
              id="athlete-import-text"
              className="input min-h-[220px] resize-y font-mono text-xs leading-6"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setFileName('');
              }}
              placeholder={`SBD\tLoại\tTên\tNam\tNữ\tĐội\tĐơn vị\tNhóm tuổi\n501\tSolo\tNguyễn Văn A\t\t\t\t\tTrẻ\n502\tCouple\t\tMinh Quân\tThu Trang\t\t\tThanh niên`}
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                aria-label="Chọn tệp CSV để nhập vận động viên"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <UploadIcon size={18} /> Chọn tệp CSV
              </Button>
              {fileName && <span className="text-xs font-semibold text-slate-500">{fileName}</span>}
              {text && (
                <Button variant="ghost" onClick={reset}>
                  Xóa nội dung
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Callout tone="info" title="Các cột được nhận diện">
              <p className="text-xs leading-relaxed">
                <b>SBD</b>, <b>Loại</b> (Solo / Couple / Đội), <b>Tên</b>, <b>Nam</b>,{' '}
                <b>Nữ</b>, <b>Đội</b>, <b>Đơn vị</b>, <b>Nhóm tuổi</b>, <b>Ghi chú</b>. Có thể
                dùng tiêu đề tiếng Việt hoặc tiếng Anh. Nếu không có tiêu đề, cột được hiểu là
                SBD, Tên, Nhóm tuổi.
              </p>
            </Callout>
            <Callout tone="warning" title="Lưu ý">
              <p className="text-xs leading-relaxed">
                Hệ thống tự nhận loại: có tên Nam/Nữ → Couple; có tên Đội/Đơn vị → Đội; còn lại
                là Solo. SBD trùng với danh sách hiện có sẽ được bỏ qua và báo lại sau khi nhập.
              </p>
            </Callout>
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <div className="font-bold text-slate-800">Đã chọn tệp / dữ liệu</div>
              {hasInput ? (
                <>
                  <p>
                    {parsed.totalRows} dòng · {parsed.rows.length} hợp lệ · {parsed.issues.length}{' '}
                    lỗi · {duplicates.length} SBD đã tồn tại
                  </p>
                  {parsed.headers.length > 0 && (
                    <p className="mt-1 truncate text-slate-500">
                      Cột: {parsed.headers.join(' | ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-slate-500">
                  Chưa có dữ liệu. Dán bảng từ Excel hoặc chọn tệp CSV để xem trước.
                </p>
              )}
            </div>
          </div>
        </div>

        {hasInput && parsed.issues.length > 0 && (
          <Callout tone="warning" title={`${parsed.issues.length} dòng chưa hợp lệ`}>
            <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
              {parsed.issues.slice(0, 20).map((issue, index) => (
                <li key={`${issue.line}-${index}`}>
                  {issue.line ? `Dòng ${issue.line}: ` : ''}
                  {issue.message}
                </li>
              ))}
              {parsed.issues.length > 20 && <li>… và {parsed.issues.length - 20} lỗi khác.</li>}
            </ul>
          </Callout>
        )}

        {parsed.rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table-base">
              <thead>
                <tr>
                  <th>SBD</th>
                  <th>Loại</th>
                  <th>Tên / Đội</th>
                  <th>Đơn vị</th>
                  <th>Nhóm tuổi</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 8).map((row) => {
                  const duplicate = existingBibs.has(row.bib);
                  return (
                    <tr key={row.bib}>
                      <td className="tabular font-bold">{row.bib}</td>
                      <td>{row.kind === 'solo' ? 'Solo' : row.kind === 'couple' ? 'Couple' : 'Đội'}</td>
                      <td className="font-semibold">
                        {row.kind === 'couple'
                          ? `${row.male || '—'} / ${row.female || '—'}`
                          : row.teamName || row.name}
                      </td>
                      <td>{row.unit || '—'}</td>
                      <td>{row.ageGroup || '—'}</td>
                      <td>
                        {duplicate ? (
                          <span className="badge-amber">SBD đã tồn tại</span>
                        ) : (
                          <span className="badge-green">Sẽ nhập</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {parsed.rows.length > 8 && (
              <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                … và {parsed.rows.length - 8} dòng khác
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
