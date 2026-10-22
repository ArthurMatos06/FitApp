import dayjs from "dayjs";

import { InvalidWorkoutSessionDateError, NotFoundError } from "../error/index.js";
import { prisma } from "../lib/db.js";



// Data Transfer Object
interface InputDto {
  userId: string;
  workoutPlanId: string;
  dayId: string;
  sessionId: string;
  completedAt: string;
}

interface OutputDto {
  id: string;
  startedAt: string;
  completedAt: string;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: dto.sessionId },
      include: {
        workoutDay: { include: { workoutPlan: true } },
      },
    });

    // A sessão não existe, ou não pertence ao dia/plano recebido
    if (
      !workoutSession ||
      workoutSession.workoutDayId !== dto.dayId ||
      workoutSession.workoutDay.workoutPlanId !== dto.workoutPlanId
    ) {
      throw new NotFoundError("Workout session not found");
    }

    // Apenas o dono do workout plan pode atualizar a sessão
    if (workoutSession.workoutDay.workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    const completedAt = dayjs(dto.completedAt);

    // A conclusão não pode ser anterior ao início da sessão
    if (completedAt.isBefore(workoutSession.startedAt)) {
      throw new InvalidWorkoutSessionDateError(
        "completedAt cannot be before startedAt",
      );
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: workoutSession.id },
      data: { completedAt: completedAt.toDate() },
    });

    return {
      id: updatedSession.id,
      startedAt: updatedSession.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  }
}
