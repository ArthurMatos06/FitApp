import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { GetWorkoutPlans } from "../usecases/GetWorkoutPlans.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const UPPER_BODY_COVER_IMAGES = [
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v",
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL",
];

const LOWER_BODY_COVER_IMAGES = [
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj",
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY",
];

const AI_SYSTEM_PROMPT = `
Você é um personal trainer virtual especialista em montar planos de treino.

## Tom e comunicação
- Seja amigável, motivador e use linguagem simples, sem jargões técnicos de musculação.
- Seu principal público são pessoas leigas em musculação; explique de forma clara e acolhedora.
- Respostas curtas e objetivas.

## Fluxo obrigatório
1. SEMPRE chame a tool "getUserTrainData" ANTES de qualquer outra interação com o usuário.
2. Se os dados retornarem null (usuário sem dados cadastrados):
   - Pergunte nome, peso (em kg), altura (em cm), idade e % de gordura corporal.
   - Faça perguntas simples e diretas, TODAS em uma única mensagem.
   - Após receber as respostas, chame a tool "updateUserTrainData", convertendo o peso de kg para gramas (kg * 1000).
3. Se os dados já existirem: cumprimente o usuário pelo nome.
4. Para criar um plano de treino: pergunte objetivo, dias disponíveis por semana e restrições físicas/lesões. Poucas perguntas, simples e diretas.
5. Chame a tool "getWorkoutPlans" quando o usuário perguntar sobre os planos dele.

## Criação do plano de treino
- O plano DEVE ter exatamente 7 dias, de MONDAY a SUNDAY.
- Dias sem treino: isRest = true, exercises = [], estimatedDurationInSeconds = 0.
- Use a tool "createWorkoutPlan" para criar o plano.
- Use nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso").

## Divisões de treino (escolha conforme os dias disponíveis)
- 2-3 dias/semana: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros).
- 4 dias/semana: Upper/Lower (recomendado, cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen).
- 5 dias/semana: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x/semana).
- 6 dias/semana: PPL 2x — Push/Pull/Legs repetido.

## Princípios gerais de montagem
- Agrupe músculos sinérgicos (peito+tríceps, costas+bíceps).
- Exercícios compostos primeiro, isoladores depois.
- 4 a 8 exercícios por sessão.
- 3-4 séries por exercício; 8-12 reps (hipertrofia), 4-6 reps (força).
- Descanso entre séries: 60-90s (hipertrofia), 2-3min (compostos pesados).
- Evite treinar o mesmo grupo muscular em dias consecutivos.

## Imagens de capa (coverImageUrl)
- SEMPRE forneça um coverImageUrl para cada dia de treino, escolhendo conforme o foco muscular:
- Dias majoritariamente SUPERIORES (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
  - ${UPPER_BODY_COVER_IMAGES[0]}
  - ${UPPER_BODY_COVER_IMAGES[1]}
- Dias majoritariamente INFERIORES (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
  - ${LOWER_BODY_COVER_IMAGES[0]}
  - ${LOWER_BODY_COVER_IMAGES[1]}
- Alterne entre as duas opções de cada categoria para variar. Dias de descanso usam imagem de superior.
`;

const AI_UI_MESSAGE_SCHEMA = z.custom<UIMessage>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    "parts" in value &&
    Array.isArray((value as { parts: unknown }).parts),
  { message: "Formato de mensagem inválido." },
);

const AI_BODY_SCHEMA = z.object({
  messages: z
    .array(AI_UI_MESSAGE_SCHEMA)
    .min(1, "É necessário enviar ao menos uma mensagem."),
});

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "Chat with the virtual personal trainer",
      body: AI_BODY_SCHEMA,
      response: {
        200: z.any(),
        400: z.any(),
        401: z.any(),
      },
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({
          message: "Não autenticado.",
        });
      }

      const { messages } = request.body;
      const userId = session.user.id;

      const result = streamText({
        model: google("gemini-2.5-flash"),
        system: AI_SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        tools: {
          getUserTrainData: tool({
            description:
              "Obtém os dados de treino do usuário (peso, altura, idade e % de gordura corporal). Retorna null se ainda não estiverem cadastrados.",
            inputSchema: z.object({}),
            execute: async () => {
              const getUserTrainData = new GetUserTrainData();
              return getUserTrainData.execute({ userId });
            },
          }),
          updateUserTrainData: tool({
            description:
              "Cria ou atualiza os dados de treino do usuário (peso em gramas, altura em centímetros, idade e % de gordura corporal).",
            inputSchema: z.object({
              weightInGrams: z
                .number()
                .int()
                .positive()
                .describe("Peso do usuário em gramas"),
              heightInCentimeters: z
                .number()
                .int()
                .positive()
                .describe("Altura do usuário em centímetros"),
              age: z
                .number()
                .int()
                .positive()
                .describe("Idade do usuário em anos"),
              bodyFatPercentage: z
                .number()
                .int()
                .min(0)
                .max(100)
                .describe("% de gordura corporal, onde 100 representa 100%"),
            }),
            execute: async (input) => {
              const upsertUserTrainData = new UpsertUserTrainData();
              return upsertUserTrainData.execute({
                userId,
                weightInGrams: input.weightInGrams,
                heightInCentimeters: input.heightInCentimeters,
                age: input.age,
                bodyFatPercentage: input.bodyFatPercentage,
              });
            },
          }),
          getWorkoutPlans: tool({
            description: "Lista os planos de treino do usuário",
            inputSchema: z.object({}),
            execute: async () => {
              const getWorkoutPlans = new GetWorkoutPlans();
              return getWorkoutPlans.execute({ userId });
            },
          }),
          createWorkoutPlan: tool({
            description:
              "Cria um plano de treino completo para o usuário, com sete dias da semana e seus respectivos exercícios.",
            inputSchema: z.object({
              name: z.string().describe("Nome do plano de treino"),
              workoutDays: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .describe(
                        "Nome do dia, como Peito e Tríceps ou Descanso",
                      ),
                    weekDay: z.enum(WeekDay).describe("Dia da semana"),
                    isRest: z
                      .boolean()
                      .describe("Indica se é um dia de descanso"),
                    estimatedDurationInSeconds: z
                      .number()
                      .nonnegative()
                      .describe(
                        "Duração estimada do treino em segundos; 0 para descanso",
                      ),
                    coverImageUrl: z
                      .string()
                      .url()
                      .describe("URL da imagem de capa do dia"),
                    exercises: z
                      .array(
                        z.object({
                          order: z.number().int().nonnegative(),
                          name: z.string().describe("Nome do exercício"),
                          sets: z.number().int().positive(),
                          reps: z.number().int().positive(),
                          restTimeInSeconds: z.number().int().nonnegative(),
                        }),
                      )
                      .describe(
                        "Exercícios do dia; array vazio nos dias de descanso",
                      ),
                  }),
                )
                .length(7)
                .describe("Exatamente sete dias, de segunda a domingo"),
            }),
            execute: async (input) => {
              const createWorkoutPlan = new CreateWorkoutPlan();

              return createWorkoutPlan.execute({
                userId,
                name: input.name,
                workoutDays: input.workoutDays,
              });
            },
          }),
        },
        stopWhen: stepCountIs(5),
      });

      const response = result.toUIMessageStreamResponse();

      reply.status(response.status as 200 | 400 | 401);

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      return reply.send(response.body);
    },
  });
};
