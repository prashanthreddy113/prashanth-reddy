// AquaProof tanker node firmware
// ------------------------------
// Counts flow-meter pulses, samples TDS/turbidity/GPS, detects pumping sessions and posts them
// to the AquaProof API over 4G. The server turns "start / reading / end" batches into a verified delivery.
//
// Wiring: see include/config.h. Power: 12 V tanker battery -> buck 5 V -> ESP32 + SIM7600 (needs 2 A bursts).

#include <Arduino.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include "config.h"

// ---------- Hardware ----------
HardwareSerial gpsSerial(1);
HardwareSerial modemSerial(2);
TinyGsm modem(modemSerial);
#if API_USE_TLS
TinyGsmClientSecure netClient(modem);
#else
TinyGsmClient netClient(modem);
#endif
HttpClient http(netClient, API_HOST, API_PORT);
TinyGPSPlus gps;

// ---------- Flow counting (ISR) ----------
volatile uint32_t pulseCount = 0;      // total since boot (cumulative counter the server diffs)
volatile uint32_t pulseWindow = 0;     // pulses in the current sampling window
void IRAM_ATTR onPulse() { pulseCount++; pulseWindow++; }

// ---------- Session state ----------
struct Sample {
  uint32_t epoch; float flowLpm; float litres; float tds; float ntu; float tempC;
  double lat; double lng; bool fix; float batt; int csq; bool tamper;
};
static Sample queueBuf[QUEUE_MAX_SAMPLES];
static int queueLen = 0;

static bool pumping = false;
static uint32_t lastFlowMs = 0;
static uint32_t lastSampleMs = 0;
static uint32_t lastWindowMs = 0;
static uint32_t bootId = 0;
static uint32_t sessionNo = 0;
static char sessionKey[48] = "";
static const char* pendingEvent = "heartbeat";

// ---------- Sensors ----------
static float readTds(float tempC) {
  // Typical analog TDS board: V = raw * 3.3 / 4095, TDS(ppm) = (133.42 V^3 - 255.86 V^2 + 857.39 V) * 0.5, temp-compensated.
  long acc = 0; for (int i = 0; i < 16; i++) { acc += analogRead(TDS_PIN); delayMicroseconds(200); }
  float v = (acc / 16.0f) * 3.3f / 4095.0f;
  float comp = 1.0f + 0.02f * (tempC - 25.0f);
  float vc = v / comp;
  float tds = (133.42f * vc * vc * vc - 255.86f * vc * vc + 857.39f * vc) * 0.5f;
  return tds < 0 ? 0 : tds;
}

static float readTurbidity() {
  // SEN0189 style: ~4.1 V in clear water falling as turbidity rises. Divider brings 5 V range to 3.3 V.
  long acc = 0; for (int i = 0; i < 16; i++) { acc += analogRead(TURBIDITY_PIN); delayMicroseconds(200); }
  float v = (acc / 16.0f) * 3.3f / 4095.0f * (5.0f / 3.3f);
  float ntu = -1120.4f * v * v + 5742.3f * v - 4352.9f;   // datasheet curve
  if (v > 4.15f) ntu = 0;
  return ntu < 0 ? 0 : ntu;
}

static float readBattery() {
  return analogRead(BATTERY_PIN) * 3.3f / 4095.0f * 2.0f;
}

static uint32_t nowEpoch() {
  if (gps.date.isValid() && gps.time.isValid()) {
    struct tm t = {};
    t.tm_year = gps.date.year() - 1900; t.tm_mon = gps.date.month() - 1; t.tm_mday = gps.date.day();
    t.tm_hour = gps.time.hour(); t.tm_min = gps.time.minute(); t.tm_sec = gps.time.second();
    return (uint32_t)mktime(&t);
  }
  int y, mo, d, h, mi, s; float tz;
  if (modem.getNetworkTime(&y, &mo, &d, &h, &mi, &s, &tz)) {
    struct tm t = {}; t.tm_year = y - 1900; t.tm_mon = mo - 1; t.tm_mday = d; t.tm_hour = h; t.tm_min = mi; t.tm_sec = s;
    return (uint32_t)mktime(&t) - (uint32_t)(tz * 3600);
  }
  return 0; // server fills in receive time
}

static void feedGps() { while (gpsSerial.available()) gps.encode(gpsSerial.read()); }

// ---------- Network ----------
static bool ensureNetwork() {
  if (modem.isGprsConnected()) return true;
  Serial.println("[net] connecting...");
  if (!modem.isNetworkConnected() && !modem.waitForNetwork(60000L)) return false;
  return modem.gprsConnect(APN, "", "");
}

static bool upload(const char* event) {
  if (!ensureNetwork()) return false;

  JsonDocument doc;
  doc["sessionKey"] = sessionKey[0] ? sessionKey : nullptr;
  doc["event"] = event;
  doc["firmware"] = FIRMWARE_VERSION;
  JsonArray arr = doc["readings"].to<JsonArray>();
  for (int i = 0; i < queueLen; i++) {
    const Sample& s = queueBuf[i];
    JsonObject o = arr.add<JsonObject>();
    if (s.epoch) { char iso[25]; time_t t = s.epoch; strftime(iso, sizeof iso, "%Y-%m-%dT%H:%M:%SZ", gmtime(&t)); o["t"] = iso; }
    o["flowLpm"] = s.flowLpm; o["litres"] = s.litres; o["tds"] = s.tds; o["ntu"] = s.ntu; o["tempC"] = s.tempC;
    if (s.fix) { o["lat"] = s.lat; o["lng"] = s.lng; }
    o["batt"] = s.batt; o["csq"] = s.csq; o["tamper"] = s.tamper;
  }
  String body; serializeJson(doc, body);

  http.setTimeout(15000);
  http.beginRequest();
  http.post(API_PATH);
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("Content-Length", body.length());
  http.sendHeader("X-Device-Id", DEVICE_CODE);
  http.sendHeader("X-Device-Key", DEVICE_KEY);
  http.beginBody();
  http.print(body);
  http.endRequest();
  int status = http.responseStatusCode();
  String resp = http.responseBody();
  Serial.printf("[net] POST %s -> %d %s\n", event, status, resp.c_str());
  if (status >= 200 && status < 300) { queueLen = 0; return true; }
  return false;
}

// ---------- Sampling ----------
static void takeSample(float flowLpm) {
  feedGps();
  float tempC = 27.0f;   // replace with DS18B20 read when fitted
  Sample& s = queueBuf[queueLen < QUEUE_MAX_SAMPLES ? queueLen : QUEUE_MAX_SAMPLES - 1];
  s.epoch = nowEpoch();
  s.flowLpm = flowLpm;
  noInterrupts(); uint32_t total = pulseCount; interrupts();
  s.litres = total / PULSES_PER_LITRE;
  s.tds = readTds(tempC);
  s.ntu = readTurbidity();
  s.tempC = tempC;
  s.fix = gps.location.isValid() && gps.location.age() < 10000;
  s.lat = s.fix ? gps.location.lat() : 0; s.lng = s.fix ? gps.location.lng() : 0;
  s.batt = readBattery();
  s.csq = modem.getSignalQuality();
  s.tamper = digitalRead(TAMPER_PIN) == LOW;
  if (queueLen < QUEUE_MAX_SAMPLES) queueLen++;   // if the buffer is full the last slot is overwritten (keeps the newest)
}

static void startSession() {
  sessionNo++;
  snprintf(sessionKey, sizeof sessionKey, "%s-%lu-%lu", DEVICE_CODE, (unsigned long)bootId, (unsigned long)sessionNo);
  pumping = true;
  pendingEvent = "start";
  Serial.printf("[flow] session %s started\n", sessionKey);
}

static void endSession() {
  pumping = false;
  Serial.printf("[flow] session %s ended\n", sessionKey);
  takeSample(0);
  upload("end");
  sessionKey[0] = 0;
  pendingEvent = "heartbeat";
}

void setup() {
  Serial.begin(115200);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  pinMode(TAMPER_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onPulse, FALLING);
  analogReadResolution(12);

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  modemSerial.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  pinMode(MODEM_PWRKEY_PIN, OUTPUT);
  digitalWrite(MODEM_PWRKEY_PIN, LOW); delay(1000); digitalWrite(MODEM_PWRKEY_PIN, HIGH); delay(5000);
  Serial.println("[modem] init");
  modem.restart();
  Serial.printf("[modem] %s\n", modem.getModemInfo().c_str());
#if API_USE_TLS
  netClient.setInsecure();   // pin the server certificate for production
#endif
  bootId = esp_random() & 0xFFFFFF;
  lastWindowMs = millis();
  ensureNetwork();
}

void loop() {
  feedGps();
  uint32_t now = millis();

  // Flow rate over the last window.
  uint32_t windowMs = now - lastWindowMs;
  if (windowMs >= 2000) {
    noInterrupts(); uint32_t p = pulseWindow; pulseWindow = 0; interrupts();
    lastWindowMs = now;
    float lpm = (p / PULSES_PER_LITRE) * (60000.0f / windowMs);
    if (lpm >= FLOW_START_LPM) {
      lastFlowMs = now;
      if (!pumping) startSession();
    } else if (pumping && now - lastFlowMs > FLOW_STOP_SECONDS * 1000UL) {
      endSession();
      return;
    }

    uint32_t interval = pumping ? SAMPLE_MS_PUMPING : SAMPLE_MS_IDLE;
    if (now - lastSampleMs >= interval) {
      lastSampleMs = now;
      takeSample(lpm);
      bool flush = queueLen >= BATCH_MAX_SAMPLES || !pumping || strcmp(pendingEvent, "start") == 0;
      if (flush) {
        upload(pendingEvent);
        pendingEvent = pumping ? "reading" : "heartbeat";
      }
    }
  }
  delay(20);
}
