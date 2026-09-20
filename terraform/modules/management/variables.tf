variable "project" { type = string }
variable "env" { type = string }
variable "region" { type = string }
variable "domain_name" { type = string }
variable "cognito_user_pool_id" { type = string }
variable "cognito_client_id" { type = string }
variable "alert_email" {
  description = "アラート通知先メールアドレス"
  type        = string
}
variable "ec2_instance_id" {
  description = "監視対象 EC2 インスタンス ID"
  type        = string
}
