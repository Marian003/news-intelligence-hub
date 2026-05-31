# Multi-stage: build the Vite bundle in Node, serve the static files with nginx.
# The API base URL is baked at build time (browser-side), so it is a build arg.

FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
# shared must be built first so the frontend can resolve its types.
RUN pnpm --filter @nih/shared build && pnpm --filter @nih/frontend build

FROM nginx:1.27-alpine AS runner
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
EXPOSE 80
