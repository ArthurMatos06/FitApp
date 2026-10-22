import { NotFoundError } from "../error/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
  userId: string;
  workoutPlanId: string;
}

interface OutputDto {
  id: string;
  name: string;
  workoutDays: Array<{
    id: string;
    weekDay: WeekDay;
    name: string;
    isRest: boolean;
    coverImageUrl?: string | null;
    estimatedDurationInSeconds: number;
    exercisesCount: number;
  }>;
}

export class GetWorkoutPlanById {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
      include: {
        workoutdays: {
          include: {
            _count: { select: { exercises: true } },
          },
        },
      },
    });

    // O plano não existe, ou não pertence ao usuário autenticado
    if (!workoutPlan || workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    return {
      id: workoutPlan.id,
      name: workoutPlan.name,
      workoutDays: workoutPlan.workoutdays.map((workoutDay) => ({
        id: workoutDay.id,
        weekDay: workoutDay.weekDay,
        name: workoutDay.name,
        isRest: workoutDay.isRest,
        coverImageUrl: workoutDay.coverImageUrl,
        estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
        exercisesCount: workoutDay._count.exercises,
      })),
    };
  }
}
