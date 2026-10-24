# ============================================
# Stage: base - 開発用ベース（ワークスペースインストール）
# ============================================
FROM node:26.12.1-alpine3.24 AS base

WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY frontend/package*.json ./frontend/

RUN npm install -w frontend

COPY shared/ ./shared/
COPY frontend/ ./frontend/

# ============================================
# Stage: dev - 開発用（docker-compose）
# ============================================
FROM base AS dev

WORKDIR /app/frontend
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]

# ============================================
# Stage: build - Angularビルド
# ============================================
FROM node:26.12.1-alpine3.24 AS build

# k8s ローカル検証時に --build-arg で Cognito 値を注入する
# GitHub Actions (AWS本番) はこのステージを使わず S3 に sync するため影響なし
ARG COGNITO_USER_POOL_ID
ARG COGNITO_CLIENT_ID

WORKDIR /app

COPY shared/ ./shared/
COPY frontend/package*.json ./frontend/

WORKDIR /app/frontend

# @uma-crown/shared をローカルファイル参照に書き換えてインストール（1回のみ）
RUN sed -i 's|"@uma-crown/shared": "\*"|"@uma-crown/shared": "file:../shared"|' package.json && \
    npm install

COPY frontend/ /app/frontend/

# Cognito 設定を environment.ts に注入（--build-arg 指定時のみ有効）
RUN if [ -n "$COGNITO_USER_POOL_ID" ]; then \
      sed -i "s|userPoolId: ''|userPoolId: '${COGNITO_USER_POOL_ID}'|g" src/app/environments/environment.ts; \
    fi && \
    if [ -n "$COGNITO_CLIENT_ID" ]; then \
      sed -i "s|clientId: ''|clientId: '${COGNITO_CLIENT_ID}'|g" src/app/environments/environment.ts; \
    fi

RUN npx @tailwindcss/cli -i src/styles.css -o src/styles.built.css && \
    mv src/styles.built.css src/styles.css && \
    npx ng build --configuration production

# ============================================
# Stage: prod - 本番用（k8s ローカル検証 / nginx配信）
# ※ AWS本番はこのステージは使わず ng build 成果物を S3 に sync する
# ============================================
FROM nginx:1.30.6-alpine3.24 AS prod

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/uma-crown-simulator/browser /usr/share/nginx/html

EXPOSE 80
