'use strict';

// Municipality-level settings. Override with environment variables so the same
// build serves any urban local body (municipality or corporation) in Telangana.
const MUNICIPALITY_NAME = process.env.MUNICIPALITY_NAME || 'Sample Municipality';
const MUNICIPALITY_NAME_TE = process.env.MUNICIPALITY_NAME_TE || 'నమూనా పురపాలక సంఘం';
const CONSTITUENCY = process.env.CONSTITUENCY || 'Sample Assembly Constituency';
const HEAD_TITLE = process.env.HEAD_TITLE || 'Chairperson'; // "Mayor" for a corporation
const WARD_COUNT = clampInt(process.env.WARD_COUNT, 1, 200, 30);

// Wings of a Telangana urban local body that receive grievances.
const DEPARTMENTS = [
  { id: 'sanitation', en: 'Public Health & Sanitation', te: 'ప్రజారోగ్యం & పారిశుధ్యం' },
  { id: 'engineering', en: 'Engineering (Roads, Drains, Water)', te: 'ఇంజనీరింగ్ (రోడ్లు, డ్రైనేజీ, నీరు)' },
  { id: 'electrical', en: 'Street Lighting', te: 'వీధి దీపాలు' },
  { id: 'town_planning', en: 'Town Planning', te: 'పట్టణ ప్రణాళిక' },
  { id: 'revenue', en: 'Revenue (Taxes & Licences)', te: 'రెవెన్యూ (పన్నులు & లైసెన్సులు)' },
  { id: 'greenery', en: 'Greenery & Parks', te: 'హరిత & ఉద్యానవనాలు' },
  { id: 'administration', en: 'Administration & Certificates', te: 'పరిపాలన & ధృవపత్రాలు' },
];

// Complaint categories. slaHours are this app's default service targets (editable
// here), not statutory limits.
const CATEGORIES = [
  { id: 'garbage', dept: 'sanitation', sla: 24, en: 'Garbage not collected', te: 'చెత్త సేకరించలేదు' },
  { id: 'drain', dept: 'sanitation', sla: 48, en: 'Drain / sewage overflow', te: 'మురుగు కాలువ పొంగిపొర్లడం' },
  { id: 'toilet', dept: 'sanitation', sla: 24, en: 'Public toilet not clean', te: 'పబ్లిక్ టాయిలెట్ శుభ్రంగా లేదు' },
  { id: 'dead_animal', dept: 'sanitation', sla: 12, en: 'Dead animal removal', te: 'చనిపోయిన జంతువు తొలగింపు' },
  { id: 'mosquito', dept: 'sanitation', sla: 72, en: 'Mosquitoes / fogging needed', te: 'దోమలు / ఫాగింగ్ అవసరం' },
  { id: 'stray_dogs', dept: 'sanitation', sla: 72, en: 'Stray dogs / animals', te: 'వీధి కుక్కలు / జంతువులు' },
  { id: 'water_supply', dept: 'engineering', sla: 24, en: 'No / irregular water supply', te: 'నీటి సరఫరా లేదు / అనియమితం' },
  { id: 'water_leak', dept: 'engineering', sla: 48, en: 'Pipeline leakage', te: 'పైప్‌లైన్ లీకేజీ' },
  { id: 'road', dept: 'engineering', sla: 168, en: 'Pothole / damaged road', te: 'గుంతలు / దెబ్బతిన్న రోడ్డు' },
  { id: 'streetlight', dept: 'electrical', sla: 48, en: 'Streetlight not working', te: 'వీధి దీపం పనిచేయడం లేదు' },
  { id: 'encroachment', dept: 'town_planning', sla: 168, en: 'Encroachment on road / footpath', te: 'రోడ్డు / ఫుట్‌పాత్ ఆక్రమణ' },
  { id: 'illegal_building', dept: 'town_planning', sla: 168, en: 'Unauthorised construction', te: 'అనధికార నిర్మాణం' },
  { id: 'tree', dept: 'greenery', sla: 72, en: 'Tree fall / park upkeep / plantation', te: 'చెట్టు కూలడం / పార్కు నిర్వహణ' },
  { id: 'property_tax', dept: 'revenue', sla: 168, en: 'Property tax issue', te: 'ఆస్తి పన్ను సమస్య' },
  { id: 'trade_licence', dept: 'revenue', sla: 168, en: 'Trade licence', te: 'ట్రేడ్ లైసెన్స్' },
  { id: 'certificate', dept: 'administration', sla: 168, en: 'Birth / death certificate', te: 'జనన / మరణ ధృవపత్రం' },
  { id: 'other', dept: 'administration', sla: 168, en: 'Other', te: 'ఇతర' },
];

// Services a citizen can apply for online. slaDays are this app's default service
// targets for the Citizen Charter; the council should adopt its own. External services
// (building permission) are handled by state portals and only linked from here.
const SERVICES = [
  { id: 'water_connection', dept: 'engineering', slaDays: 15, en: 'New drinking water tap connection', te: 'కొత్త మంచినీటి నల్లా కనెక్షన్', docs: 'Property tax receipt, ID proof, house photo' },
  { id: 'new_assessment', dept: 'revenue', slaDays: 15, en: 'New property tax assessment', te: 'కొత్త ఆస్తి పన్ను అసెస్‌మెంట్', docs: 'Sale deed or title document, building plan, ID proof' },
  { id: 'mutation', dept: 'revenue', slaDays: 15, en: 'Property mutation (name transfer)', te: 'ఆస్తి మ్యుటేషన్ (పేరు మార్పు)', docs: 'Registered document, latest tax receipt, ID proof' },
  { id: 'trade_new', dept: 'revenue', slaDays: 7, en: 'New trade licence', te: 'కొత్త ట్రేడ్ లైసెన్స్', docs: 'Shop rent deed or ownership proof, ID proof, shop photo' },
  { id: 'trade_renew', dept: 'revenue', slaDays: 3, en: 'Trade licence renewal', te: 'ట్రేడ్ లైసెన్స్ పునరుద్ధరణ', docs: 'Previous licence number' },
  { id: 'birth_cert', dept: 'administration', slaDays: 3, en: 'Birth certificate copy', te: 'జనన ధృవపత్రం కాపీ', docs: 'Hospital discharge slip or registration number' },
  { id: 'death_cert', dept: 'administration', slaDays: 3, en: 'Death certificate copy', te: 'మరణ ధృవపత్రం కాపీ', docs: 'Registration number or hospital record' },
  { id: 'septic', dept: 'sanitation', slaDays: 2, en: 'Septic tank cleaning (cesspool vehicle)', te: 'సెప్టిక్ ట్యాంక్ శుభ్రపరచడం', docs: 'Address and preferred date' },
  { id: 'tree_permission', dept: 'greenery', slaDays: 7, en: 'Tree cutting / pruning permission', te: 'చెట్టు నరికివేత / కత్తిరింపు అనుమతి', docs: 'Photo of the tree, reason' },
  { id: 'vendor_id', dept: 'administration', slaDays: 15, en: 'Street vendor ID card', te: 'వీధి వ్యాపారి గుర్తింపు కార్డు', docs: 'Aadhaar, photo, vending location' },
  { id: 'building', dept: 'town_planning', slaDays: 21, external: 'https://tsbpass.telangana.gov.in', en: 'Building permission (through TS-bPASS)', te: 'భవన అనుమతి (TS-bPASS ద్వారా)', docs: 'Apply on the state TS-bPASS portal' },
];
const APP_STATUSES = ['received', 'verification', 'approved', 'issued', 'rejected'];
const APP_OPEN = ['received', 'verification', 'approved'];

// Development works (projects) tracked on the portal.
const WORK_TYPES = [
  { id: 'roads', en: 'Roads & footpaths', te: 'రోడ్లు & ఫుట్‌పాత్‌లు' },
  { id: 'drains', en: 'Storm-water drains', te: 'వరద నీటి కాలువలు' },
  { id: 'water', en: 'Water supply', te: 'నీటి సరఫరా' },
  { id: 'sanitation', en: 'Sanitation & waste', te: 'పారిశుధ్యం & వ్యర్థాలు' },
  { id: 'greenery', en: 'Parks & greenery', te: 'పార్కులు & హరితం' },
  { id: 'buildings', en: 'Markets, halls & crematoria', te: 'మార్కెట్లు, హాళ్లు & వైకుంఠధామాలు' },
  { id: 'lighting', en: 'Street lighting', te: 'వీధి దీపాలు' },
];
const WORK_STATUSES = ['proposed', 'sanctioned', 'tendered', 'in_progress', 'completed', 'stalled'];
const SCHEMES = ['General funds', 'Finance Commission grant', 'AMRUT 2.0', 'SBM-U 2.0', 'PMAY-U 2.0', 'State special development fund', 'TUFIDC', 'MLA/MP development fund'];

const COMMITTEE_TYPES = [
  { id: 'youth', en: 'Youth', te: 'యువత' },
  { id: 'women', en: 'Women', te: 'మహిళలు' },
  { id: 'senior', en: 'Senior citizens', te: 'వయోవృద్ధులు' },
  { id: 'eminent', en: 'Eminent citizens', te: 'ప్రముఖ పౌరులు' },
];

// KPI scorecard from the blueprint. "auto" KPIs are computed from app data;
// "manual" ones are entered monthly by the Commissioner's office.
const KPIS = [
  { id: 'complaints_on_time', en: 'Complaints resolved within deadline', te: 'గడువులో పరిష్కారమైన ఫిర్యాదులు', unit: '%', target: 90, source: 'auto' },
  { id: 'citizen_rating', en: 'Average citizen rating', te: 'పౌరుల సగటు రేటింగ్', unit: '/5', target: 4, source: 'auto' },
  { id: 'tax_collection', en: 'Property-tax collection (demand)', te: 'ఆస్తి పన్ను వసూలు', unit: '%', target: 85, source: 'auto' },
  { id: 'council_meetings', en: 'Council meetings held this year', te: 'ఈ ఏడాది కౌన్సిల్ సమావేశాలు', unit: '', target: 12, source: 'auto' },
  { id: 'door_to_door', en: 'Households with daily door-to-door collection', te: 'రోజువారీ ఇంటింటి చెత్త సేకరణ', unit: '%', target: 100, source: 'manual' },
  { id: 'segregation', en: 'Waste segregated at source', te: 'మూలం వద్ద చెత్త వేరుచేయడం', unit: '%', target: 80, source: 'manual' },
  { id: 'water_hours', en: 'Water supply hours a day (worst ward)', te: 'నీటి సరఫరా గంటలు (కనిష్ట వార్డు)', unit: 'h', target: 2, source: 'manual' },
  { id: 'streetlights', en: 'Streetlights working (night audit)', te: 'పనిచేస్తున్న వీధి దీపాలు', unit: '%', target: 98, source: 'manual' },
  { id: 'building_on_time', en: 'Building permissions decided in time', te: 'గడువులో భవన అనుమతులు', unit: '%', target: 100, source: 'manual' },
  { id: 'sapling_survival', en: 'Saplings surviving after one year', te: 'ఏడాది తర్వాత బతికిన మొక్కలు', unit: '%', target: 85, source: 'manual' },
];

const ROLES = ['citizen', 'chairperson', 'commissioner', 'officer', 'ward_officer'];
const STAFF_ROLES = ['chairperson', 'commissioner', 'officer', 'ward_officer'];
const LEADERSHIP = ['chairperson', 'commissioner'];

const STATUSES = ['submitted', 'assigned', 'in_progress', 'resolved', 'rejected', 'reopened'];
const OPEN_STATUSES = ['submitted', 'assigned', 'in_progress', 'reopened'];

function clampInt(v, min, max, dflt) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
}

const WARDS = Array.from({ length: WARD_COUNT }, (_, i) => i + 1);

// Public contact details shown on the portal. Override per town.
const CONTACT = {
  head: process.env.HEAD_NAME || `${HEAD_TITLE} (name to be updated)`,
  commissioner: process.env.COMMISSIONER_NAME || 'Municipal Commissioner (name to be updated)',
  helpline: process.env.HELPLINE || '1800-000-0000',
  whatsapp: process.env.WHATSAPP || '',
  email: process.env.CONTACT_EMAIL || 'municipality@example.org',
  address: process.env.OFFICE_ADDRESS || 'Municipal Office, Main Road',
  hours: process.env.OFFICE_HOURS || 'Mon–Sat, 10:30 am – 5:00 pm',
  prajaVani: process.env.PRAJA_VANI || 'Every Monday, 10:30 am – 1:30 pm, Council Hall',
};

module.exports = {
  MUNICIPALITY_NAME, MUNICIPALITY_NAME_TE, CONSTITUENCY, HEAD_TITLE, WARDS, CONTACT,
  DEPARTMENTS, CATEGORIES, ROLES, STAFF_ROLES, LEADERSHIP, STATUSES, OPEN_STATUSES,
  SERVICES, APP_STATUSES, APP_OPEN, WORK_TYPES, WORK_STATUSES, SCHEMES, COMMITTEE_TYPES, KPIS,
  categoryById: (id) => CATEGORIES.find((c) => c.id === id),
  departmentById: (id) => DEPARTMENTS.find((d) => d.id === id),
  serviceById: (id) => SERVICES.find((s) => s.id === id),
};
