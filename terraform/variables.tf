variable "project" {
  description = "プロジェクト名（リソース名のプレフィックスに使用）"
  type        = string
  default     = "uma-crown"
}

variable "env" {
  description = "環境名"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "メインリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "domain_name" {
  description = "取得済みドメイン名"
  type        = string
  default     = "umacrownsimulator.com"
}

variable "github_repo" {
  description = "GitHub リポジトリ（owner/repo 形式）"
  type        = string
  default     = "Spepepepe/uma-crown-simulator"
}

variable "ec2_instance_type" {
  description = "EC2 インスタンスタイプ"
  type        = string
  default     = "t3.small"
}

variable "ebs_volume_size" {
  description = "PostgreSQL 用 EBS ボリュームサイズ (GB)"
  type        = number
  default     = 20
}

variable "alert_email" {
  description = "アラート通知先メールアドレス（terraform.tfvars で設定）"
  type        = string
  sensitive   = true
}
