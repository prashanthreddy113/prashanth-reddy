# ESP32 tanker node firmware

Sealed unit clamped on the tanker outlet: **hall-effect flow meter + TDS probe + turbidity sensor + GPS + SIM7600 4G**, driven by an ESP32 (PlatformIO / Arduino).

## Bill of materials (per unit, approx.)

| Part | Example | ₹ |
| --- | --- | --- |
| ESP32 DevKit | ESP32-WROOM-32 | 350 |
| 4G module | SIM7600EI (India bands) breakout | 1,900 |
| Flow meter | DN50 hall-effect (YF-DN50 type) or DN65 with flange | 1,200–1,800 |
| TDS probe + board | Gravity analog TDS | 450 |
| Turbidity sensor | SEN0189 type | 350 |
| GPS | NEO-6M (or use the SIM7600's GNSS) | 250 |
| Power | 12 V → 5 V 3 A buck, 18650 backup, fuse | 400 |
| Enclosure | IP67 box, cable glands, tamper switch, serialised seal | 500 |
| **Total** | | **≈ ₹5,400–6,000** |

## How it works

1. Pulses from the flow meter are counted in an ISR (`pulseCount` is a cumulative counter since boot).
2. Every 2 s the loop computes litres/min. Above `FLOW_START_LPM` a **session** starts (`sessionKey = code-boot-seq`) and the node posts `event: "start"`.
3. While pumping it samples every 5 s (flow, cumulative litres, TDS, NTU, GPS fix, battery, signal, tamper) and uploads batches of 12.
4. When no flow for 90 s it posts `event: "end"`; the server finalises the delivery (litres, quality grade, geofence match, price).
5. Idle: one heartbeat a minute so the fleet page shows the unit as online and where the tanker is.

If there is no signal, samples queue in RAM (30 min of pumping) and are retried with the same `sessionKey`, so retries never double-count.

## Set-up

1. Register the device from the operator app (Fleet → Devices → Register). Copy the one-time key.
2. Put the code and key in `include/config.h`, set the APN and API host.
3. `pio run -t upload`, then `pio device monitor`.
4. Calibrate: pump a known volume (e.g. a 200 L drum) and adjust `PULSES_PER_LITRE` (the server also stores this per device).

`GET /api/telemetry/whoami` with the two headers confirms the credentials.
