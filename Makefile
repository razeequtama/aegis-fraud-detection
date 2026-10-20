.PHONY: help up down restart status logs test test-backend test-frontend seed reset-demo clean

help:
	@echo "AEGIS Fraud Detection Platform - Command Reference"
	@echo "=================================================="
	@echo "  make up             - Initialize .env and start all containers in background"
	@echo "  make down           - Stop all running containers"
	@echo "  make restart        - Restart all containers"
	@echo "  make status         - Display running container status and health"
	@echo "  make logs           - Follow Docker Compose log stream"
	@echo "  make test           - Run full test suite (backend pytest + frontend vitest)"
	@echo "  make test-backend   - Run pytest inside backend container"
	@echo "  make test-frontend  - Run frontend unit tests"
	@echo "  make seed           - Seed database if empty"
	@echo "  make reset-demo     - Reset database to clean demonstration baseline"
	@echo "  make clean          - Stop containers and remove persistent volumes (destructive)"

up:
	@if [ ! -f .env ]; then \
		if [ -f .env.example ]; then \
			echo "Notice: .env not found. Initializing from .env.example..."; \
			cp .env.example .env; \
		else \
			echo "Error: Neither .env nor .env.example exists." >&2; \
			exit 1; \
		fi; \
	fi
	docker compose up --build -d

down:
	docker compose down

restart:
	docker compose restart

status:
	docker compose ps

logs:
	docker compose logs -f

test: test-backend test-frontend

test-backend:
	docker compose exec backend pytest

test-frontend:
	npm test --prefix frontend

seed:
	docker compose exec backend python -m app.db.seed

reset-demo:
	docker compose exec backend python -m app.db.seed --reset

clean:
	docker compose down -v

