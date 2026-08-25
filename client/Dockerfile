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
# مسار API نسبي دائمًا الآن — Caddy يوكّل /api إلى الخادم فيبقى الأصل واحدًا من منظور المتصفح
ENV VITE_API_ORIGIN=""
RUN npm run build:shared && npm run build --workspace=client

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/client/dist /srv
COPY client/Caddyfile /etc/caddy/Caddyfile
EXPOSE 4173
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
