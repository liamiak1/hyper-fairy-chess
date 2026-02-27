  # Build commands for this project
  export PATH="/c/Program Files/nodejs:$PATH"
  cd /c/claude/hyper_fairy_chess/packages/client && npx pnpm run build
  cd /c/claude/hyper_fairy_chess/packages/server && npx pnpm run build