import { useMemo, useState } from 'react';
import type { Judge, Dance, DanceEvent, RoundType } from '../types';
import { useApp } from '../store/AppStore';
import { cn, sortBibs } from '../lib/utils';
import {
  AthleteLabel,
  Badge,
  Button,
  Callout,
  IconButton,
  ProgressBar,
} from './ui';
import {
  CheckIcon,
  TrashIcon,
  UsersIcon,
} from './icons';

type MatrixProps = {
  event: DanceEvent;
  round: RoundType;
  dance: Dance;
  judge: Judge;
  readOnly: boolean;
  onRequestClear: () => void;
};

export function JudgingMatrix({
  event,
  round,
  dance,
  judge,
  readOnly,
  onRequestClear,
}: MatrixProps) {
  const { state, actions } = useApp();
  const [mode, setMode] = useState<'table' | 'quick'>('table');
  const participants = useMemo(
    () =>
      sortBibs(
        (round === 'semifinal' ? event.athleteIds : event.finalists ?? [])
          .map((id) => state.athletes.find((a) => a.id === id))
          .filter(Boolean) as NonNullable<(typeof state.athletes)[number]>[],
      ),
    [round, event.athleteIds, event.finalists, state.athletes],
  );
  const slotsLength = round === 'semifinal' ? 6 : participants.length;
  const stored = event[round]?.marks?.[dance]?.[judge.id] ?? [];
  const slots = Array.from({ length: slotsLength }, (_, index) => stored[index] ?? null);
  const athleteById = useMemo(
    () => new Map(state.athletes.map((athlete) => [athlete.id, athlete])),
    [state.athletes],
  );

  const missing = slots
    .map((athleteId, index) => (athleteId ? null : index + 1))
    .filter((place): place is number => place !== null);
  const duplicates = slots.filter(
    (athleteId, index): athleteId is string =>
      Boolean(athleteId) && slots.indexOf(athleteId) !== index,
  );
  const filled = slots.filter(Boolean).length;
  const complete = slotsLength > 0 && missing.length === 0 && duplicates.length === 0;

  const placeOf = (athleteId: string) => {
    const index = slots.findIndex((id) => id === athleteId);
    return index === -1 ? null : index + 1;
  };

  const assign = (placeIndex: number, athleteId: string | null) => {
    if (readOnly) return;
    actions.setMark(event.id, round, dance, judge.id, placeIndex, athleteId);
  };

  const unassigned = participants.filter((athlete) => !slots.includes(athlete.id));
  const firstEmpty = slots.findIndex((id) => !id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">
              {round === 'semifinal' ? 'Bán kết' : 'Chung kết'} · Giám khảo {judge.code}
            </h3>
            {complete ? (
              <Badge tone="green">
                <CheckIcon size={12} /> Đã nhập đủ
              </Badge>
            ) : (
              <Badge tone="amber">Còn {missing.length} hạng</Badge>
            )}
          </div>
          <p className="muted mt-1">
            {round === 'semifinal'
              ? 'Chọn 6 VĐV và xếp hạng 1–6. VĐV không được chọn sẽ không có điểm ở điệu này.'
              : `Xếp hạng toàn bộ ${participants.length} VĐV từ 1 đến ${participants.length}.`}
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode('table')}
            className={cn(
              'min-h-[44px] rounded-lg px-3 text-xs font-bold',
              mode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            Bảng chấm
          </button>
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={cn(
              'min-h-[44px] rounded-lg px-3 text-xs font-bold',
              mode === 'quick' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            Xếp theo thứ tự
          </button>
        </div>
      </div>

      <div className={cn('rounded-xl border px-4 py-3', complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {complete ? (
              <>
                <CheckIcon size={18} className="text-emerald-700" />
                <span className="text-emerald-800">Đã xếp đủ {slotsLength} hạng</span>
              </>
            ) : (
              <>
                <UsersIcon size={18} className="text-amber-700" />
                <span className="text-amber-900">
                  Đã xếp {filled}/{slotsLength} hạng. Còn thiếu:{' '}
                  {missing.length ? missing.map((p) => `Hạng ${p}`).join(', ') : '—'}
                </span>
              </>
            )}
          </div>
          <div className="w-full sm:w-52">
            <ProgressBar value={filled} total={slotsLength} tone={complete ? 'green' : 'amber'} />
          </div>
        </div>
      </div>

      {readOnly && (
        <Callout tone="warning" title="Chế độ chỉ xem">
          Sự kiện đã hoàn tất và đang khóa. Chủ tịch hội đồng cần mở khóa để sửa điểm.
        </Callout>
      )}

      {mode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[210px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Vận động viên
                </th>
                {slots.map((_, index) => (
                  <th
                    key={index}
                    className={cn(
                      'min-w-[56px] border-b border-slate-200 bg-slate-50 px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide',
                      missing.includes(index + 1) ? 'bg-amber-50 text-amber-800' : 'text-slate-500',
                    )}
                  >
                    Hạng {index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map((athlete) => {
                const assigned = placeOf(athlete.id);
                return (
                  <tr key={athlete.id} className={assigned ? 'bg-brand-50/50' : 'bg-white'}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-inherit px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <AthleteLabel athlete={athlete} compact showSub={false} />
                        {assigned && <Badge tone="blue">Hạng {assigned}</Badge>}
                      </div>
                    </td>
                    {slots.map((occupantId, index) => {
                      const isSelf = occupantId === athlete.id;
                      const occupant = occupantId ? athleteById.get(occupantId) : undefined;
                      const isMissing = !occupantId;
                      return (
                        <td key={index} className="border-b border-slate-100 p-1 text-center">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => assign(index, isSelf ? null : athlete.id)}
                            aria-label={
                              isSelf
                                ? `Bỏ VĐV ${athlete.bib} khỏi hạng ${index + 1}`
                                : occupant
                                  ? `Xếp VĐV ${athlete.bib} vào hạng ${index + 1}, thay SBD ${occupant.bib}`
                                  : `Xếp VĐV ${athlete.bib} vào hạng ${index + 1}`
                            }
                            title={
                              isSelf
                                ? 'Bấm để bỏ'
                                : occupant
                                  ? `Hạng này đang là SBD ${occupant.bib} – bấm để thay`
                                  : `Xếp vào hạng ${index + 1}`
                            }
                            className={cn(
                              'score-cell',
                              readOnly
                                ? 'score-cell-disabled'
                                : isSelf
                                  ? 'score-cell-filled'
                                  : occupant
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400'
                                    : 'score-cell-empty',
                              isMissing && !readOnly && !isSelf && 'border-dashed border-amber-300',
                            )}
                          >
                            {isSelf ? (
                              <CheckIcon size={20} />
                            ) : occupant ? (
                              <span className="text-[10px] font-extrabold">SBD {occupant.bib}</span>
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Thứ tự hạng
            </div>
            <div className="space-y-2">
              {slots.map((athleteId, index) => {
                const athlete = athleteId ? athleteById.get(athleteId) : undefined;
                return (
                  <div
                    key={index}
                    className={cn(
                      'flex min-h-[58px] items-center gap-3 rounded-xl border px-3 py-2',
                      athlete ? 'border-brand-200 bg-brand-50/50' : 'border-dashed border-amber-300 bg-amber-50/40',
                    )}
                  >
                    <span
                      className={cn(
                        'tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold',
                        athlete ? 'bg-brand-700 text-white' : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {athlete ? (
                        <AthleteLabel athlete={athlete} compact />
                      ) : (
                        <span className="text-sm font-medium text-amber-800">Chưa xếp hạng</span>
                      )}
                    </div>
                    {athlete && (
                      <IconButton
                        label={`Bỏ hạng ${index + 1}`}
                        variant="danger"
                        disabled={readOnly}
                        onClick={() => assign(index, null)}
                      >
                        <TrashIcon size={17} />
                      </IconButton>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                VĐV chưa được chọn ({unassigned.length})
              </div>
              {firstEmpty === -1 && (
                <Badge tone="green">Đã xếp đủ {slotsLength} hạng</Badge>
              )}
            </div>
            {unassigned.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Tất cả VĐV đã được xếp hạng. Bấm nút xóa ở cột bên trái nếu muốn đổi.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {unassigned.map((athlete) => (
                  <button
                    key={athlete.id}
                    type="button"
                    disabled={readOnly || firstEmpty === -1}
                    onClick={() => {
                      if (firstEmpty >= 0) assign(firstEmpty, athlete.id);
                    }}
                    className={cn(
                      'flex min-h-[60px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors',
                      !readOnly && firstEmpty >= 0
                        ? 'hover:border-brand-300 hover:bg-brand-50'
                        : 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <AthleteLabel athlete={athlete} compact />
                    <span className="ml-auto text-xs font-bold text-brand-700">
                      + Hạng {firstEmpty >= 0 ? firstEmpty + 1 : '—'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Bấm VĐV để xếp vào hạng trống tiếp theo. Muốn đổi thứ tự, xóa một hạng đã xếp rồi
              chọn lại, hoặc chuyển sang “Bảng chấm”.
            </p>
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <Callout tone="danger" title="Có VĐV bị trùng hạng">
          Dữ liệu này không hợp lệ. Hãy kiểm tra và xếp lại trước khi chốt.
        </Callout>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="text-xs text-slate-500">
          <b>Gợi ý:</b> ô vàng là hạng đang do VĐV khác giữ – bấm để thay thế; bấm ô xanh của
          chính VĐV để bỏ.
        </div>
        <Button
          variant="ghost"
          onClick={onRequestClear}
          disabled={readOnly || filled === 0}
        >
          <TrashIcon size={17} /> Xóa điểm điệu này ({judge.code})
        </Button>
      </div>

      <div className="sr-only" aria-live="polite">
        {filled}/{slotsLength} hạng đã nhập.
      </div>
    </div>
  );
}
