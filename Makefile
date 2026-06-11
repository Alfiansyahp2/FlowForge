# FlowForge Docker Management Makefile
# Provides convenient commands for Docker operations

.PHONY: help build up down restart logs shell test migrate seed

# Default target
help:
	@echo "FlowForge Docker Management Commands:"
	@echo ""
	@echo "build           - Build Docker containers"
	@echo "up              - Start all services"
	@echo "down            - Stop all services"
	@echo "restart         - Restart all services"
	@echo "logs            - View logs from all services"
	@echo "shell           - Open shell in app container"
	@echo "test            - Run test suite"
	@echo "migrate         - Run database migrations"
	@echo "seed            - Seed database"
	@echo "fresh           - Fresh install (migrate + seed)"
	@echo "clean           - Remove all containers and volumes"
	@echo "prod            - Start production services"
	@echo "monitor         - Start monitoring stack (Prometheus + Grafana)"

# Build containers
build:
	@echo "Building Docker containers..."
	docker-compose build

# Start all services
up:
	@echo "Starting FlowForge services..."
	docker-compose up -d
	@echo "FlowForge is now running at http://localhost:8000"

# Stop all services
down:
	@echo "Stopping FlowForge services..."
	docker-compose down

# Restart services
restart: down up

# View logs
logs:
	docker-compose logs -f

# Open shell in app container
shell:
	docker-compose exec app sh

# Run tests
test:
	docker-compose exec app php artisan test --coverage

# Run migrations
migrate:
	docker-compose exec app php artisan migrate

# Seed database
seed:
	docker-compose exec app php artisan db:seed

# Fresh installation
fresh: migrate seed
	@echo "Fresh installation complete!"

# Clean everything (remove containers and volumes)
clean:
	@echo "Removing all containers and volumes..."
	docker-compose down -v
	@echo "Cleanup complete!"

# Production deployment
prod:
	@echo "Starting production services..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Monitoring stack
monitor:
	@echo "Starting monitoring stack..."
	docker-compose -f docker-compose.prod.yml up -d prometheus grafana
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3001"

# Install dependencies
install:
	docker-compose exec app composer install
	docker-compose exec app npm install
	docker-compose exec app npm run build

# Generate application key
key:
	docker-compose exec app php artisan key:generate

# Cache configuration
cache:
	docker-compose exec app php artisan config:cache
	docker-compose exec app php artisan route:cache
	docker-compose exec app php artisan view:cache

# Clear caches
clear:
	docker-compose exec app php artisan cache:clear
	docker-compose exec app php artisan route:clear
	docker-compose exec app php artisan view:clear
	docker-compose exec app php artisan config:clear

# Database operations
db-fresh:
	docker-compose exec app php artisan migrate:fresh --seed

# Queue worker
queue:
	docker-compose exec app php artisan queue:work

# Schedule run
schedule:
	docker-compose exec app php artisan schedule:run

# Horizon dashboard
horizon:
	docker-compose exec app php artisan horizon

# Check status
status:
	@docker-compose ps

# Network test
ping:
	docker-compose exec app ping -c 3 postgres

# Backup database
backup:
	docker-compose exec postgres pg_dump -U flowforge flowforge > backup_$$(date +%Y%m%d_%H%M%S).sql

# Show container stats
stats:
	@docker stats --no-stream

# Watch logs for specific service
watch-logs:
	@if [ -z "$(SERVICE)" ]; then \
		echo "Usage: make watch-logs SERVICE=app|nginx|postgres|redis"; \
		exit 1; \
	fi
	docker-compose logs -f $(SERVICE)