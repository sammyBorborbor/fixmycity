import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletEvent } from 'leaflet';
import L from 'leaflet';
import Icon from './Icon.tsx';
import { GEO } from '../lib/store.tsx';
import type { LocationName } from '../lib/store.tsx';
import { nearestLocation, reverseGeocode } from '../lib/geo.ts';

interface LocationPickerProps {
  location: LocationName;
  onLocationChange: (loc: LocationName) => void;
  onPositionChange: (lat: number, lng: number) => void;
  height?: number;
}

const PIN_ICON = L.divIcon({
  html: renderToStaticMarkup(
    <Icon name="MapPin" size={32} strokeWidth={2.5} style={{ color: '#1E5F8E', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.3))' }} />,
  ),
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

/* Invisible helper: re-centers the map whenever `position` changes (react-leaflet
   does not do this automatically from the MapContainer `center` prop after mount). */
function RecenterOnChange({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(position); }, [position, map]);
  return null;
}

/* Invisible helper: tapping anywhere on the map moves the pin there. */
function ClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMove(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

/* Geolocate-on-mount + draggable/clickable pin for precise report-submission
   location. Fails soft throughout: a denied/unavailable/timed-out geolocation
   falls back silently to the given area's centroid; a failed reverse-geocode
   just leaves the address hint blank. Neither ever blocks interaction. */
export default function LocationPicker({ location, onLocationChange, onPositionChange, height = 160 }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>(() => {
    const g = GEO[location];
    return [g.lat, g.lng];
  });
  const [hint, setHint] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  // guards against LocationPicker's own nearest-neighbourhood update to
  // `location` re-triggering the "dropdown changed externally" recenter effect
  // below, which would otherwise snap a precisely-dragged pin back to a
  // neighbourhood's centroid.
  const skipNextRecenter = useRef(false);

  function movePin(lat: number, lng: number) {
    setPosition([lat, lng]);
    onPositionChange(lat, lng);
    setHint(null);

    const nearest = nearestLocation(lat, lng);
    if (nearest !== location) {
      skipNextRecenter.current = true;
      onLocationChange(nearest);
    }

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
      <div className="rounded-xl overflow-hidden ring-1 ring-black/5" style={{ height }}>
        <MapContainer center={position} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={position}
            icon={PIN_ICON}
            draggable
            eventHandlers={{
              dragend: (e: LeafletEvent) => {
                const p = (e.target as L.Marker).getLatLng();
                movePin(p.lat, p.lng);
              },
            }}
          />
          <RecenterOnChange position={position} />
          <ClickHandler onMove={movePin} />
        </MapContainer>
      </div>
      {hint && <p className="text-[11px] text-muted mt-1.5 px-1">Near: {hint}</p>}
    </div>
  );
}
