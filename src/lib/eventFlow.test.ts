import { describe, expect, it } from 'vitest';
import type { DanceEvent, Judge, MarkSlots } from '../types';
import { createSampleState } from '../store/seed';
import { autoAdvanceEvent } from './eventFlow';

const judges: Judge[] = [
  { id: 'j1', code: 'A', name: 'A' },
  { id: 'j2', code: 'B', name: 'B' },
  { id: 'j3', code: 'C', name: 'C' },
  { id: 'j4', code: 'D', name: 'D' },
  { id: 'j5', code: 'E', name: 'E' },
  { id: 'j6', code: 'F', name: 'F' },
  { id: 'j7', code: 'G', name: 'G' },
];

describe('autoAdvanceEvent', () => {
  it('tự tạo chung kết khi bán kết đủ điểm và không hòa', () => {
    const state = createSampleState();
    const base = state.events.find((event) => event.name === 'Solo Latin – 5 điệu')!;
    const event: DanceEvent = {
      ...base,
      status: 'semifinal',
      final: undefined,
      finalists: undefined,
    };
    const result = autoAdvanceEvent(event, state.judges, state.settings.criteria);
    expect(result.event.status).toBe('final');
    expect(result.event.finalists).toHaveLength(6);
    expect(result.event.final).toBeDefined();
    expect(result.logs.some((log) => log.action.includes('chốt bán kết'))).toBe(true);
  });

  it('không chuyển vòng khi bán kết chưa đủ điểm', () => {
    const state = createSampleState();
    const event = state.events.find((item) => item.name === 'Solo Standard – Tango')!;
    const result = autoAdvanceEvent(event, state.judges, state.settings.criteria);
    expect(result.event.status).toBe('semifinal');
    expect(result.event.final).toBeUndefined();
    expect(result.logs).toHaveLength(0);
  });

  it('không tự chốt khi hòa ở vị trí thứ 6', () => {
    const athleteIds = Array.from({ length: 7 }, (_, index) => `a${index + 1}`);
    const selectionOrders = [
      ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      ['a1', 'a2', 'a3', 'a4', 'a7', 'a5'],
      ['a1', 'a2', 'a3', 'a4', 'a5', 'a7'],
      ['a1', 'a2', 'a3', 'a4', 'a7', 'a5'],
      ['a1', 'a2', 'a3', 'a4', 'a6', 'a7'],
      ['a1', 'a2', 'a3', 'a4', 'a7', 'a6'],
      ['a1', 'a2', 'a3', 'a4', 'a6', 'a7'],
    ];
    const marks: Record<string, MarkSlots> = {};
    judges.forEach((judge, index) => {
      marks[judge.id] = selectionOrders[index];
    });
    const event: DanceEvent = {
      id: 'tie-test',
      name: 'Tie test',
      category: 'newbie-solo',
      dances: ['R'],
      athleteIds,
      status: 'semifinal',
      semifinal: { marks: { R: marks } },
      resolutions: [],
      createdAt: '',
      updatedAt: '',
    };
    const result = autoAdvanceEvent(event, judges, []);
    expect(result.event.status).toBe('semifinal');
    expect(result.event.final).toBeUndefined();
  });

  it('chung kết đủ điểm tự hoàn tất', () => {
    const state = createSampleState();
    const base = state.events.find((event) => event.name === 'Couple Latin – 3 điệu')!;
    const event: DanceEvent = { ...base, status: 'final' };
    const result = autoAdvanceEvent(event, state.judges, state.settings.criteria);
    expect(result.event.status).toBe('done');
    expect(result.logs.some((log) => log.action === 'Hoàn tất sự kiện')).toBe(true);
  });

  it('chung kết chưa đủ điểm không hoàn tất', () => {
    const state = createSampleState();
    const event = state.events.find((item) => item.name === 'Solo Standard – Slow Waltz')!;
    const result = autoAdvanceEvent(event, state.judges, state.settings.criteria);
    expect(result.event.status).toBe('final');
  });

  it('đồng diễn đủ điểm tự hoàn tất', () => {
    const state = createSampleState();
    const base = state.events.find((event) => event.category === 'show')!;
    const event: DanceEvent = { ...base, status: 'final' };
    const result = autoAdvanceEvent(event, state.judges, state.settings.criteria);
    expect(result.event.status).toBe('done');
  });
});
