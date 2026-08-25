# يُبنى بسياق جذر المستودع (monorepo) — Railway: Root Directory = "." والمسار هنا client/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

FROM deps AS build
WORKDIR /repo
COPY . .
ARG VITE_API_ORIGIN
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}
RUN npm run build:shared && npm run build --workspace=client

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /repo/client/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
