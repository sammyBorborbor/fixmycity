import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import Icon from './Icon.tsx';
import Btn from './Btn.tsx';
import CenterPin from './CenterPin.tsx';
import { reverseGeocode } from '../lib/geo.ts';
import { pointInAwma } from '../lib/awma-boundary.ts';

interface MapLocationModalProps {
  initialPosition: [number, number];
  initialHint: string | null;
  onConfirm: (lat: number, lng: number, hint: string | null) => void;
  onClose: () => void;
}

/* Invisible helper: on any pan/zoom settle, report the map's new centre. We
   deliberately never call setView here — the centre pin is already over that
   point, so re-centring would fight the user's own gesture. */
function CenterReporter({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onMove(c.lat, c.lng);
    },
  });
  return null;
}

/* Invisible helper: Leaflet mis-measures its container when the map mounts
   inside a just-shown flex box; force a re-measure on the next tick. */
function FixSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/* Full-screen "move the map under a fixed pin" location picker. Opened from the
   compact preview in the report form. Works on a DRAFT position seeded from the
   current pin; only "Confirm location" lifts the choice back to the form, so
   cancelling leaves the report untouched. Confirm is blocked while the pin is
   outside Ayawaso West (the same jurisdiction gate the form enforces). */
export default function MapLocationModal({ initialPosition, initialHint, onConfirm, onClose }: MapLocationModalProps) {
  const [pos, setPos] = useState<[number, number]>(initialPosition);
  const [hint, setHint] = useState<string | null>(initialHint);
  const posRef = useRef<[number, number]>(initialPosition);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  // debounced reverse-geocode for the live "Near: ..." address; fail-soft
  function fetchHint(lat: number, lng: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      reverseGeocode(lat, lng)
        .then(address => { if (seq === requestSeq.current) setHint(address); })
        .catch(() => { /* fail soft: leave the last hint */ });
    }, 400);
  }

  function handleMove(lat: number, lng: number) {
    // ignore no-op moveend (e.g. a zoom that keeps the centre) to avoid flicker
    if (Math.abs(lat - posRef.current[0]) < 1e-7 && Math.abs(lng - posRef.current[1]) < 1e-7) return;
    posRef.current = [lat, lng];
    setPos([lat, lng]);
    setHint(null);
    fetchHint(lat, lng);
  }

  // seed the hint for the initial centre if the form didn't hand us one
  useEffect(() => {
    if (initialHint == null) fetchHint(initialPosition[0], initialPosition[1]);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on open
  }, []);

  const inAwma = pointInAwma(pos[0], pos[1]);

  // Portal to <body>: the report form's `.fade-up` animation uses
  // `animation-fill-mode: both`, leaving a permanent transform that would make
  // the form the containing block for this `fixed` overlay and trap it below the
  // header. Rendering outside that subtree lets inset-0 cover the whole viewport.
  return createPortal(
    <div className="fixed inset-0 z-1000 bg-black/40">
      <div className="mx-auto w-full max-w-[420px] h-full flex flex-col bg-paper shadow-xl">
        {/* header */}
        <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-black/5 bg-white">
          <button onClick={onClose} aria-label="Cancel" className="p-1 -ml-1 rounded-lg hover:bg-gray-100 active:scale-95 transition">
            <Icon name="ArrowLeft" size={22} className="text-navy" />
          </button>
          <p className="font-semibold text-ink">Set location</p>
        </div>

        {/* interactive map with the fixed centre pin */}
        <div className="relative flex-1 min-h-0">
          <MapContainer center={pos} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CenterReporter onMove={handleMove} />
            <FixSize />
          </MapContainer>
          <CenterPin />
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-500 bg-navy/90 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
            Move the map to place the pin
          </div>
        </div>

        {/* bottom sheet */}
        <div className="shrink-0 bg-white border-t border-black/5 px-4 pt-3 pb-4 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <Icon name="MapPin" size={16} className="text-ocean shrink-0 mt-0.5" />
            <p className="text-sm text-ink min-h-[20px]">{hint ?? 'Locating…'}</p>
          </div>
          {!inAwma && (
            <div className="flex items-start gap-2 bg-amber-50 ring-1 ring-amber-200 rounded-xl px-3 py-2">
              <Icon name="TriangleAlert" size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">This spot is outside Ayawaso West — reports must be inside the municipality. Move the map back inside to continue.</p>
            </div>
          )}
          <Btn size="lg" icon="Check" className="w-full" disabled={!inAwma} onClick={() => onConfirm(pos[0], pos[1], hint)}>
            Confirm location
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
