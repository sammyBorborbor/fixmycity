import { GEO } from './store.tsx';
import type { LocationName } from './store.tsx';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/* Great-circle distance between two lat/lng points, in kilometres. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/* Nearest of the 8 known AWMA neighbourhoods to a point, by straight-line
   distance to each area's centroid (GEO). Pure client-side math, no network
   call — this is why milestone 6's design doesn't need Nominatim just to
   pick which of the 8 fixed dropdown values to auto-select. */
export function nearestLocation(lat: number, lng: number): LocationName {
  let best: LocationName = 'Okponglo';
  let bestDist = Infinity;
  (Object.keys(GEO) as LocationName[]).forEach(name => {
    const g = GEO[name];
    const dist = haversineKm(lat, lng, g.lat, g.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  });
  return best;
}

/* Reverse-geocode via Nominatim (OpenStreetMap's free geocoder, no API key).
   Display-only address hint — never persisted to the database. Browser
   fetch() cannot set a custom User-Agent (a forbidden header); Nominatim's
   usage policy accepts this for genuine browser-originated requests, since
   the browser's own UA and Referer already identify the site. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`nominatim returned ${res.status}`);
  const data = await res.json();
  if (typeof data?.display_name !== 'string') throw new Error('no address found');
  return data.display_name;
}
