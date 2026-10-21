# Unraid hosting plan

Deployment instructions will be finalized once the application is implemented and tested.

## Intended setup

- One Docker container running a lightweight Node.js backend and the dashboard.
- A configurable host port, initially proposed as 8088.
- Docker bridge networking with a published dashboard port.
- Outbound access from the container to the DSP on TCP port 23.
- Automatic restart unless manually stopped.
- Local configuration stored under an Unraid appdata directory.

The dashboard URL will have the form `http://<unraid-address>:<dashboard-port>`. A phone on the home Wi-Fi can open it and save a home-screen shortcut.

## DSP preparation

- Enable Telnet in Tesira network settings.
- Give the DSP a stable address using a DHCP reservation or a suitable static configuration.
- Confirm reachability from Unraid before starting the application.
- Confirm instance tags, channel numbers, and DSP level limits.

Telnet connectivity from the target Unraid server has already been verified.

## Configuration to support

- DSP host and port.
- Main block tag and channel list.
- Subwoofer block tag and channel.
- Independent minimum and maximum dashboard levels.
- Dashboard listen port.

Actual addresses belong in local configuration, not committed examples.

## Access

This initial design is for a trusted local network. Telnet is unencrypted. Do not publish either the DSP's Telnet port or an unauthenticated dashboard to the internet.

## Acceptance checks

1. Opening or restarting the dashboard does not change DSP levels.
2. Main adjustment updates all six intended channels.
3. Sub adjustment updates only the intended subwoofer control.
4. Changes in Tesira software appear on the dashboard.
5. Disconnecting the DSP disables controls and shows connection loss.
6. Reconnection reads current state without applying stale settings.
7. Invalid or out-of-range requests are rejected by the backend.
