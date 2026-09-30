output "ecr_repository_url" {
  description = "Push the API image here before raising desired_count."
  value       = aws_ecr_repository.api.repository_url
}

output "alb_dns_name" {
  description = "Public API hostname after apply. Empty traffic until desired_count > 0."
  value       = aws_lb.api.dns_name
}

output "api_base_url" {
  description = "Base URL for NEXT_PUBLIC_API_URL once ECS is serving."
  value       = local.https_enabled ? "https://${aws_lb.api.dns_name}" : "http://${aws_lb.api.dns_name}"
}

output "rds_endpoint" {
  description = "Private RDS hostname. Not reachable from a laptop."
  value       = aws_db_instance.this.address
}

output "secrets_arn" {
  description = "Secrets Manager JSON (DATABASE_URL + provider keys + admin key)."
  value       = aws_secretsmanager_secret.app.arn
}

output "admin_api_key" {
  description = "X-Admin-Key generated when var.admin_api_key is empty."
  value       = local.admin_api_key
  sensitive   = true
}
