FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY frontend/package*.json ./frontend/

RUN npm install -w frontend

COPY shared/ ./shared/
COPY frontend/ ./frontend/

WORKDIR /app/frontend

EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]
