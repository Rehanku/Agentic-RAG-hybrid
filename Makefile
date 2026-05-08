.PHONY: help up down build deploy logs

help:
	@echo "DeepRead Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make up       - Start the full stack locally via Docker Compose"
	@echo "  make down     - Stop the local stack"
	@echo "  make build    - Force rebuild of Docker images locally"
	@echo "  make deploy   - Run the deploy.sh script to deploy to Cloud Run"
	@echo "  make logs     - Tail the logs of local Docker containers"

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

deploy:
	./deploy.sh

logs:
	docker-compose logs -f
