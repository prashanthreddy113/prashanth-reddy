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

module.exports = {
  MUNICIPALITY_NAME, MUNICIPALITY_NAME_TE, CONSTITUENCY, HEAD_TITLE, WARDS,
  DEPARTMENTS, CATEGORIES, ROLES, STAFF_ROLES, LEADERSHIP, STATUSES, OPEN_STATUSES,
  categoryById: (id) => CATEGORIES.find((c) => c.id === id),
  departmentById: (id) => DEPARTMENTS.find((d) => d.id === id),
};
