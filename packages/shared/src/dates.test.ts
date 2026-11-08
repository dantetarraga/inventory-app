import { describe, expect, it } from 'vitest';
import { dates } from './dates';

describe('dates adapter', () => {
  it('formats in Spanish with named formats', () => {
    expect(dates.format('2026-11-08T14:35:00', 'dateTime')).toBe('08/11/2026 14:35');
    expect(dates.format('2026-11-08', 'isoDate')).toBe('2026-11-08');
    expect(dates.format(dates.fromYearMonth('2026-11'), 'monthShort')).toBe('nov 26');
  });
  it('does date arithmetic', () => {
    expect(dates.format(dates.addDays('2026-12-30', 3), 'isoDate')).toBe('2027-01-02');
    expect(dates.daysBetween('2026-11-01', '2026-11-08')).toBe(7);
  });
  it('rejects invalid input', () => {
    expect(() => dates.parse('no-es-fecha')).toThrow(RangeError);
    expect(dates.isValid('2026-02-30')).toBe(false);
  });
});
