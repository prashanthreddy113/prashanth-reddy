export const company = {
  legalName: 'Mana Bandi Mobility Private Limited',
  brand: 'Mana Bandi · మన బండి',
  gstin: '36ABCDE1234F1Z5',
  address: 'Shop 4, Bus stand road, Narayanakhed, Sangareddy 502286, Telangana',
  supportEmail: 'help@manabandi.in',
  supportPhone: '+91 94940 11000',
  whatsappNumber: '+91 94940 11000',
  commissionPct: 10,
  freeMonths: 3,
  incentiveTripsPerDay: 8,
  incentiveAmount: 100,
  offerWindowSec: 15,
  dispatchRounds: 3,
  dispatchRadiusKm: 3,
}

export const terms = {
  currentVersion: '1.2',
  publishedAt: '2026-08-10',
  versions: [
    { version: '1.0', publishedAt: '2026-06-28', by: 'Prashanth Reddy' },
    { version: '1.1', publishedAt: '2026-07-20', by: 'Prashanth Reddy' },
    { version: '1.2', publishedAt: '2026-08-10', by: 'Prashanth Reddy' },
  ],
  te: 'మన బండి సేవలను ఉపయోగించే ముందు ఈ నియమాలను చదవండి. ప్రయాణ ఛార్జీ బుకింగ్‌కు ముందు చూపబడుతుంది. రాత్రి 10 నుండి ఉదయం 5 వరకు 20% రాత్రి ఛార్జి వర్తిస్తుంది. నగదు లేదా UPI ద్వారా చెల్లించవచ్చు. పార్సెల్ డెలివరీకి OTP తప్పనిసరి.',
  en: 'Read these terms before using Mana Bandi. The fare is shown before booking. A 20% night charge applies between 10 pm and 5 am. Pay by cash or UPI. Parcel delivery requires the receiver OTP. Captains are independent partners; Mana Bandi provides the platform and a support desk in each town.',
}

export const templates = [
  { id: 'tpl_1', channel: 'sms', key: 'captain_assigned', langs: ['te', 'en', 'hi'], status: 'approved', te: 'మీ బండి వస్తోంది: {captain} · {vehicle_no} · 📞 {phone}. OTP {otp}', en: 'Your bandi is coming: {captain} · {vehicle_no} · call {phone}. OTP {otp}' },
  { id: 'tpl_2', channel: 'whatsapp', key: 'ride_receipt', langs: ['te', 'en'], status: 'approved', te: 'ప్రయాణం పూర్తయింది. ఛార్జీ ₹{fare}. ధన్యవాదాలు 🙏', en: 'Trip finished. Fare ₹{fare}. Thank you for riding with Mana Bandi.' },
  { id: 'tpl_3', channel: 'whatsapp', key: 'parcel_tracking', langs: ['te', 'en', 'kn'], status: 'approved', te: '{sender} మీకు పార్సెల్ పంపారు. ట్రాక్ చేయండి: {link} · OTP {otp}', en: '{sender} sent you a parcel. Track: {link} · delivery OTP {otp}' },
  { id: 'tpl_4', channel: 'sms', key: 'otp_login', langs: ['te', 'en', 'hi', 'kn', 'mr', 'ur'], status: 'approved', te: 'మన బండి OTP: {otp}', en: 'Mana Bandi OTP: {otp}' },
  { id: 'tpl_5', channel: 'whatsapp', key: 'captain_settlement', langs: ['te'], status: 'pending_review', te: 'ఈ వారం సెటిల్మెంట్: UPI ₹{upi}, నగదు ₹{cash}, చెల్లింపు ₹{payout}', en: 'This week: UPI ₹{upi}, cash ₹{cash}, payout ₹{payout}' },
  { id: 'tpl_6', channel: 'sms', key: 'sos_trusted_contact', langs: ['te', 'en'], status: 'approved', te: '{name} SOS నొక్కారు. లొకేషన్: {link}', en: '{name} pressed SOS in Mana Bandi. Location: {link}' },
]

export const users = [
  { id: 'usr_1', name: 'Prashanth Reddy', email: 'owner@manabandi.in', role: 'owner', townId: null, lastLogin: '2026-09-20T08:10:00' },
  { id: 'usr_2', name: 'Swapna', email: 'nkd@manabandi.in', role: 'town_manager', townId: 'nkd', lastLogin: '2026-09-20T07:42:00' },
  { id: 'usr_3', name: 'Mohammed Arif', email: 'zhb@manabandi.in', role: 'town_manager', townId: 'zhb', lastLogin: '2026-09-19T21:05:00' },
]

export const auditLog = [
  { id: 'aud_1', at: '2026-09-20T09:12:00', by: 'Swapna', action: 'captain.approve', target: 'cap_0031', detail: 'All checks passed (score 94)' },
  { id: 'aud_2', at: '2026-09-20T08:40:00', by: 'Prashanth Reddy', action: 'town.radius', target: 'nkd', detail: 'Service radius 10 → 12 km' },
  { id: 'aud_3', at: '2026-09-19T19:05:00', by: 'Mohammed Arif', action: 'settlement.paid', target: 'cap_0009', detail: 'UTR 4521 · ₹1,300' },
  { id: 'aud_4', at: '2026-09-19T11:30:00', by: 'Prashanth Reddy', action: 'terms.publish', target: 'v1.2', detail: 'Telugu + English' },
  { id: 'aud_5', at: '2026-09-18T16:22:00', by: 'Swapna', action: 'captain.block', target: 'cap_0010', detail: 'Rider complaint — overcharging' },
  { id: 'aud_6', at: '2026-09-18T10:02:00', by: 'Prashanth Reddy', action: 'landmark.add', target: 'zhb', detail: 'Bidar road junction' },
  { id: 'aud_7', at: '2026-09-17T09:15:00', by: 'Mohammed Arif', action: 'captain.reupload', target: 'cap_0018', detail: 'RC image unreadable' },
]

export const sosEvents = [
  { id: 'sos_1', at: new Date(Date.now() - 22 * 60000).toISOString(), rideId: 'ride_0910', townId: 'nkd', by: 'rider', resolved: false },
  { id: 'sos_2', at: new Date(Date.now() - 26 * 3600000).toISOString(), rideId: 'ride_0644', townId: 'zhb', by: 'captain', resolved: true },
]
