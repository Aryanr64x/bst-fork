# Multi-stage build for the Backstage backend.
# Build from the REPO ROOT as context:
#   docker build -t neuron5ai/bst-upihelp:1.0.2 -f packages/backend/Dockerfile .
#
# Before building, run in the repo root:
#   yarn install --immutable
#   yarn tsc
#   yarn build:backend

# ============================================================
# Stage 1 — builder
# Has compilers + dev headers to compile native modules
# (better-sqlite3, isolated-vm). Discarded after the copy below;
# none of these tools ship in the final image.
# ============================================================
FROM node:24-trixie-slim AS builder

ENV PYTHON=/usr/bin/python3
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

# Build toolchain + sqlite3 headers (needed only at compile time)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Yarn metadata
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node .yarnrc.yml backstage.json ./

# Skeleton first (per-package package.json files + lockfile) for cache efficiency
COPY --chown=node:node yarn.lock package.json packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

# Production install. Do NOT rm the mounted cache dir — it's a live mount (busy).
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked \
    yarn workspaces focus --all --production && \
    yarn cache clean && \
    rm -rf /tmp/*

# Backend bundle + config + examples
COPY --chown=node:node packages/backend/dist/bundle.tar.gz app-config*.yaml ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

COPY --chown=node:node examples ./examples


# ============================================================
# Stage 2 — runtime
# Slim: only the sqlite3 runtime library + ca-certs.
# No compilers, no dev headers.
# ============================================================
FROM node:24-trixie-slim

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      libsqlite3-0 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
USER node

# Bring over the fully-prepared app tree (compiled native modules included)
COPY --from=builder --chown=node:node /app /app

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]