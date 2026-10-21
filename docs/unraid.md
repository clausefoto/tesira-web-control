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
  -p 8088:8088 --env-file .env tesira-web-control:local
```

This recreates only this container. DSP settings remain on the DSP; there is no app volume database to restore.

For Compose deployments, run `git pull --ff-only` followed by `docker compose up -d --build` instead.

## Configuration changes

After changing `.env`, recreate the container using the same launch method. For Compose, use `docker compose up -d --force-recreate`. Restarting an existing manually created container alone will not reload environment variables.

## Hardware acceptance checks

- Startup and restart leave levels unchanged.
- Main control updates all six intended channels.
- Sub control changes only the intended block.
- Tesira software changes appear within the next successful refresh.
- DSP loss disables controls; recovery reads current state without applying cached levels.
- Backend rejects invalid and out-of-range input.

The simulator tests pass, but these physical checks and a Docker build must be completed on the target server.
