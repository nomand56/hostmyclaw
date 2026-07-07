FROM node:24-bookworm-slim AS base

WORKDIR /app

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Create openclaw state dir with correct ownership
RUN mkdir -p /home/node/.openclaw/workspace && \
    chown -R node:node /home/node/.openclaw

USER node

# Bake in a base openclaw.json — env vars injected at runtime override these
COPY --chown=node:node openclaw.json /home/node/.openclaw/openclaw.json

ENV HOME=/home/node
ENV OPENCLAW_HOME=/home/node
ENV OPENCLAW_STATE_DIR=/home/node/.openclaw
ENV OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json
ENV OPENCLAW_CONFIG_DIR=/home/node/.openclaw
ENV OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw/workspace
ENV OPENCLAW_DISABLE_BONJOUR=1

EXPOSE 18789

HEALTHCHECK --interval=10s --timeout=5s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:18789/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["openclaw", "gateway", "--bind", "lan", "--port", "18789"]
