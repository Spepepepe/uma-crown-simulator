variable "project" { type = string }
variable "env" { type = string }
variable "github_repo" {
  description = "GitHub リポジトリ（owner/repo 形式）"
  type        = string
}
variable "ecr_arn" { type = string }
# ECS デプロイ権限（github_actions_ecs）の Resource を絞り込むために受け取っているが、現状は "*" のまま未使用
# 権限の絞り込みはバックログ infra_20261024_cicd-ecs-policy-scope で対応する
# tflint-ignore: terraform_unused_declarations
variable "ecs_cluster" { type = string }
# tflint-ignore: terraform_unused_declarations
variable "ecs_service" { type = string }
