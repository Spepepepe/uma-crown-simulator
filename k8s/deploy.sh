#!/bin/bash
# ============================================
# Uma Crown Simulator - K8s デプロイスクリプト
# ============================================
# 使い方: bash k8s/deploy.sh
#
# このスクリプトが行うこと:
# 1. Docker イメージをビルド (backend, frontend)
# 2. K8s マニフェストを適用
# 3. デプロイ完了を待機
# ============================================

set -e

# プロジェクトルートに移動
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo " Uma Crown Simulator - K8s Deploy"
echo "=========================================="

# --- Step 1: Docker イメージビルド ---
echo ""
echo "[1/3] Docker イメージをビルド中..."
echo "  -> backend..."
docker build -t uma-crown-backend:latest -f backend/Dockerfile --target prod .

echo "  -> frontend..."
docker build -t uma-crown-frontend:latest -f frontend/Dockerfile --target prod .

echo "  ビルド完了!"

# --- Step 2: K8s マニフェスト適用 ---
echo ""
echo "[2/3] K8s マニフェストを適用中..."

# Namespace を最初に作成
kubectl apply -f k8s/namespace.yaml

# ConfigMap と Secret
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# PostgreSQL（backend より先に起動する必要がある）
kubectl apply -f k8s/postgres-deployment.yaml
echo "  PostgreSQL の起動を待機中..."
kubectl rollout status deployment/postgres -n uma-crown --timeout=120s

# Deployment + Service
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Ingress (Ingress Controller が必要。なくてもエラーにはならない)
kubectl apply -f k8s/ingress.yaml

echo "  マニフェスト適用完了!"

# --- Step 3: デプロイ完了待ち ---
echo ""
echo "[3/3] デプロイ完了を待機中..."
kubectl rollout status deployment/backend -n uma-crown --timeout=120s
kubectl rollout status deployment/frontend -n uma-crown --timeout=120s

# --- 完了 ---
echo ""
echo "=========================================="
echo " デプロイ完了!"
echo "=========================================="
echo ""
echo " アクセス URL: http://localhost:30080"
echo ""
echo " 便利なコマンド:"
echo "   kubectl get all -n uma-crown          # 全リソース確認"
echo "   kubectl logs -n uma-crown deploy/backend   # バックエンドログ"
echo "   kubectl logs -n uma-crown deploy/frontend  # フロントエンドログ"
echo "   kubectl scale deploy backend --replicas=2 -n uma-crown  # スケール"
echo ""
