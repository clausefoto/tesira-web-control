# Tesira Web Control

A simple, mobile-friendly dashboard for controlling a Biamp Tesira DSP from a phone, hosted in Docker on Unraid.

## Status

Planning and protocol verification. The dashboard and Docker image have not been implemented yet.

Verified on the target system:
- Unraid can connect to the DSP's Tesira Text Protocol (TTP) server over Telnet.
- Main volume: `Level5`, six channels.
- Subwoofer volume: `Level4`, channel 1.
- Read-only queries successfully returned the current levels.

## First version

- Main volume slider controlling all six main channels together.
- Subwoofer volume slider.
- dB readouts and fine adjustment buttons.
- Connection status and automatic reconnection.
- Read current levels on connection; never apply startup volume defaults.
- Configurable minimum and maximum levels.
- Feedback when levels change through Tesira software.

Preset recall buttons are planned for a later version.

## Planned architecture

Phone browser → Node.js web server on Unraid → Tesira DSP over Telnet/TTP.

One Docker container will serve the dashboard and handle the DSP connection. No additional Raspberry Pi or Pi-hole is required. The phone, server, and DSP must have network access to one another.

The backend will handle Telnet negotiation, TTP response parsing, serialized commands, reconnection, and state updates to connected browsers. It must restore subscriptions after reconnecting.

## Documentation

- [Verified protocol notes](docs/protocol.md)
- [Unraid hosting plan](docs/unraid.md)

## Local configuration

The DSP address will be supplied through local configuration or environment variables. Actual network addresses and credentials should not be committed. The repository excludes `.env` and local configuration files.

## Next steps

1. Implement the TTP client and test against a simulated DSP.
2. Implement read-only connection and state feedback.
3. Add validated volume writes and the mobile interface.
4. Package and test on Unraid.
5. Verify operation against the physical DSP.

## References

- [Biamp Tesira Text Protocol](https://support.biamp.com/Tesira/Control/Tesira_Text_Protocol)

This is an independent project and is not affiliated with Biamp.
