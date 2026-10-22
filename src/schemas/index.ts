import { z } from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
}); 

export const StartWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  dayId: z.string().uuid(),
});

export const StartWorkoutSessionResponseSchema = z.object({
  userWorkoutSessionId: z.string().uuid(),
});

export const UpdateWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  dayId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const UpdateWorkoutSessionBodySchema = z.object({
  completedAt: z.iso.datetime(),
});

export const UpdateWorkoutSessionResponseSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
});

export const GetHomeParamsSchema = z.object({
  date: z.iso.date(),
});

export const GetHomeResponseSchema = z.object({
  activeWorkoutPlanId: z.string().uuid(),
  todayWorkoutDay: z.object({
    workoutPlanId: z.string().uuid(),
    id: z.string().uuid(),
    name: z.string(),
    isRest: z.boolean(),
    weekDay: z.enum(WeekDay),
    estimatedDurationInSeconds: z.number(),
    coverImageUrl: z.url().nullable().optional(),
    exercisesCount: z.number(),
  }),
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.string(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const WorkoutPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),        // corrigido
      isRest: z.boolean().default(false), // corrigido
      coverImageUrl: z.url().nullable().optional(), // corrigido
      estimatedDurationInSeconds: z.number().min(1),
      exercises: z.array(              // corrigido
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});