#!/usr/bin/env node
// Simulates a tanker node so you can test the whole flow without hardware.
// Usage: node simulate-device.mjs [--api http://localhost:5090] [--code AQ-DEMO-0001] [--key demo-device-key-0001]
//        [--lat 17.4088 --lng 78.3775] [--litres 9800] [--tds 640] [--ntu 0.9] [--minutes 2] [--fast]
// Posts start → readings → end exactly like the firmware. With --fast the whole delivery takes ~10 seconds.

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? 'true' : arr[i + 1]])
  return acc
}, []))

const api = (args.api || 'http://localhost:5090').replace(/\/+$/, '')
const code = args.code || 'AQ-DEMO-0001'
const key = args.key || 'demo-device-key-0001'
const lat = parseFloat(args.lat ?? 17.4088), lng = parseFloat(args.lng ?? 78.3775)
const target = parseFloat(args.litres ?? 9800)
const tds = parseFloat(args.tds ?? 640), ntu = parseFloat(args.ntu ?? 0.9)
const minutes = parseFloat(args.minutes ?? 2)
const fast = args.fast === 'true'

const headers = { 'Content-Type': 'application/json', 'X-Device-Id': code, 'X-Device-Key': key }
let cumulative = 120000 + Math.round(Math.random() * 1000)
const sessionKey = `${code}-${Date.now().toString(36)}`

async function post(event, readings) {
  const res = await fetch(`${api}/api/telemetry`, { method: 'POST', headers, body: JSON.stringify({ sessionKey, event, firmware: 'sim-0.1', readings }) })
  const text = await res.text()
  console.log(`${event.padEnd(9)} ${res.status} ${text}`)
  if (!res.ok) process.exit(1)
}

function sample(flowLpm, t) {
  return {
    t: t.toISOString(), flowLpm: +flowLpm.toFixed(1), litres: +cumulative.toFixed(1),
    tds: Math.round(tds + (Math.random() - 0.5) * 30), ntu: +(ntu + (Math.random() - 0.5) * 0.2).toFixed(2), tempC: 28,
    lat: lat + (Math.random() - 0.5) * 0.0004, lng: lng + (Math.random() - 0.5) * 0.0004, batt: 4.02, csq: 18, tamper: false,
  }
}

const who = await fetch(`${api}/api/telemetry/whoami`, { headers })
console.log('whoami   ', who.status, await who.text())

const steps = 24
const stepMs = fast ? 400 : (minutes * 60000) / steps
const peak = target / minutes * 1.25 // L/min
const start = new Date(Date.now() - (fast ? minutes * 60000 : 0))

await post('start', [sample(peak * 0.6, start)])
let batch = []
for (let i = 1; i <= steps; i++) {
  const frac = i / steps
  const flow = i === steps ? 0 : peak * (0.75 + 0.25 * Math.sin(frac * Math.PI))
  cumulative += target / steps
  batch.push(sample(flow, new Date(start.getTime() + minutes * 60000 * frac)))
  if (batch.length === 6 || i === steps) { await post(i === steps ? 'end' : 'reading', batch); batch = [] }
  await new Promise((r) => setTimeout(r, stepMs))
}
console.log(`Delivered ~${target} L as session ${sessionKey}. Open the operator or RWA app to see it.`)
