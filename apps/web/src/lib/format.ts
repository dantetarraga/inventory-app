import { useSession } from '@/stores/session';

const LOCALE = 'es-PE';

/** Decimal strings from the API are formatted without converting arithmetic to floats. */
export function formatNumber(value: string | number, maxDecimals = 3) {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxDecimals }).format(
    Number(value),
  );
}

export function formatMoney(value: string | number, currency = 'PEN') {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(Number(value));
  } catch {
    return `${currency} ${formatNumber(value, 2)}`;
  }
}

export function useMoney() {
  const currency = useSession((s) => s.me?.company.currency ?? 'PEN');
  return (value: string | number) => formatMoney(value, currency);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit' }).format(
    new Date(y!, m! - 1, 1),
  );
}
