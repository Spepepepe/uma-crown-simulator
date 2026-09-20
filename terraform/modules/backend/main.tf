locals {
  name = "${var.project}-${var.env}"
}

# ─────────────────────────────────────────
# ECR リポジトリ
# ─────────────────────────────────────────

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${local.name}-ecr" }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "最新 5 イメージのみ保持"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# ─────────────────────────────────────────
# IAM: EC2 インスタンスプロファイル
# ─────────────────────────────────────────

resource "aws_iam_role" "ec2_instance" {
  name = "${local.name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ec2_ecs" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ec2_ecr" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# SSM Parameter Store の読み取り権限（PostgreSQL 起動時に DB パスワード取得）
resource "aws_iam_role_policy" "ec2_ssm_params" {
  name = "${local.name}-ec2-ssm-params"
  role = aws_iam_role.ec2_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters"]
      Resource = "arn:aws:ssm:*:*:parameter/${var.project}/*"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name}-ec2-profile"
  role = aws_iam_role.ec2_instance.name
}

# ─────────────────────────────────────────
# IAM: ECS タスク実行ロール
# ─────────────────────────────────────────

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name}-ecs-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_ssm" {
  name = "${local.name}-ecs-ssm"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:GetParameters", "kms:Decrypt"]
      Resource = "arn:aws:ssm:*:*:parameter/${var.project}/*"
    }]
  })
}

# ─────────────────────────────────────────
# ECS クラスター
# ─────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"

  configuration {
    execute_command_configuration {
      logging = "DEFAULT"
    }
  }

  tags = { Name = "${local.name}-cluster" }
}

# ─────────────────────────────────────────
# ECS タスク定義（NestJS）
# ─────────────────────────────────────────

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name}-backend"
  network_mode             = "host"  # PostgreSQL(localhost:5432) に接続するため
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  cpu                      = "512"
  memory                   = "768"

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV",   value = "production" },
      { name = "PORT",       value = "3000" },
      { name = "AWS_REGION", value = var.region },
      { name = "DB_HOST",    value = "localhost" },
      { name = "DB_PORT",    value = "5432" },
    ]

    secrets = [
      { name = "DB_PASSWORD",          valueFrom = var.db_password_arn },
      { name = "DB_NAME",              valueFrom = var.db_name_arn },
      { name = "DB_USER",              valueFrom = var.db_user_arn },
      { name = "DATABASE_URL",         valueFrom = var.database_url_arn },
      { name = "COGNITO_USER_POOL_ID", valueFrom = var.cognito_user_pool_id_arn },
      { name = "COGNITO_CLIENT_ID",    valueFrom = var.cognito_client_id_arn },
      { name = "CORS_ORIGIN",          valueFrom = var.cors_origin_arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = var.log_group_name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "backend"
      }
    }
  }])

  tags = { Name = "${local.name}-backend-task" }
}

resource "aws_ecs_service" "backend" {
  name            = "${local.name}-backend-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "EC2"

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  tags = { Name = "${local.name}-backend-svc" }

  lifecycle {
    ignore_changes = [task_definition]  # CI/CD でタスク定義を更新するため
  }
}

# ─────────────────────────────────────────
# EC2 インスタンス
# ─────────────────────────────────────────

# ECS 最適化 AMI（Amazon Linux 2）
data "aws_ami" "ecs_optimized" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }
}

resource "aws_instance" "main" {
  ami                    = data.aws_ami.ecs_optimized.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tpl", {
    cluster_name    = aws_ecs_cluster.main.name
    region          = var.region
    project         = var.project
    db_password_key = "/${var.project}/${var.env}/db_password"
    db_name_key     = "/${var.project}/${var.env}/db_name"
    db_user_key     = "/${var.project}/${var.env}/db_user"
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
  }

  tags = { Name = "${local.name}-ec2" }

  lifecycle {
    ignore_changes = [ami, user_data]  # AMI 更新・user_data 変更による意図しない再作成を防止
  }
}

# EIP を EC2 に関連付け
resource "aws_eip_association" "main" {
  instance_id   = aws_instance.main.id
  allocation_id = var.eip_id
}

# ─────────────────────────────────────────
# EBS ボリューム（PostgreSQL データ）
# ─────────────────────────────────────────

resource "aws_ebs_volume" "postgres" {
  availability_zone = aws_instance.main.availability_zone
  size              = var.ebs_volume_size
  type              = "gp3"

  tags = { Name = "${local.name}-postgres-ebs" }
}

resource "aws_volume_attachment" "postgres" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.postgres.id
  instance_id = aws_instance.main.id
}
