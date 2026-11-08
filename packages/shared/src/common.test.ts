import { describe, expect, it } from 'vitest';
import { decimalString } from './common';

describe('decimalString', () => {
  const price = decimalString(2);
  const message = (v: unknown) => price.safeParse(v).error?.issues[0]?.message;

  it('accepts numbers and numeric strings, normalized to string', () => {
    expect(price.parse('10.5')).toBe('10.5');
    expect(price.parse(3)).toBe('3');
  });
  it('says "Requerido" when empty, not a format error', () => {
    expect(message('')).toBe('Requerido');
    expect(message('   ')).toBe('Requerido');
  });
  it('explains the expected format otherwise', () => {
    expect(message('1.234')).toMatch(/hasta 2 decimales/);
    expect(message('-1')).toMatch(/positivo/);
    expect(message('abc')).toMatch(/número/);
  });
});
