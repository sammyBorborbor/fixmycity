import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from './Icon.tsx';
import { STATUS } from '../lib/store.tsx';
import type { Report } from '../lib/store.tsx';

interface LeafletMapProps {
  reports: Report[];
  onPin?: (r: Report) => void;
  activeId?: string | null;
  height?: number | string;
  rounded?: string;
}

// Roughly central to all 8 seeded AWMA neighbourhoods, near Okponglo/UG campus.
// Used only as the initial view before the map fits to the actual report pins.
const AYAWASO_WEST_CENTER: [number, number] = [5.635, -0.185];
const DEFAULT_ZOOM = 14;

const hasCoords = (r: Report) => Number.isFinite(r.lat) && Number.isFinite(r.lng);

/* Keep every report pin in view: fit the map to the bounds of all markers
   whenever the set changes. Without this the map sits at a fixed center/zoom,
   so reports outside that frame (e.g. East Legon when centred on Okponglo) are
   silently off-screen. A single pin just recentres (capped zoom); no pins is a
   no-op so the AWMA default view stands. */
function FitToReports({ reports }: { reports: Report[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = reports.filter(hasCoords).map(r => [r.lat, r.lng] as [number, number]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], Math.min(map.getZoom(), 16));
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  }, [reports, map]);
  return null;
}

/* Status-colored pin matching the placeholder's visual language, built from a
   real DOM render of the shared <Icon> component (not Leaflet's default
   marker), so pins look identical to every other status indicator in the app. */
function pinIcon(color: string, active: boolean): L.DivIcon {
  const size = active ? 32 : 26;
  const html = renderToStaticMarkup(
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Icon name="MapPin" size={size} strokeWidth={2.5}
            style={{ color, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }} />
      {active && (
        <span style={{ position: 'absolute', bottom: -4, width: 8, height: 8, borderRadius: 9999, background: color, border: '2px solid white' }} />
      )}
    </span>,
  );
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/* Real OpenStreetMap tiles, one marker per report at its actual coordinates.
   Same props shape as the old MapPlaceholder, so call sites barely change. */
export default function LeafletMap({ reports, onPin, activeId, height = 320, rounded = 'rounded-xl' }: LeafletMapProps) {
  return (
    // `isolate` traps Leaflet's high internal z-indices (panes/controls up to 1000)
    // in their own stacking context so the map can't paint over overlays like the
    // slide-in detail panel or the header search dropdown.
    <div className={`relative isolate w-full overflow-hidden ${rounded} ring-1 ring-black/5`} style={{ height }}>
      <MapContainer
        center={AYAWASO_WEST_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToReports reports={reports} />
        {reports.filter(hasCoords).map(r => {
          const cfg = STATUS[r.status] || STATUS.Submitted;
          const active = activeId === r.id;
          return (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={pinIcon(cfg.solid, active)}
              eventHandlers={{ click: () => onPin?.(r) }}
              zIndexOffset={active ? 1000 : 0}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
