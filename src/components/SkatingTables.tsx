import { useState } from 'react';
import type { Dance, DanceEvent, Athlete, Judge } from '../types';
import { useApp } from '../store/AppStore';
import { DANCE_INFO } from '../lib/constants';
import { cn } from '../lib/utils';
import type { FinalResults } from '../lib/results';
import {
  AthleteLabel,
  Badge,
  Button,
  Modal,
  PlaceNumber,
} from './ui';
import { ArrowDownIcon, ArrowUpIcon } from './icons';

export function SkatingTables({
  event,
  result,
  athletes,
}: {
  event: DanceEvent;
  result: FinalResults;
  athletes: Athlete[];
}) {
  const { state } = useApp();
  const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const judges = state.judges;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Bảng tổng hợp Skating</h2>
        <p className="muted mt-1">
          Tổng hạng các điệu; tổng nhỏ hơn xếp trên. Hòa tổng được phân định theo Rule 11: số điệu
          đạt hạng 1, 2… sau đó tổng hạng thô.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-16">Hạng</th>
                <th>VĐV</th>
                {event.dances.map((dance) => (
                  <th key={dance} className="text-center" title={DANCE_INFO[dance].name}>
                    {DANCE_INFO[dance].short}
                  </th>
                ))}
                <th className="text-right">Tổng hạng</th>
                <th className="text-right">Tổng hạng thô</th>
                <th className="text-right">Hạng cuối</th>
              </tr>
            </thead>
            <tbody>
              {result.overall.rows.map((row) => {
                const athlete = athleteById.get(row.athleteId);
                return (
                  <tr key={row.athleteId} className={row.tied ? 'bg-amber-50' : undefined}>
                    <td className="font-bold">
                      <PlaceNumber place={row.place} tied={row.tied} />
                    </td>
                    <td>
                      <AthleteLabel athlete={athlete} compact />
                    </td>
                    {event.dances.map((dance) => (
                      <td key={dance} className="tabular text-center font-semibold">
                        {row.dancePlaces[dance] ?? '—'}
                      </td>
                    ))}
                    <td className="tabular text-right font-extrabold">{row.total}</td>
                    <td className="tabular text-right text-slate-500">{row.rawSum}</td>
                    <td className="text-right">
                      {row.tied ? (
                        <Badge tone="amber">Hòa</Badge>
                      ) : (
                        <span className="tabular font-bold">{row.place}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {event.dances.map((dance) => {
        const danceResult = result.danceResults[dance];
        if (!danceResult) return null;
        return (
          <DanceSkatingTable
            key={dance}
            dance={dance}
            result={danceResult}
            athleteById={athleteById}
            judges={judges}
          />
        );
      })}
    </div>
  );
}

function DanceSkatingTable({
  dance,
  result,
  athleteById,
  judges,
}: {
  dance: Dance;
  result: NonNullable<FinalResults['danceResults'][Dance]>;
  athleteById: Map<string, Athlete>;
  judges: Judge[];
}) {
  const N = result.contestantIds.length;
  return (
    <div className="print-page-break">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">
          {DANCE_INFO[dance].name} <span className="text-slate-500">({DANCE_INFO[dance].short})</span>
        </h3>
        <div className="text-xs text-slate-500">
          Đa số = <b>{result.majority}</b> / {result.judgeIds.length} giám khảo · {N} VĐV
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="table-base print-compact">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 bg-slate-50">
                VĐV
              </th>
              {result.judgeIds.map((judgeId) => (
                <th key={judgeId} rowSpan={2} className="text-center">
                  {judges.find((judge) => judge.id === judgeId)?.code ?? judgeId}
                </th>
              ))}
              <th colSpan={N} className="border-l border-slate-200 text-center">
                Số phiếu cộng dồn (hạng ≤ p)
              </th>
              <th rowSpan={2} className="text-right">
                Tổng hạng
              </th>
              <th rowSpan={2} className="text-center">
                Hạng
              </th>
            </tr>
            <tr>
              {Array.from({ length: N }, (_, index) => (
                <th key={index} className="text-center">
                  ≤{index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => {
              const athlete = athleteById.get(row.athleteId);
              return (
                <tr key={row.athleteId} className={row.tied ? 'bg-amber-50' : undefined}>
                  <td className="sticky left-0 z-10 min-w-[190px] bg-inherit">
                    <AthleteLabel athlete={athlete} compact showSub={false} />
                  </td>
                  {result.judgeIds.map((judgeId) => {
                    const rank = result.ranks[judgeId]?.[row.athleteId];
                    return (
                      <td key={judgeId} className="tabular text-center">
                        {rank ?? '—'}
                      </td>
                    );
                  })}
                  {row.counts.map((count, index) => (
                    <td
                      key={index}
                      className={cn(
                        'tabular border-l border-slate-100 text-center',
                        count >= result.majority && 'bg-emerald-50 font-bold text-emerald-800',
                      )}
                    >
                      {count}
                    </td>
                  ))}
                  <td className="tabular text-right font-bold">{row.sumRanks}</td>
                  <td className="text-center">
                    <span
                      className={cn(
                        'tabular inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-0.5 font-extrabold',
                        row.place === 1
                          ? 'bg-amber-100 text-amber-900'
                          : row.place === 2
                            ? 'bg-slate-100 text-slate-800'
                            : row.place === 3
                              ? 'bg-orange-100 text-orange-900'
                              : 'bg-slate-50 text-slate-600',
                        row.tied && 'ring-1 ring-amber-400',
                      )}
                    >
                      {row.place}
                      {row.tied ? '*' : ''}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        Cột xanh = VĐV đạt đa số phiếu ở ngưỡng hạng tương ứng. Dấu * = hòa cần Chủ tịch HĐ phân
        định.
      </p>
    </div>
  );
}

export function TieResolverModal({
  open,
  onClose,
  event,
  scope,
  dance,
  athleteIds,
  initialOrder,
}: {
  open: boolean;
  onClose: () => void;
  event: DanceEvent;
  scope: 'dance' | 'overall';
  dance?: Dance;
  athleteIds: string[];
  initialOrder: string[];
}) {
  const { state, actions } = useApp();
  const [order, setOrder] = useState(initialOrder);
  const [note, setNote] = useState('');

  const move = (index: number, direction: -1 | 1) => {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Phân định hòa"
      description={`${event.name}${dance ? ` · ${DANCE_INFO[dance].name}` : ''}`}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.resolveTie({
                eventId: event.id,
                scope,
                dance,
                athleteIds,
                order,
                note: note.trim() || 'Quyết định của Chủ tịch hội đồng',
              });
              onClose();
            }}
          >
            Lưu quyết định
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="warning-box">
          <div className="font-bold">Kết quả hòa chưa thể phân định bằng thuật toán</div>
          <p className="mt-1 text-sm">
            Chủ tịch hội đồng xếp thứ tự các VĐV bên dưới. Thứ tự này được áp dụng vào bảng điểm và
            ghi lịch sử.
          </p>
        </div>

        <div className="space-y-2">
          {order.map((athleteId, index) => {
            const athlete = state.athletes.find((a) => a.id === athleteId);
            return (
              <div
                key={athleteId}
                className="flex min-h-[60px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <span className="tabular flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-extrabold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <AthleteLabel athlete={athlete} />
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Đưa lên"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUpIcon size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Đưa xuống"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    onClick={() => move(index, 1)}
                    disabled={index === order.length - 1}
                  >
                    <ArrowDownIcon size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <label className="label" htmlFor="tie-note">
            Ghi chú quyết định (tùy chọn)
          </label>
          <input
            id="tie-note"
            className="input"
            value={note}
            onChange={(eventInput) => setNote(eventInput.target.value)}
            placeholder="VD: Xét thành tích đối đầu, quyết định của Chủ tịch HĐ"
          />
        </div>
      </div>
    </Modal>
  );
}
