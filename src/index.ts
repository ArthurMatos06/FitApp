// Import the framework and instantiate it
import Fastify from 'fastify'
import dotenv from 'dotenv'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import z from 'zod';

dotenv.config()

const app = Fastify({
  logger: true
})

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
// Declare a route
app.get('/', async function handler () {
  return { hello: 'world' }
})


app.withTypeProvider<ZodTypeProvider>().route({
    method: 'GET',
    url: '/',
    schema: {
        description: 'Get a message',
        tags: ['message'],
      response: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
    handler: () => {
      return { message: 'Hello World' }
    },
  });

// Run the server!
try {
  await app.listen({ port: Number(process.env.PORT) || 3000 })
} catch (err) {
    app.log.error(err)
  process.exit(1)
}