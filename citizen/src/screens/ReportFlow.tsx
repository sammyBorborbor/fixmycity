import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, CATEGORIES, COORDS } from '../lib/store.tsx';
import type { CategoryName, LocationName } from '../lib/store.tsx';
import Icon from '../components/Icon.tsx';
import Btn from '../components/Btn.tsx';
import StatusPill from '../components/StatusPill.tsx';
import CategoryBadge from '../components/CategoryBadge.tsx';
import ProgressBar from '../components/ProgressBar.tsx';
import MapPlaceholder from '../components/MapPlaceholder.tsx';

export default function ReportFlow() {
  const { submitReport, user } = useStore();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<CategoryName | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState<LocationName>('Okponglo');
  const [newId, setNewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // object URLs leak unless revoked when replaced/unmounted
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview(null);
  }

  async function submit() {
    if (!category || !photo || busy) return;
    setBusy(true);
    setError(null);
    const { report, error: submitError } = await submitReport({ category, location, description: desc, photo });
    setBusy(false);
    if (submitError || !report) {
      setError(submitError ?? 'Could not submit the report. Please try again.');
      return;
    }
    setNewId(report.id);
    setStep(3);
  }

  function reset() {
    setStep(1); setCategory(null); clearPhoto(); setDesc(''); setNewId(null); setError(null);
  }

  return (
    <div className="px-4 pt-5 pb-4 fade-in">
      {/* step header */}
      {step < 3 && (
        <>
          <div className="flex items-center gap-2 mb-1">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="text-navy -ml-1"><Icon name="ChevronLeft" size={22} /></button>}
            <h1 className="text-xl font-bold text-navy">New report</h1>
          </div>
          <ProgressBar step={step} />
        </>
      )}

      {/* STEP 1 — category */}
      {step === 1 && (
        <div className="fade-up">
          <p className="text-sm text-muted mb-3">What kind of issue is it?</p>
          <div className="flex flex-col gap-3">
            {(Object.entries(CATEGORIES) as [CategoryName, typeof CATEGORIES[CategoryName]][]).map(([name, cfg]) => (
              <button key={name} onClick={() => { setCategory(name); setStep(2); }}
                className="flex items-center gap-3 bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 text-left hover:ring-ocean/40 hover:shadow transition active:scale-[.99]">
                <CategoryBadge category={name} size={48} />
                <div className="flex-1">
                  <p className="font-semibold text-ink">{name}</p>
                  <p className="text-xs text-muted">{cfg.blurb}</p>
                </div>
                <Icon name="ChevronRight" size={20} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2 — capture */}
      {step === 2 && category && (
        <div className="fade-up flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CategoryBadge category={category} size={36} />
            <p className="font-semibold text-ink">{category}</p>
          </div>

          {/* camera */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Photo</label>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
            {!preview ? (
              <div className="mt-1.5 rounded-xl ring-1 ring-dashed ring-gray-300 bg-gray-50 h-44 flex flex-col items-center justify-center gap-3">
                <Icon name="Camera" size={30} className="text-gray-400" />
                <Btn variant="primary" onClick={() => fileInput.current?.click()} icon="Camera">Take Photo</Btn>
              </div>
            ) : (
              <div className="mt-1.5 relative">
                <img src={preview} alt="report" className="rounded-xl h-44 w-full object-cover" />
                <button onClick={clearPhoto} className="absolute top-2 right-2 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center shadow text-navy">
                  <Icon name="RotateCcw" size={15} />
                </button>
                <span className="absolute bottom-2 left-2 bg-green-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Icon name="Check" size={12} /> Photo added
                </span>
              </div>
            )}
          </div>

          {/* map */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Location</label>
            <div className="mt-1.5 relative rounded-xl overflow-hidden ring-1 ring-black/5">
              <MapPlaceholder reports={[{ id: 'new', category, location, status: 'Submitted', description: '', crew: null, hasPhoto: !!photo, timeline: [] }]} height={130} rounded="" activeId="new" />
              <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur px-3 py-2 flex items-center gap-2">
                <Icon name="MapPin" size={15} className="text-ocean" />
                <select value={location} onChange={e => setLocation(e.target.value as LocationName)}
                  className="flex-1 bg-transparent text-sm font-medium text-ink focus:outline-none">
                  {Object.keys(COORDS).map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-1">Pin auto-detected near Okponglo. Adjust if needed.</p>
          </div>

          {/* description */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="Describe what you see…"
              className="mt-1.5 w-full rounded-xl ring-1 ring-gray-300 focus:ring-2 focus:ring-ocean p-3 text-sm text-ink resize-none focus:outline-none" />
          </div>

          {error && <p className="text-center text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-xl px-3 py-2">{error}</p>}
          <Btn size="lg" onClick={submit} icon="Send" className="w-full" disabled={!photo || busy}>
            {busy ? 'Submitting…' : 'Submit report'}
          </Btn>
          {!photo && <p className="text-center text-[11px] text-muted -mt-2">Add a photo to submit</p>}
        </div>
      )}

      {/* STEP 3 — confirmation */}
      {step === 3 && (
        <div className="fade-up flex flex-col items-center text-center pt-8">
          <span className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <span className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-white">
              <Icon name="Check" size={34} strokeWidth={3} />
            </span>
          </span>
          <h1 className="text-2xl font-bold text-navy">Report submitted!</h1>
          <p className="text-muted text-sm mt-1 max-w-[18rem]">Thanks {user?.firstName}. AWMA has received your report and will review it shortly.</p>

          <div className="mt-5 w-full bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4">
            <p className="text-xs text-muted">Reference number</p>
            <p className="text-xl font-bold font-mono text-navy tracking-wide">{newId}</p>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-muted">Status</span>
              <StatusPill status="Submitted" size="lg" />
            </div>
          </div>

          <div className="flex gap-3 mt-5 w-full">
            <Btn variant="outline" className="flex-1" onClick={() => navigate('/reports/' + newId)}>View report</Btn>
            <Btn className="flex-1" onClick={reset}>Report another</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
