#!/bin/bash

# TARA Unified Startup Script
# This script helps you start the entire TARA application with proper checks

set -e

echo "Starting TARA Application..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Resolve compose command (prefer modern 'docker compose', fallback to 'docker-compose')
COMPOSE_CMD=""
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "Error: Docker Compose is not available. Please install/update Docker Desktop."
    exit 1
fi

# Check if backend .env.local exists
if [ ! -f "TARA - backend/.env.local" ]; then
    echo "Warning: Backend .env.local file not found at 'TARA - backend/.env.local'"
    echo "Please create it before starting the application."
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Parse command line arguments
MODE=${1:-foreground}

case $MODE in
    up|foreground)
        echo "Starting all services in foreground mode..."
        echo "Press Ctrl+C to stop all services"
        echo ""
        $COMPOSE_CMD up
        ;;

    start|background|detached|-d)
        echo "Starting all services in background mode..."
        $COMPOSE_CMD up -d
        echo ""
        echo "Services started successfully!"
        echo ""
        echo "Service Status:"
        $COMPOSE_CMD ps
        echo ""
        echo "Access URLs:"
        echo "  Frontend:  http://localhost:3000"
        echo "  Backend:   http://localhost:8000"
        echo "  API Docs:  http://localhost:8000/docs"
        echo ""
        echo "Useful Commands:"
        echo "  docker compose logs -f           # View all logs"
        echo "  docker compose logs -f api       # View API logs"
        echo "  docker compose logs -f frontend  # View frontend logs"
        echo "  docker compose ps                # Check service status"
        echo "  docker compose down              # Stop all services"
        echo ""
        ;;

    stop|down)
        echo "Stopping all services..."
        $COMPOSE_CMD down
        echo "All services stopped"
        ;;

    restart)
        echo "Restarting all services..."
        $COMPOSE_CMD restart
        echo "All services restarted"
        ;;

    logs)
        echo "Showing logs (press Ctrl+C to exit)..."
        $COMPOSE_CMD logs -f
        ;;

    status|ps)
        echo "Service Status:"
        $COMPOSE_CMD ps
        ;;

    clean)
        echo "Cleaning up containers and volumes..."
        read -p "This will remove all data. Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            $COMPOSE_CMD down -v
            echo "Cleanup complete"
        else
            echo "Cleanup cancelled"
        fi
        ;;

    rebuild)
        echo "Rebuilding all services..."
        $COMPOSE_CMD build --no-cache
        echo "Rebuild complete"
        ;;

    help|--help|-h)
        echo "TARA Unified Startup Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  up, foreground     Start all services in foreground (default)"
        echo "  start, background  Start all services in background"
        echo "  stop, down         Stop all services"
        echo "  restart            Restart all services"
        echo "  logs               View logs from all services"
        echo "  status, ps         Show service status"
        echo "  clean              Stop services and remove volumes (data)"
        echo "  rebuild            Rebuild all Docker images"
        echo "  help               Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                 # Start in foreground"
        echo "  $0 start           # Start in background"
        echo "  $0 logs            # View logs"
        echo "  $0 stop            # Stop services"
        echo ""
        ;;

    *)
        echo "Unknown command: $MODE"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

