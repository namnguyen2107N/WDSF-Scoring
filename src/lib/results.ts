import type { Dance, DanceEvent, Judge } from '../types';
import {
  computeDanceSkating,
  computeOverallSkating,
  ranksFromSlots,
  type DanceSkatingResult,
  type OverallResult,
  type SkatingTie,
} from './skating';
import {
  computeSemifinal,
  validateRound,
  type RoundValidation,
  type SemifinalResult,
} from './semifinal';
import { computeGroupResult, type GroupResult } from './group';

export type FinalResults = {
  danceResults: Partial<Record<Dance, DanceSkatingResult>>;
  overall: OverallResult;
  validation: RoundValidation;
  danceTies: { dance: Dance; ties: SkatingTie[] }[];
  overallTies: SkatingTie[];
  complete: boolean;
};

export function finalParticipants(event: DanceEvent): string[] {
  if (event.status === 'pending') return [];
  return event.finalists ?? (event.status === 'final' || event.status === 'done' ? event.athleteIds : []);
}

export function computeFinalResults(
  event: DanceEvent,
  judges: Judge[],
): FinalResults | null {
  if (!event.final) return null;
  const participants = finalParticipants(event);
  if (participants.length === 0) return null;
  const judgeIds = judges.map((j) => j.id);
  const danceResults: Partial<Record<Dance, DanceSkatingResult>> = {};

  for (const dance of event.dances) {
    const slots = event.final.marks[dance] ?? {};
    const ranks = ranksFromSlots(judgeIds, participants, slots);
    danceResults[dance] = computeDanceSkating({
      contestantIds: participants,
      judgeIds,
      ranks,
      dance,
      resolutions: event.resolutions,
    });
  }

  const overall = computeOverallSkating({
    contestantIds: participants,
    judgeIds,
    danceOrder: event.dances,
    danceResults,
    resolutions: event.resolutions,
  });
  const validation = validateRound(event, 'final', judges);

  return {
    danceResults,
    overall,
    validation,
    danceTies: event.dances
      .map((dance) => ({
        dance,
        ties: danceResults[dance]?.ties ?? [],
      }))
      .filter((entry) => entry.ties.length > 0),
    overallTies: overall.ties,
    complete: validation.complete,
  };
}

export type SemifinalBundle = {
  result: SemifinalResult;
  validation: RoundValidation;
  complete: boolean;
};

export function computeSemifinalResults(
  event: DanceEvent,
  judges: Judge[],
): SemifinalBundle {
  const validation = validateRound(event, 'semifinal', judges);
  const result = computeSemifinal({
    contestantIds: event.athleteIds,
    judgeIds: judges.map((j) => j.id),
    dances: event.dances,
    marks: event.semifinal?.marks,
    cutoff: 6,
  });
  return { result: { ...result, complete: validation.complete }, validation, complete: validation.complete };
}

export function computeGroupForEvent(
  event: DanceEvent,
  judges: Judge[],
  criteria: import('../types').Criterion[],
): GroupResult {
  return computeGroupResult(event, judges, criteria);
}

/** Lấy hạng hiện tại của VĐV trong kết quả chung kết. */
export function overallPlaceMap(result: FinalResults | null): Record<string, number> {
  if (!result) return {};
  return Object.fromEntries(
    result.overall.rows.map((row) => [row.athleteId, row.place]),
  );
}
