import type { AppState, DanceEvent } from '../types';
import {
  computeFinalResults,
  computeGroupForEvent,
  computeSemifinalResults,
} from './results';

export type ReportKind = 'final' | 'group' | 'semifinal' | 'none';

export type ReportRow = {
  athleteId: string;
  place: number;
  total: number;
  tied: boolean;
  rawSum?: number;
  dancePlaces?: Record<string, number>;
  selections?: number;
  rankSum?: number;
  qualified?: boolean;
  tiedAtCutoff?: boolean;
};

export type EventReport = {
  event: DanceEvent;
  kind: ReportKind;
  rows: ReportRow[];
  complete: boolean;
  tieCount: number;
  final?: ReturnType<typeof computeFinalResults>;
  group?: ReturnType<typeof computeGroupForEvent>;
  semifinal?: ReturnType<typeof computeSemifinalResults>;
};

export function buildEventReport(event: DanceEvent, state: AppState): EventReport {
  if (event.category === 'show') {
    const group = computeGroupForEvent(event, state.judges, state.settings.criteria);
    return {
      event,
      kind: 'group',
      rows: group.rows.map((row) => ({
        athleteId: row.athleteId,
        place: row.place,
        total: row.total,
        rawSum: row.rawTotal,
        tied: row.tied,
      })),
      complete: group.complete,
      tieCount: group.ties.length,
      group,
    };
  }
  if (event.status === 'final' || event.status === 'done') {
    const final = computeFinalResults(event, state.judges);
    return {
      event,
      kind: 'final',
      rows:
        final?.overall.rows.map((row) => ({
          athleteId: row.athleteId,
          place: row.place,
          total: row.total,
          rawSum: row.rawSum,
          tied: row.tied,
          dancePlaces: row.dancePlaces,
        })) ?? [],
      complete: Boolean(final?.complete),
      tieCount: (final?.overallTies.length ?? 0) + (final?.danceTies.length ?? 0),
      final: final ?? undefined,
    };
  }
  if (event.status === 'semifinal' && event.semifinal) {
    const semifinal = computeSemifinalResults(event, state.judges);
    return {
      event,
      kind: 'semifinal',
      rows: semifinal.result.rows.map((row) => ({
        athleteId: row.athleteId,
        place: row.position,
        total: row.selections,
        tied: row.tiedAtCutoff,
        selections: row.selections,
        rankSum: row.rankSum,
        qualified: row.qualified,
        tiedAtCutoff: row.tiedAtCutoff,
      })),
      complete: semifinal.complete,
      tieCount: semifinal.result.boundaryTie ? 1 : 0,
      semifinal,
    };
  }
  return { event, kind: 'none', rows: [], complete: false, tieCount: 0 };
}
