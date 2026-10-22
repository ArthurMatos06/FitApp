import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../error/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

// Data Transfer Object
interface InputDto {
  userId: string;
  workoutPlanId: string;
  dayId: string;
}

interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string | null;
  estimatedDurationInSeconds: number;
  weekDay: WeekDay;
  exercises: Array<{
    id: string;
    name: string;
    order: number;
    workoutdayId: string;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt: string;
    completedAt?: string;
  }>;
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutDay = await prisma.workoutday.findUnique({
      where: { id: dto.dayId },
      include: {
        exercises: { orderBy: { order: "asc" } },
        workoutSessions: { orderBy: { startedAt: "asc" } },
        workoutPlan: { select: { userId: true } },
      },
    });

    // O dia não existe, ou não pertence ao plano recebido
    if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
      throw new NotFoundError("Workout day not found");
    }

    // Apenas o dono do workout plan pode ver o dia
    if (workoutDay.workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      weekDay: workoutDay.weekDay,
      exercises: workoutDay.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        order: exercise.order,
        workoutdayId: exercise.workoutdayId,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
      })),
      sessions: workoutDay.workoutSessions.map((session) => ({
        id: session.id,
        workoutDayId: session.workoutDayId,
        startedAt: dayjs.utc(session.startedAt).format("YYYY-MM-DD"),
        ...(session.completedAt
          ? {
              completedAt: dayjs
                .utc(session.completedAt)
                .format("YYYY-MM-DD"),
            }
          : {}),
      })),
    };
  }
}
