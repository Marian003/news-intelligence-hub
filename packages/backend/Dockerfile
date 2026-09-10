# Multi-stage build for the NestJS backend within the pnpm workspace. The build
# context is the repo root so the workspace lockfile and the shared package are
# available. Stage 1 installs everything and compiles; stage 2 ships only
# production dependencies plus the compiled output.

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# --- Build stage: full install + TypeScript compile ---
FROM base AS builder
# Copy only manifests first so dependency installation is cached across source
# changes.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --frozen-lockfile
# Now the sources; `tsc -b` on the backend also builds the referenced shared pkg.
COPY packages/shared packages/shared
COPY packages/backend packages/backend
RUN pnpm --filter @nih/backend build

# --- Runtime stage: production deps + compiled JS only ---
FROM base AS runner
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/backend/dist packages/backend/dist
# Committed SQL migrations, applied at runtime by the migrate entrypoint.
COPY --from=builder /app/packages/backend/drizzle packages/backend/drizzle
# Drop to the unprivileged user the node images already ship (node = 1000:1000).
# The app only ever reads from the image (all state is in Postgres/Redis), so
# root is not needed at runtime - which lets the Kubernetes manifests also set
# readOnlyRootFilesystem and runAsNonRoot.
#
# Numeric, not `USER node`: with a name, the kubelet cannot prove the user is
# non-root before starting the container and refuses the pod outright
# ("image has non-numeric user"). The numeric form is verifiable.
USER 1000:1000
CMD ["node", "packages/backend/dist/main.js"]
