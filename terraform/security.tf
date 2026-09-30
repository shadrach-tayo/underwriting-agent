resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "ALB → public HTTP/HTTPS"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = local.https_enabled ? [443] : []
    content {
      description = "HTTPS"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
  tags = { Name = "${local.name}-alb" }
}

resource "aws_security_group" "ecs" {
  name_prefix = "${local.name}-ecs-"
  description = "Fargate API tasks"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "ALB to API"
    from_port       = local.container_port
    to_port         = local.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Public-subnet tasks need 443 for ECR + LLM/embedding providers. No NAT gateway.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
  tags = { Name = "${local.name}-ecs" }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  description = "Postgres from ECS only"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "ECS to Postgres"
    from_port       = local.db_port
    to_port         = local.db_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  lifecycle { create_before_destroy = true }
  tags = { Name = "${local.name}-rds" }
}
