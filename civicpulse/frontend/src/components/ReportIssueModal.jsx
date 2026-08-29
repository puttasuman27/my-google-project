import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Camera, 
  MapPin, 
  Navigation, 
  Search, 
  Sparkles, 
  UploadCloud, 
  CheckCircle2, 
  X, 
  Send, 
  Loader2, 
  Video,
  AlertCircle,
  RotateCcw
} from 'lucide-react';

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

function LocationPickerEvents({ onLocationSelected }) {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const DEFAULT_COORDS = { lat: 17.49367, lng: 78.42035 };
const DEFAULT_ADDRESS = 'Ward 14, Main Arterial Road';

export default function ReportIssueModal({ isOpen, onClose, onReportSuccess }) {
  // Location States
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [addressQuery, setAddressQuery] = useState(DEFAULT_ADDRESS);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');

  // Form States
  const [category, setCategory] = useState('POTHOLE');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  // Execution States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentResponse, setAgentResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  // ✨ Auto-Reset Function
  const resetForm = () => {
    setCoords(DEFAULT_COORDS);
    setAddressQuery(DEFAULT_ADDRESS);
    setCategory('POTHOLE');
    setDescription('');
    setImageUri('');
    setPreviewImage(null);
    setAgentResponse(null);
    setErrorMessage('');
    setLocationMsg('');
    stopCamera();
  };

  // Reset every time modal opens or unmounts
  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setAddressQuery(`GPS Locked: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setLocationMsg('Device GPS Pinpoint Locked');
        setIsLocating(false);
        setTimeout(() => setLocationMsg(''), 3000);
      },
      (err) => {
        setIsLocating(false);
        alert("GPS access denied or timed out. Click on map to place pin.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleMapPin = (lat, lng) => {
    setCoords({ lat, lng });
    setAddressQuery(`Pin Marked: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setLocationMsg('Coordinates updated on map');
    setTimeout(() => setLocationMsg(''), 3000);
  };

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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!previewImage && !imageUri) {
      setErrorMessage("Please capture or upload a defect photo first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setAgentResponse(null);

    const payload = {
      citizen_id: "citizen_demo_user",
      image_uri: imageUri,
      category: category,
      description_text: description,
      latitude: coords.lat,
      longitude: coords.lng
    };

    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorDetail = await res.json().catch(() => ({}));
        throw new Error(errorDetail.detail || `Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setAgentResponse(data);

      const incidentForFeed = {
        id: data.incident_id,
        title: `${data.analysis.category} Hazard`,
        category: data.analysis.category,
        location: addressQuery,
        severity: data.routing.priority_level,
        severityScore: data.analysis.severity_level === 'Critical' ? 0.95 : 0.75,
        upvotes: 1,
        userUpvoted: true,
        department: data.routing.assigned_department,
        slaCountdown: `${data.routing.sla_hours}h SLA remaining`,
        status: "IN_PROGRESS",
        reportsMerged: data.is_duplicate ? 2 : 1,
        image: previewImage || imageUri,
        reportedAt: "Just now"
      };

      if (onReportSuccess) onReportSuccess(incidentForFeed);

    } catch (err) {
      console.error("Agent Pipeline Error:", err);
      setErrorMessage(err.message || "Failed to submit incident.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-2xl w-full max-h-[92vh] overflow-y-auto space-y-5 shadow-2xl border border-slate-100">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-2 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black uppercase text-[#0B4D3C] tracking-wider">
              Google ADK Multi-Agent Pipeline
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              Report Infrastructure Defect
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={resetForm}
              title="Reset Form"
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder */}
        {isCameraOpen && (
          <div className="bg-slate-950 p-4 rounded-3xl space-y-3 relative text-white">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Video className="w-4 h-4" /> Live Camera Stream
              </span>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white">✕ Cancel</button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover rounded-2xl bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            <button 
              type="button" 
              onClick={capturePhoto} 
              className="w-full bg-[#F97316] hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition"
            >
              <Camera className="w-5 h-5" />
              <span>Capture Photo Evidence</span>
            </button>
          </div>
        )}

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl flex items-center gap-2 text-xs text-red-700 font-bold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-5">
          
          {/* SECTION 1: PHOTO EVIDENCE */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                1. Visual Evidence (Gemini Vision Agent)
              </label>
              <button 
                type="button" 
                onClick={startCamera} 
                className="text-[11px] font-bold text-[#0B4D3C] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1 transition"
              >
                <Camera className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Open Camera</span>
              </button>
            </div>

            <div className="relative">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                id="modal-file-upload" 
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
                htmlFor="modal-file-upload"
                className="border-2 border-dashed border-emerald-200 hover:border-[#0B4D3C] bg-[#F4F8F6] p-4 rounded-2xl block text-center cursor-pointer transition"
              >
                {previewImage ? (
                  <div className="relative">
                    <img src={previewImage} alt="Preview" className="h-44 w-full object-cover rounded-xl mx-auto shadow-sm" />
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      Change Photo
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1 py-3">
                    <UploadCloud className="w-8 h-8 text-[#0B4D3C] mx-auto" />
                    <p className="text-xs font-bold text-slate-800">Tap to upload or snap hazard photo</p>
                    <p className="text-[10px] text-slate-400">Gemini inspects authenticity, dimensions & severity</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* SECTION 2: MAP LOCATION */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                2. Mark Geolocation
              </label>
              {locationMsg && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ {locationMsg}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  placeholder="Enter street, landmark, or ward..."
                  className="w-full bg-[#F4F8F6] border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0B4D3C]"
                />
              </div>

              <button 
                type="button" 
                onClick={handleGetGPS} 
                disabled={isLocating}
                className="bg-[#0B4D3C] hover:bg-[#047857] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 shrink-0"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4 text-[#F97316]" />}
                <span>{isLocating ? "Locating..." : "Live GPS"}</span>
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-44 relative z-0">
              <MapContainer center={[coords.lat, coords.lng]} zoom={15} scrollWheelZoom={false} className="w-full h-full">
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[coords.lat, coords.lng]} icon={customMarkerIcon} />
                <MapRecenter lat={coords.lat} lng={coords.lng} />
                <LocationPickerEvents onLocationSelected={handleMapPin} />
              </MapContainer>
              <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-xl flex justify-between pointer-events-none z-[400]">
                <span>Tap map to drag marker</span>
                <span className="font-mono text-emerald-300">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: CATEGORY & REMARKS */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Defect Classification</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#F4F8F6] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0B4D3C]"
              >
                <option value="POTHOLE">Pothole & Road Subsidence Hazard</option>
                <option value="STREETLIGHT">Streetlight / Dark Spot Grid Short</option>
                <option value="DRAINAGE">Drainage & Stormwater Culvert Blockage</option>
                <option value="GARBAGE">Illegal Garbage Dump / Solid Waste</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Citizen Remarks (Optional)</label>
              <textarea 
                rows={2} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Near the school gate, causing heavy traffic bottlenecks..."
                className="w-full bg-[#F4F8F6] border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-[#0B4D3C]"
              />
            </div>
          </div>

          {/* AGENT RESPONSE PILL */}
          {agentResponse && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center font-bold text-[#0B4D3C]">
                <span className="flex items-center gap-1.5 font-black text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  {agentResponse.is_duplicate ? 'Merged via Incident Agent' : 'New Canonical Cluster Initialized'}
                </span>
                <span className="text-[10px] bg-[#10B981] text-white font-black px-2.5 py-0.5 rounded-full">
                  SLA: {agentResponse.routing.sla_hours} hrs
                </span>
              </div>

              <p className="text-[11px] text-slate-600 border-t border-emerald-200/60 pt-1.5">
                {agentResponse.dedup_explanation}
              </p>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1 bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                <div>
                  <span className="block text-slate-400">Assigned Department:</span>
                  <strong className="text-slate-800">{agentResponse.routing.assigned_department}</strong>
                </div>
                <div>
                  <span className="block text-slate-400">Priority Level:</span>
                  <strong className="text-red-600 font-bold">{agentResponse.routing.priority_level}</strong>
                </div>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="space-y-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-[#0B4D3C] hover:bg-[#047857] text-white font-extrabold py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition active:scale-95 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Agent Pipeline (Vision + Deduplication + Routing)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F97316]" />
                  <span>Submit Report to Agent Network</span>
                </>
              )}
            </button>

            {agentResponse && (
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Done & Return to Dashboard
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
}