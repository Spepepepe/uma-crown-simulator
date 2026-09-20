# インフラ構成（IaC）

## Terraform モジュール構成

```
terraform/
├── main.tf            # ルートモジュール（モジュール呼び出し）
├── variables.tf       # 入力変数
├── outputs.tf         # 出力値
├── backend.tf         # tfstate S3 バックエンド
├── modules/
│   ├── networking/    # VPC, Subnet, SG, EIP
│   ├── frontend/      # S3, CloudFront
│   ├── backend/       # EC2, ECS, ECR, EBS
│   ├── auth/          # Cognito
│   ├── management/    # SSM, CloudWatch Logs
│   ├── dns/           # Route53, ACM
│   └── cicd/          # GitHub Actions OIDC, IAM Role
└── scripts/
    └── bootstrap.sh   # tfstate S3 バケット作成
```

## 各リソースの役割

### networking/

| リソース | 用途 |
|---------|------|
| `aws_vpc` | アプリ用 VPC |
| `aws_subnet` (public) | EC2 配置用パブリックサブネット |
| `aws_internet_gateway` | インターネットゲートウェイ |
| `aws_security_group` | CloudFront マネージドプレフィックスリストで直接アクセス遮断 |
| `aws_eip` | EC2 用 Elastic IP（IP 固定） |

### frontend/

| リソース | 用途 |
|---------|------|
| `aws_s3_bucket` | 静的ファイルホスティング |
| `aws_cloudfront_origin_access_control` | S3 アクセス制御（OAC） |
| `aws_cloudfront_distribution` | CDN・HTTPS 終端・`/api/*` ルーティング |

### backend/

| リソース | 用途 |
|---------|------|
| `aws_instance` | EC2 t3.small（ECS ホスト + PostgreSQL ホスト） |
| `aws_ebs_volume` | PostgreSQL データ用 EBS（20GB gp3） |
| `aws_ecs_cluster` | ECS クラスター（EC2 起動タイプ） |
| `aws_ecs_task_definition` | NestJS タスク定義 |
| `aws_ecs_service` | NestJS サービス |
| `aws_ecr_repository` | Docker イメージのプライベートレジストリ |

### auth/

| リソース | 用途 |
|---------|------|
| `aws_cognito_user_pool` | ユーザープール |
| `aws_cognito_user_pool_client` | フロントエンド用アプリクライアント |

### management/

| リソース | 用途 |
|---------|------|
| `aws_ssm_parameter` | DB パスワード等の機密情報（SecureString） |
| `aws_cloudwatch_log_group` | ECS タスクのログ出力先（30日保持） |

### dns/

| リソース | 用途 |
|---------|------|
| `aws_acm_certificate` | CloudFront 用 SSL 証明書（us-east-1） |
| `aws_route53_record` | CloudFront への Alias レコード（apex + www） |

### cicd/

| リソース | 用途 |
|---------|------|
| `aws_iam_openid_connect_provider` | GitHub Actions OIDC プロバイダー |
| `aws_iam_role` | GitHub Actions 用 IAM ロール（ECR push, ECS deploy, S3 deploy, CloudFront 無効化） |

## コスト見積もり（月額・東京リージョン）

| リソース | 月額概算 | 備考 |
|---------|---------|------|
| EC2 t3.small | ~$20 | 全体の約 85% |
| EBS gp3 (20GB) | ~$2 | PostgreSQL データ領域 |
| Route53 | ~$0.5 | ホストゾーン固定費 |
| CloudWatch Logs | ~$0.5 | ログ量次第 |
| S3 / CloudFront / ECR / ACM / Cognito / SSM | ~$0 | 無料枠内 |
| **合計（オンデマンド）** | **~$23/月** | |
| **合計（1年リザーブド）** | **~$15/月** | |

## アーキテクチャの設計判断

### なぜ RDS を使わないか

RDS の最小構成（db.t3.micro）は月額 ~$15 追加になります。
個人開発規模では EC2 上の Docker PostgreSQL + EBS スナップショットで十分です。

### なぜ ALB を使わないか

ALB は月額 ~$16 かかります。CloudFront + Elastic IP で代替し、
セキュリティグループで CloudFront マネージドプレフィックスリスト以外からの直接アクセスを遮断しています。

### GitHub Actions OIDC

シークレット不要でデプロイできます。IAM ロールの信頼ポリシーでリポジトリ・ブランチを限定します。

```hcl
# main ブランチからのみデプロイ可能
"token.actions.githubusercontent.com:sub": "repo:Spepepepe/uma-crown-simulator:ref:refs/heads/main"
```

## デプロイ手順（初回構築）

### 前提条件

- AWS CLI セットアップ済み・認証済み（`aws configure`）
- Terraform v1.6.0 以上
- Route53 でドメイン取得済み（`umacrownsimulator.com`）

### 1. tfstate 用 S3 バケットを作成

```bash
# Linux/macOS
chmod +x terraform/scripts/bootstrap.sh
./terraform/scripts/bootstrap.sh

# Windows（PowerShell）
aws s3api create-bucket --bucket uma-crown-tfstate --region ap-northeast-1 --create-bucket-configuration LocationConstraint=ap-northeast-1
aws s3api put-bucket-versioning --bucket uma-crown-tfstate --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket uma-crown-tfstate --server-side-encryption-configuration file://encryption.json
aws s3api put-public-access-block --bucket uma-crown-tfstate --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 2. Terraform 初期化

```bash
cd terraform
terraform init
```

### 3. 確認・適用

```bash
terraform plan
terraform apply
```

### 4. DB パスワードを SSM に設定（初回のみ）

```bash
aws ssm put-parameter \
  --name "/uma-crown/prod/db_password" \
  --value "YOUR_STRONG_PASSWORD" \
  --type SecureString \
  --overwrite \
  --region ap-northeast-1
```

### 5. GitHub Actions シークレットを設定

リポジトリの Settings > Secrets and variables > Actions に追加:

| シークレット名 | 値 |
|---|---|
| `AWS_ROLE_ARN` | `terraform output github_actions_role_arn` の値 |
| `AWS_REGION` | `ap-northeast-1` |
| `ECR_REPOSITORY_URL` | `terraform output ecr_repository_url` の値 |
| `CLOUDFRONT_DISTRIBUTION_ID` | AWS コンソールで確認 |
| `S3_BUCKET` | `uma-crown-prod-frontend` |

## 運用

### EC2 への接続（SSM Session Manager）

SSH ポートは閉じています。SSM 経由でアクセスします。

```bash
aws ssm start-session --target <EC2_INSTANCE_ID>
```

### PostgreSQL の確認

```bash
# SSM セッション内で実行
docker exec -it postgres psql -U uma_crown -d uma_crown -c "\dt"
```

### ECS サービスの確認

```bash
aws ecs describe-services \
  --cluster uma-crown-prod-cluster \
  --services uma-crown-prod-backend-svc \
  --query "services[0].{status:status,running:runningCount}"
```

## 注意事項・トレードオフ

| 省略した要素 | 本来の役割 | 代替手段 |
|------------|----------|---------|
| ALB | ヘルスチェック・SSL 終端 | CloudFront + Elastic IP |
| RDS | マネージド DB・HA | EC2 上 Docker + EBS スナップショット |
| Multi-AZ | AZ 障害対策 | 単一 AZ で許容 |
| WAF | 不正アクセス防御 | 必要になったら追加 |

EC2 が単一障害点（SPOF）のため、**EBS スナップショットの自動化**は必須です。

## 今後の検討事項

- [ ] EBS スナップショットによる PostgreSQL 定期バックアップ
- [ ] CloudFront WAF の導入
- [ ] Cognito MFA ポリシーの設定
- [ ] トラフィック増加時の RDS 移行判断基準
