import React, { useState } from 'react';
import { Camera, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CitizenReportForm() {
  const [imageUri, setImageUri] = useState('https://upload.wikimedia.org/wikipedia/commons/a/a8/Broken_street_lamp.jpg');
  const [description, setDescription] = useState('Street light fixture is broken and hanging dangerously.');
  const [coords, setCoords] = useState({ latitude: 19.0760, longitude: 72.8777 });
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_id: 'citizen_demo_user',
          image_uri: imageUri,
          description_text: description,
          latitude: parseFloat(coords.latitude),
          longitude: parseFloat(coords.longitude),
        }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-card border border-slate-200 shadow-civic space-y-5">
      <div className="flex items-center space-x-2">
        <div className="bg-civic-canvas p-2 rounded-xl text-civic-deep">
          <Camera className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-civic-deep">Submit Infrastructure Incident</h2>
          <p className="text-xs text-slate-500">Multimodal Gemini Triage & Spatial Deduplication</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Image Evidence URL</label>
          <input
            type="text"
            value={imageUri}
            onChange={(e) => setImageUri(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-civic-mint"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-civic-mint"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Latitude</label>
            <input
              type="number" step="any"
              value={coords.latitude}
              onChange={(e) => setCoords({ ...coords, latitude: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-civic-mint"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Longitude</label>
            <input
              type="number" step="any"
              value={coords.longitude}
              onChange={(e) => setCoords({ ...coords, longitude: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-civic-mint"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-civic-orange hover:bg-orange-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-floating flex items-center justify-center space-x-2 transition"
        >
          {loading ? (
            <span>Processing via Agent Pipeline...</span>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Submit Incident Report</span>
            </>
          )}
        </button>
      </form>

      {response && (
        <div className="bg-civic-canvas p-5 rounded-2xl border border-emerald-200 space-y-3 mt-4 text-xs">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="font-bold text-civic-deep text-sm">Response Summary</span>
            <span className="bg-emerald-100 text-civic-deep font-bold px-2.5 py-1 rounded-full flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-civic-mint" /> Processed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <p><strong>Report ID:</strong> {response.report_id}</p>
            <p><strong>Incident ID:</strong> {response.incident_id}</p>
            <p><strong>Duplicate Status:</strong> {response.is_duplicate ? 'Duplicate Detected' : 'New Incident'}</p>
            <p><strong>Category:</strong> {response.analysis?.category}</p>
            <p><strong>Severity:</strong> {response.analysis?.severity_level}</p>
            <p><strong>Assigned Dept:</strong> {response.routing?.assigned_department}</p>
          </div>
        </div>
      )}
    </div>
  );
}