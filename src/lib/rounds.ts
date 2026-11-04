import type {
  Criterion,
  Dance,
  GroupScores,
  MarkSlots,
  RoundMarks,
} from '../types';

export function emptySlots(length: number): MarkSlots {
  return Array.from({ length }, () => null);
}

export function createRoundMarks(
  dances: Dance[],
  judgeIds: string[],
  _participantIds: string[],
  slots: number,
): RoundMarks {
  const marks: Record<string, Record<string, MarkSlots>> = {};
  for (const dance of dances) {
    marks[dance] = {};
    for (const judgeId of judgeIds) {
      marks[dance][judgeId] = emptySlots(slots);
    }
  }
  return {
    marks,
    startedAt: new Date().toISOString(),
  };
}

export function createGroupScores(
  judgeIds: string[],
  teamIds: string[],
  criteria: Criterion[],
): GroupScores {
  const result: GroupScores = {};
  for (const judgeId of judgeIds) {
    result[judgeId] = {};
    for (const teamId of teamIds) {
      result[judgeId][teamId] = {};
      for (const criterion of criteria) {
        result[judgeId][teamId][criterion.id] = null;
      }
    }
  }
  return result;
}

/** Đảm bảo mọi ô điểm của một vòng đều tồn tại (khi thêm VĐV/giám khảo). */
export function ensureRoundShape(
  event: { dances: Dance[] },
  round: RoundMarks | undefined,
  judgeIds: string[],
  slots: number,
): RoundMarks {
  const result: RoundMarks = round
    ? { ...round, marks: { ...round.marks } }
    : { marks: {}, startedAt: new Date().toISOString() };

  for (const dance of event.dances) {
    if (!result.marks[dance]) result.marks[dance] = {};
    for (const judgeId of judgeIds) {
      const current = result.marks[dance][judgeId];
      if (!current) {
        result.marks[dance][judgeId] = emptySlots(slots);
      } else if (current.length !== slots) {
        const next = emptySlots(slots);
        current.slice(0, slots).forEach((value, index) => {
          next[index] = value;
        });
        result.marks[dance][judgeId] = next;
      }
    }
  }
  return result;
}
