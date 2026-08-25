# يُبنى بسياق جذر المستودع (monorepo) — Railway: Root Directory = "." والمسار هنا server/Dockerfile
FROM mcr.microsoft.com/playwright:v1.47.2-jammy AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

FROM deps AS build
COPY . .
# Prisma Client يُولَّد قبل tsc — بدونه كل استدعاء Prisma في الكود يُكتَّب كـ any ضمنيًا فيفشل tsc strict
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build:shared && npm run build:server

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo/server
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages/shared/dist /repo/packages/shared/dist
COPY --from=build /repo/packages/shared/package.json /repo/packages/shared/package.json
COPY --from=build /repo/server/dist ./dist
COPY --from=build /repo/server/prisma ./prisma
COPY --from=build /repo/server/assets ./assets
COPY --from=build /repo/server/package.json ./package.json
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/index.js"]
