import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Criterion, DanceEvent, Judge } from '../types';
import { useApp } from '../store/AppStore';
import { computeGroupForEvent } from '../lib/results';
import { validateGroupAgainstCriteria } from '../lib/semifinal';
import { cn, sortBibs } from '../lib/utils';
import {
  AthleteLabel,
  Badge,
  Callout,
  ProgressBar,
  Toggle,
} from './ui';
import { AlertTriangleIcon, CheckIcon } from './icons';

export function GroupJudging({
  event,
  judge,
  readOnly,
}: {
  event: DanceEvent;
  judge: Judge;
  readOnly: boolean;
}) {
  const { state, actions } = useApp();
  const criteria = state.settings.criteria;
  const validation = useMemo(
    () => validateGroupAgainstCriteria(event, state.judges, criteria),
    [event, state.judges, criteria],
  );
  const result = useMemo(
    () => computeGroupForEvent(event, state.judges, criteria),
    [event, state.judges, criteria],
  );
  const teams = sortBibs(
    event.athleteIds
      .map((id) => state.athletes.find((athlete) => athlete.id === id))
      .filter(Boolean) as NonNullable<(typeof state.athletes)[number]>[],
  );

  const judgeValues = (teamId: string) =>
    criteria.map((criterion) => {
      const score = event.groupScores?.[judge.id]?.[teamId]?.[criterion.id];
      return score === null || score === undefined ? null : score;
    });
  const judgeTotal = (teamId: string) => {
    const values = judgeValues(teamId);
    let total = 0;
    for (const value of values) {
      if (value === null) return null;
      total += value;
    }
    return Math.round(total * 1000) / 1000;
  };
  const completeCells = criteria.reduce(
    (count, criterion) =>
      count +
      event.athleteIds.filter((teamId) => {
        const value = event.groupScores?.[judge.id]?.[teamId]?.[criterion.id];
        return value !== null && value !== undefined;
      }).length,
    0,
  );
  const totalCells = criteria.length * event.athleteIds.length;
  const judgeComplete = Boolean(validation.judgeComplete[judge.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">Giám khảo {judge.code}</h2>
            {judgeComplete ? (
              <Badge tone="green">
                <CheckIcon size={12} /> Đã nhập đủ
              </Badge>
            ) : (
              <Badge tone="amber">Còn {totalCells - completeCells} ô</Badge>
            )}
          </div>
          <p className="muted mt-1">
            Nhập điểm từng tiêu chí cho mỗi đội. Ô trống hoặc ngoài thang sẽ được cảnh báo.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <ProgressBar
            value={completeCells}
            total={totalCells}
            tone={judgeComplete ? 'green' : 'amber'}
          />
        </div>
      </div>

      {readOnly && (
        <Callout tone="warning" title="Chế độ chỉ xem">
          Sự kiện đã hoàn tất và đang khóa. Chủ tịch hội đồng cần mở khóa để sửa điểm.
        </Callout>
      )}

      {criteria.length === 0 && (
        <Callout tone="danger" title="Chưa cấu hình tiêu chí">
          Vào Thiết lập → Tiêu chí đồng diễn để thêm tiêu chí.
        </Callout>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Đội
              </th>
              {criteria.map((criterion) => (
                <th
                  key={criterion.id}
                  className="min-w-[110px] border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
                >
                  <div>{criterion.name}</div>
                  <div className="mt-0.5 text-[10px] font-semibold normal-case text-slate-500">
                    {criterion.min}–{criterion.max} · bước {criterion.step}
                  </div>
                </th>
              ))}
              <th className="min-w-[90px] sticky right-0 z-20 border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Tổng
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const total = judgeTotal(team.id);
              return (
                <tr key={team.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2">
                    <AthleteLabel athlete={team} compact showSub />
                  </td>
                  {criteria.map((criterion) => {
                    const value = event.groupScores?.[judge.id]?.[team.id]?.[criterion.id];
                    return (
                      <td
                        key={criterion.id}
                        className="border-b border-slate-100 px-1.5 py-1.5 text-center"
                      >
                        <GroupScoreInput
                          value={value ?? null}
                          criterion={criterion}
                          disabled={readOnly}
                          onChange={(next) =>
                            actions.setGroupScore(event.id, judge.id, team.id, criterion.id, next)
                          }
                          label={`${team.teamName ?? team.bib} – ${criterion.name}`}
                        />
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 border-b border-l border-slate-100 bg-white px-2 py-2 text-center">
                    {total === null ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : (
                      <span className="tabular text-base font-extrabold text-slate-900">
                        {Math.round(total * 1000) / 1000}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <Toggle
          checked={Boolean(event.dropHighLow)}
          onChange={(checked) => actions.updateEvent(event.id, { dropHighLow: checked })}
          disabled={readOnly}
          label="Bỏ điểm cao nhất và thấp nhất"
          hint="Bỏ 1 tổng giám khảo cao nhất và 1 thấp nhất khi có từ 3 giám khảo."
        />
        <div className="text-xs leading-relaxed text-slate-500 sm:max-w-xs">
          Tổng đội = tổng điểm {criteria.length} tiêu chí của tất cả giám khảo
          {event.dropHighLow ? ', sau khi bỏ 1 cao nhất và 1 thấp nhất.' : '.'}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold">Bảng điểm tổng hợp</h3>
            <p className="text-xs text-slate-500">
              {validation.complete
                ? 'Đủ điểm tất cả giám khảo.'
                : 'Đang tạm tính – còn thiếu điểm ở một số ô.'}
            </p>
          </div>
          {result.ties.length > 0 ? (
            <Badge tone="amber">
              <AlertTriangleIcon size={12} /> Có điểm hòa
            </Badge>
          ) : (
            <Badge tone={result.complete ? 'green' : 'gray'}>
              {result.complete ? 'Hoàn tất' : 'Tạm tính'}
            </Badge>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-14">Hạng</th>
                <th>Đội</th>
                {state.judges.map((item) => (
                  <th key={item.id} className="text-center">
                    GK {item.code}
                  </th>
                ))}
                <th className="text-right">Tổng gốc</th>
                <th className="text-right">Điểm xếp hạng</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const athlete = state.athletes.find((a) => a.id === row.athleteId);
                return (
                  <tr key={row.athleteId} className={row.tied ? 'bg-amber-50' : undefined}>
                    <td className="tabular font-bold">
                      {row.place}
                      {row.tied ? '*' : ''}
                    </td>
                    <td>
                      <AthleteLabel athlete={athlete} compact />
                    </td>
                    {row.judgeScores.map((score) => {
                      const dropped = row.droppedJudgeIds.includes(score.judgeId);
                      return (
                        <td key={score.judgeId} className="text-center">
                          <span
                            className={cn(
                              'tabular inline-flex min-w-10 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold',
                              dropped
                                ? 'bg-red-50 text-red-500 line-through'
                                : 'bg-slate-100 text-slate-700',
                            )}
                            title={dropped ? 'Bị bỏ (cao nhất/thấp nhất)' : undefined}
                          >
                            {score.total ?? '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="tabular text-right font-semibold text-slate-600">
                      {row.rawTotal}
                    </td>
                    <td className="tabular text-right text-base font-extrabold text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {result.ties.length > 0 && (
        <Callout tone="warning" title="Có đội đồng điểm">
          Các đội đồng điểm được tạm xếp theo thứ tự đăng ký. Chủ tịch hội đồng có thể phân định
          tại trang Xếp hạng; quyết định sẽ được ghi lịch sử.
        </Callout>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Điểm được lưu ngay khi rời ô nhập (blur) hoặc nhấn Enter. Có thể nhập dấu phẩy thập phân,
        ví dụ 8,5.
      </p>
    </div>
  );
}

function GroupScoreInput({
  value,
  criterion,
  onChange,
  disabled,
  label,
}: {
  value: number | null;
  criterion: Criterion;
  onChange: (value: number | null) => void;
  disabled: boolean;
  label: string;
}) {
  const format = (input: number | null) =>
    input === null ? '' : String(input).replace('.', ',');
  const [draft, setDraft] = useState(format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value));
  }, [value, focused]);

  const commit = () => {
    const trimmed = draft.trim().replace(',', '.');
    if (trimmed === '') {
      if (value !== null) onChange(null);
      return;
    }
    const number = Number(trimmed);
    if (!Number.isFinite(number)) {
      setDraft(format(value));
      return;
    }
    if (number !== value) onChange(number);
  };

  const invalid =
    value !== null && (value < criterion.min || value > criterion.max);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={cn(
        'input input-sm tabular w-[88px] px-2 text-center text-base font-bold',
        invalid && 'border-red-400 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-100',
        disabled && 'cursor-not-allowed bg-slate-50 text-slate-500',
      )}
      value={draft}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
          (event.target as HTMLInputElement).blur();
        }
        if (event.key === 'Escape') {
          setDraft(format(value));
          (event.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
