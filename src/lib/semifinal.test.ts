import { describe, expect, it } from 'vitest';
import { computeSemifinal, semifinalAllTiedQualifiers } from './semifinal';

function buildMarks(
  dances: string[],
  judgeSelections: Record<string, Record<string, string[]>>,
): Record<string, Record<string, (string | null)[]>> {
  const marks: Record<string, Record<string, (string | null)[]>> = {};
  for (const dance of dances) {
    marks[dance] = {};
    for (const [judgeId, selections] of Object.entries(judgeSelections)) {
      const ids = selections[dance] ?? [];
      marks[dance][judgeId] = [...ids, ...Array(6 - ids.length).fill(null)];
    }
  }
  return marks;
}

describe('computeSemifinal', () => {
  it('cộng lượt chọn qua các giám khảo và xếp theo tổng hạng', () => {
    const contestants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const selections = {
      j1: { S: ['A', 'B', 'C', 'D', 'E', 'F'] },
      j2: { S: ['A', 'B', 'C', 'D', 'E', 'G'] },
      j3: { S: ['A', 'B', 'C', 'D', 'F', 'G'] },
    };
    const result = computeSemifinal({
      contestantIds: contestants,
      judgeIds: ['j1', 'j2', 'j3'],
      dances: ['S'],
      marks: buildMarks(['S'], selections),
    });
    expect(result.rows[0].athleteId).toBe('A');
    expect(result.rows[0].selections).toBe(3);
    expect(result.rows[0].rankSum).toBe(3);
    expect(result.qualifiers).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(result.boundaryTie).toBe(false);
  });

  it('cộng dồn nhiều điệu', () => {
    const contestants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const marks = buildMarks(['S', 'C'], {
      j1: {
        S: ['A', 'B', 'C', 'D', 'E', 'F'],
        C: ['A', 'C', 'B', 'D', 'E', 'G'],
      },
    });
    const result = computeSemifinal({
      contestantIds: contestants,
      judgeIds: ['j1'],
      dances: ['S', 'C'],
      marks,
    });
    const rowA = result.rows.find((r) => r.athleteId === 'A');
    expect(rowA?.selections).toBe(2);
    expect(rowA?.rankSum).toBe(2);
    const rowF = result.rows.find((r) => r.athleteId === 'F');
    expect(rowF?.perDance.S.selected).toBe(true);
    expect(rowF?.perDance.C.selected).toBe(false);
  });

  it('phát hiện hai VĐV đồng hạng ở ranh giới top 6', () => {
    const contestants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const marks = buildMarks(['S'], {
      j1: { S: ['A', 'B', 'C', 'D', 'E', 'F'] },
      j2: { S: ['A', 'B', 'C', 'D', 'G', 'E'] },
      j3: { S: ['A', 'B', 'C', 'D', 'E', 'G'] },
      j4: { S: ['A', 'B', 'C', 'D', 'G', 'E'] },
      j5: { S: ['A', 'B', 'C', 'D', 'F', 'G'] },
      j6: { S: ['A', 'B', 'C', 'D', 'G', 'F'] },
      j7: { S: ['A', 'B', 'C', 'D', 'F', 'G'] },
    });
    const result = computeSemifinal({
      contestantIds: contestants,
      judgeIds: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'],
      dances: ['S'],
      marks,
    });
    const e = result.rows.find((r) => r.athleteId === 'E');
    const f = result.rows.find((r) => r.athleteId === 'F');
    expect(e?.selections).toBe(4);
    expect(f?.selections).toBe(4);
    expect(e?.rankSum).toBe(22);
    expect(f?.rankSum).toBe(22);
    expect(result.boundaryTie).toBe(true);
    expect(result.boundaryAthleteIds.sort()).toEqual(['E', 'F']);
    expect(result.qualifiers).toContain('E');
    expect(result.qualifiers).not.toContain('F');
    expect(semifinalAllTiedQualifiers(result)).toContain('F');
    expect(semifinalAllTiedQualifiers(result)).toHaveLength(7);
  });

  it('chỉ lấy đúng 6 VĐV khi có 7 VĐV', () => {
    const contestants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const marks = buildMarks(['S'], {
      j1: { S: ['A', 'B', 'C', 'D', 'E', 'F'] },
      j2: { S: ['A', 'B', 'C', 'D', 'E', 'F'] },
      j3: { S: ['A', 'B', 'C', 'D', 'E', 'G'] },
    });
    const result = computeSemifinal({
      contestantIds: contestants,
      judgeIds: ['j1', 'j2', 'j3'],
      dances: ['S'],
      marks,
    });
    expect(result.qualifiers).toHaveLength(6);
    expect(result.rows[6].qualified).toBe(false);
  });

  it('không báo hòa ranh giới khi VĐV hạng 5 và hạng 6 bằng nhau nhưng hơn hẳn hạng 7', () => {
    const contestants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const marks = buildMarks(['S'], {
      j1: { S: ['A', 'B', 'C', 'D', 'E', 'F'] },
      j2: { S: ['A', 'B', 'C', 'D', 'F', 'E'] },
    });
    const result = computeSemifinal({
      contestantIds: contestants,
      judgeIds: ['j1', 'j2'],
      dances: ['S'],
      marks,
    });
    // E và F đều có 2 lượt chọn, cùng hạng 5-6; G có 0 lượt chọn
    expect(result.boundaryTie).toBe(false);
    expect(result.boundaryAthleteIds).toHaveLength(0);
    expect(result.qualifiers).toHaveLength(6);
  });
});
