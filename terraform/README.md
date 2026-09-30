# AWS — configured, not applied

Terraform here describes a later deploy: **ECS Fargate** (API) + **RDS PostgreSQL 16 / pgvector** + **ALB**. Grafana, Prometheus, and the Next.js playground stay on the laptop.

**Do not run `terraform apply` for the current demo.** Use local servers:

```bash
docker compose up -d postgres
uv run underwriting-api
cd web && pnpm dev
```

`desired_count` defaults to **0**, so even an accidental apply would create VPC/RDS/ALB (those still cost money) but would not start API tasks.

## What it creates (when you do apply)

| Resource | Role |
|----------|------|
| VPC `10.40.0.0/16` | 2 public + 2 private subnets, no NAT |
| ECR `underwriting-api` | Image registry |
| RDS Postgres 16 `db.t4g.micro` | Private; ECS-only SG; `CREATE EXTENSION vector` after first connect |
| Secrets Manager | `DATABASE_URL` + Anthropic / Voyage / DeepSeek / admin key |
| ECS Fargate | `GET /health` on the ALB; `/ready` still needs Postgres |
| ALB | HTTP :80 (HTTPS if `acm_certificate_arn` is set). Idle timeout 180s for RAG SSE |

Tasks sit in **public** subnets with a public IP so they can pull ECR and call LLM/embedding APIs without a NAT gateway. RDS has no public address.

Not in this stack: Next.js, Grafana, Prometheus, LangSmith Cloud, ElastiCache.

## Later apply (not now)

1. Copy `terraform.tfvars.example` → `terraform.tfvars` and fill keys.
2. `terraform init`
3. Apply ECR first, then push the image, then the rest:

```bash
terraform apply -target=aws_ecr_repository.api
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "$(terraform output -raw ecr_repository_url | cut -d/ -f1)"
docker build --platform linux/amd64 -t "$(terraform output -raw ecr_repository_url):latest" ..
docker push "$(terraform output -raw ecr_repository_url):latest"
terraform apply
# Start tasks only when the image exists:
#   terraform apply -var='desired_count=1'
```

4. On RDS: `CREATE EXTENSION IF NOT EXISTS vector;` then ingest (`POST /admin/rag/ingest` with `X-Admin-Key`).
5. Point the local playground at the ALB only if you want a hybrid demo: `NEXT_PUBLIC_API_URL=$(terraform output -raw api_base_url)`.

`terraform plan` needs AWS credentials. It is still not a deploy. Destroy with `terraform destroy` when you are done; `skip_final_snapshot` is on for this demo stack.

## Local vs AWS

| Concern | Local demo | This stack |
|---------|------------|------------|
| API | `uv run underwriting-api` or compose profile `api` | ECS, `desired_count=0` until you raise it |
| Postgres | compose `postgres` on :54326 | private RDS |
| Playground | `pnpm dev` :3000 | not deployed |
| Metrics | compose profile `observability` :3300 | not deployed |
