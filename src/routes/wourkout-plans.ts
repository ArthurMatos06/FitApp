import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import {
  InvalidWorkoutSessionDateError,
  NotFoundError,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../error/index.js";
import { auth } from "../lib/auth.js";
import {
  ErrorSchema,
  GetWorkoutDayParamsSchema,
  GetWorkoutDayResponseSchema,
  GetWorkoutPlanByIdParamsSchema,
  GetWorkoutPlanByIdResponseSchema,
  StartWorkoutSessionParamsSchema,
  StartWorkoutSessionResponseSchema,
  UpdateWorkoutSessionBodySchema,
  UpdateWorkoutSessionParamsSchema,
  UpdateWorkoutSessionResponseSchema,
  WorkoutPlanSchema,
} from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetWorkoutDay } from "../usecases/GetWorkoutDay.js";
import { GetWorkoutPlanById } from "../usecases/GetWorkoutPlanById.js";
import { StartWorkoutSession } from "../usecases/StartWorkoutSession.js";
import { UpdateWorkoutSession } from "../usecases/UpdateWorkoutSession.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Workout Plan"],
      summary: "Create a workout plan",
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

        return reply.status(201).send(result);
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:workoutPlanId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get a workout plan by id with its days",
      params: GetWorkoutPlanByIdParamsSchema,
      response: {
        200: GetWorkoutPlanByIdResponseSchema,
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

        const getWorkoutPlanById = new GetWorkoutPlanById();
        const result = await getWorkoutPlanById.execute({
          userId: session.user.id,
          workoutPlanId: request.params.workoutPlanId,
        });

        return reply.status(200).send(result);
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:workoutPlanId/days/:dayId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Get a workout day with its exercises and sessions",
      params: GetWorkoutDayParamsSchema,
      response: {
        200: GetWorkoutDayResponseSchema,
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

        const getWorkoutDay = new GetWorkoutDay();
        const result = await getWorkoutDay.execute({
          userId: session.user.id,
          workoutPlanId: request.params.workoutPlanId,
          dayId: request.params.dayId,
        });

        return reply.status(200).send(result);
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/:workoutPlanId/days/:dayId/sessions",
    schema: {
      tags: ["Workout Plan"],
      summary: "Start a workout session",
      params: StartWorkoutSessionParamsSchema,
      response: {
        201: StartWorkoutSessionResponseSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
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

        const startWorkoutSession = new StartWorkoutSession();
        const result = await startWorkoutSession.execute({
          userId: session.user.id,
          workoutPlanId: request.params.workoutPlanId,
          dayId: request.params.dayId,
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        if (
          error instanceof WorkoutPlanNotActiveError ||
          error instanceof WorkoutSessionAlreadyStartedError
        ) {
          return reply.status(409).send({
            error: error.message,
            code: "CONFLICT",
          });
        }
        return reply.status(500).send({
          error: "Internal Server Error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:workoutPlanId/days/:dayId/sessions/:sessionId",
    schema: {
      tags: ["Workout Plan"],
      summary: "Update a workout session",
      params: UpdateWorkoutSessionParamsSchema,
      body: UpdateWorkoutSessionBodySchema,
      response: {
        200: UpdateWorkoutSessionResponseSchema,
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

        const updateWorkoutSession = new UpdateWorkoutSession();
        const result = await updateWorkoutSession.execute({
          userId: session.user.id,
          workoutPlanId: request.params.workoutPlanId,
          dayId: request.params.dayId,
          sessionId: request.params.sessionId,
          completedAt: request.body.completedAt,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        if (error instanceof InvalidWorkoutSessionDateError) {
          return reply.status(400).send({
            error: error.message,
            code: "BAD_REQUEST",
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
