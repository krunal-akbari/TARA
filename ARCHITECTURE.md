# TARA Docker Architecture

This document describes the unified Docker Compose architecture for the TARA application.

## Service Dependency Graph

```
┌──────────────────────────────────────────────────────────────┐
│                     TARA Application                         │
│                     (tara-network)                           │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   PostgreSQL    │  Image: postgres:16
│   (tara-db)     │  Port: 5432
│                 │  Volume: postgres_data:/var/lib/postgresql/data
└────────┬────────┘
         │
         │ depends_on
         │
    ┌────▼─────┐  ┌─────────────┐
    │   Redis  │  │   Backend   │  Build: ./TARA - backend
    │  (redis) │  │    (api)    │  Port: 8000
    │          │  │             │  Command: uvicorn --reload
    └────┬─────┘  └──────┬──────┘
         │               │
         │ depends_on    │ depends_on
         │               │
    ┌────▼───────────────▼──────┐
    │      Celery Worker        │  Build: ./TARA - backend
    │      (tara-worker)        │  Queues: resume_ingest,
    │                           │          routing_events,
    └───────────────────────────┘          notifications

         ┌───────────────┐
         │   Frontend    │  Build: ./TARA - frontend
         │ (tara-frontend)│  Port: 3000
         │               │  Proxies: /backend/* → http://api:8000
         └───────┬───────┘
                 │
                 │ depends_on
                 │
         ┌───────▼───────┐
         │   Backend API │
         │   (api:8000)  │
         └───────────────┘
```

## Network Communication

### External Access (Host → Containers)

```
Host Machine
│
├─► http://localhost:3000  ───→  Frontend Container
├─► http://localhost:8000  ───→  API Container
├─► localhost:5432         ───→  Database Container
└─► localhost:6379         ───→  Redis Container
```

### Internal Communication (Container → Container)

```
Frontend Container
│
└─► http://api:8000              ───→  API Container

API Container
│
├─► postgresql://db:5432         ───→  Database Container
└─► redis://redis:6379           ───→  Redis Container

Worker Container
│
├─► postgresql://db:5432         ───→  Database Container
└─► redis://redis:6379           ───→  Redis Container
```

## Service Details

### 1. Database (tara-db)

**Purpose:** Primary data store for all application data

**Image:** postgres:16

**Configuration:**
- Database: `tara`
- User: `tara`
- Password: `tara` (change in production!)
- Port: `5432` (exposed to host)

**Persistence:**
- Volume: `postgres_data` → `/var/lib/postgresql/data`
- Data survives container restarts
- Removed only with `docker-compose down -v`

**Network:**
- Hostname: `db` (accessible by other services)
- Bridge network: `tara-network`

---

### 2. Redis (tara-redis)

**Purpose:** Message broker for Celery and application cache

**Image:** redis:7

**Configuration:**
- Port: `6379` (exposed to host)
- No persistence configured (in-memory only)

**Network:**
- Hostname: `redis` (accessible by other services)
- Bridge network: `tara-network`

**Used By:**
- API service (caching)
- Worker service (task queue)

---

### 3. Backend API (tara-api)

**Purpose:** RESTful API server for business logic

**Build Context:** `./TARA - backend`

**Runtime:**
- Framework: FastAPI
- Server: uvicorn with hot reload
- Port: `8000` (exposed to host)

**Configuration:**
- Environment: From `./TARA - backend/.env`
- Volume mount: `./TARA - backend:/app` (for hot reload)

**Dependencies:**
- Must start after: `db`, `redis`
- Connects to: `postgresql://db:5432`, `redis://redis:6379`

**Network:**
- Hostname: `api` (used by frontend and worker)
- Bridge network: `tara-network`

**API Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

---

### 4. Celery Worker (tara-worker)

**Purpose:** Background task processing

**Build Context:** `./TARA - backend` (same as API)

**Runtime:**
- Framework: Celery
- Concurrency: 4 workers
- Queues:
  - `resume_ingest` - Resume parsing and storage
  - `routing_events` - Candidate routing logic
  - `notifications` - Email and notification delivery

**Configuration:**
- Environment: From `./TARA - backend/.env`
- Volume mount: `./TARA - backend:/app`

**Dependencies:**
- Must start after: `db`, `redis`, `api`
- Connects to: `postgresql://db:5432`, `redis://redis:6379`

**Network:**
- Bridge network: `tara-network`
- No exposed ports (internal service)

---

### 5. Frontend (tara-frontend)

**Purpose:** User-facing web application

**Build Context:** `./TARA - frontend`

**Runtime:**
- Framework: Next.js 15
- Port: `3000` (exposed to host)
- Mode: Production build

**Build Arguments:**
- `NEXT_PUBLIC_API_BASE_URL`: `/backend` (browser API path)
- `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE`: `false`
- `API_PROXY_TARGET`: `http://api:8000` (internal proxy)

**Environment Variables:**
- Same as build args, available at runtime
- `NODE_ENV`: `production`

**Dependencies:**
- Must start after: `api`
- Proxies `/backend/*` to `http://api:8000`

**Network:**
- Bridge network: `tara-network`
- Hostname: `frontend`

**Request Flow:**
```
Browser
  │
  │ http://localhost:3000/backend/api/v1/auth/login
  │
  ▼
Frontend Container (Next.js)
  │
  │ Rewrites /backend/* → http://api:8000/*
  │
  ▼
API Container (FastAPI)
  │
  │ Processes request
  │
  ▼
Database Container (PostgreSQL)
```

---

## Volume Management

### Named Volumes

**postgres_data:**
- Purpose: Persistent PostgreSQL data
- Location: Docker managed volume
- Lifecycle: Persists across `docker-compose down`
- Removed by: `docker-compose down -v`

**View volume details:**
```bash
docker volume ls
docker volume inspect tara_postgres_data
```

### Bind Mounts

**Backend code:**
- Host: `./TARA - backend`
- Container: `/app`
- Purpose: Hot reload during development

**Frontend code:**
- Host: `./TARA - frontend`
- Container: `/app` (build time only, not mounted in production image)
- Purpose: Build context

---

## Network Details

### Bridge Network (tara-network)

**Type:** Docker bridge network

**Purpose:**
- Isolate TARA services from other Docker containers
- Enable service discovery via DNS (container names)
- Provide network segmentation

**DNS Resolution:**
- `db` resolves to Database container IP
- `redis` resolves to Redis container IP
- `api` resolves to API container IP
- `worker` resolves to Worker container IP
- `frontend` resolves to Frontend container IP

**Inspect network:**
```bash
docker network ls
docker network inspect tara_tara-network
```

---

## Startup Sequence

Docker Compose ensures services start in the correct order using `depends_on`:

```
1. db (PostgreSQL)      ┐
   redis (Redis)        ├─ No dependencies, start first
                        ┘
         │
         ▼
2. api (Backend API)    ─ Depends on: db, redis
         │
         ▼
3. worker (Celery)      ─ Depends on: db, redis, api
         │
         ▼
4. frontend (Next.js)   ─ Depends on: api
```

**Note:** `depends_on` only controls startup order, not readiness. Services should implement health checks or retry logic for robust startup.

---

## Port Mapping Summary

| Service  | Container Port | Host Port | Purpose                    |
|----------|----------------|-----------|----------------------------|
| frontend | 3000           | 3000      | Web application            |
| api      | 8000           | 8000      | REST API & documentation   |
| db       | 5432           | 5432      | PostgreSQL database access |
| redis    | 6379           | 6379      | Redis CLI access           |
| worker   | -              | -         | No external access needed  |

---

## Environment Files

### Backend (.env)

Location: `./TARA - backend/.env`

**Required variables:**
```env
# Database
DATABASE_URL=postgresql://tara:tara@db:5432/tara

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# ... other backend configuration
```

### Frontend (.env - optional)

Location: Root directory `.env` (or use defaults)

**Optional overrides:**
```env
NEXT_PUBLIC_API_BASE_URL=/backend
NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE=false
API_PROXY_TARGET=http://api:8000
```

---

## Comparison: Before vs After

### Before (Separate Setups)

**Terminal 1 - Backend:**
```bash
cd "TARA - backend"
docker-compose up
```
- Starts: api, worker, db, redis
- Frontend must connect via `host.docker.internal:8000`

**Terminal 2 - Frontend:**
```bash
cd "TARA - frontend"
docker-compose up
```
- Starts: frontend only
- Uses `extra_hosts` hack for host.docker.internal

**Issues:**
- Two separate networks
- No service discovery
- Manual coordination required
- Platform-specific networking (`host.docker.internal`)

### After (Unified Setup)

**Single Terminal:**
```bash
docker-compose up
```
- Starts: frontend, api, worker, db, redis
- All services in one network
- Proper service discovery
- Cross-platform compatible

**Benefits:**
- Single command startup
- Proper Docker networking
- Simplified development
- Consistent across environments
- Production-like architecture

---

## Production Considerations

When deploying to production, consider these modifications:

### 1. Security

**Database credentials:**
```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # From secure secret
```

**Remove exposed ports:**
```yaml
# Remove these for internal services
# ports:
#   - "5432:5432"  # Database
#   - "6379:6379"  # Redis
```

### 2. Resource Limits

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 3. Health Checks

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 4. Logging

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5. Persistence

**Database backups:**
```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      device: /path/to/backup/location
      o: bind
```

### 6. Reverse Proxy

Add nginx for SSL termination and load balancing:

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - frontend
      - api
```

### 7. Environment-specific Configs

Use Docker Compose override files:

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

---

## Monitoring & Debugging

### View all logs
```bash
docker-compose logs -f
```

### View specific service logs
```bash
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f worker
```

### Check service status
```bash
docker-compose ps
```

### Execute commands in containers
```bash
# Database shell
docker-compose exec db psql -U tara -d tara

# API shell
docker-compose exec api bash

# Run migrations
docker-compose exec api alembic upgrade head

# Django-style manage commands
docker-compose exec api python -m app.cli.commands
```

### Inspect network
```bash
docker network inspect tara_tara-network
```

### View volumes
```bash
docker volume ls
docker volume inspect tara_postgres_data
```

### Container resource usage
```bash
docker stats
```

---

## Summary

The unified Docker Compose setup provides:

✅ Single command startup (`docker-compose up`)
✅ Proper service networking and discovery
✅ Consistent development and production-like environment
✅ Isolated network for TARA services
✅ Hot reload for backend development
✅ Persistent database storage
✅ Organized service dependencies
✅ Cross-platform compatibility
✅ Easy scaling and orchestration
✅ Production-ready foundation

All services communicate efficiently within the Docker network while maintaining proper separation of concerns and following Docker best practices.
