import { describe, expect, it } from 'vitest';
import type { Criterion, DanceEvent, Judge } from '../types';
import { computeGroupResult, groupJudgeTable } from './group';

const judges: Judge[] = [
  { id: 'j1', code: 'A', name: 'Giám khảo A' },
  { id: 'j2', code: 'B', name: 'Giám khảo B' },
  { id: 'j3', code: 'C', name: 'Giám khảo C' },
];

const criteria: Criterion[] = [
  { id: 'c1', name: 'Kỹ thuật', min: 0, max: 10, step: 0.1 },
  { id: 'c2', name: 'Trình diễn', min: 0, max: 10, step: 0.1 },
];

function makeEvent(
  scores: Record<string, Record<string, Record<string, number | null>>>,
  dropHighLow = false,
): DanceEvent {
  return {
    id: 'evt',
    name: 'Đồng diễn',
    category: 'show',
    dances: [],
    athleteIds: ['T1', 'T2', 'T3'],
    status: 'final',
    groupScores: scores,
    dropHighLow,
    resolutions: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('computeGroupResult', () => {
  it('tính tổng điểm tất cả giám khảo và xếp hạng giảm dần', () => {
    const event = makeEvent({
      j1: { T1: { c1: 9, c2: 9 }, T2: { c1: 8, c2: 8 }, T3: { c1: 7, c2: 7 } },
      j2: { T1: { c1: 9, c2: 8 }, T2: { c1: 8, c2: 9 }, T3: { c1: 7, c2: 6 } },
      j3: { T1: { c1: 8, c2: 9 }, T2: { c1: 9, c2: 8 }, T3: { c1: 6, c2: 7 } },
    });
    const result = computeGroupResult(event, judges, criteria);
    // T1 = 52, T2 = 50, T3 = 40
    expect(result.rows.map((r) => [r.athleteId, r.place, r.total])).toEqual([
      ['T1', 1, 52],
      ['T2', 2, 50],
      ['T3', 3, 40],
    ]);
    expect(result.complete).toBe(true);
    expect(result.ties).toHaveLength(0);
  });

  it('bỏ điểm cao nhất và thấp nhất khi bật tùy chọn', () => {
    const event = makeEvent(
      {
        j1: { T1: { c1: 10, c2: 10 }, T2: { c1: 8, c2: 8 }, T3: { c1: 7, c2: 7 } },
        j2: { T1: { c1: 5, c2: 5 }, T2: { c1: 9, c2: 9 }, T3: { c1: 8, c2: 8 } },
        j3: { T1: { c1: 7, c2: 7 }, T2: { c1: 8, c2: 8 }, T3: { c1: 9, c2: 9 } },
      },
      true,
    );
    const result = computeGroupResult(event, judges, criteria);
    const t1 = result.rows.find((r) => r.athleteId === 'T1');
    // Tổng các giám khảo: 20, 10, 14 -> bỏ 20 và 10, còn 14
    expect(t1?.rawTotal).toBe(44);
    expect(t1?.total).toBe(14);
    expect(t1?.droppedJudgeIds.sort()).toEqual(['j1', 'j2']);
  });

  it('không bỏ điểm khi có ít hơn 3 giám khảo', () => {
    const event = makeEvent(
      {
        j1: { T1: { c1: 10, c2: 10 }, T2: { c1: 8, c2: 8 }, T3: { c1: 7, c2: 7 } },
        j2: { T1: { c1: 5, c2: 5 }, T2: { c1: 9, c2: 9 }, T3: { c1: 8, c2: 8 } },
      },
      true,
    );
    const result = computeGroupResult(event, judges.slice(0, 2), criteria);
    const t1 = result.rows.find((r) => r.athleteId === 'T1');
    expect(t1?.total).toBe(30);
    expect(t1?.droppedJudgeIds).toHaveLength(0);
  });

  it('cảnh báo hòa tổng điểm', () => {
    const event = makeEvent({
      j1: { T1: { c1: 9, c2: 9 }, T2: { c1: 9, c2: 9 }, T3: { c1: 5, c2: 5 } },
      j2: { T1: { c1: 8, c2: 8 }, T2: { c1: 8, c2: 8 }, T3: { c1: 5, c2: 5 } },
      j3: { T1: { c1: 7, c2: 7 }, T2: { c1: 7, c2: 7 }, T3: { c1: 5, c2: 5 } },
    });
    const result = computeGroupResult(event, judges, criteria);
    expect(result.ties).toHaveLength(1);
    expect(result.rows.filter((r) => r.tied)).toHaveLength(2);
  });

  it('đánh dấu chưa đầy đủ khi thiếu điểm', () => {
    const event = makeEvent({
      j1: { T1: { c1: 9, c2: 9 }, T2: { c1: 8, c2: 8 }, T3: { c1: 7, c2: 7 } },
      j2: { T1: { c1: 9, c2: 8 }, T2: { c1: 8, c2: 9 }, T3: { c1: 7, c2: 6 } },
    });
    const result = computeGroupResult(event, judges, criteria);
    expect(result.complete).toBe(false);
  });

  it('tạo bảng điểm theo giám khảo', () => {
    const event = makeEvent({
      j1: { T1: { c1: 9, c2: 9 }, T2: { c1: 8, c2: 8 }, T3: { c1: 7, c2: 7 } },
    });
    const table = groupJudgeTable(event, 'j1', criteria);
    expect(table[0].total).toBe(18);
    expect(table[0].complete).toBe(true);
  });
});
