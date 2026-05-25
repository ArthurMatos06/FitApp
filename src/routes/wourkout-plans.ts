import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import { fromNodeHeaders } from "better-auth/node";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { auth } from "../lib/auth.js";
import { NotFoundError } from "../error/index.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      body: WorkoutPlanSchema.omit({ id: true }),
      response: {
        201: WorkoutPlanSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const createWorkoutPlan = new CreateWorkoutPlan();
        const result = await createWorkoutPlan.execute({
          userId: session.user.id,
          name: request.body.name,
          workoutDays: request.body.workoutDays,
        });

        return reply.status(201).send({
          id: result.id,
          name: result.name,
          workoutDays: result.workoutdays.map((day) => ({
            name: day.name,
            weekDay: day.weekDay,
            isRest: day.isRest,
            estimatedDurationInSeconds: day.estimatedDurationInSeconds,
            exercises: day.exercises.map((exercise) => ({
              order: exercise.order,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              restTimeInSeconds: exercise.restTimeInSeconds,
            })),
          })),
        });
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        return reply.status(500).send({
          error: "Internal Server Error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
