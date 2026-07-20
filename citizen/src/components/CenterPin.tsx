import Icon from './Icon.tsx';

/* Stationary pin overlay whose tip sits at the exact centre of its positioned
   parent. Used by both the report-flow map preview and the full-screen picker:
   instead of a draggable marker, the citizen moves the map *under* this fixed
   pin (the Uber metaphor), which removes the drag-vs-page-scroll conflict.

   The parent must be `position: relative`. `pointer-events-none` lets taps and
   drags fall through to the Leaflet map underneath. The tip is anchored to the
   centre via `-translate-y-full` (bottom-centre of the icon = container centre),
   matching Leaflet's `iconAnchor: [w/2, h]` convention. */
export default function CenterPin() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-500 -translate-x-1/2 -translate-y-full">
      <Icon
        name="MapPin"
        size={36}
        strokeWidth={2.5}
        style={{ color: '#1E5F8E', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }}
      />
    </div>
  );
}
