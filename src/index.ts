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
import fastifySwaggerUI from "@fastify/swagger-ui";
import z from "zod";

dotenv.config();

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);



await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Projeto App Fit',
      description: 'api do projeto app fit',
      version: '1.0.0',
    },
    servers: [
      {
        description: 'localhost',
        url: 'http://localhost:3000',
      }
    ],
  },
  transform: jsonSchemaTransform,

});

await app.register(fastifySwaggerUI, {
  routePrefix: '/docs',
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

// Run the server!
try {
  await app.listen({ port: Number(process.env.PORT) || 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
