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

export const GetWorkoutPlanByIdParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
});

export const WorkoutDayWithCountSchema = z.object({
  id: z.string().uuid(),
  weekDay: z.enum(WeekDay),
  name: z.string(),
  isRest: z.boolean(),
  coverImageUrl: z.url().nullable().optional(),
  estimatedDurationInSeconds: z.number(),
  exercisesCount: z.number(),
});

export const GetWorkoutPlanByIdResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  workoutDays: z.array(WorkoutDayWithCountSchema),
});

export const GetWorkoutDayParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  dayId: z.string().uuid(),
});

export const GetWorkoutDayResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isRest: z.boolean(),
  coverImageUrl: z.url().nullable().optional(),
  estimatedDurationInSeconds: z.number(),
  weekDay: z.enum(WeekDay),
  exercises: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      order: z.number(),
      workoutdayId: z.string().uuid(),
      sets: z.number(),
      reps: z.number(),
      restTimeInSeconds: z.number(),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.string().uuid(),
      workoutDayId: z.string().uuid(),
      startedAt: z.string(),
      completedAt: z.string().optional(),
    }),
  ),
});

export const GetStatsQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export const GetStatsResponseSchema = z.object({
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number(),
  conclusionRate: z.number(),
  totalTimeInSeconds: z.number(),
});

export const GetWorkoutPlansQuerySchema = z.object({
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true",
    ),
});

export const GetUserTrainDataResponseSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  weightInGrams: z.number().int().min(0),
  heightInCentimeters: z.number().int().min(0),
  age: z.number().int().min(0),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const UpsertUserTrainDataBodySchema = GetUserTrainDataResponseSchema.omit(
  { userId: true, userName: true },
);

export const UpsertUserTrainDataResponseSchema = z.object({
  userId: z.string(),
  weightInGrams: z.number().int().min(0),
  heightInCentimeters: z.number().int().min(0),
  age: z.number().int().min(0),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const GetWorkoutPlansResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  workoutDays: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean(),
      coverImageUrl: z.url().nullable().optional(),
      estimatedDurationInSeconds: z.number(),
      exercises: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          order: z.number(),
          workoutdayId: z.string().uuid(),
          sets: z.number(),
          reps: z.number(),
          restTimeInSeconds: z.number(),
        }),
      ),
    }),
  ),
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
    z.iso.date(),
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