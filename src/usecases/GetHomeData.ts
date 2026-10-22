import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../error/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

// Data Transfer Object
interface InputDto {
  userId: string;
  date: string;
}

interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string | null;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
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

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const referenceDate = dayjs.utc(dto.date);

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: { workoutdays: { include: { exercises: true } } },
    });
    if (!activeWorkoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const todayWeekDay = WEEK_DAY_BY_INDEX[referenceDate.day()];
    const todayWorkoutDay = activeWorkoutPlan.workoutdays.find(
      (workoutDay) => workoutDay.weekDay === todayWeekDay,
    );
    if (!todayWorkoutDay) {
      throw new NotFoundError("Workout day not found for this date");
    }

    const startOfWeek = referenceDate.startOf("week");
    const endOfWeek = referenceDate.endOf("week");

    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        startedAt: { gte: startOfWeek.toDate(), lte: endOfWeek.toDate() },
        workoutDay: { workoutPlan: { userId: dto.userId } },
      },
    });

    const consistencyByDay: OutputDto["consistencyByDay"] = {};
    for (let i = 0; i < 7; i++) {
      const dayKey = startOfWeek.add(i, "day").format("YYYY-MM-DD");
      consistencyByDay[dayKey] = {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };
    }
    for (const session of weekSessions) {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      if (!consistencyByDay[dayKey]) continue;
      consistencyByDay[dayKey].workoutDayStarted = true;
      if (session.completedAt) {
        consistencyByDay[dayKey].workoutDayCompleted = true;
      }
    }

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

    let workoutStreak = 0;
    let cursor = referenceDate;
    for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS; i++) {
      const cursorWeekDay = WEEK_DAY_BY_INDEX[cursor.day()];
      const scheduledWorkoutDay = workoutDaysByWeekDay.get(cursorWeekDay);
      if (scheduledWorkoutDay) {
        const cursorKey = cursor.format("YYYY-MM-DD");
        if (!completedDates.has(cursorKey)) break;
        workoutStreak++;
      }
      cursor = cursor.subtract(1, "day");
    }

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: {
        workoutPlanId: todayWorkoutDay.workoutPlanId,
        id: todayWorkoutDay.id,
        name: todayWorkoutDay.name,
        isRest: todayWorkoutDay.isRest,
        weekDay: todayWorkoutDay.weekDay,
        estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
        coverImageUrl: todayWorkoutDay.coverImageUrl,
        exercisesCount: todayWorkoutDay.exercises.length,
      },
      workoutStreak,
      consistencyByDay,
    };
  }
}
