FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 18789
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:18789/healthz || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
