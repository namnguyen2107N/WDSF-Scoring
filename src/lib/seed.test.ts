import { describe, expect, it } from 'vitest';
import { createSampleState } from '../store/seed';
import { computeSemifinalResults, computeFinalResults } from './results';
import { validateGroupAgainstCriteria, validateRound } from './semifinal';

describe('dữ liệu mẫu', () => {
  const state = createSampleState();

  it('có 7 giám khảo và 24 VĐV/đội', () => {
    expect(state.judges).toHaveLength(7);
    expect(state.athletes).toHaveLength(24);
  });

  it('sự kiện Solo Latin 5 điệu hoàn tất và có 6 VĐV chung kết', () => {
    const event = state.events.find((e) => e.name === 'Solo Latin – 5 điệu');
    expect(event).toBeDefined();
    expect(event?.status).toBe('done');
    expect(event?.semifinal).toBeDefined();
    expect(event?.final).toBeDefined();
    expect(event?.finalists).toHaveLength(6);
    const result = computeSemifinalResults(event!, state.judges);
    expect(result.complete).toBe(true);
    expect(result.result.boundaryTie).toBe(false);
    const final = computeFinalResults(event!, state.judges);
    expect(final?.complete).toBe(true);
    expect(final?.overall.rows).toHaveLength(6);
  });

  it('sự kiện Couple Latin 3 điệu hoàn tất', () => {
    const event = state.events.find((e) => e.name === 'Couple Latin – 3 điệu');
    expect(event?.status).toBe('done');
    expect(event?.finalists).toHaveLength(6);
    const result = computeFinalResults(event!, state.judges);
    expect(result?.complete).toBe(true);
  });

  it('bán kết Tango đang nhập dở: 4/7 giám khảo đã xong', () => {
    const event = state.events.find((e) => e.name === 'Solo Standard – Tango');
    expect(event?.status).toBe('semifinal');
    const validation = validateRound(event!, 'semifinal', state.judges);
    expect(validation.complete).toBe(false);
    expect(validation.filled).toBe(24);
    expect(validation.judgeComplete['judge-a']).toBe(true);
    expect(validation.judgeComplete['judge-d']).toBe(true);
    expect(validation.judgeComplete['judge-e']).toBe(false);
  });

  it('đồng diễn đủ điểm', () => {
    const event = state.events.find((e) => e.name === 'Đồng diễn');
    const validation = validateGroupAgainstCriteria(event!, state.judges, state.settings.criteria);
    expect(validation.complete).toBe(true);
  });

  it('chung kết Slow Waltz đang nhập dở', () => {
    const event = state.events.find((e) => e.name === 'Solo Standard – Slow Waltz');
    expect(event?.status).toBe('final');
    expect(computeFinalResults(event!, state.judges)?.complete).toBe(false);
  });
});
