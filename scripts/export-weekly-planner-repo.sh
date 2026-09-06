#!/usr/bin/env bash
# Export planner/ as a standalone git repo (for a separate GitHub + Vercel project).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/../weekly-planner}"

echo "Exporting planner to: $OUT"

rm -rf "$OUT"
mkdir -p "$OUT"

rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  "$ROOT/planner/" "$OUT/"

cd "$OUT"
if [[ ! -d .git ]]; then
  git init -b main
fi

git add -A
git status

cat <<'EOF'

Next steps:
1. Create empty GitHub repo: weekly-planner (github.com/new)
2. cd to the export folder above
3. git remote add origin https://github.com/jieunchoi3/weekly-planner.git
4. git commit -m "Initial Weekly Planner export"  # if needed
5. git push -u origin main

6. Vercel → Add New Project → Import weekly-planner repo
   - Root Directory: . (repo root — planner files are already at root)
   - Framework: Vite
   - Add env vars from planner/.env.example

7. Use ONLY the new URL for Dock / phone (one URL forever)
8. book-archive-journal Vercel project → Production Branch: main (Reading Archive only)

EOF
