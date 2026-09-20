import L from 'leaflet'

/** Leaflet divIcons so we do not need the default marker PNGs (they break under Vite). */
export const captainIcon = (vehicleType) => L.divIcon({
  className: '',
  html: `<div class="cap-marker cap-${vehicleType}">${vehicleType === 'auto' ? '🛺' : '🏍️'}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -14],
})

export const centreIcon = L.divIcon({
  className: '',
  html: '<div class="centre-marker">మ</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

export const landmarkIcon = (emoji) => L.divIcon({
  className: '',
  html: `<div class="lm-marker">${emoji}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -12],
})

export const pointIcon = (kind) => L.divIcon({
  className: '',
  html: `<div class="pt-marker pt-${kind}"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})
