FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=optional

FROM node:20-alpine AS builder
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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
