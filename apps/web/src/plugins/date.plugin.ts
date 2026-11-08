import { DateAdapter, type DateInput } from '@stockpro/shared';

class UiDates extends DateAdapter {
  dateTime(value: DateInput) {
    return this.format(value, 'dateTime');
  }

  medium(value: DateInput) {
    return this.format(value, 'dateMedium');
  }

  month(yyyyMm: string) {
    return this.format(this.fromYearMonth(yyyyMm), 'monthShort');
  }

  inputValue(value: DateInput) {
    return this.format(value, 'isoDate');
  }
}

export const dates = new UiDates();
