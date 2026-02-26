# TARA Docker Compose Setup

This unified Docker Compose configuration allows you to start the entire TARA application (frontend, backend, database, Redis, and worker) with a single command.

## Quick Start

From the project root directory:

```bash
# Start all services
docker-compose up

# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Services

The setup includes 5 services running in a shared Docker network:

### 1. Database (db)
- **Image**: postgres:16
- **Port**: 5432
- **Container**: tara-db
- **Credentials**:
  - Database: tara
  - User: tara
  - Password: tara
- **Data**: Persisted in `postgres_data` volume

### 2. Redis (redis)
- **Image**: redis:7
- **Port**: 6379
- **Container**: tara-redis
- **Purpose**: Message broker for Celery and caching

### 3. Backend API (api)
- **Build**: `./TARA - backend`
- **Port**: 8000
- **Container**: tara-api
- **Framework**: FastAPI with uvicorn
- **Features**: Hot reload enabled
- **Dependencies**: db, redis

### 4. Celery Worker (worker)
- **Build**: `./TARA - backend`
- **Container**: tara-worker
- **Purpose**: Background task processing
- **Queues**: resume_ingest, routing_events, notifications
- **Concurrency**: 4 workers
- **Dependencies**: db, redis, api

### 5. Frontend (frontend)
- **Build**: `./TARA - frontend`
- **Port**: 3000
- **Container**: tara-frontend
- **Framework**: Next.js 15
- **API Connection**: http://api:8000 (via Docker network)
- **Dependencies**: api

## Network Architecture

All services communicate via a dedicated Docker bridge network (`tara-network`):

```
Frontend (3000) ──→ API (8000) ──→ Database (5432)
                        │
                        └──→ Redis (6379) ←── Worker
```

Key networking changes from individual setups:
- Frontend now connects to backend via `http://api:8000` instead of `http://host.docker.internal:8000`
- All inter-service communication happens within the Docker network
- Only necessary ports are exposed to the host

## Environment Variables

### Backend (.env in TARA - backend/)
Ensure your backend `.env` file contains:
- Database connection settings (should point to service name `db`)
- Redis connection settings (should point to service name `redis`)
- Any API keys, secrets, or configuration

### Frontend (Optional .env in TARA - frontend/)
You can override defaults via environment variables:
- `NEXT_PUBLIC_API_BASE_URL` (default: `/backend`)
- `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE` (default: `false`)
- `API_PROXY_TARGET` (default: `http://api:8000` in unified setup)

## Development Workflow

### First Time Setup

1. Ensure backend `.env` file exists:
   ```bash
   cd "TARA - backend"
   # Create .env from template if needed
   ```

2. Start all services:
   ```bash
   cd ..
   docker-compose up -d
   ```

3. Check service health:
   ```bash
   docker-compose ps
   ```

4. View logs:
   ```bash
   # All services
   docker-compose logs -f

   # Specific service
   docker-compose logs -f api
   docker-compose logs -f frontend
   ```

5. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Making Changes

#### Backend Code Changes
- Changes to Python files are automatically detected (hot reload enabled)
- If you modify dependencies in requirements.txt:
  ```bash
  docker-compose build api worker
  docker-compose up -d api worker
  ```

#### Frontend Code Changes
- For development with hot reload, you may want to run frontend locally instead:
  ```bash
  cd "TARA - frontend"
  npm run dev
  # Set API_PROXY_TARGET=http://localhost:8000 in .env.local
  ```
- To rebuild frontend container:
  ```bash
  docker-compose build frontend
  docker-compose up -d frontend
  ```

#### Database Migrations
```bash
# Run migrations in the API container
docker-compose exec api alembic upgrade head

# Create a new migration
docker-compose exec api alembic revision --autogenerate -m "description"
```

### Troubleshooting

#### Services won't start
```bash
# Check service status
docker-compose ps

# View specific service logs
docker-compose logs api
docker-compose logs db

# Restart a specific service
docker-compose restart api
```

#### Database connection issues
```bash
# Verify database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Connect to database directly
docker-compose exec db psql -U tara -d tara
```

#### Frontend can't reach backend
```bash
# Verify API is running
curl http://localhost:8000/docs

# Check frontend logs
docker-compose logs frontend

# Verify network connectivity
docker-compose exec frontend ping api
```

#### Clean slate restart
```bash
# Stop everything and remove volumes
docker-compose down -v

# Rebuild all images
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

## Production Deployment

For production use, consider:

1. **Environment-specific configuration**: Use separate `.env` files
2. **Remove hot reload**: Modify API command to remove `--reload` flag
3. **Resource limits**: Add memory and CPU limits to services
4. **Security**: Change default database credentials
5. **Volumes**: Configure proper volume backup strategy
6. **Logging**: Set up centralized logging (e.g., ELK stack)
7. **Reverse proxy**: Use nginx or Traefik in front of services
8. **Health checks**: Add health check configurations to services

## Individual Service Commands

```bash
# Build specific service
docker-compose build <service-name>

# Start specific service
docker-compose up <service-name>

# Stop specific service
docker-compose stop <service-name>

# View service logs
docker-compose logs -f <service-name>

# Execute command in running container
docker-compose exec <service-name> <command>

# Scale worker instances
docker-compose up -d --scale worker=3
```

## Comparing to Individual Setups

### Before (Two separate docker-compose files)
```bash
# Terminal 1 - Backend
cd "TARA - backend"
docker-compose up

# Terminal 2 - Frontend
cd "TARA - frontend"
docker-compose up
```

### After (Unified setup)
```bash
# Single terminal - Everything
docker-compose up
```

### Migration Notes
- The original `docker-compose.yml` files in backend and frontend directories remain unchanged
- You can still use them individually if needed
- The unified setup uses Docker networking instead of `host.docker.internal`
- All functionality is preserved, just combined into one orchestration file
