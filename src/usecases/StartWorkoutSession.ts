import { NotFoundError, WorkoutPlanNotActiveError, WorkoutSessionAlreadyStartedError } from "../error/index.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
  userId: string;
  workoutPlanId: string;
  dayId: string;
}

interface OutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutDay = await prisma.workoutday.findUnique({
      where: { id: dto.dayId },
      include: {
        workoutPlan: true,
      },
    });

    // O dia não existe, ou não pertence ao plano recebido
    if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
      throw new NotFoundError("Workout day not found");
    }

    // Apenas o dono do workout plan pode iniciar o dia
    if (workoutDay.workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    // Um dia só pode ser iniciado em um plano ativo
    if (!workoutDay.workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError("Workout plan is not active");
    }

    // Caso o dia já tenha uma sessão iniciada (startedAt presente), retorna 409
    const existingSession = await prisma.workoutSession.findFirst({
      where: { workoutDayId: dto.dayId },
    });
    if (existingSession) {
      throw new WorkoutSessionAlreadyStartedError("Workout session already started");
    }

    const workoutSession = await prisma.workoutSession.create({
      data: {
        id: crypto.randomUUID(),
        workoutDayId: dto.dayId,
        startedAt: new Date(),
      },
    });

    return {
      userWorkoutSessionId: workoutSession.id,
    };
  }
}
