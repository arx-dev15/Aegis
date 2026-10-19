# AEGIS — Controlled Node.js 22 Sandbox Image
# Target: aegis-sandbox-node:22
# Purpose: Bounded, non-root, isolated execution sandbox for Node.js and TypeScript verification

FROM node:22-alpine

LABEL org.opencontainers.image.title="aegis-sandbox-node" \
      org.opencontainers.image.version="22" \
      org.opencontainers.image.description="Dedicated AEGIS execution sandbox for Node.js 22 and TypeScript verification"

WORKDIR /workspace

# Configure environment for read-only root compatibility and isolated execution
ENV NODE_ENV=test \
    HOME=/tmp \
    NPM_CONFIG_CACHE=/tmp/.npm \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    CI=true

# Switch to non-root user (UID 1000 in official alpine node)
USER node

CMD ["node", "--version"]
