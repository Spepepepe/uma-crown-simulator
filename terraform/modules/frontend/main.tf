locals {
  name = "${var.project}-${var.env}"
}

# ─────────────────────────────────────────
# S3 バケット（静的ファイル）
# ─────────────────────────────────────────

resource "aws_s3_bucket" "frontend" {
  bucket = "${local.name}-frontend"
  tags   = { Name = "${local.name}-frontend" }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────
# CloudFront OAC（S3 へのアクセス制御）
# ─────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name}-oac"
  description                       = "OAC for ${local.name} frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontOAC"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })
}

# ─────────────────────────────────────────
# CloudFront Functions（セキュリティパスブロック）
# ─────────────────────────────────────────

resource "aws_cloudfront_function" "block_sensitive_paths" {
  name    = "${local.name}-block-sensitive-paths"
  runtime = "cloudfront-js-2.0"
  comment = "クローラーによる機密ファイルへのアクセスをブロック"
  publish = true
  code    = <<-JS
    function handler(event) {
      var uri = event.request.uri.toLowerCase();

      var blockedPatterns = [
        /^\/.env/,
        /^\/.git/,
        /^\/.aws/,
        /^\/.ssh/,
        /^\/.htaccess/,
        /^\/.htpasswd/,
        /^\/.config/,
        /^\/.well-known\/security\.txt/,
        /^\/wp-/,
        /^\/wordpress/,
        /^\/phpmy/,
        /^\/adminer/,
        /^\/config\b/,
        /^\/backup/,
        /^\/\.DS_Store/,
        /\/web\.config$/,
        /\/server-status$/,
        /\/server-info$/,
      ];

      for (var i = 0; i < blockedPatterns.length; i++) {
        if (blockedPatterns[i].test(uri)) {
          return {
            statusCode: 403,
            statusDescription: 'Forbidden',
            headers: {
              'content-type': { value: 'text/plain' },
            },
            body: 'Forbidden',
          };
        }
      }

      return event.request;
    }
  JS
}

# ─────────────────────────────────────────
# CloudFront ディストリビューション
# ─────────────────────────────────────────

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${local.name} distribution"

  # オリジン 1: S3（静的フロントエンド）
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # オリジン 2: EC2（NestJS バックエンド）
  origin {
    domain_name = var.backend_origin
    origin_id   = "ec2-backend"

    custom_origin_config {
      http_port              = 3000
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # デフォルトキャッシュ動作（S3）
  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.block_sensitive_paths.arn
    }
  }

  # /api/* → EC2 バックエンド（キャッシュなし）
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "ec2-backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin"]
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # SPA フォールバック（404 → index.html）
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  aliases = [var.domain_name, "www.${var.domain_name}"]

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = { Name = "${local.name}-cf" }
}
