#!/usr/bin/env bash
# Restore drill: restores the latest prod backup (or a PITR target) into a throwaway Postgres on the staging host,
# runs integrity checks and prints RTO. Never points at the production data directory.
#   TARGET_TIME="2026-09-16 14:30:00+04" ./restore-drill.sh   # PITR
set -euo pipefail
STANZA=${STANZA:-lokacia}
DRILL_DIR=${DRILL_DIR:-/srv/restore-drill/pgdata}
PORT=${DRILL_PORT:-55432}
IMAGE=${PG_IMAGE:-postgis/postgis:16-3.5}
started=$(date +%s)

echo "[drill] $(date -Is) restoring stanza=$STANZA into $DRILL_DIR"
docker rm -f lokacia-restore-drill >/dev/null 2>&1 || true
sudo rm -rf "$DRILL_DIR" && sudo mkdir -p "$DRILL_DIR"

restore_args=(--stanza="$STANZA" --pg1-path="$DRILL_DIR" --delta --archive-mode=off)
if [[ -n "${TARGET_TIME:-}" ]]; then
  restore_args+=(--type=time "--target=$TARGET_TIME" --target-action=promote)
fi
sudo -E pgbackrest restore "${restore_args[@]}"
sudo chown -R 999:999 "$DRILL_DIR"

docker run -d --name lokacia-restore-drill -p "127.0.0.1:$PORT:5432" \
  -v "$DRILL_DIR:/var/lib/postgresql/data" "$IMAGE" \
  postgres -c archive_mode=off -c search_path='public, extensions' >/dev/null

for _ in $(seq 1 120); do
  docker exec lokacia-restore-drill pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done

q() { docker exec lokacia-restore-drill psql -U postgres -d lokacia -Atc "$1"; }
echo "[drill] recovery finished: $(q "select not pg_is_in_recovery()")"
echo "[drill] migrations applied: $(q "select count(*) from drizzle.__drizzle_migrations" 2>/dev/null || echo n/a)"
echo "[drill] listings: $(q "select count(*) from listings where deleted_at is null")"
echo "[drill] users: $(q "select count(*) from users")"
echo "[drill] latest listing update: $(q "select max(updated_at) from listings")"
echo "[drill] postgis: $(q "select extensions.postgis_version()")"
q "select count(*) from listings where geom is null and lat is not null" | grep -qx 0 && echo "[drill] geography columns OK"

echo "[drill] RTO: $(( $(date +%s) - started )) s"
docker rm -f lokacia-restore-drill >/dev/null
echo "[drill] done — record the result in docs/OPERATIONS.md → Restore drill log"
