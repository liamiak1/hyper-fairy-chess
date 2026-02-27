@echo off
REM Stop Hyper Fairy Chess processes
echo Stopping Hyper Fairy Chess...

REM Kill processes on port 5173 (Vite client)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Killing process on port 5173 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill processes on port 3001 (Server)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Killing process on port 3001 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)

echo Done.
