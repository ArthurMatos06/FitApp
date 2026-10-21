# AGENTS.md

Projeto **fitapp** — REST API Node.js para um app de fitness. Estas regras são obrigatórias;
siga-as ao escrever qualquer código.

## Stack

- Node.js 24, **ES modules** (`"type": "module"`), TypeScript (target ES2024, module NodeNext).
- **pnpm** como package manager (10.33.0).
- **Fastify** 5 com fastify-type-provider-zod.
- **Prisma** 7 ORM com PostgreSQL (via @prisma/adapter-pg).
- **better-auth** para autenticação (email/senha + sessions).
- **Zod v4**.

## Comandos

```bash
pnpm dev                      # Servidor dev com watch mode (tsx --watch) — porta 3000
pnpm exec prisma generate     # Gera o Prisma client em src/generated/prisma
pnpm exec prisma migrate dev  # Executa migrations em desenvolvimento
pnpm exec prisma migrate deploy
pnpm exec prisma studio       # Abre o Prisma Studio GUI
pnpm eslint .                 # Executa ESLint
pnpm exec prettier --write .  # Formata com Prettier
pnpm exec tsc --noEmit        # Type-check
```

Não há build, test ou lint scripts no `package.json` além de `dev`; use os comandos acima.

## Arquitetura

- Todos os arquivos TS ficam em `src/` por camada; cada camada tem responsabilidade única.
- `src/lib/db.ts` — client do Prisma (singleton) com pg adapter.
- `src/lib/auth.ts` — instância do better-auth.
- `src/error/index.ts` — classes de erro customizadas (e.g. `NotFoundError`). Crie aqui qualquer erro necessário que não exista.
- `src/schemas/index.ts` — schemas Zod para validação de request/response e esquemas de erro.
- `src/usecases/` — classes de lógica de negócio (padrão use case).
- `src/routes/` — registra as rotas Fastify, um arquivo por recurso.
- `src/generated/prisma/` — Prisma client **gerado automaticamente**; nunca edite — re-genere com `prisma generate`.
- `prisma/schema.prisma` — schema e migrations do Prisma.

**Documentação da API:** Swagger/OpenAPI disponível em `/docs` quando o servidor está rodando (porta 3000).

## Git

- **SEMPRE** use [Conventional Commits](https://www.conventionalcommits.org/). Ex.: `feat: add start workout session endpoint`, `fix: workout plan validation`, `docs: update architecture rules`.
- **NUNCA** faça commit sem a permissão explícita do usuário. Sempre aguarde o usuário pedir para commitar.

## Fastify: Rotas de API

- **SEMPRE** siga os princípios REST. Ex.: `GET /workout-plans`, `GET /workout-plans/:id/days`.
- **SEMPRE** crie os arquivos das rotas em `src/routes`.
- **SEMPRE** use `fastify-type-provider-zod` para definir schemas de request e response.
- **SEMPRE** use **Zod v4**, nunca Zod v3.
- **SEMPRE** crie os schemas de criação e atualização em `src/schemas/index.ts`.
- **SEMPRE** use `z.enum(WeekDay)` importado de `../generated/prisma/enums.js` para campos de dia da semana. **NUNCA** use `z.string()` para WeekDay.
- **SEMPRE** use `src/schemas/index.ts` para tipar respostas de erro.
- Uma rota **NUNCA** contém regras de negócio — apenas validação de dados (Zod) e autenticação.
- Rota protegida: **SEMPRE** use `auth.api.getSession` (`src/lib/auth.ts`) para recuperar a sessão.
- Uma rota **SEMPRE** instancia e chama um use case.
- **SEMPRE** trate os erros lançados pelo use case (try/catch fica na rota).
- **SEMPRE** inclua `tags` e `summary` no schema para documentação no Swagger/OpenAPI.

### Exemplo

```ts
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { NotFoundError } from "../error/index.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";

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
            code: "NOT_FOUND_ERROR",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
```

## Use Cases

- **SEMPRE** concentre toda a regra de negócio no use case; crie-os em `src/usecases`.
- Todos os use cases são **classes** com método `execute`, nomeadas com **verbos** (PascalCase).
- Parâmetro: **SEMPRE** um DTO `InputDto` (interface definida no mesmo arquivo).
- Retorno: **SEMPRE** tipado com `OutputDto` (interface no mesmo arquivo); mapeie o resultado do banco para o OutputDto — **NUNCA** retorne o model do Prisma diretamente (desacoplamento negócio × banco).
- Interação com banco: **SEMPRE** via Prisma diretamente, não repository.
- Use cases **nunca** tratam erros (sem try/catch); quem trata é a rota.
- Exceção lançada deve **SEMPRE** ser um erro customizado de `src/error/index.ts`. Se não existir, **crie-o**.

### Exemplo

```ts
import { NotFoundError } from "../error/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

interface OutputDto {
  id: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class CreateWorkoutPlan {
  async execute(dto: InputDto): Promise<OutputDto> {
    const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { isActive: true },
    });
    return prisma.$transaction(async (tx) => {
      if (existingWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingWorkoutPlan.id },
          data: { isActive: false },
        });
      }
      const workoutPlan = await tx.workoutPlan.create({
        data: {
          id: crypto.randomUUID(),
          name: dto.name,
          userId: dto.userId,
          isActive: true,
          workoutdays: {
            create: dto.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
              exercises: {
                create: workoutDay.exercises.map((exercise) => ({
                  name: exercise.name,
                  order: exercise.order,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                })),
              },
            })),
          },
        },
      });
      const result = await tx.workoutPlan.findUnique({
        where: { id: workoutPlan.id },
        include: { workoutdays: { include: { exercises: true } } },
      });
      if (!result) {
        throw new NotFoundError("Workout plan not found");
      }
      return {
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
      };
    });
  }
}
```

## TypeScript

- **SEMPRE** TypeScript, nunca JavaScript. **NUNCA** use `any`.
- **SEMPRE** prefira named exports a default exports.
- **SEMPRE** use arrow functions, a menos que estritamente necessário.
- **SEMPRE** nomeie funções como verbos.
- **SEMPRE** prefira early returns a ifs muito aninhados.
- Priorize higher-order functions (map, filter, reduce) em vez de loops.
- Mais de 2 parâmetros? **SEMPRE** receba um objeto.

### Nomenclatura

- **SEMPRE** prefira `interface` a `type`, a menos que estritamente necessário.
- **SEMPRE** kebab-case para arquivos (e.g. `lib/auth-client.ts`), **exceto** use cases (PascalCase).
- **SEMPRE** PascalCase para classes; **SEMPRE** camelCase para variáveis, funções e métodos.

### Datas

- **SEMPRE** use a biblioteca "dayjs" para manipular/formatar datas.

### Zod

- **SEMPRE** use Zod v4. Valide da melhor maneira possível (e.g. `z.url()`, `z.date()`).
- **SEMPRE** use os validadores ISO do Zod em vez de regex manuais: `z.iso.date()` (YYYY-MM-DD), `z.iso.datetime()` (timestamps ISO), `z.iso.time()` (horários), `z.iso.duration()` (durações).

## Gotchas

- **`.env` é obrigatório** para rodar (tem `DATABASE_URL`, `PORT`, `POSTGRES_*`) e é usado pelo `docker-compose.yaml` (postgres:17). Está gitignored — nunca commite segredos.
- `engine-strict=true` no `.npmrc`; Node precisa ser v24.
- A pasta de erros é **`src/error/`** (singular), como está no repo — não crie `src/errors/`.
- **`dayjs` ainda não está instalado** — instale (`pnpm add dayjs`) antes de usar a regra de datas.
- Não há `entities/` no repo; a estrutura real é: `error`, `generated`, `lib`, `routes`, `schemas`, `usecases`.
- Não existe `pnpm build`/tsup neste repo; o único script é `pnpm dev`.
- Swagger/docs rodam na **porta 3000** (a porta é `process.env.PORT || 3000`), não em outra porta.
- `src/generated/prisma` está gitignored; num checkout limpo rode `pnpm exec prisma generate` antes de compilar.
- O arquivo de rota é `src/routes/wourkout-plans.ts` (typo mantido no repo); não renomeie sem o usuário pedir.
- Em imports locais use extensão `.js` (NodeNext): e.g. `../lib/auth.js` para `src/lib/auth.ts`.
- Ids são gerados no código com `crypto.randomUUID()`, e operações multi-escrita usam `prisma.$transaction`.
- `prisma/migrations/` está atualmente untracked — rode `migrate dev` para gerar a migration em vez de editar à mão.
