import { dates } from '@/plugins/date.plugin';
import { useSession } from '@/stores/session';

const LOCALE = 'es-PE';

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

export const formatDateTime = (iso: string) => dates.dateTime(iso);
export const formatDate = (iso: string) => dates.medium(iso);
export const formatMonth = (yyyyMm: string) => dates.month(yyyyMm);
