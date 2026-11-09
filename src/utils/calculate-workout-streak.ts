import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";

dayjs.extend(utc);

const WEEK_DAY_BY_INDEX: WeekDay[] = [
  WeekDay.SUNDAY,
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
];

const MAX_STREAK_LOOKBACK_DAYS = 365;

interface CalculateWorkoutStreakParams {
  streakReference: dayjs.Dayjs;
  scheduledWeekDays: Set<WeekDay>;
  completedDates: Set<string>;
}

export function calculateWorkoutStreak({
  streakReference,
  scheduledWeekDays,
  completedDates,
}: CalculateWorkoutStreakParams): number {
  let workoutStreak = 0;
  let cursor = streakReference;
  let hasSkippedBoundaryDay = false;

  for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS; i++) {
    const cursorWeekDay = WEEK_DAY_BY_INDEX[cursor.day()];

    if (scheduledWeekDays.has(cursorWeekDay)) {
      const cursorKey = cursor.format("YYYY-MM-DD");

      if (!completedDates.has(cursorKey)) {
        if (!hasSkippedBoundaryDay && cursor.isSame(streakReference, "day")) {
          hasSkippedBoundaryDay = true;
          cursor = cursor.subtract(1, "day");
          continue;
        }
        break;
      }
      workoutStreak++;
    }

    cursor = cursor.subtract(1, "day");
  }

  return workoutStreak;
}