type Env = "development" | "production" | "test";
const env = (process.env.NODE_ENV ?? "development") as Env;
async function buildLoggerConfig() {
  if (env === "development") {
    const { default: pretty } = await import("pino-pretty");
    return {
      stream: pretty({
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      }),
    };
  }
  return env === "production"; // production: true, test: false
}

export const loggerConfig = await buildLoggerConfig();