#!/bin/sh
set -eu
# Initialize only the app's data directory, then drop privileges for the service.
if [ "$(id -u)" = "0" ]; then
  app_uid="${PUID:-1000}"
  app_gid="${PGID:-1000}"
  case "$app_uid" in ''|*[!0-9]*) echo 'PUID must be numeric' >&2; exit 1;; esac
  case "$app_gid" in ''|*[!0-9]*) echo 'PGID must be numeric' >&2; exit 1;; esac
  if [ "$app_uid" = "0" ] || [ "$app_gid" = "0" ]; then
    echo 'PUID and PGID must be non-root IDs' >&2; exit 1
  fi
  mkdir -p /data
  chown "$app_uid:$app_gid" /data
  for file in /data/settings.json /data/settings.json.tmp; do
    if [ -f "$file" ] && [ ! -L "$file" ]; then chown "$app_uid:$app_gid" "$file"; fi
  done
  exec su-exec "$app_uid:$app_gid" "$@"
fi
exec "$@"
