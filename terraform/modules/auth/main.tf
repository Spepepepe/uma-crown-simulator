locals {
  name = "${var.project}-${var.env}"
}

resource "aws_cognito_user_pool" "main" {
  name = "${local.name}-user-pool"

  # メールアドレスでサインイン
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # 未確認ユーザーの有効期限
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # 未確認ユーザーを 7 日後に自動削除
  lambda_config {}

  tags = { Name = "${local.name}-user-pool" }
}

resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${local.name}-frontend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # SPA からのアクセス用（シークレットなし）
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  # トークン有効期限
  access_token_validity  = 1  # 1 時間
  id_token_validity      = 1  # 1 時間
  refresh_token_validity = 30 # 30 日

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}
