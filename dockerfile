FROM node:26-slim AS base 

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.33.0

WORKDIR /app

# --DEPENDENCIAS--
FROM base AS deps

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

# --BUILD--
FROM deps AS build

COPY . .

RUN pnpm run build && cp -r src/generated dist/generated

# --PRODUCTION--
FROM base AS production

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]