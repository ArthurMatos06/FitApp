import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  from: string;
  to: string;
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

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

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const from = dayjs.utc(dto.from).startOf("day");
    const to = dayjs.utc(dto.to).endOf("day");

    const periodSessions = await prisma.workoutSession.findMany({
      where: {
        startedAt: { gte: from.toDate(), lte: to.toDate() },
        workoutDay: { workoutPlan: { userId: dto.userId } },
      },
    });

    let completedWorkoutsCount = 0;
    let totalTimeInSeconds = 0;

    const consistencyByDay: OutputDto["consistencyByDay"] = {};

    for (const session of periodSessions) {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      const day = consistencyByDay[dayKey] ?? {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };

      day.workoutDayStarted = true;

      if (session.completedAt) {
        day.workoutDayCompleted = true;
        completedWorkoutsCount++;

        totalTimeInSeconds += dayjs(session.completedAt).diff(
          session.startedAt,
          "second",
        );
      }

      consistencyByDay[dayKey] = day;
    }

    const conclusionRate =
      periodSessions.length === 0
        ? 0
        : completedWorkoutsCount / periodSessions.length;

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: { workoutdays: true },
    });

    let workoutStreak = 0;

    if (activeWorkoutPlan) {
      const workoutDaysByWeekDay = new Map(
        activeWorkoutPlan.workoutdays.map((workoutDay) => [
          workoutDay.weekDay,
          workoutDay,
        ]),
      );

      const completedSessions = await prisma.workoutSession.findMany({
        where: {
          completedAt: { not: null },
          workoutDay: { workoutPlanId: activeWorkoutPlan.id },
        },
        select: { startedAt: true },
      });

      const completedDates = new Set(
        completedSessions.map((session) =>
          dayjs.utc(session.startedAt).format("YYYY-MM-DD"),
        ),
      );

      const today = dayjs.utc().startOf("day");
      const streakReference = to.isAfter(today, "day") ? today : to;

      let cursor = streakReference;

      for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS; i++) {
        const scheduledWorkoutDay = workoutDaysByWeekDay.get(
          WEEK_DAY_BY_INDEX[cursor.day()],
        );

        if (scheduledWorkoutDay) {
          if (!completedDates.has(cursor.format("YYYY-MM-DD"))) {
            break;
          }

          workoutStreak++;
        }

        cursor = cursor.subtract(1, "day");
      }
    }

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }
}
