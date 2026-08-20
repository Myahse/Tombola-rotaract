FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
WORKDIR /app/backend
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
