# NaviTBI runs as a single long-lived container, not as serverless functions.
#
# That is a deliberate constraint, not a preference. Session state is held in
# memory and keyed on globalThis; on a platform that spreads requests across
# instances, a share link minted by one would 404 on another and a check-in
# would vanish between requests. One container behaves exactly like localhost.
#
# Moving to Postgres removes the constraint — src/db/schema.ts is written and
# tested against the app's shapes — and until then this is the honest shape.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000
CMD ["node", "server.js"]
