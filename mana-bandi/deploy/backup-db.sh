#!/usr/bin/env bash
# Nightly backup of the database and uploaded documents to /var/backups/manabandi (keeps 14 days).
# Add to root's crontab:  15 2 * * * /opt/manabandi/mana-bandi/deploy/backup-db.sh
# Managed databases also keep their own daily backups; this is a second copy you control.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a
OUT=/var/backups/manabandi; mkdir -p "$OUT"; STAMP=$(date +%F-%H%M)
# Npgsql connection string → libpq URL for pg_dump
conn() { echo "$DATABASE_URL" | tr ';' '\n' | awk -F= -v k="$1" 'tolower($1)==tolower(k){print substr($0, index($0,"=")+1)}'; }
PGPASSWORD="$(conn Password)" docker run --rm -e PGPASSWORD --network host postgres:16 \
  pg_dump -h "$(conn Host)" -p "$(conn Port)" -U "$(conn Username)" -d "$(conn Database)" -Fc > "$OUT/db-$STAMP.dump"
docker run --rm -v deploy_files:/data -v "$OUT":/out alpine tar czf "/out/files-$STAMP.tgz" -C /data .
find "$OUT" -type f -mtime +14 -delete
echo "backup ok: $OUT/db-$STAMP.dump"
