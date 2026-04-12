FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/prisma/build/index.js generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh
COPY package.json ./
RUN chmod +x ./entrypoint.sh
EXPOSE 3020
CMD ["./entrypoint.sh"]
