variable "aws_region" {
  description = "AWS region for the API stack."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name prefix for AWS resources."
  type        = string
  default     = "underwriting"
}

variable "azs" {
  description = "Two AZs for ALB + RDS. Override if a region does not have these names."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.azs) == 2
    error_message = "Provide exactly two availability zones."
  }
}

variable "vpc_cidr" {
  description = "VPC CIDR. Public 10.40.0.0/24 + 10.40.1.0/24, private 10.40.10.0/24 + 10.40.11.0/24 when using the default."
  type        = string
  default     = "10.40.0.0/16"
}

variable "image_tag" {
  description = "ECR image tag for the API task. Push this tag before setting desired_count > 0."
  type        = string
  default     = "latest"
}

variable "desired_count" {
  description = "ECS tasks. Leave 0 until you are ready to run the API on Fargate."
  type        = number
  default     = 0

  validation {
    condition     = var.desired_count >= 0 && var.desired_count <= 4
    error_message = "desired_count must be between 0 and 4."
  }
}

variable "cpu" {
  description = "Fargate CPU units (256, 512, 1024, …)."
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate memory in MiB."
  type        = number
  default     = 1024
}

variable "cpu_architecture" {
  description = "Fargate CPU architecture. Match the docker build (linux/amd64 → X86_64)."
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "cpu_architecture must be X86_64 or ARM64."
  }
}

variable "db_instance_class" {
  description = "RDS instance class. pgvector is available on PostgreSQL 16."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "Postgres database name (matches local compose)."
  type        = string
  default     = "underwriting_db"
}

variable "db_username" {
  description = "RDS master username."
  type        = string
  default     = "underwriting"
}

variable "cors_origins" {
  description = "Browser origins allowed to call the API. Local playground until the web UI is hosted."
  type        = string
  default     = "http://localhost:3000,http://127.0.0.1:3000"
}

variable "risk_ceiling" {
  description = "Hard-coded risk ceiling passed through to the API process."
  type        = number
  default     = 0.75
}

variable "acm_certificate_arn" {
  description = "Optional ACM cert ARN. Empty = HTTP-only ALB (port 80)."
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic key for the graph. Stored in Secrets Manager; never commit the real value."
  type        = string
  sensitive   = true
  default     = ""
}

variable "voyage_api_key" {
  description = "Voyage embeddings key (RAG ingest / retrieve)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "deepseek_api_key" {
  description = "DeepSeek key (RagPipeline generation)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "Optional OpenAI fallback key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langsmith_api_key" {
  description = "Optional LangSmith key. Tracing stays off in ECS unless you change the task env."
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_api_key" {
  description = "X-Admin-Key for /admin/*. Empty = generate a random key at apply."
  type        = string
  sensitive   = true
  default     = ""
}
