/** Reads the phone's GPS once. Resolves { latitude, longitude, accuracy } or rejects with a friendly message. */
export function getPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Location is not supported on this device.')); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6), accuracy: Math.round(pos.coords.accuracy) }),
      (err) => {
        const msg = err.code === 1 ? 'Location permission denied. Allow location for this site to tag the shop.'
          : err.code === 2 ? 'Location unavailable. Try again outdoors.'
          : 'Location request timed out.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    )
  })
}
