# Unraid operations

Follow the [README quick start](../README.md#quick-start-on-unraid) for initial setup. The container needs outbound TCP access to the DSP on port 23 and an inbound published dashboard port. No host networking, USB mapping, or privileged mode is required.

Give the DSP a stable IP using a DHCP reservation or suitable static configuration. Keep `.env` on Unraid and out of Git.

## Updating a manually launched container

```bash
cd /mnt/user/appdata/tesira-web-control
git pull --ff-only
docker build -t tesira-web-control:local .
docker stop tesira-web-control
docker rm tesira-web-control
docker run -d --name tesira-web-control --restart unless-stopped \
  -p 8088:8088 --env-file .env \
  -v tesira-web-control-data:/data tesira-web-control:local
```

This recreates only this container. DSP levels remain on the DSP. Dashboard settings are saved in the named Docker volume `tesira-web-control-data`; keep the `-v` mapping when recreating the container. Back up this volume along with your other Unraid app data.

For Compose deployments, run `git pull --ff-only` followed by `docker compose up -d --build` instead.

## Configuration changes

After changing `.env`, recreate the container using the same launch method. For Compose, use `docker compose up -d --force-recreate`. Restarting an existing manually created container alone will not reload environment variables.

## Hardware acceptance checks

- Startup and restart leave levels unchanged.
- Main control updates the configured channels. Gang off exposes individual channel sliders.
- Sub control changes only the configured subwoofer block/channels.
- Tesira software changes appear within the next successful refresh.
- DSP loss disables controls; recovery reads current state without applying cached levels.
- Backend rejects invalid and out-of-range input.

The original volume controls and Docker deployment have been reported working on the target system. The new editable mappings, channel counts, and Gang mode need a hardware check after updating.

## Editable control settings

Open **Settings** in the dashboard. Each group has an instance tag, channel count (1–32), and Gang toggle. Counts select channels 1 through N; the DSP block must expose numbered channels. The Gang switch links dashboard writes and does not change DSP block ganging. Saving configuration does not alter DSP volume levels.

Settings are saved as `/data/settings.json` in Docker. The image initializes `/data` ownership, then runs the service as `PUID:PGID` (default 1000:1000; the Unraid template uses 99:100). A non-root Docker `--user` skips initialization and requires suitable directory permissions. Outside Docker, the default is `./data/settings.json`; `SETTINGS_FILE` overrides the path.

Existing installations retain the original defaults until settings are saved: main `Level5`, six channels, Gang on; sub `Level4`, one channel, Gang on.

## Community Applications packaging

See [publishing instructions](publishing.md) for the beta image and submission process. Container template fields now set initial Main and Subwoofer tags, channel counts, and Gang defaults. Saved dashboard settings override these defaults. DSP address and volume limits continue to use environment variables.
