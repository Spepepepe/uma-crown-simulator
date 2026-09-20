terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# メインリージョン（東京）
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}

# ACM は CloudFront 用に us-east-1 が必須
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}

# ─────────────────────────────────────────
# Modules
# ─────────────────────────────────────────

module "networking" {
  source            = "./modules/networking"
  project           = var.project
  env               = var.env
  vpc_cidr          = "10.0.0.0/16"
  public_subnet_cidr = "10.0.1.0/24"
  az                = "${var.region}a"
}

module "auth" {
  source  = "./modules/auth"
  project = var.project
  env     = var.env
}

# auth より後に実行（Cognito ID を SSM に保存するため）
module "management" {
  source               = "./modules/management"
  project              = var.project
  env                  = var.env
  region               = var.region
  domain_name          = var.domain_name
  cognito_user_pool_id = module.auth.user_pool_id
  cognito_client_id    = module.auth.client_id
  alert_email          = var.alert_email
  ec2_instance_id      = module.backend.ec2_instance_id
}

module "backend" {
  source                   = "./modules/backend"
  project                  = var.project
  env                      = var.env
  region                   = var.region
  subnet_id                = module.networking.public_subnet_id
  security_group_id        = module.networking.ec2_security_group_id
  instance_type            = var.ec2_instance_type
  ebs_volume_size          = var.ebs_volume_size
  log_group_name           = module.management.ecs_log_group_name
  eip_id                   = module.networking.eip_id
  db_password_arn          = module.management.db_password_arn
  db_name_arn              = module.management.db_name_arn
  db_user_arn              = module.management.db_user_arn
  database_url_arn         = module.management.database_url_arn
  cors_origin_arn          = module.management.cors_origin_arn
  cognito_user_pool_id_arn = module.management.cognito_user_pool_id_arn
  cognito_client_id_arn    = module.management.cognito_client_id_arn
}

# CloudFront origin 用バックエンド DNS レコード（IP アドレスは origin に使えないため）
data "aws_route53_zone" "main" {
  name = var.domain_name
}

resource "aws_route53_record" "backend_origin" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "backend.${var.domain_name}"
  type    = "A"
  ttl     = 60
  records = [module.networking.eip_public_ip]
}

module "frontend" {
  source          = "./modules/frontend"
  project         = var.project
  env             = var.env
  domain_name     = var.domain_name
  backend_origin  = "backend.${var.domain_name}"
  certificate_arn = module.dns.certificate_arn
}

module "dns" {
  source              = "./modules/dns"
  project             = var.project
  env                 = var.env
  domain_name         = var.domain_name
  cloudfront_domain   = module.frontend.cloudfront_domain_name
  cloudfront_zone_id  = module.frontend.cloudfront_hosted_zone_id

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

module "cicd" {
  source       = "./modules/cicd"
  project      = var.project
  env          = var.env
  github_repo  = var.github_repo
  ecr_arn      = module.backend.ecr_repository_arn
  ecs_cluster  = module.backend.ecs_cluster_name
  ecs_service  = module.backend.ecs_service_name
}
