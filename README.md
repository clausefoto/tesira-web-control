# Tesira Web Control

A mobile-friendly dashboard for main and subwoofer volume on a Biamp Tesira DSP. Runs as one Docker container on Unraid, with no runtime npm dependencies.

## Status

Initial implementation, tested against a simulated DSP. **Physical hardware writes and the Docker image still need validation on Unraid.** Read commands and connectivity were previously verified on the target DSP.

## Features

- Main slider sets `Level5` channels 1–6 equally.
- Subwoofer slider sets `Level4` channel 1 independently.
- Large dB readouts, sliders, and 0.5 dB adjustment buttons.
- Current levels read on connection; no startup/reconnect volume defaults.
- Actual values refreshed every three seconds while the page is visible.
- Configurable limits enforced by the backend.
- Readback after writes and clear errors for partial main updates.
- Controls disabled when disconnected or an operation is in progress.

Preset recall is planned for later.

## Quick start on Unraid

Run in the Unraid terminal:

```bash
mkdir -p /mnt/user/appdata/tesira-web-control
git clone https://github.com/clausefoto/tesira-web-control.git /mnt/user/appdata/tesira-web-control
cd /mnt/user/appdata/tesira-web-control
cp .env.example .env
nano .env
```

Replace `DSP_HOST=192.0.2.10` with your DSP's actual IP address. Review the volume limits, save, and exit. The example address is deliberately nonfunctional.

Build and launch, without needing the Compose plugin:

```bash
docker build -t tesira-web-control:local .
docker run -d --name tesira-web-control --restart unless-stopped \
  -p 8088:8088 --env-file .env tesira-web-control:local
```

Or, if Docker Compose is installed:

```bash
docker compose up -d --build
```

Use one launch method. Open `http://<unraid-address>:8088` on your phone on the home Wi-Fi. Save a home-screen shortcut if desired.

The plain `docker run` command always publishes port 8088; to change it, change its left-hand port number (for example `-p 8090:8088`). `WEB_PORT` in `.env` applies to Compose only.

## First hardware check

1. Open the dashboard and verify its readouts match Tesira. Opening it does not write any settings.
2. Make a small downward sub adjustment and verify it in Tesira.
3. Make a small downward main adjustment and verify all six channels.
4. Change a level in Tesira and confirm the dashboard follows.
5. Test DSP disconnection and recovery.

Main adjustments set all six channels to the same value. If channels differ, the dashboard lists them before adjustment. Main channel writes are sequential, not atomic: a failure can leave only some channels changed. The app stops on the first failure, shows an error, and reads actual levels on the next refresh. It never automatically rolls back or retries a volume write.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| DSP_HOST | documentation-only example address | DSP control-network IP |
| DSP_PORT | 23 | Telnet port |
| WEB_PORT | 8088 | Compose host port |
| PORT | 8088 | App listen port; leave at 8088 in Docker |
| MAIN_MIN_DB / MAIN_MAX_DB | -24 / 12 | Main slider limits |
| SUB_MIN_DB / SUB_MAX_DB | -100 / 12 | Sub slider limits |

Instance tags and main channel count are currently fixed to this DSP design. Match configured limits to the DSP block limits. Changing `.env` requires recreating the container. Actual addresses and credentials should remain in ignored local files.

## Development

Requires Node.js 22 or newer (Docker uses Node.js 24).

```bash
cp .env.example .env
# Edit DSP_HOST before connecting to hardware.
npm start
npm test
```

Tests cover Telnet negotiation and fragmented replies, read-only startup behavior, all six main writes, independent sub control, invalid input, partial failures, serialized operations, and timeouts.

## Architecture

Phone browser → Node.js HTTP server on Unraid → Tesira Telnet/TTP.

The backend serializes operations. Each command uses a short-lived Telnet session so a delayed reply cannot be mistaken for another command's acknowledgment. State uses periodic reads rather than subscriptions in this version. A main update uses six acknowledged per-channel commands followed by actual level reads.

## Access and troubleshooting

This version has no login and is intended for a trusted local network only. Do not forward the dashboard or DSP Telnet ports to the internet. Telnet traffic is unencrypted.

- Read logs: `docker logs --tail 100 tesira-web-control`
- Verify the DSP address and that Telnet is enabled.
- Check that the container can route to the DSP's control network on TCP port 23.
- A `channelIndex` error means the block/channel mapping is wrong.
- A level-limit error means the requested value is outside the DSP's limits.
- For a partial update, inspect all main channel values before retrying.

See [protocol verification](docs/protocol.md) and [Unraid operations](docs/unraid.md).

[Biamp Tesira Text Protocol reference](https://support.biamp.com/Tesira/Control/Tesira_Text_Protocol).

Independent project; not affiliated with Biamp.
