import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import Icon from './Icon.tsx';
import Btn from './Btn.tsx';
import CenterPin from './CenterPin.tsx';
import { reverseGeocode, searchPlaces } from '../lib/geo.ts';
import type { PlaceResult } from '../lib/geo.ts';
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
  const mapRef = useRef<LeafletMap | null>(null);

  // place-search (type-ahead) state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

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

  // debounced forward search; ignores short queries and stale responses, fail-soft
  function onQueryChange(value: string) {
    setQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    searchDebounceRef.current = setTimeout(() => {
      searchPlaces(q)
        .then(list => { if (seq === searchSeq.current) { setResults(list); setSearching(false); } })
        .catch(() => { if (seq === searchSeq.current) { setResults([]); setSearching(false); } });
    }, 350);
  }

  function clearSearch() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchSeq.current++;
    setQuery('');
    setResults([]);
    setSearching(false);
  }

  // picking a suggestion drives the map; the resulting moveend flows through
  // handleMove -> draft position + reverse-geocode + jurisdiction gate.
  function pickResult(r: PlaceResult) {
    mapRef.current?.setView([r.lat, r.lng], 16);
    setHint(r.label); // snappy: show the chosen label until moveend refines it
    clearSearch();
  }

  // seed the hint for the initial centre if the form didn't hand us one
  useEffect(() => {
    if (initialHint == null) fetchHint(initialPosition[0], initialPosition[1]);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
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
          <MapContainer ref={mapRef} center={pos} zoom={16} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* moved off the top-left so the search bar doesn't cover it */}
            <ZoomControl position="bottomleft" />
            <CenterReporter onMove={handleMove} />
            <FixSize />
          </MapContainer>
          <CenterPin />

          {/* search box + suggestions overlay */}
          <div className="absolute top-3 left-3 right-3 z-500">
            <div className="flex items-center gap-2 bg-white rounded-xl ring-1 ring-black/5 shadow-md px-3 h-11">
              <Icon name="Search" size={16} className="text-muted shrink-0" />
              <input
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder="Search a place or landmark…"
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {query && (
                <button onClick={clearSearch} aria-label="Clear search" className="p-0.5 rounded-md hover:bg-gray-100 active:scale-95 transition">
                  <Icon name="X" size={15} className="text-muted" />
                </button>
              )}
            </div>

            {query.trim().length >= 3 && (
              <div className="mt-1.5 bg-white rounded-xl ring-1 ring-black/5 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                {searching && results.length === 0 ? (
                  <p className="text-[13px] text-muted px-3 py-2.5">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="text-[13px] text-muted px-3 py-2.5">No matches in this area</p>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={`${r.lat},${r.lng},${i}`}
                      onClick={() => pickResult(r)}
                      className="w-full text-left flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition border-b border-black/5 last:border-b-0"
                    >
                      <Icon name="MapPin" size={15} className="text-ocean shrink-0 mt-0.5" />
                      <span className="text-[13px] text-ink leading-snug">{r.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {!query && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-500 bg-navy/90 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
              Move the map to place the pin
            </div>
          )}
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
