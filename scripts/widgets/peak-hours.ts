/**
 * Peak hours widget - shows whether currently in Anthropic API peak hours
 * Based on https://github.com/pforret/PeakClaude
 * Peak: Weekdays 5:00 AM - 10:59 AM Pacific Time
 * Off-peak: Weekends + all other hours
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import type { Widget } from './base.js';
import type { WidgetContext, PeakHoursData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { formatTimeRemaining } from '../utils/formatters.js';

const PEAK_START_HOUR = 5;  // 5:00 AM PT
const PEAK_END_HOUR = 11;   // 11:00 AM PT (peak is 5:00-10:59)

const PACIFIC_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hourCycle: 'h23',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
});

interface PacificTime {
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
}

export function getPacificTime(): PacificTime {
  const parts = PACIFIC_FORMATTER.formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  const weekday = parts.find((p) => p.type === 'weekday')!.value;

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return { hour, minute, dayOfWeek: dayMap[weekday] ?? 0 };
}

function isWeekday(dayOfWeek: number): boolean {
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

export function isPeakTime(pt: PacificTime): boolean {
  return isWeekday(pt.dayOfWeek) && pt.hour >= PEAK_START_HOUR && pt.hour < PEAK_END_HOUR;
}

export function getMinutesToTransition(pt: PacificTime): number {
  const currentMinutes = pt.hour * 60 + pt.minute;

  if (isPeakTime(pt)) {
    // Currently peak → minutes until 11:00 AM PT
    return PEAK_END_HOUR * 60 - currentMinutes;
  }

  // Currently off-peak → minutes until next peak start (5:00 AM PT on a weekday)
  if (isWeekday(pt.dayOfWeek) && currentMinutes < PEAK_START_HOUR * 60) {
    // Before 5 AM on a weekday → peak starts today
    return PEAK_START_HOUR * 60 - currentMinutes;
  }

  // After peak on weekday, or weekend → find next weekday morning
  let daysUntilNextWeekday: number;
  if (pt.dayOfWeek === 5) {
    // Friday after peak → Monday (3 days)
    daysUntilNextWeekday = 3;
  } else if (pt.dayOfWeek === 6) {
    // Saturday → Monday (2 days)
    daysUntilNextWeekday = 2;
  } else if (pt.dayOfWeek === 0) {
    // Sunday → Monday (1 day)
    daysUntilNextWeekday = 1;
  } else {
    // Mon-Thu after peak → next day
    daysUntilNextWeekday = 1;
  }

  const minutesRemainingToday = 24 * 60 - currentMinutes;
  return minutesRemainingToday + (daysUntilNextWeekday - 1) * 24 * 60 + PEAK_START_HOUR * 60;
}

export const peakHoursWidget: Widget<PeakHoursData> = {
  id: 'peakHours',
  name: 'Peak Hours',

  async getData(_ctx: WidgetContext): Promise<PeakHoursData | null> {
    const pt = getPacificTime();
    return {
      isPeak: isPeakTime(pt),
      minutesToTransition: getMinutesToTransition(pt),
    };
  },

  render(data: PeakHoursData, ctx: WidgetContext): string {
    const { translations: t } = ctx;
    const theme = getTheme();
    const transitionAt = new Date(Date.now() + data.minutesToTransition * 60 * 1000);
    const countdown = formatTimeRemaining(transitionAt, t);

    if (data.isPeak) {
      const label = t.widgets.peakHours ?? 'Peak';
      return `${colorize(label, theme.danger)} (${countdown})`;
    }

    const label = t.widgets.offPeak ?? 'Off-Peak';
    return `${colorize(label, theme.safe)} (${countdown})`;
  },
};
