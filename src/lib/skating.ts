import type { Dance, MarkSlots, TieResolution } from '../types';

/**
 * Skating System (WDSF) – phần lõi xếp hạng.
 *
 * Quy ước:
 * - Mỗi giám khảo xếp toàn bộ VĐV của vòng theo thứ tự 1..N (không trùng).
 * - Đa số = floor(J/2) + 1, J là số giám khảo.
 * - Rule 9/10: xét hạng 1, 2, 3...; với ngưỡng p, VĐV chưa xếp đạt đa số phiếu
 *   có hạng <= p sẽ được nhận hạng hiện tại. Nếu nhiều VĐV cùng đạt: nhiều phiếu
 *   hơn thắng, tổng hạng nhỏ hơn thắng, sau đó xét tiếp ngưỡng p+1 (Rule 10).
 * - Nếu vẫn không phân định được, ghi nhận hòa. Khi đó các VĐV được tạm xếp
 *   các hạng liên tiếp theo thứ tự đăng ký để vẫn tính được tổng; Chủ tịch HĐ
 *   có thể phân định lại và quyết định được lưu trong TieResolution.
 * - Rule 11 (nhiều điệu): tổng hạng nhỏ hơn xếp trên. Nếu hòa: xét số điệu
 *   đạt hạng 1, rồi hạng 2... (nhiều hơn thắng), sau đó tổng điểm thô của các
 *   giám khảo (nhỏ hơn thắng). Còn hòa thì ghi nhận để Chủ tịch HĐ xử lý.
 */

export type SkatingTie = {
  key: string;
  athleteIds: string[];
  places: number[];
  dance?: Dance;
};

export type SkatingRow = {
  athleteId: string;
  place: number;
  /** counts[p] = số giám khảo cho hạng <= p+1 */
  counts: number[];
  /** Tổng hạng của tất cả giám khảo */
  sumRanks: number;
  tied: boolean;
};

export type DanceSkatingResult = {
  dance?: Dance;
  contestantIds: string[];
  judgeIds: string[];
  majority: number;
  ranks: Record<string, Record<string, number>>;
  rows: SkatingRow[];
  ties: SkatingTie[];
};

export type OverallRow = {
  athleteId: string;
  place: number;
  total: number;
  /** Tổng hạng thô của các giám khảo trên tất cả các điệu */
  rawSum: number;
  /** byPlace[0] = số điệu xếp hạng 1, byPlace[1] = số điệu xếp hạng 2... */
  byPlace: number[];
  dancePlaces: Record<string, number>;
  tied: boolean;
};

export type OverallResult = {
  contestantIds: string[];
  judgeIds: string[];
  danceOrder: Dance[];
  rows: OverallRow[];
  ties: SkatingTie[];
};

export function majorityFor(judgeCount: number): number {
  return Math.floor(judgeCount / 2) + 1;
}

export function tieKeyOf(athleteIds: string[]): string {
  return [...athleteIds].sort().join('|');
}

export function sameAthleteSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function ranksFromSlots(
  judgeIds: string[],
  contestantIds: string[],
  slotsByJudge: Record<string, MarkSlots | undefined>,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  const valid = new Set(contestantIds);
  for (const judgeId of judgeIds) {
    const map: Record<string, number> = {};
    const slots = slotsByJudge[judgeId] ?? [];
    slots.forEach((athleteId, index) => {
      if (athleteId && valid.has(athleteId) && map[athleteId] === undefined) {
        map[athleteId] = index + 1;
      }
    });
    result[judgeId] = map;
  }
  return result;
}

function findResolution(
  resolutions: TieResolution[] | undefined,
  scope: 'dance' | 'overall',
  dance: Dance | undefined,
  athleteIds: string[],
): TieResolution | undefined {
  if (!resolutions?.length) return undefined;
  return resolutions.find(
    (r) =>
      r.scope === scope &&
      (scope === 'overall' || r.dance === dance) &&
      sameAthleteSet(r.athleteIds, athleteIds) &&
      athleteIds.every((id) => r.order.includes(id)),
  );
}

/** Áp dụng quyết định phân định của Chủ tịch HĐ vào một nhóm hòa. */
function applyResolutionToRows(
  rows: SkatingRow[],
  tie: SkatingTie,
  resolution: TieResolution | undefined,
): void {
  if (!resolution) return;
  const byId = new Map(rows.map((r) => [r.athleteId, r]));
  const group = tie.athleteIds.map((id) => byId.get(id)).filter(Boolean) as SkatingRow[];
  if (group.length !== tie.athleteIds.length) return;
  const places = group.map((r) => r.place).sort((a, b) => a - b);
  resolution.order.forEach((athleteId, index) => {
    const row = byId.get(athleteId);
    if (row && places[index] !== undefined) {
      row.place = places[index];
      row.tied = false;
    }
  });
}

export function applyDanceResolutions(
  result: DanceSkatingResult,
  resolutions: TieResolution[] | undefined,
): DanceSkatingResult {
  if (!resolutions?.length || !result.ties.length) return result;
  const rows = result.rows.map((r) => ({ ...r, counts: [...r.counts] }));
  const remainingTies: SkatingTie[] = [];
  for (const tie of result.ties) {
    const resolution = findResolution(
      resolutions,
      'dance',
      result.dance,
      tie.athleteIds,
    );
    if (resolution) {
      applyResolutionToRows(rows, tie, resolution);
    } else {
      remainingTies.push(tie);
    }
  }
  rows.sort((a, b) => a.place - b.place);
  return { ...result, rows, ties: remainingTies };
}

type DanceInput = {
  contestantIds: string[];
  judgeIds: string[];
  ranks: Record<string, Record<string, number>>;
  dance?: Dance;
  resolutions?: TieResolution[];
};

/**
 * Xếp hạng một điệu theo Skating System (Rule 9 + Rule 10).
 */
export function computeDanceSkating(input: DanceInput): DanceSkatingResult {
  const contestantIds = [...new Set(input.contestantIds)];
  const judgeIds = [...new Set(input.judgeIds)];
  const ranks = input.ranks;
  const N = contestantIds.length;
  const judgeCount = judgeIds.length;
  const majority = majorityFor(judgeCount);
  const orderIndex = new Map(contestantIds.map((id, i) => [id, i]));

  const rankOf = (judgeId: string, athleteId: string): number | undefined =>
    ranks[judgeId]?.[athleteId];

  const countLE = (athleteId: string, threshold: number): number =>
    judgeIds.reduce((count, judgeId) => {
      const rank = rankOf(judgeId, athleteId);
      return rank !== undefined && rank <= threshold ? count + 1 : count;
    }, 0);

  const sumAll = (athleteId: string): number =>
    judgeIds.reduce((total, judgeId) => total + (rankOf(judgeId, athleteId) ?? 0), 0);

  const rows: SkatingRow[] = [];
  const ties: SkatingTie[] = [];
  const placed = new Set<string>();
  let nextPlace = 1;

  const addRow = (athleteId: string, place: number, tied: boolean): void => {
    rows.push({
      athleteId,
      place,
      counts: Array.from({ length: N }, (_, i) => countLE(athleteId, i + 1)),
      sumRanks: sumAll(athleteId),
      tied,
    });
    placed.add(athleteId);
  };

  const pickWinner = (candidates: string[], threshold: number): string | null => {
    let pool = [...candidates];

    const maxCount = Math.max(...pool.map((id) => countLE(id, threshold)));
    pool = pool.filter((id) => countLE(id, threshold) === maxCount);
    if (pool.length === 1) return pool[0];

    const minSum = Math.min(...pool.map(sumAll));
    pool = pool.filter((id) => sumAll(id) === minSum);
    if (pool.length === 1) return pool[0];

    // Rule 10: tiếp tục xét ngưỡng kế tiếp. Nếu mọi số phiếu cộng dồn
    // vẫn bằng nhau thì đây là hòa thực sự (không tự ý phân định).
    for (let q = threshold + 1; q <= N; q += 1) {
      const qMax = Math.max(...pool.map((id) => countLE(id, q)));
      pool = pool.filter((id) => countLE(id, q) === qMax);
      if (pool.length === 1) return pool[0];
    }
    return null;
  };

  while (placed.size < N) {
    const remaining = contestantIds.filter((id) => !placed.has(id));
    let threshold = nextPlace;
    let candidates: string[] = [];

    while (threshold <= N) {
      candidates = remaining.filter((id) => countLE(id, threshold) >= majority);
      if (candidates.length > 0) break;
      threshold += 1;
    }

    if (candidates.length === 0) {
      // Không có dữ liệu (0 giám khảo) – tạm xếp tất cả đồng hạng
      const group = [...remaining].sort(
        (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
      );
      const places: number[] = [];
      group.forEach((athleteId, index) => {
        const p = nextPlace + index;
        places.push(p);
        addRow(athleteId, p, true);
      });
      ties.push({
        key: tieKeyOf(group),
        athleteIds: group,
        places,
        dance: input.dance,
      });
      nextPlace += group.length;
      continue;
    }

    if (candidates.length === 1) {
      addRow(candidates[0], nextPlace, false);
      nextPlace += 1;
      continue;
    }

    const winner = pickWinner(candidates, threshold);
    if (winner) {
      addRow(winner, nextPlace, false);
      nextPlace += 1;
      continue;
    }

    // Hòa thực sự: tạm xếp liên tiếp, đánh dấu để Chủ tịch HĐ phân định.
    const group = [...candidates].sort(
      (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    );
    const places: number[] = [];
    group.forEach((athleteId, index) => {
      const p = nextPlace + index;
      places.push(p);
      addRow(athleteId, p, true);
    });
    ties.push({
      key: tieKeyOf(group),
      athleteIds: group,
      places,
      dance: input.dance,
    });
    nextPlace += group.length;
  }

  rows.sort((a, b) => a.place - b.place);
  const result: DanceSkatingResult = {
    dance: input.dance,
    contestantIds,
    judgeIds,
    majority,
    ranks,
    rows,
    ties,
  };
  return applyDanceResolutions(result, input.resolutions);
}

export type OverallInput = {
  contestantIds: string[];
  judgeIds: string[];
  danceOrder: Dance[];
  danceResults: Partial<Record<Dance, DanceSkatingResult>>;
  resolutions?: TieResolution[];
};

type MutableOverallRow = OverallRow;

function compareWithinTotal(a: MutableOverallRow, b: MutableOverallRow): number {
  const max = Math.max(a.byPlace.length, b.byPlace.length);
  for (let i = 0; i < max; i += 1) {
    const av = a.byPlace[i] ?? 0;
    const bv = b.byPlace[i] ?? 0;
    if (av !== bv) return bv - av; // nhiều hơn thắng
  }
  return a.rawSum - b.rawSum; // tổng hạng thô nhỏ hơn thắng
}

function sameWithinTotal(a: MutableOverallRow, b: MutableOverallRow): boolean {
  return a.total === b.total && compareWithinTotal(a, b) === 0;
}

/**
 * Xếp hạng nhiều điệu theo Rule 11.
 */
export function computeOverallSkating(input: OverallInput): OverallResult {
  const contestantIds = [...new Set(input.contestantIds)];
  const danceOrder = input.danceOrder.filter((d) => input.danceResults[d]);
  const orderIndex = new Map(contestantIds.map((id, i) => [id, i]));

  const rows: MutableOverallRow[] = contestantIds.map((athleteId) => {
    const dancePlaces: Record<string, number> = {};
    let total = 0;
    let rawSum = 0;
    const byPlace: number[] = [];
    for (const dance of danceOrder) {
      const result = input.danceResults[dance];
      if (!result) continue;
      const row = result.rows.find((r) => r.athleteId === athleteId);
      if (row) {
        dancePlaces[dance] = row.place;
        total += row.place;
        rawSum += row.sumRanks;
        byPlace[row.place - 1] = (byPlace[row.place - 1] ?? 0) + 1;
      }
    }
    return {
      athleteId,
      place: 0,
      total,
      rawSum,
      byPlace,
      dancePlaces,
      tied: false,
    };
  });

  rows.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    const within = compareWithinTotal(a, b);
    if (within !== 0) return within;
    return (orderIndex.get(a.athleteId) ?? 0) - (orderIndex.get(b.athleteId) ?? 0);
  });

  const ties: SkatingTie[] = [];
  let index = 0;
  while (index < rows.length) {
    let end = index + 1;
    while (end < rows.length && sameWithinTotal(rows[index], rows[end])) end += 1;
    const group = rows.slice(index, end);
    const basePlace = index + 1;
    const places = group.map((_, i) => basePlace + i);
    if (group.length > 1) {
      group.forEach((r) => {
        r.tied = true;
      });
      ties.push({
        key: tieKeyOf(group.map((r) => r.athleteId)),
        athleteIds: group.map((r) => r.athleteId),
        places,
      });
    }
    group.forEach((r, i) => {
      r.place = basePlace + i;
    });
    index = end;
  }

  const result: OverallResult = {
    contestantIds,
    judgeIds: input.judgeIds,
    danceOrder,
    rows,
    ties,
  };

  if (!input.resolutions?.length || !result.ties.length) return result;

  const rowsCopy = result.rows.map((r) => ({ ...r }));
  const remaining: SkatingTie[] = [];
  for (const tie of result.ties) {
    const resolution = findResolution(
      input.resolutions,
      'overall',
      undefined,
      tie.athleteIds,
    );
    if (!resolution) {
      remaining.push(tie);
      continue;
    }
    const group = tie.athleteIds
      .map((id) => rowsCopy.find((r) => r.athleteId === id))
      .filter(Boolean) as OverallRow[];
    const places = group.map((r) => r.place).sort((a, b) => a - b);
    resolution.order.forEach((athleteId, i) => {
      const row = rowsCopy.find((r) => r.athleteId === athleteId);
      if (row && places[i] !== undefined) {
        row.place = places[i];
        row.tied = false;
      }
    });
  }
  rowsCopy.sort((a, b) => a.place - b.place);
  return { ...result, rows: rowsCopy, ties: remaining };
}

export function hasUniquePlaces(places: number[]): boolean {
  const set = new Set(places);
  return set.size === places.length;
}
