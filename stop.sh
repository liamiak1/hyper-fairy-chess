#!/bin/bash
# Stop Hyper Fairy Chess processes
echo "Stopping Hyper Fairy Chess..."

# Kill processes on port 5173 (Vite client)
if lsof -i :5173 > /dev/null 2>&1; then
    echo "Killing process on port 5173"
    kill $(lsof -t -i :5173) 2>/dev/null
fi

# Kill processes on port 3001 (Server)
if lsof -i :3001 > /dev/null 2>&1; then
    echo "Killing process on port 3001"
    kill $(lsof -t -i :3001) 2>/dev/null
fi

echo "Done."
