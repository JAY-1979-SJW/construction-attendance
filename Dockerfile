FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .
RUN mkdir -p public
RUN npx prisma generate
# 빌드 시 DATABASE_URL이 없으면 Prisma 초기화 실패 → dummy URL로 빌드만 통과
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build_placeholder"
ENV DATABASE_URL=${DATABASE_URL}
# NEXT_PUBLIC_* 는 빌드 시 번들에 인라인됨 — .dockerignore 외부에서 ARG로 주입
ARG NEXT_PUBLIC_KAKAO_MAP_JS_KEY=""
ENV NEXT_PUBLIC_KAKAO_MAP_JS_KEY=${NEXT_PUBLIC_KAKAO_MAP_JS_KEY}
ARG NEXT_PUBLIC_APP_NAME="해한Ai 현장관리"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ARG NEXT_PUBLIC_BASE_URL="https://attendance.haehan-ai.kr"
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
RUN NODE_OPTIONS="--max-old-space-size=1024" npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/openai ./node_modules/openai
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /app/uploads/identity/original /app/uploads/identity/masked \
              /app/uploads/documents /app/uploads/estimates && \
    chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "entrypoint.sh"]
