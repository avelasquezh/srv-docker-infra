#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/arley2911/srv/docker/backups"
WORKDIR="${BACKUP_DIR}/tmp_${TIMESTAMP}"
PUBKEY="age13uq3vgr62jkpaw0uank5u0j86mw4serz98rfdruv2yus2x4rdfnqktr6ye"
RCLONE_REMOTE="gdrive:server-backups"
RETENTION_DAYS=14
LOG="/home/arley2911/srv/docker/scripts/backup.log"

exec >> "$LOG" 2>&1
echo "=== Backup iniciado: $(date) ==="

mkdir -p "$WORKDIR"

echo "-- Postgres --"
docker exec postgres pg_dump -U postgres autokore > "$WORKDIR/postgres_autokore.sql"
docker exec postgres pg_dump -U postgres lilop > "$WORKDIR/postgres_lilop.sql"

echo "-- Redis --"
docker exec redis redis-cli BGSAVE
sleep 5
docker cp redis:/data/dump.rdb "$WORKDIR/redis_dump.rdb"

echo "-- n8n --"
declare -A N8N_DIRS=(
  ["dev-qa"]="/home/arley2911/srv/docker/projects/dev-qa/n8n/data"
  ["lilop"]="/home/arley2911/srv/docker/projects/lilop/n8n/data"
  ["autokore-av"]="/home/arley2911/srv/docker/projects/autokore/n8n/n8nav/data"
  ["autokore-ds"]="/home/arley2911/srv/docker/projects/autokore/n8n/n8nds/data"
  ["autokore-gk"]="/home/arley2911/srv/docker/projects/autokore/n8n/n8ngk/data"
)
for name in "${!N8N_DIRS[@]}"; do
  tar -czf "$WORKDIR/n8n_${name}.tar.gz" -C "${N8N_DIRS[$name]}" .
done

echo "-- Comprimiendo y cifrando --"
ARCHIVE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"
tar -czf "$ARCHIVE" -C "$WORKDIR" .
rm -rf "$WORKDIR"
age -r "$PUBKEY" -o "${ARCHIVE}.age" "$ARCHIVE"
rm -f "$ARCHIVE"

echo "-- Subiendo a Google Drive --"
rclone copy "${ARCHIVE}.age" "$RCLONE_REMOTE" --quiet

echo "-- Rotando backups antiguos (>${RETENTION_DAYS}d) --"
find "$BACKUP_DIR" -name "backup_*.tar.gz.age" -mtime +${RETENTION_DAYS} -delete
rclone delete "$RCLONE_REMOTE" --min-age ${RETENTION_DAYS}d --quiet

echo "=== Backup completado: $(date) ==="
