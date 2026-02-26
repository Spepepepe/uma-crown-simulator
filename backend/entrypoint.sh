#!/bin/sh
set -e
echo "Running Prisma db push..."
npx prisma db push --skip-generate --accept-data-loss
echo "Starting application..."
exec node dist/main.js
