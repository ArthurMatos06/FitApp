import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
}

interface OutputDto {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

export class GetUserTrainData {
  async execute(dto: InputDto): Promise<OutputDto | null> {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) return null;

    return {
      userId: user.id,
      userName: user.name,
      weightInGrams: user.weightInGrams ?? 0,
      heightInCentimeters: user.heightInCm ?? 0,
      age: user.age ?? 0,
      bodyFatPercentage: user.bodyFatPercentage ?? 0,
    };
  }
}
