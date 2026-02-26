# TARA Quick Start Guide

Get the TARA application running in under 5 minutes!

## Prerequisites Checklist

- [ ] Docker Desktop installed and running
- [ ] Git installed (if cloning the repository)
- [ ] At least 4GB of free disk space
- [ ] Ports 3000, 8000, 5432, 6379 are available

## Step-by-Step Setup

### 1. Verify Docker is Running

**Windows:**
```cmd
docker --version
docker-compose --version
```

**Linux/Mac:**
```bash
docker --version
docker-compose --version
```

Expected output: Version numbers for both commands.

---

### 2. Navigate to Project Root

```bash
cd "C:\Users\krunal\OneDrive - Nalashaa Solutions India Pvt Ltd\Documents\TARA"
```

Or on Linux/Mac:
```bash
cd /path/to/TARA
```

---

### 3. Configure Backend Environment (First Time Only)

```bash
cd "TARA - backend"
```

**Option A: Use example file (if available)**
```bash
cp .env.example .env
```

**Option B: Create minimal .env file**

Create `TARA - backend/.env` with these minimal settings:

```env
# Database
DATABASE_URL=postgresql://tara:tara@db:5432/tara

# Redis
REDIS_URL=redis://redis:6379/0

# JWT Secret (change in production!)
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS - Allow frontend
CORS_ORIGINS=["http://localhost:3000"]

# Environment
ENVIRONMENT=development
```

Return to project root:
```bash
cd ..
```

---

### 4. Start the Application

**Windows (using startup script):**
```cmd
start-tara.bat start
```

**Linux/Mac (using startup script):**
```bash
chmod +x start-tara.sh
./start-tara.sh start
```

**Or use Docker Compose directly:**
```bash
docker-compose up -d
```

---

### 5. Wait for Services to Start

Watch the logs:
```bash
docker-compose logs -f
```

Press `Ctrl+C` to stop watching logs (services keep running).

Check service status:
```bash
docker-compose ps
```

All services should show "Up" status.

---

### 6. Verify Installation

Open your browser and test these URLs:

✅ **Frontend:** http://localhost:3000
- Should load the TARA login page

✅ **Backend API:** http://localhost:8000
- Should show a JSON response

✅ **API Documentation:** http://localhost:8000/docs
- Should load Swagger UI with API documentation

---

### 7. First-Time Database Setup (if needed)

If the application requires initial database migrations or seed data:

```bash
# Run database migrations
docker-compose exec api alembic upgrade head

# (Optional) Seed initial data if you have a seed script
docker-compose exec api python -m app.cli.seed
```

---

## Common First-Time Issues

### Issue: Port already in use

**Error message:**
```
Error: Bind for 0.0.0.0:3000 failed: port is already allocated
```

**Solution:**
```bash
# Windows - Find process using port
netstat -ano | findstr :3000

# Linux/Mac - Find process using port
lsof -i :3000

# Stop the conflicting service or change TARA ports in docker-compose.yml
```

---

### Issue: Docker daemon not running

**Error message:**
```
Cannot connect to the Docker daemon
```

**Solution:**
- Start Docker Desktop application
- Wait for Docker to fully initialize (whale icon in system tray)
- Retry the command

---

### Issue: Backend .env file missing

**Error message:**
```
Warning: Backend .env file not found
```

**Solution:**
- Follow Step 3 above to create the .env file
- Ensure it's in `TARA - backend/.env` (not project root)

---

### Issue: Services keep restarting

**Check logs:**
```bash
docker-compose logs api
```

**Common causes:**
- Database connection failed (check DATABASE_URL)
- Redis connection failed (check REDIS_URL)
- Missing environment variables
- Port conflicts

**Solution:**
```bash
# Stop all services
docker-compose down

# Fix the issue (environment variables, ports, etc.)

# Start with fresh containers
docker-compose up -d
```

---

## Next Steps

### Access the Application

1. **Login/Register**
   - Navigate to http://localhost:3000
   - Use the registration page if available, or use seeded credentials

2. **Explore API Documentation**
   - Open http://localhost:8000/docs
   - Try out endpoints using the interactive Swagger UI

3. **Check Backend Health**
   - Visit http://localhost:8000/health (if health endpoint exists)
   - Check http://localhost:8000/openapi.json for API schema

### Development Workflow

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f worker
```

**Restart Services:**
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
```

**Stop Services:**
```bash
# Stop (keeps containers)
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (DELETES DATA!)
docker-compose down -v
```

**Update Code:**

Backend changes are automatically detected (hot reload).

For frontend changes in production mode:
```bash
docker-compose build frontend
docker-compose up -d frontend
```

### Run Commands Inside Containers

**Backend shell:**
```bash
docker-compose exec api bash
```

**Database shell:**
```bash
docker-compose exec db psql -U tara -d tara
```

**Run migrations:**
```bash
docker-compose exec api alembic upgrade head
```

**Create migration:**
```bash
docker-compose exec api alembic revision --autogenerate -m "description"
```

---

## Helpful Resources

- **README.md** - Complete project documentation
- **DOCKER-SETUP.md** - Detailed Docker Compose guide
- **ARCHITECTURE.md** - System architecture and networking
- **Frontend docs:** `TARA - frontend/CLAUDE.md`
- **API reference:** `TARA - frontend/AGENT.md`

---

## Need Help?

### Check Service Status
```bash
docker-compose ps
```

### View All Logs
```bash
docker-compose logs --tail=100
```

### Inspect Network
```bash
docker network inspect tara_tara-network
```

### Check Resource Usage
```bash
docker stats
```

### Clean Everything and Start Fresh
```bash
# ⚠️ WARNING: This deletes all data!
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## Success Checklist

After setup, verify:

- [ ] `docker-compose ps` shows all 5 services as "Up"
- [ ] Frontend loads at http://localhost:3000
- [ ] Backend API responds at http://localhost:8000
- [ ] API docs load at http://localhost:8000/docs
- [ ] No error messages in logs (`docker-compose logs`)
- [ ] Can create an account or login
- [ ] Database is accessible (if needed for debugging)

---

## Production Deployment

This Quick Start is for development only. For production:

1. Change all default passwords and secrets
2. Use environment-specific configuration files
3. Set up SSL/TLS certificates
4. Configure proper backup strategy for database
5. Implement monitoring and logging
6. Review and apply security best practices
7. See **DOCKER-SETUP.md** for production considerations

---

## Stopping the Application

**When you're done for the day:**

```bash
# Stop services (keeps data)
docker-compose stop
```

**Or:**
```bash
# Windows
start-tara.bat stop

# Linux/Mac
./start-tara.sh stop
```

**To start again later:**
```bash
docker-compose start
# or
start-tara.bat start
```

---

## Uninstalling

To completely remove TARA:

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove images (optional)
docker rmi tara-api tara-worker tara-frontend

# Remove the project directory (if desired)
```

---

That's it! You now have a fully functional TARA application running in Docker. Happy coding! 🚀
