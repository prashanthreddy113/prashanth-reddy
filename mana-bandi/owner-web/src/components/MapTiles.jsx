import { TileLayer } from 'react-leaflet'

/**
 * OpenStreetMap tiles. With VITE_OFFLINE_MAP=1 (the shared prototype build, whose host
 * blocks third-party images) no tiles are drawn and the map shows a plain grid instead;
 * circles, markers and lines still work.
 */
export const OFFLINE_MAP = import.meta.env.VITE_OFFLINE_MAP === '1'

export default function MapTiles() {
  if (OFFLINE_MAP) return null
  return <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
}
