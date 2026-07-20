import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import Icon from './Icon.tsx';
import CenterPin from './CenterPin.tsx';
import MapLocationModal from './MapLocationModal.tsx';
import { GEO } from '../lib/store.tsx';
import type { LocationName } from '../lib/store.tsx';
import { nearestLocation, reverseGeocode } from '../lib/geo.ts';

interface LocationPickerProps {
  location: LocationName;
  onLocationChange: (loc: LocationName) => void;
  onPositionChange: (lat: number, lng: number) => void;
  height?: number;
}

/* Invisible helper: re-centers the map whenever `position` changes (react-leaflet
   does not do this automatically from the MapContainer `center` prop after mount). */
function RecenterOnChange({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(position); }, [position, map]);
  return null;
}

/* Compact, non-interactive map PREVIEW of the report's location. The map itself
   is locked (no drag/zoom) and shows a fixed centre pin; tapping it opens the
   full-screen MapLocationModal where the citizen actually moves the map to place
   the pin. This split keeps the tidy form free of a map that would otherwise
   fight page-scroll, while giving a full screen for precise pinning on demand.

   Fails soft throughout: a denied/unavailable/timed-out geolocation falls back
   silently to the given area's centroid; a failed reverse-geocode just leaves
   the address hint blank. Neither ever blocks interaction. */
export default function LocationPicker({ location, onLocationChange, onPositionChange, height = 160 }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>(() => {
    const g = GEO[location];
    return [g.lat, g.lng];
  });
  const [hint, setHint] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  // guards against LocationPicker's own nearest-neighbourhood update to
  // `location` re-triggering the "dropdown changed externally" recenter effect
  // below, which would otherwise snap a precisely-placed pin back to a
  // neighbourhood's centroid.
  const skipNextRecenter = useRef(false);

  // Applies a new pin position: syncs it up to the parent, auto-selects the
  // nearest neighbourhood, and refreshes the address hint. When the caller
  // already knows the address (e.g. the modal geocoded it live), pass it as
  // `knownHint` to skip a redundant network round-trip.
  function movePin(lat: number, lng: number, knownHint?: string | null) {
    setPosition([lat, lng]);
    onPositionChange(lat, lng);

    const nearest = nearestLocation(lat, lng);
    if (nearest !== location) {
      skipNextRecenter.current = true;
      onLocationChange(nearest);
    }

    if (knownHint !== undefined) {
      setHint(knownHint);
      return;
    }

    setHint(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      reverseGeocode(lat, lng)
        .then(address => { if (seq === requestSeq.current) setHint(address); })
        .catch(() => { /* fail soft: leave the hint blank */ });
    }, 400);
  }

  // geolocate once on mount; silently keep the default position on any failure
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => movePin(pos.coords.latitude, pos.coords.longitude),
      () => { /* denied/unavailable: keep the default position */ },
      { enableHighAccuracy: false, timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geolocate once on mount only
  }, []);

  // the citizen picked a different area from the dropdown: recenter the pin
  // to that area's centroid, unless this `location` change was itself caused
  // by the pin moving (see skipNextRecenter above). Must also propagate the
  // new position up via onPositionChange — otherwise the parent's submitted
  // lat/lng would silently stay stale (still wherever the pin last was)
  // while the visible pin and location_name move to the new area.
  useEffect(() => {
    if (skipNextRecenter.current) {
      skipNextRecenter.current = false;
      return;
    }
    const g = GEO[location];
    setPosition([g.lat, g.lng]);
    onPositionChange(g.lat, g.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to `location`; onPositionChange is a stable setter from the parent
  }, [location]);

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden ring-1 ring-black/5" style={{ height }}>
        <MapContainer
          center={position}
          zoom={15}
          zoomControl={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          scrollWheelZoom={false}
          keyboard={false}
          boxZoom={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterOnChange position={position} />
        </MapContainer>
        <CenterPin />
        {/* full-cover tap target that opens the precise picker */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Adjust location on map"
          className="absolute inset-0 z-600 flex items-end justify-center pb-3"
        >
          <span className="inline-flex items-center gap-1.5 bg-navy text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-md">
            <Icon name="Maximize2" size={13} /> Tap to adjust on map
          </span>
        </button>
      </div>
      {hint && <p className="text-[11px] text-muted mt-1.5 px-1">Near: {hint}</p>}

      {modalOpen && (
        <MapLocationModal
          initialPosition={position}
          initialHint={hint}
          onClose={() => setModalOpen(false)}
          onConfirm={(lat, lng, h) => { movePin(lat, lng, h); setModalOpen(false); }}
        />
      )}
    </div>
  );
}
