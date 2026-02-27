# Hyper Fairy Chess - Development Notes

## Build Commands (Local)
```bash
export PATH="/c/Program Files/nodejs:$PATH"

# Build everything
cd /c/claude/hyper_fairy_chess && npx pnpm run build

# Or individually
cd /c/claude/hyper_fairy_chess/packages/client && npx pnpm run build
cd /c/claude/hyper_fairy_chess/packages/server && npx pnpm run build
```

## Start/Stop (Local Development)
```bash
# Start both client and server
./start.bat  # Windows
./start.sh   # Unix

# Client: http://localhost:5173
# Server: http://localhost:3001
```

## Deployment (Railway)

### Current Status
- **Server**: https://hyper-fairy-chess-production.up.railway.app/
  - Health check: https://hyper-fairy-chess-production.up.railway.app/health
  - Stats: https://hyper-fairy-chess-production.up.railway.app/stats
- **Client**: NOT YET DEPLOYED

### Server Deployment Settings
- **Dockerfile Path**: `Dockerfile.server`
- **Root Directory**: (empty/default)
- No environment variables needed (CORS_ORIGIN defaults to *)

### Client Deployment (TODO)
1. Create new service in same Railway project
2. Set Dockerfile Path: `Dockerfile.client`
3. Set environment variable: `VITE_SERVER_URL=https://hyper-fairy-chess-production.up.railway.app`
4. Generate public domain

### Key Files for Deployment
- `Dockerfile.server` - Server build with esbuild bundling
- `Dockerfile.client` - Client build with Vite + serve
- `packages/server/build.js` - esbuild config (bundles shared package)

## Architecture
```
packages/
├── shared/   # Game logic + protocol types (bundled into server/client)
├── server/   # Node.js + Socket.io + Express
└── client/   # React + Vite
```

## GitHub
- Repo: https://github.com/liamiak1/hyper-fairy-chess
