# モジュール単体でも動作要件が分かるよう、ルート（terraform/main.tf）と同じ制約を宣言する
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
