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

### Live URLs
- **Client**: https://comfortable-harmony-production.up.railway.app/
- **Server**: https://hyper-fairy-chess-production.up.railway.app/
  - Health check: https://hyper-fairy-chess-production.up.railway.app/health
  - Stats: https://hyper-fairy-chess-production.up.railway.app/stats

### Server Deployment Settings
- **Dockerfile Path**: `Dockerfile.server`
- **Root Directory**: (empty/default)
- **Environment Variables**:
  - `CORS_ORIGIN=https://comfortable-harmony-production.up.railway.app`

### Client Deployment Settings
- **Dockerfile Path**: `Dockerfile.client`
- **Root Directory**: (empty/default)
- **Environment Variables**:
  - `VITE_SERVER_URL=https://hyper-fairy-chess-production.up.railway.app`

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

## IMPORTANT: Deployment Workflow
Railway deploys from GitHub, NOT from local files. Before deploying or when the user mentions deploying:

1. **Always check for uncommitted changes**: `git status`
2. **Commit and push** any changes before deploying
3. **Verify** the push succeeded before telling the user to redeploy

If changes work locally but not on Railway, the most likely cause is uncommitted/unpushed changes.
