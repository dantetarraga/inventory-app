import {
  addDays as fnsAddDays,
  differenceInCalendarDays,
  endOfDay,
  format as fnsFormat,
  formatDistanceToNow,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

export type DateInput = Date | string | number;

export const DATE_FORMATS = {
  date: 'dd/MM/yyyy',
  dateTime: 'dd/MM/yyyy HH:mm',
  dateMedium: 'd MMM yyyy',
  monthShort: 'MMM yy',
  isoDate: 'yyyy-MM-dd',
  dayLong: "EEEE d 'de' MMMM",
} as const;
export type DateFormat = keyof typeof DATE_FORMATS;

export class DateAdapter {
  constructor(private readonly locale = es) {}

  parse(value: DateInput): Date {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (!isValid(d)) throw new RangeError(`Fecha inválida: ${String(value)}`);
    return d;
  }

  isValid(value: unknown): boolean {
    if (value instanceof Date || typeof value === 'number') return isValid(new Date(value));
    return typeof value === 'string' && isValid(parseISO(value));
  }

  now(): Date {
    return new Date();
  }

  format(value: DateInput, fmt: DateFormat = 'date'): string {
    return fnsFormat(this.parse(value), DATE_FORMATS[fmt], { locale: this.locale });
  }

  fromNow(value: DateInput): string {
    return formatDistanceToNow(this.parse(value), { addSuffix: true, locale: this.locale });
  }

  today(): string {
    return this.format(this.now(), 'isoDate');
  }

  addDays(value: DateInput, days: number): Date {
    return fnsAddDays(this.parse(value), days);
  }

  subMonths(value: DateInput, months: number): Date {
    return subMonths(this.parse(value), months);
  }

  startOfDay(value: DateInput): Date {
    return startOfDay(this.parse(value));
  }

  endOfDay(value: DateInput): Date {
    return endOfDay(this.parse(value));
  }

  startOfMonth(value: DateInput): Date {
    return startOfMonth(this.parse(value));
  }

  daysBetween(from: DateInput, to: DateInput): number {
    return differenceInCalendarDays(this.parse(to), this.parse(from));
  }

  fromYearMonth(yyyyMm: string): Date {
    return this.parse(`${yyyyMm}-01`);
  }

  toISO(value: DateInput): string {
    return this.parse(value).toISOString();
  }
}

export const dates = new DateAdapter();
