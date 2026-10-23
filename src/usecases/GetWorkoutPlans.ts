import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
  userId: string;
  active?: boolean;
}

interface OutputDto {
  id: string;
  name: string;
  isActive: boolean;
  workoutDays: Array<{
    id: string;
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    coverImageUrl?: string | null;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      id: string;
      name: string;
      order: number;
      workoutdayId: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class GetWorkoutPlans {
  async execute(dto: InputDto): Promise<OutputDto[]> {
    const workoutPlans = await prisma.workoutPlan.findMany({
      where: {
        userId: dto.userId,
        ...(dto.active === undefined ? {} : { isActive: dto.active }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        workoutdays: {
          include: {
            exercises: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    return workoutPlans.map((workoutPlan) => ({
      id: workoutPlan.id,
      name: workoutPlan.name,
      isActive: workoutPlan.isActive,
      workoutDays: workoutPlan.workoutdays.map((workoutDay) => ({
        id: workoutDay.id,
        name: workoutDay.name,
        weekDay: workoutDay.weekDay,
        isRest: workoutDay.isRest,
        coverImageUrl: workoutDay.coverImageUrl,
        estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
        exercises: workoutDay.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          order: exercise.order,
          workoutdayId: exercise.workoutdayId,
          sets: exercise.sets,
          reps: exercise.reps,
          restTimeInSeconds: exercise.restTimeInSeconds,
        })),
      })),
    }));
  }
}
