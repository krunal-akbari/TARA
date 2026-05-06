# TARA - Applicant Tracking System

TARA is a modern, multi-tenant Applicant Tracking System (ATS) built with Next.js 15 (frontend) and FastAPI (backend).

## Quick Start with Docker

The easiest way to run the entire TARA application is using the unified Docker Compose setup:

### Run from Docker Hub on Another Device

```bash
curl -L -o docker-compose.yml https://raw.githubusercontent.com/krunal-akbari/TARA/main/docker-compose.hub.yml
docker compose up -d
```

This pulls the published images from Docker Hub:
- `krunalakbari/tara-api:latest`
- `krunalakbari/tara-frontend:latest`

No source checkout is required for the Docker Hub setup. The application runs at http://localhost:3000 and stores runtime data in Docker named volumes.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop)

### Starting the Application

**Option 1: Using the startup script (Recommended)**

Windows:
```cmd
start-tara.bat start
```

Linux/Mac:
```bash
chmod +x start-tara.sh
./start-tara.sh start
```

**Option 2: Using Docker Compose directly**

```bash
docker compose up --build -d
```

### Accessing the Application

Once started, access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

MinerU is optional because it requires NVIDIA GPU support. To start with MinerU enabled:

```bash
RESUME_PARSER_BACKEND=mineru docker compose --profile mineru up --build -d
```

### Stopping the Application

Windows:
```cmd
start-tara.bat stop
```

Linux/Mac:
```bash
./start-tara.sh stop
```

Or using Docker Compose:
```bash
docker compose down
```

## Project Structure

```
TARA/
├── TARA - frontend/          # Next.js 15 frontend application
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # React components
│   │   ├── lib/              # API services, utilities, types
│   │   └── ...
│   ├── Dockerfile
│   ├── docker-compose.yml    # Individual frontend setup
│   └── package.json
│
├── TARA - backend/           # FastAPI backend application
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── models/           # Database models
│   │   ├── services/         # Business logic
│   │   ├── tasks/            # Celery background tasks
│   │   └── ...
│   ├── Dockerfile
│   ├── docker-compose.yml    # Individual backend setup
│   └── requirements.txt
│
├── docker-compose.yml        # Unified Docker setup (all services)
├── DOCKER-SETUP.md           # Detailed Docker documentation
├── start-tara.bat            # Windows startup script
├── start-tara.sh             # Linux/Mac startup script
└── README.md                 # This file
```

## Architecture

### Services

The application consists of 6 Docker services:

1. **Frontend** (Next.js 15) - Port 3000
   - React 19 with TypeScript
   - Tailwind CSS for styling
   - React Query for server state
   - Zustand for client state

2. **API** (FastAPI) - Port 8000
   - RESTful API with OpenAPI documentation
   - JWT-based authentication
   - Multi-tenant architecture
   - Hot reload in development

3. **Worker** (Celery)
   - Background job processing
   - Resume ingestion
   - Routing events
   - Notifications

4. **Database** (PostgreSQL 16) - Port 5432
   - Primary data store
   - Persistent volume for data

5. **Redis** (Redis 7) - Port 6379
   - Celery message broker
   - Caching layer

6. **MinerU API** (MinerU 2.5 Docker) - Port 18000
   - OCR/document parser for resumes
   - Used by backend resume extraction flow

### Technology Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- React Query (@tanstack/react-query)
- Zustand
- Axios
- Radix UI
- Lucide Icons

**Backend:**
- Python 3.11+
- FastAPI
- SQLAlchemy (ORM)
- Alembic (migrations)
- Celery (task queue)
- PostgreSQL
- Redis
- JWT authentication

## Development Setup

### Backend Development

1. Navigate to backend directory:
   ```bash
   cd "TARA - backend"
   ```

2. Create and configure `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. Start development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Development

1. Navigate to frontend directory:
   ```bash
   cd "TARA - frontend"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment (optional):
   ```bash
   cp .env.example .env.local
   # Edit .env.local if needed
   ```

4. Generate TypeScript types from backend OpenAPI schema:
   ```bash
   npm run api:generate
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

6. Access at http://localhost:3000

### Available Commands

**Frontend:**
```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Type checking
npm run api:generate # Generate types from OpenAPI schema
```

**Backend:**
```bash
uvicorn app.main:app --reload           # Start API server
celery -A app.tasks.celery_app worker   # Start Celery worker
alembic upgrade head                    # Run migrations
alembic revision --autogenerate -m ""   # Create migration
pytest                                  # Run tests (if configured)
```

**Docker:**
```bash
docker-compose up              # Start all services (foreground)
docker-compose up -d           # Start all services (background)
docker-compose down            # Stop all services
docker-compose logs -f         # View all logs
docker-compose logs -f api     # View specific service logs
docker-compose ps              # Check service status
docker-compose restart api     # Restart specific service
docker-compose build           # Rebuild all images
docker-compose down -v         # Stop and remove volumes (clean slate)
```

## Environment Variables

### Frontend Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `/backend` | API URL prefix for browser requests |
| `API_PROXY_TARGET` | `http://api:8000` | Backend URL for Next.js proxy |
| `NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE` | `false` | Enable `/bootstrap` admin page |
| `NEXT_PUBLIC_DEFAULT_TENANT_ID` | - | Pre-set tenant context for development |

### Backend Configuration

Configure in `TARA - backend/.env`:
- Database connection (PostgreSQL)
- Redis connection
- JWT secret and settings
- CORS origins
- Email/SMTP settings (if applicable)
- Third-party API keys

See `TARA - backend/.env.example` for all available options.

## Documentation

- **DOCKER-SETUP.md** - Comprehensive Docker Compose guide
- **TARA - frontend/CLAUDE.md** - Frontend architecture and patterns
- **TARA - frontend/AGENT.md** - Backend API reference
- **API Documentation** - http://localhost:8000/docs (when running)

## Key Features

- Multi-tenant architecture with tenant isolation
- JWT-based authentication with token refresh
- Role-based access control
- Real-time job posting and candidate management
- Resume parsing and ingestion
- Vendor and client relationship management
- Automated routing and notifications
- Soft delete with restore capability
- Audit logging
- Responsive UI with dark/light mode support

## Network Architecture

In the unified Docker setup, services communicate via a dedicated bridge network:

```
┌─────────────┐
│  Frontend   │ :3000
│  (Next.js)  │
└──────┬──────┘
       │
       ├─────► ┌─────────┐
       │       │   API   │ :8000
       │       │(FastAPI)│
       │       └────┬────┘
       │            │
       │            ├─────► ┌──────────┐
       │            │       │   DB     │ :5432
       │            │       │(Postgres)│
       │            │       └──────────┘
       │            │
       │            └─────► ┌─────────┐     ┌────────┐
       │                    │  Redis  │◄────┤ Worker │
       │                    │         │     │(Celery)│
       │                    └─────────┘     └────────┘
       │                     :6379
       │
       └─────► http://api:8000 (Docker network)
```

## Troubleshooting

### Services won't start

1. Check Docker is running:
   ```bash
   docker info
   ```

2. View service logs:
   ```bash
   docker-compose logs
   ```

3. Check service status:
   ```bash
   docker-compose ps
   ```

### Database connection errors

1. Ensure database service is running:
   ```bash
   docker-compose ps db
   ```

2. Check database logs:
   ```bash
   docker-compose logs db
   ```

3. Verify database credentials in backend `.env`

### Frontend can't connect to backend

1. Verify API is accessible:
   ```bash
   curl http://localhost:8000/docs
   ```

2. Check frontend environment variables
3. Verify `API_PROXY_TARGET` is set to `http://api:8000` in Docker setup

### Clean slate restart

```bash
# Stop and remove everything
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test locally using Docker Compose
4. Submit a pull request with description of changes

## License

[Add your license information here]

## Support

[Add support contact information here]
