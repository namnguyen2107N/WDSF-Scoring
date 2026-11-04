import type { Criterion, DanceEvent, Judge, TieResolution } from '../types';
import { sameAthleteSet, tieKeyOf, type SkatingTie } from './skating';

export type GroupJudgeScore = {
  judgeId: string;
  total: number | null;
  complete: boolean;
  values: Record<string, number | null>;
};

export type GroupRow = {
  athleteId: string;
  place: number;
  total: number;
  rawTotal: number;
  tied: boolean;
  complete: boolean;
  judgeScores: GroupJudgeScore[];
  droppedJudgeIds: string[];
};

export type GroupResult = {
  rows: GroupRow[];
  ties: SkatingTie[];
  complete: boolean;
  judgeCount: number;
  dropHighLow: boolean;
  maxTotal: number;
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function findResolution(
  resolutions: TieResolution[],
  athleteIds: string[],
): TieResolution | undefined {
  return resolutions.find(
    (r) =>
      r.scope === 'overall' &&
      sameAthleteSet(r.athleteIds, athleteIds) &&
      athleteIds.every((id) => r.order.includes(id)),
  );
}

/**
 * Tính điểm Đồng diễn.
 * - Mỗi giám khảo cho điểm từng tiêu chí; tổng giám khảo = tổng các tiêu chí.
 * - Tổng đội = tổng điểm các giám khảo.
 * - Nếu bật "bỏ điểm cao nhất và thấp nhất": bỏ 1 tổng cao nhất và 1 tổng thấp
 *   nhất của các giám khảo (chỉ áp dụng khi có từ 3 giám khảo trở lên).
 */
export function computeGroupResult(
  event: DanceEvent,
  judges: Judge[],
  criteria: Criterion[],
): GroupResult {
  const judgeIds = judges.map((j) => j.id);
  const drop = Boolean(event.dropHighLow);
  const maxTotal = criteria.reduce((max, c) => max + c.max, 0);

  const rows: GroupRow[] = event.athleteIds.map((teamId) => {
    const judgeScores: GroupJudgeScore[] = judgeIds.map((judgeId) => {
      const values: Record<string, number | null> = {};
      let total = 0;
      let complete = true;
      for (const criterion of criteria) {
        const value = event.groupScores?.[judgeId]?.[teamId]?.[criterion.id];
        if (value === null || value === undefined || Number.isNaN(value)) {
          values[criterion.id] = null;
          complete = false;
        } else {
          values[criterion.id] = value;
          total += value;
        }
      }
      return {
        judgeId,
        total: complete ? round3(total) : null,
        complete,
        values,
      };
    });

    const completeScores = judgeScores.filter(
      (s): s is GroupJudgeScore & { total: number } => s.total !== null,
    );
    const rawTotal = round3(
      completeScores.reduce((acc, s) => acc + s.total, 0),
    );
    let droppedJudgeIds: string[] = [];
    let total = rawTotal;
    if (drop && completeScores.length >= 3) {
      const sorted = [...completeScores].sort((a, b) => a.total - b.total);
      const lowest = sorted[0];
      const highest = sorted[sorted.length - 1];
      droppedJudgeIds = [lowest.judgeId, highest.judgeId];
      total = round3(
        completeScores
          .filter((s) => !droppedJudgeIds.includes(s.judgeId))
          .reduce((acc, s) => acc + s.total, 0),
      );
    }

    return {
      athleteId: teamId,
      place: 0,
      total,
      rawTotal,
      tied: false,
      complete: completeScores.length === judgeIds.length && judgeIds.length > 0,
      judgeScores,
      droppedJudgeIds,
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.athleteId.localeCompare(b.athleteId, 'vi', { numeric: true });
  });

  const ties: SkatingTie[] = [];
  let index = 0;
  while (index < rows.length) {
    let end = index + 1;
    while (end < rows.length && Math.abs(rows[end].total - rows[index].total) < 1e-9) {
      end += 1;
    }
    const group = rows.slice(index, end);
    const places = group.map((_, i) => index + 1 + i);
    if (group.length > 1) {
      group.forEach((row) => {
        row.tied = true;
      });
      ties.push({
        key: tieKeyOf(group.map((r) => r.athleteId)),
        athleteIds: group.map((r) => r.athleteId),
        places,
      });
    }
    group.forEach((row, i) => {
      row.place = index + 1 + i;
    });
    index = end;
  }

  // Áp dụng quyết định phân định của Chủ tịch HĐ
  const remainingTies: SkatingTie[] = [];
  for (const tie of ties) {
    const resolution = findResolution(event.resolutions, tie.athleteIds);
    if (!resolution) {
      remainingTies.push(tie);
      continue;
    }
    const group = tie.athleteIds
      .map((id) => rows.find((r) => r.athleteId === id))
      .filter(Boolean) as GroupRow[];
    const places = group.map((r) => r.place).sort((a, b) => a - b);
    resolution.order.forEach((athleteId, i) => {
      const row = rows.find((r) => r.athleteId === athleteId);
      if (row && places[i] !== undefined) {
        row.place = places[i];
        row.tied = false;
      }
    });
  }
  rows.sort((a, b) => a.place - b.place);

  return {
    rows,
    ties: remainingTies,
    complete: rows.length > 0 && rows.every((r) => r.complete),
    judgeCount: judgeIds.length,
    dropHighLow: drop,
    maxTotal: maxTotal * Math.max(judgeIds.length, 1),
  };
}

export type GroupJudgeTableRow = {
  teamId: string;
  values: Record<string, number | null>;
  total: number | null;
  complete: boolean;
};

/** Bảng điểm theo từng giám khảo, dùng cho trang chấm và in chi tiết. */
export function groupJudgeTable(
  event: DanceEvent,
  judgeId: string,
  criteria: Criterion[],
): GroupJudgeTableRow[] {
  return event.athleteIds.map((teamId) => {
    const values: Record<string, number | null> = {};
    let total = 0;
    let complete = true;
    for (const criterion of criteria) {
      const value = event.groupScores?.[judgeId]?.[teamId]?.[criterion.id];
      if (value === null || value === undefined || Number.isNaN(value)) {
        values[criterion.id] = null;
        complete = false;
      } else {
        values[criterion.id] = value;
        total += value;
      }
    }
    return {
      teamId,
      values,
      total: complete ? round3(total) : null,
      complete,
    };
  });
}
