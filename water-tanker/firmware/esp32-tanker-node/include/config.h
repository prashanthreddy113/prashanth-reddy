#pragma once
// ---------- Identity (per unit; printed on the enclosure; issued by POST /api/fleet/devices) ----------
#define DEVICE_CODE      "AQ-DEMO-0001"
#define DEVICE_KEY       "demo-device-key-0001"
#define FIRMWARE_VERSION "0.1.0"

// ---------- Server ----------
#define API_HOST         "aquaproof-api.onrender.com"   // or your LAN IP while bench testing
#define API_PORT         443                            // 80 for plain HTTP on the bench
#define API_USE_TLS      1
#define API_PATH         "/api/telemetry"

// ---------- Cellular (SIM7600 via UART2) ----------
#define APN              "airtelgprs.com"               // Jio: "jionet", Vi: "www"
#define MODEM_RX_PIN     16
#define MODEM_TX_PIN     17
#define MODEM_PWRKEY_PIN 4

// ---------- GPS (NEO-6M/NEO-M8N via UART1; skip if the SIM7600's built-in GNSS is used) ----------
#define GPS_RX_PIN       26
#define GPS_TX_PIN       27

// ---------- Sensors ----------
#define FLOW_PIN         25      // hall-effect flow meter pulse output (open collector, 10k pull-up)
#define PULSES_PER_LITRE 4.8f    // K-factor for a DN50 YF-DN50 style meter; calibrate per unit with a known volume
#define TDS_PIN          34      // analog TDS probe board (0-2.3 V)
#define TURBIDITY_PIN    35      // analog turbidity sensor (SEN0189 style)
#define WATER_TEMP_PIN   33      // optional DS18B20 (temperature compensation for TDS)
#define TAMPER_PIN       32      // reed / micro-switch on the sealed lid, LOW when the lid is opened
#define BATTERY_PIN      36      // battery divider (2:1)

// ---------- Behaviour ----------
#define FLOW_START_LPM        5.0f   // above this the pump is on
#define SAMPLE_MS_PUMPING     5000   // one sample every 5 s while pumping
#define SAMPLE_MS_IDLE        60000  // heartbeat once a minute when idle
#define BATCH_MAX_SAMPLES     12     // upload after this many samples (~1 min while pumping)
#define FLOW_STOP_SECONDS     90     // no flow for this long => delivery ended
#define QUEUE_MAX_SAMPLES     360    // RAM buffer while there is no signal (~30 min pumping)
