FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=optional

FROM node:20-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=/backend
ARG NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE=false
ARG API_PROXY_TARGET=http://host.docker.internal:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE=${NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE}
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN set -eux; \
  for i in 1 2 3; do \
    npm run build && exit 0; \
    if [ "$i" -eq 3 ]; then exit 1; fi; \
    echo "Transient Next.js build failure. Retrying..."; \
    sleep 5; \
  done

FROM node:20-slim AS runner
RUN groupadd -r nodeuser && useradd -r -g nodeuser -u 1001 nodeuser
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY --chown=nodeuser:nodeuser package*.json ./
COPY --chown=nodeuser:nodeuser --from=deps /app/node_modules ./node_modules
COPY --chown=nodeuser:nodeuser --from=builder /app/.next ./.next
COPY --chown=nodeuser:nodeuser --from=builder /app/public ./public
COPY --chown=nodeuser:nodeuser --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
USER nodeuser
CMD ["npm", "run", "start", "--", "-p", "3000"]
