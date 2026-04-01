// Import the framework and instantiate it
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
import { fromNodeHeaders } from "better-auth/node";
import fastifyApiReference from "@scalar/fastify-api-reference";
import fastifyCors from "@fastify/cors";
import { handleOAuthUserInfo } from "better-auth/oauth2";

dotenv.config();

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Projeto App Fit",
      description: "api do projeto app fit",
      version: "1.0.0",
    },
    servers: [
      {
        description: "localhost",
        url: "http://localhost:3000",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: ["http://localhost:8081"], //porta front-end
  credentials: true,
});

await app.register(fastifyApiReference, {
  routePrefix: "/docs",
  configuration: {
    sources: [
      {
        title: "Fit App API",
        slug: "Fit-App-API",
        url: "/swagger.json",
      },
      {
        title: "Auth API",
        slug: "Auth-API",
        url: "/api/auth/open-api/generate-schema",
      },
    ],
  },
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

// Declare a route
app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Get a message",
    tags: ["message"],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return { message: "Hello World" };
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      // Construct request URL
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Convert Fastify headers to standard Headers object
      const headers = fromNodeHeaders(request.headers);

      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      // Process authentication request
      const response = await auth.handler(req);

      // Forward response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

// Run the server!
try {
  await app.listen({ port: Number(process.env.PORT) || 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
