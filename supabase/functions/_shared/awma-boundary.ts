// AWMA jurisdiction boundary check — is a point inside Ayawaso West?
//
// GENERATED from data/awma-boundary.geojson (OpenStreetMap relation 12759086).
// This file is duplicated at supabase/functions/_shared/awma-boundary.ts for the
// edge runtime; keep the two identical. Regenerate both from the GeoJSON rather
// than hand-editing the ring.
//
// A point counts as in-jurisdiction if it is inside the admin polygon OR within
// EDGE_TOLERANCE_M of its edge. The tolerance exists because 3 of the 8 official
// pilot neighbourhoods (Abelemkpe, Airport Residential, Roman Ridge) sit ~100-400 m
// outside the raw OSM polygon; 500 m captures them while still rejecting genuinely
// out-of-area points (East Legon Hills ~1.4 km out, central Accra).

// Outer ring as [lng, lat] pairs (GeoJSON coordinate order).
const AWMA_RING: ReadonlyArray<readonly [number, number]> = [
  [-0.22846, 5.612227], [-0.227795, 5.610701], [-0.226888, 5.609222],
  [-0.226121, 5.607615], [-0.225837, 5.605922], [-0.225627, 5.60281],
  [-0.225351, 5.601969], [-0.225, 5.601122], [-0.224799, 5.601195],
  [-0.224128, 5.601262], [-0.223651, 5.60119], [-0.2232, 5.600851],
  [-0.222841, 5.60049], [-0.22236, 5.600034], [-0.222087, 5.599927],
  [-0.221567, 5.599543], [-0.221261, 5.599414], [-0.221266, 5.601101],
  [-0.221545, 5.60234], [-0.221255, 5.603098], [-0.220885, 5.603397],
  [-0.219469, 5.601646], [-0.217828, 5.601048], [-0.216315, 5.6014],
  [-0.206273, 5.606697], [-0.204363, 5.605455], [-0.196767, 5.600517],
  [-0.192036, 5.597419], [-0.190342, 5.596208], [-0.189188, 5.595293],
  [-0.187586, 5.594381], [-0.184539, 5.59304], [-0.183995, 5.592574],
  [-0.183462, 5.591712], [-0.18306, 5.590835], [-0.18269, 5.589925],
  [-0.181923, 5.588841], [-0.18136, 5.589687], [-0.181087, 5.590296],
  [-0.178039, 5.604272], [-0.176897, 5.609056], [-0.175867, 5.613914],
  [-0.176121, 5.61845], [-0.176382, 5.623097], [-0.157607, 5.629172],
  [-0.154463, 5.630058], [-0.151566, 5.631222], [-0.149753, 5.632215],
  [-0.147704, 5.633123], [-0.142817, 5.635045], [-0.143348, 5.635952],
  [-0.143149, 5.636694], [-0.143959, 5.638365], [-0.14588, 5.640874],
  [-0.146856, 5.642177], [-0.149099, 5.645572], [-0.150277, 5.64829],
  [-0.151137, 5.654898], [-0.151391, 5.659941], [-0.152989, 5.659887],
  [-0.155373, 5.659934], [-0.159947, 5.659207], [-0.165683, 5.659744],
  [-0.16576, 5.65975], [-0.16592, 5.659761], [-0.166773, 5.659822],
  [-0.169053, 5.659814], [-0.178678, 5.65974], [-0.17723, 5.667299],
  [-0.178089, 5.667298], [-0.179067, 5.667361], [-0.180501, 5.66736],
  [-0.187728, 5.667342], [-0.190351, 5.667368], [-0.190528, 5.667053],
  [-0.197314, 5.664091], [-0.198843, 5.663477], [-0.19887, 5.663567],
  [-0.198982, 5.663541], [-0.198988, 5.663226], [-0.199149, 5.662954],
  [-0.199181, 5.662623], [-0.199122, 5.661704], [-0.199267, 5.661726],
  [-0.200914, 5.662537], [-0.202791, 5.661683], [-0.203129, 5.66171],
  [-0.203327, 5.661833], [-0.203719, 5.661678], [-0.204272, 5.661],
  [-0.20439, 5.659633], [-0.205049, 5.659318], [-0.20528, 5.659046],
  [-0.205135, 5.645722], [-0.192054, 5.625553], [-0.191402, 5.624223],
  [-0.191317, 5.624074], [-0.191376, 5.623919], [-0.201313, 5.617446],
  [-0.201219, 5.616701], [-0.213872, 5.615125], [-0.21968, 5.614402],
  [-0.221921, 5.614123], [-0.22653, 5.61278], [-0.22846, 5.612227],
];

const BBOX = { minLat: 5.588841, maxLat: 5.667368, minLng: -0.22846, maxLng: -0.142817 };

const EDGE_TOLERANCE_M = 500;
const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
// generous degree margin (~0.007deg ~ 780 m) so the bbox fast-reject never
// discards a point that the metre-accurate tolerance check would accept.
const BBOX_MARGIN_DEG = 0.007;

// Ray-casting point-in-polygon (even-odd rule). `lng` is x, `lat` is y.
function insidePolygon(lat: number, lng: number): boolean {
  let inside = false;
  for (let i = 0, j = AWMA_RING.length - 1; i < AWMA_RING.length; j = i++) {
    const xi = AWMA_RING[i][0], yi = AWMA_RING[i][1];
    const xj = AWMA_RING[j][0], yj = AWMA_RING[j][1];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Shortest distance (metres) from the point to the polygon edge, using a local
// equirectangular projection centred on the point — accurate at the ~500 m scale.
function distanceToEdgeM(lat: number, lng: number): number {
  const cosLat = Math.cos(toRad(lat));
  let best = Infinity;
  for (let i = 0, j = AWMA_RING.length - 1; i < AWMA_RING.length; j = i++) {
    const ax = toRad(AWMA_RING[i][0] - lng) * cosLat * EARTH_RADIUS_M;
    const ay = toRad(AWMA_RING[i][1] - lat) * EARTH_RADIUS_M;
    const bx = toRad(AWMA_RING[j][0] - lng) * cosLat * EARTH_RADIUS_M;
    const by = toRad(AWMA_RING[j][1] - lat) * EARTH_RADIUS_M;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    best = Math.min(best, Math.hypot(cx, cy));
  }
  return best;
}

/** True if (lat, lng) is inside AWMA's jurisdiction (polygon + 500 m tolerance). */
export function pointInAwma(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (
    lat < BBOX.minLat - BBOX_MARGIN_DEG || lat > BBOX.maxLat + BBOX_MARGIN_DEG ||
    lng < BBOX.minLng - BBOX_MARGIN_DEG || lng > BBOX.maxLng + BBOX_MARGIN_DEG
  ) {
    return false;
  }
  if (insidePolygon(lat, lng)) return true;
  return distanceToEdgeM(lat, lng) <= EDGE_TOLERANCE_M;
}
