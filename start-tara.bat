@echo off
REM TARA Unified Startup Script for Windows
REM This script helps you start the entire TARA application with proper checks

setlocal enabledelayedexpansion

echo.
echo Starting TARA Application...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo Error: docker-compose is not installed or not in PATH.
    exit /b 1
)

REM Check if backend .env exists
if not exist "TARA - backend\.env" (
    echo Warning: Backend .env file not found at 'TARA - backend\.env'
    echo          Please create it before starting the application.
    echo.
    set /p CONTINUE="Continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" exit /b 1
)

REM Parse command line arguments
set MODE=%1
if "%MODE%"=="" set MODE=foreground

if /i "%MODE%"=="up" goto :foreground
if /i "%MODE%"=="foreground" goto :foreground
if /i "%MODE%"=="start" goto :background
if /i "%MODE%"=="background" goto :background
if /i "%MODE%"=="detached" goto :background
if /i "%MODE%"=="-d" goto :background
if /i "%MODE%"=="stop" goto :stop
if /i "%MODE%"=="down" goto :stop
if /i "%MODE%"=="restart" goto :restart
if /i "%MODE%"=="logs" goto :logs
if /i "%MODE%"=="status" goto :status
if /i "%MODE%"=="ps" goto :status
if /i "%MODE%"=="clean" goto :clean
if /i "%MODE%"=="rebuild" goto :rebuild
if /i "%MODE%"=="help" goto :help
if /i "%MODE%"=="--help" goto :help
if /i "%MODE%"=="-h" goto :help

echo Error: Unknown command: %MODE%
echo        Run 'start-tara.bat help' for usage information
exit /b 1

:foreground
echo Starting all services in foreground mode...
echo Press Ctrl+C to stop all services
echo.
docker-compose up
goto :end

:background
echo Starting all services in background mode...
docker-compose up -d
echo.
echo Services started successfully!
echo.
echo Service Status:
docker-compose ps
echo.
echo Access URLs:
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo Useful Commands:
echo    docker-compose logs -f           # View all logs
echo    docker-compose logs -f api       # View API logs
echo    docker-compose logs -f frontend  # View frontend logs
echo    docker-compose ps                # Check service status
echo    docker-compose down              # Stop all services
echo.
goto :end

:stop
echo Stopping all services...
docker-compose down
echo All services stopped
goto :end

:restart
echo Restarting all services...
docker-compose restart
echo All services restarted
goto :end

:logs
echo Showing logs (press Ctrl+C to exit)...
docker-compose logs -f
goto :end

:status
echo Service Status:
docker-compose ps
goto :end

:clean
echo Cleaning up containers and volumes...
set /p CONFIRM="This will remove all data. Are you sure? (y/N): "
if /i "!CONFIRM!"=="y" (
    docker-compose down -v
    echo Cleanup complete
) else (
    echo Cleanup cancelled
)
goto :end

:rebuild
echo Rebuilding all services...
docker-compose build --no-cache
echo Rebuild complete
goto :end

:help
echo TARA Unified Startup Script for Windows
echo.
echo Usage: start-tara.bat [command]
echo.
echo Commands:
echo   up, foreground     Start all services in foreground (default)
echo   start, background  Start all services in background
echo   stop, down         Stop all services
echo   restart            Restart all services
echo   logs               View logs from all services
echo   status, ps         Show service status
echo   clean              Stop services and remove volumes (data)
echo   rebuild            Rebuild all Docker images
echo   help               Show this help message
echo.
echo Examples:
echo   start-tara.bat                 # Start in foreground
echo   start-tara.bat start           # Start in background
echo   start-tara.bat logs            # View logs
echo   start-tara.bat stop            # Stop services
echo.
goto :end

:end
endlocal
