import { useMemo, useState } from 'react';
import type { DanceEvent } from '../types';
import { useApp } from '../store/AppStore';
import { computeSemifinalResults } from '../lib/results';
import { semifinalAllTiedQualifiers } from '../lib/semifinal';
import { DANCE_INFO } from '../lib/constants';
import { cn } from '../lib/utils';
import {
  AthleteLabel,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Modal,
  ProgressBar,
} from './ui';
import { AlertTriangleIcon, CheckIcon, TrophyIcon } from './icons';

export function SemifinalSummary({ event }: { event: DanceEvent }) {
  const { state, actions } = useApp();
  const bundle = useMemo(() => computeSemifinalResults(event, state.judges), [event, state.judges]);
  const result = bundle.result;
  const [manualOpen, setManualOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set(result.qualifiers));

  const canDecide = event.status === 'semifinal';
  const allTied = semifinalAllTiedQualifiers(result);
  const completeJudges = Object.values(bundle.validation.judgeComplete).filter(Boolean).length;

  const openManual = () => {
    setManualSelected(new Set(result.qualifiers));
    setManualOpen(true);
  };

  const confirmManual = () => {
    if (manualSelected.size !== 6) return;
    actions.finalizeSemifinal(
      event.id,
      [...manualSelected],
      'Chọn thủ công sau khi có VĐV đồng hạng ở ranh giới',
    );
    setManualOpen(false);
  };

  return (
    <div className="app-card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Tổng hợp bán kết</h2>
          <p className="muted mt-1">
            Số lượt được chọn giảm dần; bằng nhau thì tổng hạng nhỏ hơn. Top 6 vào chung kết.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bundle.complete ? (
            <Badge tone="green">
              <CheckIcon size={12} /> Đủ điểm
            </Badge>
          ) : (
            <Badge tone="amber">Chưa đủ điểm</Badge>
          )}
          <Badge tone="gray">
            {completeJudges}/{state.judges.length} giám khảo xong
          </Badge>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar
          value={bundle.validation.filled}
          total={bundle.validation.total}
          tone={bundle.complete ? 'green' : 'amber'}
        />
      </div>

      {!bundle.complete && (
        <div className="mt-3">
          <Callout tone="warning" title="Chưa thể chốt chung kết">
            Cần nhập đủ điểm cho tất cả giám khảo và tất cả điệu. Bảng dưới đây chỉ là tạm tính.
          </Callout>
        </div>
      )}

      {bundle.complete && result.boundaryTie && (
        <div className="mt-3">
          <Callout
            tone="warning"
            title="Hòa ở vị trí thứ 6 – cần Chủ tịch hội đồng quyết định"
          >
            <p>
              Các VĐV sau có cùng số lượt chọn và tổng hạng tại ranh giới:{' '}
              <b>
                {result.boundaryAthleteIds
                  .map((id) => state.athletes.find((a) => a.id === id)?.bib ?? id)
                  .join(', ')}
              </b>
              . Hãy chọn đưa tất cả vào chung kết hoặc chọn thủ công đúng 6 VĐV.
            </p>
            {canDecide && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="warning" onClick={() => setPromoteOpen(true)}>
                  <TrophyIcon size={18} /> Đưa tất cả ({allTied.length} VĐV)
                </Button>
                <Button onClick={openManual}>Chọn thủ công 6 VĐV</Button>
              </div>
            )}
          </Callout>
        </div>
      )}

      {bundle.complete && !result.boundaryTie && event.status === 'semifinal' && (
        <div className="mt-3">
          <Callout tone="info" title="Đã đủ điểm, chưa chuyển vòng">
            <p>
              Hệ thống sẽ tự chuyển 6 VĐV vào chung kết. Nếu chưa thấy chuyển, bấm nút bên dưới.
            </p>
            <div className="mt-3">
              <Button
                variant="primary"
                onClick={() =>
                  actions.finalizeSemifinal(event.id, result.qualifiers, 'Chốt bán kết')
                }
              >
                <CheckIcon size={18} /> Chốt 6 VĐV vào chung kết
              </Button>
            </div>
          </Callout>
        </div>
      )}

      {event.final && (
        <div className="mt-3">
          <Callout tone="success" title="Đã tạo vòng chung kết">
            <p>
              {event.finalists?.length ?? 0} VĐV đã được đưa vào chung kết. Chuyển sang tab
              “Chung kết” để chấm tiếp.
            </p>
          </Callout>
        </div>
      )}

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
            {result.rows.map((row) => {
              const athlete = state.athletes.find((a) => a.id === row.athleteId);
              return (
                <tr
                  key={row.athleteId}
                  className={cn(
                    row.tiedAtCutoff
                      ? 'bg-amber-50'
                      : row.position <= 6
                        ? 'bg-emerald-50/30'
                        : undefined,
                  )}
                >
                  <td className="tabular font-bold">{row.position}</td>
                  <td>
                    <AthleteLabel athlete={athlete} compact />
                  </td>
                  {event.dances.map((dance) => {
                    const cell = row.perDance[dance];
                    return (
                      <td key={dance} className="text-center">
                        {cell.selected ? (
                          <span
                            className={cn(
                              'tabular inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-xs font-bold',
                              cell.rank === 1
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700',
                            )}
                          >
                            {cell.rank}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <AlertTriangleIcon size={15} className="text-amber-600" />
        Cột điệu hiển thị hạng của VĐV trong điệu đó; dấu — nghĩa là không được chọn.
      </div>

      <ConfirmDialog
        open={promoteOpen}
        tone="warning"
        title="Đưa tất cả VĐV đồng hạng vào chung kết?"
        description={`Chung kết sẽ có ${allTied.length} VĐV thay vì 6.`}
        confirmLabel={`Tạo chung kết ${allTied.length} VĐV`}
        onCancel={() => setPromoteOpen(false)}
        onConfirm={() => {
          actions.finalizeSemifinal(
            event.id,
            allTied,
            'Đưa tất cả VĐV đồng hạng ở vị trí thứ 6 vào chung kết',
          );
          setPromoteOpen(false);
        }}
      >
        <p className="text-sm text-slate-600">
          Quyết định này được ghi vào lịch sử với tên Chủ tịch hội đồng. Các VĐV đồng hạng sẽ cùng
          thi chung kết.
        </p>
      </ConfirmDialog>

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Chọn thủ công VĐV vào chung kết"
        description="Chọn đúng 6 VĐV. Danh sách gợi ý mặc định là top 6 theo tổng hợp bán kết."
        size="lg"
        footer={
          <>
            <Button onClick={() => setManualOpen(false)}>Hủy</Button>
            <Button
              variant="primary"
              disabled={manualSelected.size !== 6}
              onClick={confirmManual}
            >
              <CheckIcon size={18} /> Chốt {manualSelected.size}/6 VĐV
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Callout tone="warning" title="Quyết định của Chủ tịch hội đồng">
            Lựa chọn sẽ được ghi lịch sử. Chỉ chọn 6 VĐV để giữ đúng thể thức chung kết.
          </Callout>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.rows.map((row) => {
              const athlete = state.athletes.find((a) => a.id === row.athleteId);
              const checked = manualSelected.has(row.athleteId);
              const tied = row.tiedAtCutoff;
              return (
                <label
                  key={row.athleteId}
                  className={cn(
                    'flex min-h-[62px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
                    checked ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white',
                    tied && !checked && 'border-amber-300 bg-amber-50/50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-brand-700"
                    checked={checked}
                    onChange={() => {
                      setManualSelected((current) => {
                        const next = new Set(current);
                        if (next.has(row.athleteId)) next.delete(row.athleteId);
                        else if (next.size < 6) next.add(row.athleteId);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <AthleteLabel athlete={athlete} compact />
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div className="tabular font-bold text-slate-700">
                      {row.selections} lượt
                    </div>
                    <div className="tabular">Tổng {row.rankSum}</div>
                    {tied && <div className="font-bold text-amber-700">Hòa</div>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
