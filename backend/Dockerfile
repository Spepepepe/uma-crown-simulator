# ============================================
# Stage: base - 開発用ベース（ワークスペースインストール）
# ============================================
FROM node:26.12.1-alpine3.24 AS base

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
FROM node:26.12.1-alpine3.24 AS build

WORKDIR /app

# ルートの package-lock.json（workspaces 全体の lockfile）でインストールし、ローカル・CI と同じ依存バージョンにそろえる
# （ルート package.json の overrides もここで効く）
# npm ci は全 workspace の package.json と lockfile の整合を検査するため、frontend の package.json も配置する
COPY package.json package-lock.json ./
COPY shared/ ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# postinstall（prisma generate）は schema.prisma のコピー後に実行するため、ここでは scripts を無効にする
# workspaces の依存は /app/node_modules に巻き上げられ、バージョン衝突分のみ backend/node_modules に入る
RUN npm ci --workspace=backend --ignore-scripts && \
    mkdir -p backend/node_modules

COPY backend/ /app/backend/

WORKDIR /app/backend

RUN npx prisma generate && npm run build

# ============================================
# Stage: prod - 本番用（ECS / ローカル k8s 検証）
# ============================================
FROM node:26.12.1-alpine3.24 AS prod

# workspaces と同じ配置（/app/node_modules + /app/backend）にして、巻き上げられた依存を解決できるようにする
# @uma-crown/shared は /app/node_modules から /app/shared へのシンボリックリンクのため shared もコピーする
WORKDIR /app/backend

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/shared /app/shared
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/data ./data
COPY backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
