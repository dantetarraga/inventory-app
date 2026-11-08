import { describe, expect, it } from 'vitest';
import { safeRedirect } from './guards';
import { formatMoney, formatNumber } from './format';
import { hasPermission } from '@/stores/session';
import type { Me } from '@stockpro/shared';

describe('safeRedirect', () => {
  it('allows in-app paths', () => {
    expect(safeRedirect('/kardex?page=2')).toBe('/kardex?page=2');
  });
  it('blocks open redirects', () => {
    expect(safeRedirect('https://evil.test')).toBe('/');
    expect(safeRedirect('//evil.test')).toBe('/');
    expect(safeRedirect(undefined)).toBe('/');
  });
});

describe('format', () => {
  it('formats decimal strings without float artifacts', () => {
    expect(formatNumber('7.000')).toBe('7');
    expect(formatNumber('0.300')).toBe('0.3');
  });
  it('formats money in the company currency', () => {
    expect(formatMoney('8.40', 'PEN')).toMatch(/8\.40/);
  });
});

describe('hasPermission', () => {
  const me = (permissions: Me['user']['permissions']): Me => ({
    user: { id: 1, email: 'a@b.c', fullName: 'A', role: 'employee', theme: 'system', permissions },
    company: { id: 1, name: 'X', currency: 'PEN', country: 'PE' },
  });
  it('checks module access', () => {
    expect(hasPermission(me(['kardex']), 'kardex')).toBe(true);
    expect(hasPermission(me(['kardex']), 'reports')).toBe(false);
    expect(hasPermission(null, 'kardex')).toBe(false);
  });
});
