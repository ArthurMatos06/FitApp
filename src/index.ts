import Fastify from "fastify";
import dotenv from "dotenv";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import z from "zod";
import { auth } from "./lib/auth.js";
import fastifyApiReference from "@scalar/fastify-api-reference";
import fastifyCors from "@fastify/cors";
import { WeekDay } from "./generated/prisma/enums.js";
import { CreateWorkoutPlan } from "./usecases/CreateWorkoutPlan.js";
import { fromNodeHeaders } from "better-auth/node";
import { NotFoundError } from "./error/index.js";
dotenv.config();

const app = Fastify({ logger: true });

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Projeto App Fit",
      description: "api do projeto app fit",
      version: "1.0.0",
    },
    servers: [{ description: "localhost", url: "http://localhost:3000" }],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"], //talvez "http://localhost:8081", "http://127.0.0.1:8081"
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

// Scalar em porta separada (4000)
// const scalar = Fastify({ logger: false });

await app.register(fastifyApiReference, {
  routePrefix: "/docs",
  configuration: {
    sources: [
      {
        title: "Fit App API",
        slug: "Fit-App-API",
        url: "http://localhost:3000/swagger.json",
      },
      {
        title: "Auth API",
        slug: "Auth-API",
        url: "http://localhost:3000/api/auth/open-api/generate-schema",
      },
    ],
  },
});

//rotas do fastify

app.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/workout-plans",
  schema: {
    body: z.object({
      name: z.string().trim().min(1),
      workoutDays: z.array(
        z.object({
          name: z.string().trim().min(1),
          weekDay: z.enum(WeekDay),
          isRest: z.boolean().default(false),
          estimatedDurationInSeconds: z.number().min(1),
          exercises: z.array(
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
    }),
    response: {
      201: z.object({
        id: z.uuid(),
        name: z.string().trim().min(1),
        workoutDays: z.array(
          z.object({
            name: z.string().trim().min(1),
            WeekDay: z.enum(WeekDay),
            isRestDay: z.boolean().default(false),
            estimatedDurationInSeconds: z.number().min(1),
            exercices: z.array(
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
      }),
      400: z.object({
        error: z.string(),
        code: z.string(),
      }),
      401: z.object({
        error: z.string(),
        code: z.string(),
      }),
      404: z.object({
        error: z.string(),
        code: z.string(),
      }),
      500: z.object({
        error: z.string(),
        code: z.string(),
      }),
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
          WeekDay: day.weekDay,
          isRestDay: day.isRest,
          estimatedDurationInSeconds: day.estimatedDurationInSeconds,
          exercices: day.exercises.map((exercise) => ({
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

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: { hide: true },
  handler: async () => app.swagger(),
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Get a message",
    tags: ["message"],
    response: { 200: z.object({ message: z.string() }) },
  },
  handler: () => ({ message: "Hello World" }),
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      const text = await response.text();
      reply.send(text || null);
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

// Sobe os dois servidores
try {
  await app.listen({ port: Number(process.env.PORT) || 3000 });
  console.log("Docs disponível em http://localhost:3000/docs");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}