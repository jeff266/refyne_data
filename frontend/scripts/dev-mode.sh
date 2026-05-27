#!/bin/bash
# Toggle between dev (no auth) and prod (with auth) middleware

if [ "$1" == "on" ]; then
  echo "🔓 Enabling dev mode (no auth)..."
  cp middleware.ts middleware.prod.ts
  cp middleware.dev.ts middleware.ts
  echo "✅ Dev mode enabled. Run: npm run dev"
elif [ "$1" == "off" ]; then
  echo "🔐 Disabling dev mode (restoring auth)..."
  cp middleware.prod.ts middleware.ts
  echo "✅ Production middleware restored"
else
  echo "Usage: ./scripts/dev-mode.sh [on|off]"
  echo ""
  echo "  on  - Disable Clerk auth for local development"
  echo "  off - Restore Clerk auth (for production deployment)"
fi
