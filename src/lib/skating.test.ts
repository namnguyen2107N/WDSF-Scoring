import { describe, expect, it } from 'vitest';
import {
  computeDanceSkating,
  computeOverallSkating,
  majorityFor,
  ranksFromSlots,
  tieKeyOf,
  type DanceSkatingResult,
  type OverallInput,
} from './skating';
import type { Dance } from '../types';

function makeRanks(
  judgeRankings: Record<string, string[]>,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [judgeId, order] of Object.entries(judgeRankings)) {
    result[judgeId] = {};
    order.forEach((athleteId, index) => {
      result[judgeId][athleteId] = index + 1;
    });
  }
  return result;
}

function danceResult(
  dance: Dance,
  places: Record<string, number>,
  rawSums: Record<string, number> = {},
): DanceSkatingResult {
  const ids = Object.keys(places);
  const byPlace = [...ids].sort((a, b) => places[a] - places[b]);
  return {
    dance,
    contestantIds: ids,
    judgeIds: ['j1'],
    majority: 1,
    ranks: {},
    rows: byPlace.map((athleteId) => ({
      athleteId,
      place: places[athleteId],
      counts: [],
      sumRanks: rawSums[athleteId] ?? places[athleteId],
      tied: false,
    })),
    ties: [],
  };
}

describe('majorityFor', () => {
  it('tính đa số đúng với số giám khảo lẻ và chẵn', () => {
    expect(majorityFor(7)).toBe(4);
    expect(majorityFor(5)).toBe(3);
    expect(majorityFor(4)).toBe(3);
    expect(majorityFor(1)).toBe(1);
  });
});

describe('computeDanceSkating', () => {
  it('xếp hạng rõ ràng khi mọi giám khảo đồng thuận (5 giám khảo, 6 VĐV)', () => {
    const order = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ranks = makeRanks({
      j1: order,
      j2: order,
      j3: order,
      j4: order,
      j5: order,
    });
    const result = computeDanceSkating({
      contestantIds: order,
      judgeIds: ['j1', 'j2', 'j3', 'j4', 'j5'],
      ranks,
    });
    expect(result.majority).toBe(3);
    expect(result.rows.map((r) => [r.athleteId, r.place])).toEqual([
      ['A', 1],
      ['B', 2],
      ['C', 3],
      ['D', 4],
      ['E', 5],
      ['F', 6],
    ]);
    expect(result.rows[0].counts[0]).toBe(5);
    expect(result.rows[0].sumRanks).toBe(5);
    expect(result.ties).toHaveLength(0);
  });

  it('không ai đạt đa số ở hạng 1 thì xét ngưỡng kế tiếp (Rule 9)', () => {
    // 3 giám khảo, đa số = 2. Không ai có 2 phiếu hạng 1.
    const ranks = makeRanks({
      j1: ['A', 'B', 'C', 'D'],
      j2: ['B', 'C', 'D', 'A'],
      j3: ['C', 'D', 'A', 'B'],
    });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C', 'D'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
    });
    expect(result.rows.map((r) => [r.athleteId, r.place])).toEqual([
      ['C', 1],
      ['B', 2],
      ['A', 3],
      ['D', 4],
    ]);
  });

  it('hòa số phiếu thì tổng hạng nhỏ hơn thắng (Rule 10)', () => {
    const ranks = makeRanks({
      j1: ['A', 'B', 'C', 'D'],
      j2: ['B', 'A', 'C', 'D'],
      j3: ['A', 'B', 'D', 'C'],
    });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C', 'D'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
    });
    expect(result.rows[0].athleteId).toBe('A');
    expect(result.rows[0].sumRanks).toBe(4);
    expect(result.rows[1].sumRanks).toBe(5);
  });

  it('áp dụng bước phân định Rule 10 khi số phiếu và tổng hạng bằng nhau', () => {
    // 4 giám khảo, đa số = 3. A và B bằng nhau ở ngưỡng 2 nhưng B có
    // nhiều phiếu hơn ở ngưỡng 3.
    const ranks = makeRanks({
      j1: ['A', 'B', 'C', 'D'],
      j2: ['A', 'B', 'D', 'C'],
      j3: ['B', 'A', 'C', 'D'],
      j4: ['C', 'D', 'B', 'A'],
    });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C', 'D'],
      judgeIds: ['j1', 'j2', 'j3', 'j4'],
      ranks,
    });
    expect(result.rows[0].athleteId).toBe('B');
    expect(result.rows[0].place).toBe(1);
    expect(result.rows[1].athleteId).toBe('A');
    expect(result.rows[1].place).toBe(2);
  });

  it('ghi nhận hòa khi không thể phân định', () => {
    const ranks = makeRanks({
      j1: ['A', 'B', 'C'],
      j2: ['B', 'C', 'A'],
      j3: ['C', 'A', 'B'],
    });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
    });
    expect(result.ties).toHaveLength(1);
    expect(result.ties[0].athleteIds.sort()).toEqual(['A', 'B', 'C']);
    expect(result.rows.every((r) => r.tied)).toBe(true);
  });

  it('vẫn ghi nhận hòa khi số phiếu cộng dồn giống nhau nhưng phân bố khác nhau', () => {
    // A và B có cùng tổng hạng 18 và cùng số phiếu ở mọi ngưỡng, dù các
    // giám khảo cho hạng khác nhau. Đây phải là hòa thực sự.
    const ranks = makeRanks({
      j1: ['A', 'B', 'C', 'D', 'E'],
      j2: ['A', 'C', 'B', 'D', 'E'],
      j3: ['B', 'A', 'C', 'D', 'E'],
      j4: ['D', 'A', 'C', 'B', 'E'],
      j5: ['B', 'E', 'A', 'C', 'D'],
      j6: ['C', 'D', 'E', 'A', 'B'],
      j7: ['E', 'B', 'C', 'D', 'A'],
    });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C', 'D', 'E'],
      judgeIds: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'],
      ranks,
    });
    const a = result.rows.find((r) => r.athleteId === 'A');
    const b = result.rows.find((r) => r.athleteId === 'B');
    expect(a?.sumRanks).toBe(18);
    expect(b?.sumRanks).toBe(18);
    expect(a?.counts).toEqual(b?.counts);
    expect(result.ties.some((tie) => tie.athleteIds.includes('A') && tie.athleteIds.includes('B'))).toBe(
      true,
    );
    expect(a?.tied).toBe(true);
    expect(b?.tied).toBe(true);
  });

  it('tạo bảng số đếm cộng dồn chính xác', () => {
    const ranks = makeRanks({
      j1: ['A', 'B', 'C'],
      j2: ['B', 'A', 'C'],
      j3: ['A', 'C', 'B'],
    });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
    });
    const rowA = result.rows.find((r) => r.athleteId === 'A');
    expect(rowA?.counts).toEqual([2, 3, 3]);
    expect(rowA?.sumRanks).toBe(4);
  });

  it('chạy đúng khi chỉ có 1 giám khảo', () => {
    const ranks = makeRanks({ j1: ['B', 'A', 'C'] });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1'],
      ranks,
    });
    expect(result.rows.map((r) => [r.athleteId, r.place])).toEqual([
      ['B', 1],
      ['A', 2],
      ['C', 3],
    ]);
  });

  it('xử lý sự kiện ít hơn 6 VĐV', () => {
    const ranks = makeRanks({ j1: ['A', 'B'], j2: ['A', 'B'], j3: ['B', 'A'] });
    const result = computeDanceSkating({
      contestantIds: ['A', 'B'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].athleteId).toBe('A');
    expect(result.rows[0].place).toBe(1);
    expect(result.rows[1].athleteId).toBe('B');
    expect(result.rows[1].place).toBe(2);
  });

  it('đa số là 4 khi có 7 giám khảo', () => {
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const judges = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'];
    const ranks = makeRanks(Object.fromEntries(judges.map((j) => [j, order])));
    const result = computeDanceSkating({
      contestantIds: order,
      judgeIds: judges,
      ranks,
    });
    expect(result.majority).toBe(4);
    expect(result.rows[0].counts[0]).toBe(7);
    expect(result.rows[6].place).toBe(7);
  });

  it('áp dụng quyết định phân định của Chủ tịch HĐ cho điệu', () => {
    const ranks = makeRanks({
      j1: ['A', 'B', 'C'],
      j2: ['B', 'C', 'A'],
      j3: ['C', 'A', 'B'],
    });
    const base = computeDanceSkating({
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
      dance: 'S',
    });
    expect(base.ties).toHaveLength(1);
    const resolved = computeDanceSkating({
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1', 'j2', 'j3'],
      ranks,
      dance: 'S',
      resolutions: [
        {
          id: 'r1',
          scope: 'dance',
          dance: 'S',
          athleteIds: ['A', 'B', 'C'],
          order: ['C', 'A', 'B'],
          at: new Date().toISOString(),
          by: 'Chủ tịch HĐ',
        },
      ],
    });
    expect(resolved.rows.map((r) => r.athleteId)).toEqual(['C', 'A', 'B']);
    expect(resolved.ties).toHaveLength(0);
  });

  it('trả về hòa toàn bộ khi chưa có giám khảo nào', () => {
    const result = computeDanceSkating({
      contestantIds: ['A', 'B'],
      judgeIds: [],
      ranks: {},
    });
    expect(result.ties).toHaveLength(1);
    expect(result.rows.map((r) => r.place)).toEqual([1, 2]);
  });

  it('dựng ranks từ mảng vị trí', () => {
    const ranks = ranksFromSlots(
      ['j1', 'j2'],
      ['A', 'B', 'C'],
      {
        j1: ['B', 'A', 'C'],
        j2: ['A', null, 'B'],
      },
    );
    expect(ranks.j1).toEqual({ B: 1, A: 2, C: 3 });
    expect(ranks.j2).toEqual({ A: 1, B: 3 });
  });
});

describe('computeOverallSkating (Rule 11)', () => {
  it('tổng hạng nhỏ nhất xếp trên', () => {
    const input: OverallInput = {
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1'],
      danceOrder: ['S', 'C'],
      danceResults: {
        S: danceResult('S', { A: 1, B: 2, C: 3 }),
        C: danceResult('C', { A: 2, B: 3, C: 1 }),
      },
    };
    const result = computeOverallSkating(input);
    expect(result.rows.map((r) => [r.athleteId, r.place, r.total])).toEqual([
      ['A', 1, 3],
      ['C', 2, 4],
      ['B', 3, 5],
    ]);
  });

  it('hòa tổng hạng thì xét số điệu đạt hạng 1 (Rule 11)', () => {
    const input: OverallInput = {
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1'],
      danceOrder: ['S', 'C', 'R'],
      danceResults: {
        S: danceResult('S', { A: 1, B: 2, C: 3 }),
        C: danceResult('C', { A: 1, B: 2, C: 3 }),
        R: danceResult('R', { A: 3, B: 1, C: 2 }),
      },
    };
    const result = computeOverallSkating(input);
    // A và B cùng 5 điểm; A có 2 hạng nhất, B có 1.
    expect(result.rows.map((r) => [r.athleteId, r.total, r.place])).toEqual([
      ['A', 5, 1],
      ['B', 5, 2],
      ['C', 8, 3],
    ]);
  });

  it('hòa tổng hạng và số hạng nhất thì xét tổng hạng thô', () => {
    const input: OverallInput = {
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1'],
      danceOrder: ['S', 'C'],
      danceResults: {
        S: danceResult('S', { A: 1, B: 2, C: 3 }, { A: 9, B: 8, C: 10 }),
        C: danceResult('C', { A: 2, B: 1, C: 3 }, { A: 8, B: 6, C: 10 }),
      },
    };
    const result = computeOverallSkating(input);
    expect(result.rows.map((r) => r.athleteId)).toEqual(['B', 'A', 'C']);
    expect(result.ties).toHaveLength(0);
  });

  it('ghi nhận hòa tổng khi mọi tiêu chí phân định đều bằng nhau', () => {
    const input: OverallInput = {
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1'],
      danceOrder: ['S', 'C'],
      danceResults: {
        S: danceResult('S', { A: 1, B: 2, C: 3 }, { A: 5, B: 5, C: 9 }),
        C: danceResult('C', { A: 2, B: 1, C: 3 }, { A: 5, B: 5, C: 9 }),
      },
    };
    const result = computeOverallSkating(input);
    expect(result.ties).toHaveLength(1);
    expect(result.ties[0].athleteIds.sort()).toEqual(['A', 'B']);
    expect(result.rows[0].tied).toBe(true);
    expect(result.rows[1].tied).toBe(true);
    expect(result.rows[2].athleteId).toBe('C');
  });

  it('áp dụng quyết định phân định tổng hợp của Chủ tịch HĐ', () => {
    const input: OverallInput = {
      contestantIds: ['A', 'B', 'C'],
      judgeIds: ['j1'],
      danceOrder: ['S', 'C'],
      danceResults: {
        S: danceResult('S', { A: 1, B: 2, C: 3 }, { A: 5, B: 5, C: 9 }),
        C: danceResult('C', { A: 2, B: 1, C: 3 }, { A: 5, B: 5, C: 9 }),
      },
      resolutions: [
        {
          id: 'r1',
          scope: 'overall',
          athleteIds: ['A', 'B'],
          order: ['B', 'A'],
          at: new Date().toISOString(),
          by: 'Chủ tịch HĐ',
        },
      ],
    };
    const result = computeOverallSkating(input);
    expect(result.rows.map((r) => [r.athleteId, r.place])).toEqual([
      ['B', 1],
      ['A', 2],
      ['C', 3],
    ]);
    expect(result.ties).toHaveLength(0);
  });

  it('tạo khóa hòa ổn định theo tập VĐV', () => {
    expect(tieKeyOf(['B', 'A'])).toBe(tieKeyOf(['A', 'B']));
  });
});
