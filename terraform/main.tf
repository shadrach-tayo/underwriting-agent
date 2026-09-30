provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

locals {
  name = var.project_name
  tags = {
    Project   = var.project_name
    ManagedBy = "terraform"
    Stack     = "underwriting-api"
  }

  container_port = 8080
  db_port        = 5432

  public_subnet_cidrs  = [cidrsubnet(var.vpc_cidr, 8, 0), cidrsubnet(var.vpc_cidr, 8, 1)]
  private_subnet_cidrs = [cidrsubnet(var.vpc_cidr, 8, 10), cidrsubnet(var.vpc_cidr, 8, 11)]

  https_enabled = var.acm_certificate_arn != ""
  admin_api_key = var.admin_api_key != "" ? var.admin_api_key : random_password.admin.result

  database_url = format(
    "postgresql+psycopg://%s:%s@%s:%s/%s?sslmode=require",
    var.db_username,
    random_password.db.result,
    aws_db_instance.this.address,
    aws_db_instance.this.port,
    var.db_name,
  )
}
