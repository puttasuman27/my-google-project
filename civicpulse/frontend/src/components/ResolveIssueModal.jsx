import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
  Video
} from 'lucide-react';

export default function ResolveIssueModal({ isOpen, onClose, incident, onResolveSuccess }) {
  const [previewImage, setPreviewImage] = useState(null);
  const [imageUri, setImageUri] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  if (!isOpen || !incident) return null;

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (e) {
      alert("Camera access denied or unavailable.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/jpeg');
      setPreviewImage(dataUrl);
      setImageUri(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (!imageUri) {
      setErrorMessage("Please capture or upload photo evidence of the completed repair.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setAuditResult(null);

    try {
      const res = await fetch(`/api/v1/incidents/${incident.id || incident.incident_id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_uri: imageUri,
          category: incident.category || "POTHOLE"
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setAuditResult(data.audit);

      if (data.success && onResolveSuccess) {
        onResolveSuccess(incident.id || incident.incident_id, data.audit);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to audit resolution.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 space-y-5">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start pb-2 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black uppercase text-[#10B981] tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Gemini Resolution Agent
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              Verify Fix: {incident.title || `${incident.category} Defect`}
            </h2>
            <span className="text-xs text-slate-400 font-mono">#{incident.id || incident.incident_id} • {incident.ward || "Ward 14"}</span>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Camera Viewfinder */}
        {isCameraOpen && (
          <div className="bg-slate-950 p-4 rounded-3xl space-y-3 relative text-white">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Video className="w-4 h-4" /> Live Verification Camera
              </span>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white">✕ Cancel</button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover rounded-2xl bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            <button
              type="button"
              onClick={capturePhoto}
              className="w-full bg-[#10B981] hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Completion Photo</span>
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl flex items-center gap-2 text-xs text-red-700 font-bold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Result Breakdown */}
        {auditResult ? (
          <div className="space-y-4 animate-in fade-in zoom-in duration-200">
            <div className={`p-5 rounded-2xl border text-center space-y-2 ${
              auditResult.is_resolved ? 'bg-emerald-50 border-emerald-200 text-[#0B4D3C]' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="w-12 h-12 mx-auto rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-lg">
                {auditResult.is_resolved ? '✓' : '✗'}
              </div>
              <h3 className="text-lg font-black">
                {auditResult.is_resolved ? "Resolution Verified & Approved" : "Verification Failed"}
              </h3>
              <p className="text-xs leading-relaxed max-w-md mx-auto">{auditResult.explanation}</p>
              <div className="flex justify-center gap-2 pt-2 text-[11px] font-bold">
                <span className="bg-white/80 px-2.5 py-1 rounded-lg border">
                  Verdict: {auditResult.quality_verdict}
                </span>
                <span className="bg-white/80 px-2.5 py-1 rounded-lg border">
                  AI Confidence: {(auditResult.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="w-full bg-[#0B4D3C] hover:bg-[#047857] text-white font-extrabold py-3.5 rounded-2xl shadow-lg transition"
            >
              Done & Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuditSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  Upload Completed Fix Photo
                </label>
                <button
                  type="button"
                  onClick={startCamera}
                  className="text-[11px] font-bold text-[#0B4D3C] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1 transition"
                >
                  <Camera className="w-3.5 h-3.5 text-[#F97316]" />
                  <span>Use Camera</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  id="resolve-file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPreviewImage(reader.result);
                        setImageUri(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="resolve-file-upload"
                  className="border-2 border-dashed border-emerald-200 hover:border-[#0B4D3C] bg-[#F4F8F6] p-4 rounded-2xl block text-center cursor-pointer transition"
                >
                  {previewImage ? (
                    <div className="relative">
                      <img src={previewImage} alt="Fix Preview" className="h-44 w-full object-cover rounded-xl mx-auto shadow-sm" />
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        Change Photo
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1 py-4">
                      <UploadCloud className="w-8 h-8 text-[#0B4D3C] mx-auto" />
                      <p className="text-xs font-bold text-slate-800">Snap or upload repaired site photo</p>
                      <p className="text-[10px] text-slate-400">Gemini inspects whether defect is completely rectified</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#10B981] hover:bg-emerald-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-md flex items-center justify-center space-x-2 transition active:scale-95 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Auditing Repair Quality with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#0B4D3C]" />
                  <span>Submit & Verify Resolution</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}