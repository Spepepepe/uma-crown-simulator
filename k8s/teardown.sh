#!/bin/bash
# ============================================
# Uma Crown Simulator - K8s 環境削除スクリプト
# ============================================
# 使い方: bash k8s/teardown.sh
#
# Namespace を削除すると、その中の全リソース
# (Deployment, Service, ConfigMap, Secret, Ingress)
# が自動的に削除される。
# ============================================

set -e

echo "=========================================="
echo " Uma Crown Simulator - K8s Teardown"
echo "=========================================="
echo ""
echo "Namespace 'uma-crown' と全リソースを削除します。"
echo ""

read -p "本当に削除しますか? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "キャンセルしました。"
  exit 0
fi

echo ""
echo "削除中..."
kubectl delete namespace uma-crown

echo ""
echo "=========================================="
echo " 削除完了!"
echo "=========================================="
echo ""
echo " Docker イメージも削除する場合:"
echo "   docker rmi uma-crown-backend:latest"
echo "   docker rmi uma-crown-frontend:latest"
echo ""
