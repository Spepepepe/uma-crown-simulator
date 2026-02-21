# ============================================
# Stage: base - 開発用ベース（ワークスペースインストール）
# ============================================
FROM node:20-alpine AS base

WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY backend/package*.json ./backend/
COPY backend/prisma/ ./backend/prisma/

RUN npm install -w backend

COPY shared/ ./shared/
COPY backend/ ./backend/

# ============================================
# Stage: dev - 開発用（docker-compose）
# ============================================
FROM base AS dev

WORKDIR /app/backend
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ============================================
# Stage: build - 本番ビルド
# ============================================
FROM node:20-alpine AS build

WORKDIR /app

COPY shared/ ./shared/
COPY backend/package*.json ./backend/

WORKDIR /app/backend

# @uma-crown/shared をローカルファイル参照に書き換えてインストール（1回のみ）
RUN sed -i 's|"@uma-crown/shared": "\*"|"@uma-crown/shared": "file:../shared"|' package.json && \
    npm install --ignore-scripts

COPY backend/ /app/backend/

RUN npx prisma generate && npm run build

# ============================================
# Stage: prod - 本番用（k8s / EC2 Docker）
# ============================================
FROM node:20-alpine AS prod

WORKDIR /app

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/data ./data
COPY backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
