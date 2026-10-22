# Verified TTP behavior

## Transport

The target DSP accepts Telnet connections on TCP port 23 and displays:

```text
Welcome to the Tesira Text Protocol Server...
```

The connection includes Telnet option negotiation. The backend must process negotiation bytes rather than treating the connection as plain text only.

Commands below are read-only and were verified against the physical DSP on October 21, 2026. Instance tags are case sensitive.

## Main volume

```text
Level5 get levels
+OK "value":[-6.000000 -6.000000 -6.000000 -6.000000 -6.000000 -6.000000]
```

The six channels were all at -6 dB at the time of testing. This is an observed state, not a startup default.

Channel index 0 was rejected:

```text
Level5 get level 0
-ERR INVALID_PARAMETER Index out of range:channelIndex min:1 max:6 received:0
```

Use channels 1–6. Do not assume that graphical ganging means this block accepts channel 0.

## Subwoofer volume

```text
Level4 get level 1
+OK "value":12.000000
```

The observed subwoofer level was +12 dB. This is not a prescribed setting.

## Writes: pending physical verification

The default main control adjusts six channels together. Editable mappings now allow other instance tags, channel counts, and individual channel control. Before implementation, verify the supported bulk-set syntax against Biamp's block reference or command calculator. Otherwise use serialized per-channel set commands with acknowledgment checks and readback.

The expected single-channel form is:

```text
Level4 set level 1 <dB>
Level5 set level <channel 1–6> <dB>
```

No write commands have been tested during this project's verification so far.

## Initial implementation

The backend now uses acknowledged per-channel writes and readback, tested against a simulator. Physical writes have since been reported working. It polls actual state every three seconds while the page is visible; subscriptions are deferred. Commands now share a persistent Telnet session with TCP_NODELAY. Operations are serialized. A timeout or disconnect discards the session; subsequent operations reconnect without replaying writes. This avoids repeated login/banner delays during a six-channel adjustment.

## Configurable mappings

Each dashboard group selects an instance tag, channel count from 1 to 32, and Gang mode. Channel counts address channels 1 through N; they do not create channels in the DSP. With Gang on, one slider sets all selected channels to the same value. Gang off requires an explicit channel and writes only that channel. This is dashboard linking, not DSP ganging; blocks requiring channel index 0 are not supported by this mode. Tags containing spaces are quoted.

Saving settings writes only the local settings file. State reads and volume writes are serialized with mapping changes. Each dashboard write includes its mapping identity, so an outdated page cannot send a write against a changed mapping.

## Backend requirements

- Read state before enabling volume controls.
- Never write cached values on startup or reconnect.
- Validate finite numeric values and configured limits on the server.
- Serialize commands and distinguish responses from subscription notifications.
- Read back levels after writes; surface partial failures affecting main channels.
- Show individual main values if channels differ rather than silently overwriting them.
- Disable controls while disconnected or state is unknown.
- If subscriptions are added later, recreate them after reconnection and verify behavior on hardware.
- Limit slider command frequency and avoid a backlog of stale volume requests.
- Confirm block limits before choosing final dashboard slider ranges.

## Manual test note

The curl tests used a fixed maximum duration. A timeout after successful TTP responses was expected and does not indicate a rejected DSP command.

## Reference

[Biamp Tesira Text Protocol](https://support.biamp.com/Tesira/Control/Tesira_Text_Protocol)
