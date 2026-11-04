import type { Criterion, DanceEvent, Judge } from '../types';
import { createRoundMarks } from './rounds';
import {
  computeSemifinal,
  validateGroupAgainstCriteria,
  validateRound,
} from './semifinal';
import { nowISO } from './utils';

export type AutoLog = { action: string; detail: string; eventId?: string };

export type AutoAdvanceResult = {
  event: DanceEvent;
  logs: AutoLog[];
};

/**
 * Tự động chuyển vòng:
 * - Bán kết đủ điểm → tạo chung kết với top 6 (không tạo nếu hòa ở ranh giới).
 * - Chung kết đủ điểm → hoàn tất.
 * - Đồng diễn đủ điểm → hoàn tất.
 */
export function autoAdvanceEvent(
  event: DanceEvent,
  judges: Judge[],
  criteria: Criterion[],
): AutoAdvanceResult {
  let next = event;
  const logs: AutoLog[] = [];

  if (next.status === 'semifinal' && next.semifinal && judges.length > 0) {
    const validation = validateRound(next, 'semifinal', judges);
    if (validation.complete) {
      const semifinal = computeSemifinal({
        contestantIds: next.athleteIds,
        judgeIds: judges.map((j) => j.id),
        dances: next.dances,
        marks: next.semifinal.marks,
        cutoff: 6,
      });
      if (!semifinal.boundaryTie && semifinal.qualifiers.length >= 2) {
        const finalRound = createRoundMarks(
          next.dances,
          judges.map((j) => j.id),
          semifinal.qualifiers,
          semifinal.qualifiers.length,
        );
        next = {
          ...next,
          status: 'final',
          finalists: semifinal.qualifiers,
          final: finalRound,
          updatedAt: nowISO(),
        };
        logs.push({
          action: 'Tự động chốt bán kết',
          detail: `${next.name}: ${semifinal.qualifiers.length} VĐV vào chung kết.`,
          eventId: next.id,
        });
      }
    }
  }

  if (next.status === 'final' && next.unlocked !== true) {
    const complete =
      next.category === 'show'
        ? validateGroupAgainstCriteria(next, judges, criteria).complete
        : validateRound(next, 'final', judges).complete;
    if (complete) {
      next = { ...next, status: 'done', updatedAt: nowISO() };
      logs.push({
        action: 'Hoàn tất sự kiện',
        detail: `${next.name}: đủ điểm, kết quả đã được khóa. Chủ tịch HĐ có thể mở khóa nếu cần sửa.`,
        eventId: next.id,
      });
    }
  }

  return { event: next, logs };
}
