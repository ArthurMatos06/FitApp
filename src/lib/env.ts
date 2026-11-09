import { z } from "zod";

const schemaEnv = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  PORT: z.coerce.number().default(3000),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  BASE_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  WEB_APP_BASE_URL: z.url()
});

export const env = schemaEnv.parse(process.env);
