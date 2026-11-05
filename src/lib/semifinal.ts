import type {
  Dance,
  DanceEvent,
  Judge,
  MarkSlots,
  RoundMarks,
  RoundType,
} from '../types';

// ---------------------------------------------------------------------------
// Bán kết
// ---------------------------------------------------------------------------

export type SemifinalRow = {
  athleteId: string;
  selections: number;
  rankSum: number;
  perDance: Record<string, { selected: boolean; rank: number | null }>;
  position: number;
  qualified: boolean;
  tiedAtCutoff: boolean;
};

export type SemifinalResult = {
  rows: SemifinalRow[];
  qualifiers: string[];
  cutoff: number;
  boundaryTie: boolean;
  boundaryAthleteIds: string[];
  complete: boolean;
  totalSelections: number;
};

/**
 * Tổng hợp bán kết: số lượt được chọn giảm dần, bằng nhau thì tổng hạng nhỏ hơn.
 * Mỗi giám khảo chọn 6 VĐV cho mỗi điệu; lượt chọn được cộng dồn qua các điệu.
 */
export function computeSemifinal(params: {
  contestantIds: string[];
  judgeIds: string[];
  dances: Dance[];
  marks: Record<string, Record<string, MarkSlots>> | undefined;
  cutoff?: number;
}): SemifinalResult {
  const { contestantIds, judgeIds, dances, marks } = params;
  const cutoff = Math.min(params.cutoff ?? 6, contestantIds.length);
  const rows = new Map<string, SemifinalRow>();
  const valid = new Set(contestantIds);

  for (const athleteId of contestantIds) {
    const perDance: Record<string, { selected: boolean; rank: number | null }> = {};
    for (const dance of dances) {
      perDance[dance] = { selected: false, rank: null };
    }
    rows.set(athleteId, {
      athleteId,
      selections: 0,
      rankSum: 0,
      perDance,
      position: 0,
      qualified: false,
      tiedAtCutoff: false,
    });
  }

  let totalSelections = 0;
  for (const dance of dances) {
    for (const judgeId of judgeIds) {
      const slots = marks?.[dance]?.[judgeId] ?? [];
      slots.forEach((athleteId, index) => {
        if (!athleteId || !valid.has(athleteId)) return;
        const row = rows.get(athleteId);
        if (!row) return;
        row.selections += 1;
        row.rankSum += index + 1;
        totalSelections += 1;
        const current = row.perDance[dance];
        if (!current.selected) {
          current.selected = true;
          current.rank = index + 1;
        }
      });
    }
  }

  const order = new Map(contestantIds.map((id, i) => [id, i]));
  const list = [...rows.values()].sort((a, b) => {
    if (b.selections !== a.selections) return b.selections - a.selections;
    if (a.rankSum !== b.rankSum) return a.rankSum - b.rankSum;
    return (order.get(a.athleteId) ?? 0) - (order.get(b.athleteId) ?? 0);
  });

  list.forEach((row, index) => {
    row.position = index + 1;
  });

  const atCutoff = list[cutoff - 1];
  const nextAfterCutoff = list[cutoff];
  const boundaryAthleteIds: string[] = [];
  const hasBoundaryTie =
    Boolean(atCutoff) &&
    Boolean(nextAfterCutoff) &&
    nextAfterCutoff.selections === atCutoff.selections &&
    nextAfterCutoff.rankSum === atCutoff.rankSum;

  if (hasBoundaryTie && atCutoff) {
    for (const row of list) {
      if (
        row.selections === atCutoff.selections &&
        row.rankSum === atCutoff.rankSum
      ) {
        boundaryAthleteIds.push(row.athleteId);
      }
    }
  }
  const boundaryTie = hasBoundaryTie;
  list.forEach((row) => {
    row.qualified = row.position <= cutoff;
    row.tiedAtCutoff = boundaryTie && boundaryAthleteIds.includes(row.athleteId);
  });

  return {
    rows: list,
    qualifiers: list.slice(0, cutoff).map((r) => r.athleteId),
    cutoff,
    boundaryTie,
    boundaryAthleteIds,
    complete: false,
    totalSelections,
  };
}

/** Danh sách VĐV gợi ý khi Chủ tịch HĐ chọn "đưa tất cả đồng hạng vào chung kết". */
export function semifinalAllTiedQualifiers(result: SemifinalResult): string[] {
  const base = result.qualifiers;
  const extra = result.boundaryAthleteIds.filter((id) => !base.includes(id));
  return [...base, ...extra];
}

// ---------------------------------------------------------------------------
// Kiểm tra dữ liệu điểm
// ---------------------------------------------------------------------------

export type MarkIssue = {
  judgeId: string;
  dance: Dance;
  missingPlaces: number[];
  duplicates: string[];
  unknown: string[];
};

export type RoundValidation = {
  complete: boolean;
  judgeComplete: Record<string, boolean>;
  issues: MarkIssue[];
  filled: number;
  total: number;
};

export function expectedSlotsForRound(
  event: DanceEvent,
  round: RoundType,
): { participants: string[]; slots: number } {
  if (round === 'semifinal') {
    return { participants: event.athleteIds, slots: 6 };
  }
  const participants =
    event.finalists ?? (event.status === 'final' || event.status === 'done' ? event.athleteIds : []);
  return { participants, slots: participants.length };
}

export function validateRound(
  event: DanceEvent,
  round: RoundType,
  judges: Judge[],
): RoundValidation {
  const roundMarks: RoundMarks | undefined = event[round];
  const { participants, slots } = expectedSlotsForRound(event, round);
  const valid = new Set(participants);
  const issues: MarkIssue[] = [];
  const judgeComplete: Record<string, boolean> = {};
  let filled = 0;
  let total = 0;

  for (const judge of judges) {
    let judgeOk = true;
    for (const dance of event.dances) {
      const marks = roundMarks?.marks[dance]?.[judge.id] ?? [];
      const missingPlaces: number[] = [];
      const duplicates: string[] = [];
      const unknown: string[] = [];
      const seen = new Set<string>();
      total += slots;

      for (let i = 0; i < slots; i += 1) {
        const athleteId = marks[i];
        if (!athleteId) {
          missingPlaces.push(i + 1);
          continue;
        }
        filled += 1;
        if (!valid.has(athleteId)) {
          unknown.push(athleteId);
          continue;
        }
        if (seen.has(athleteId)) duplicates.push(athleteId);
        seen.add(athleteId);
      }

      if (missingPlaces.length || duplicates.length || unknown.length) {
        judgeOk = false;
        issues.push({
          judgeId: judge.id,
          dance,
          missingPlaces,
          duplicates,
          unknown,
        });
      }
    }
    judgeComplete[judge.id] = judgeOk;
  }

  return {
    complete: judges.length > 0 && judges.every((j) => judgeComplete[j.id]),
    judgeComplete,
    issues,
    filled,
    total,
  };
}

export type GroupCellIssue = {
  judgeId: string;
  teamId: string;
  criterionId: string;
  type: 'missing' | 'out-of-range';
};

export type GroupValidation = {
  complete: boolean;
  judgeComplete: Record<string, boolean>;
  issues: GroupCellIssue[];
  filled: number;
  total: number;
};

/** Hàm kiểm tra đầy đủ, nhận tiêu chí từ cấu hình. */
export function validateGroupAgainstCriteria(
  event: DanceEvent,
  judges: Judge[],
  criteria: { id: string; min: number; max: number }[],
): GroupValidation {
  const issues: GroupCellIssue[] = [];
  const judgeComplete: Record<string, boolean> = {};
  let filled = 0;
  let total = 0;

  for (const judge of judges) {
    let ok = true;
    for (const teamId of event.athleteIds) {
      for (const criterion of criteria) {
        total += 1;
        const value = event.groupScores?.[judge.id]?.[teamId]?.[criterion.id];
        if (value === null || value === undefined || Number.isNaN(value)) {
          ok = false;
          issues.push({
            judgeId: judge.id,
            teamId,
            criterionId: criterion.id,
            type: 'missing',
          });
        } else {
          filled += 1;
          if (value < criterion.min || value > criterion.max) {
            ok = false;
            issues.push({
              judgeId: judge.id,
              teamId,
              criterionId: criterion.id,
              type: 'out-of-range',
            });
          }
        }
      }
    }
    judgeComplete[judge.id] = ok;
  }

  return {
    complete:
      judges.length > 0 && event.athleteIds.length > 0 && judges.every((j) => judgeComplete[j.id]),
    judgeComplete,
    issues,
    filled,
    total,
  };
}
