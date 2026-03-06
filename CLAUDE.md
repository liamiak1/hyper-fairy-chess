# Hyper Fairy Chess - Development Notes

## Build Commands (Local)
```bash
# IMPORTANT: Must set PATH first on Windows (node/npm/pnpm not in default PATH)
export PATH="/c/Program Files/nodejs:$PATH"

# Build all packages (shared, client, server) - use -r for recursive workspace build
cd /c/claude/hyper_fairy_chess && npx pnpm -r run build

# Single command (can copy-paste directly):
export PATH="/c/Program Files/nodejs:$PATH" && cd /c/claude/hyper_fairy_chess && npx pnpm -r run build
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

## Unit Testing

### IMPORTANT: Always Write Tests
When adding new features or utilities, **always include unit tests**:

1. **Shared package** (`packages/shared/`): Game logic, rules, utilities
   - Test file location: Same directory as source, with `.test.ts` suffix
   - Example: `src/game/rules/draft.ts` → `src/game/rules/draft.test.ts`

2. **Client package** (`packages/client/`): React components, hooks, utilities
   - Test file location: Same directory as source, with `.test.ts` suffix
   - Example: `src/utils/sessionStorage.ts` → `src/utils/sessionStorage.test.ts`
   - Uses jsdom environment for browser APIs (localStorage, etc.)

### Test Commands
```bash
# Run all tests across all packages
npx pnpm -r run test

# Run tests in watch mode (for development)
cd packages/shared && npx vitest
cd packages/client && npx vitest

# Run tests for a specific package
cd packages/shared && npx vitest run
cd packages/client && npx vitest run
```

### Test Guidelines
- **Pure functions**: Always test - easy to test, high value
- **Utility modules**: Always test - reusable code needs reliability
- **Game logic**: Always test - core rules must be correct
- **State management**: Test critical state transitions
- **Edge cases**: Test boundary conditions, null/undefined, expiry times

### Current Test Coverage
| Package | Test File | Tests |
|---------|-----------|-------|
| shared | `draft.test.ts` | 36 |
| shared | `boardUtils.test.ts` | 45 |
| shared | `types.test.ts` | 13 |
| client | `sessionStorage.test.ts` | 21 |
| **Total** | | **115** |

## GitHub
- Repo: https://github.com/liamiak1/hyper-fairy-chess

## IMPORTANT: Deployment Workflow
Railway deploys from GitHub, NOT from local files. Before deploying or when the user mentions deploying:

1. **Always check for uncommitted changes**: `git status`
2. **Commit and push** any changes before deploying
3. **Verify** the push succeeded before telling the user to redeploy

If changes work locally but not on Railway, the most likely cause is uncommitted/unpushed changes.
