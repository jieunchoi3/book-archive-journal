#!/usr/bin/env bash
# Deploy wishlist AI auto-fill to Supabase (uses existing GEMINI_API_KEY secret).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF, then rerun."
  echo "Example:"
  echo "  export SUPABASE_ACCESS_TOKEN=sbp_..."
  echo "  export SUPABASE_PROJECT_REF=your-project-ref"
  exit 1
fi

supabase functions deploy wishlist-enrich --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy compass-analyze --project-ref "$SUPABASE_PROJECT_REF"
echo "Done. Wishlist Auto-fill should work after a hard refresh."
