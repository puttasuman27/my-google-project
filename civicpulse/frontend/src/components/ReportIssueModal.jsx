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
  Loader2,
  Video,
  AlertCircle,
  RotateCcw,
  Layers,
  Clock,
  Building2,
  TrendingUp,
  ArrowRight
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
      map.setView([lat, lng], 16, { animate: true });
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
const DEFAULT_ADDRESS = 'Ward 14, Main Arterial Road, Metro Core';

export default function ReportIssueModal({ isOpen, onClose, onReportSuccess }) {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [addressQuery, setAddressQuery] = useState(DEFAULT_ADDRESS);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [locationMsg, setLocationMsg] = useState('');

  const [category, setCategory] = useState('POTHOLE');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentResponse, setAgentResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

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
    setSearchResults([]);
    stopCamera();
  };

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

  // 🛰️ Live Device GPS Pinpoint
  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setIsLocating(false);
        setLocationMsg('GPS Locked');

        try {
          const res = await fetch(`/api/v1/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data.formatted_address) {
            setAddressQuery(data.formatted_address);
          }
        } catch {
          setAddressQuery(`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setTimeout(() => setLocationMsg(''), 3000);
      },
      () => {
        setIsLocating(false);
        alert("GPS access denied or timed out. Click on map to place pin.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 🗺️ Click on Map -> Reverse Geocode
  const handleMapPin = async (lat, lng) => {
    setCoords({ lat, lng });
    setLocationMsg('Pin Updated');
    try {
      const res = await fetch(`/api/v1/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.formatted_address) {
        setAddressQuery(data.formatted_address);
      }
    } catch {
      setAddressQuery(`Pin Marked: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
    setTimeout(() => setLocationMsg(''), 3000);
  };

  // 🔍 Geocoding Search
  const handleAddressSearch = async (queryText) => {
    setAddressQuery(queryText);
    if (!queryText || queryText.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const res = await fetch(`/api/v1/geocode?query=${encodeURIComponent(queryText)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.warn("Geocoding lookup error:", err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const selectSearchResult = (item) => {
    setCoords({ lat: item.latitude, lng: item.longitude });
    setAddressQuery(item.display_name);
    setSearchResults([]);
    setLocationMsg(`Selected: ${item.ward}`);
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

  // 🚀 SUBMIT TO FASTAPI BACKEND (Resilient error handling)
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
        id: data.incident_id || `INC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        incident_id: data.incident_id || `INC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        title: `${data.analysis?.category || category} Hazard`,
        category: data.analysis?.category || category,
        location: addressQuery,
        ward: data.routing?.assigned_ward || "Ward 14 - Central Core",
        severity: data.routing?.priority_level || "High",
        severityScore: data.routing?.priority_score ?? 0.85,
        upvotes: data.duplicate_count || 1,
        userUpvoted: true,
        department: data.routing?.assigned_department || "Roads & Highway Infrastructure Dept",
        slaCountdown: `${data.routing?.sla_hours || 24}h SLA remaining`,
        status: "IN_PROGRESS",
        reportsMerged: data.duplicate_count || 1,
        image: previewImage || imageUri,
        intake_image_url: previewImage || imageUri,
        reportedAt: "Just now"
      };

      // Safely notify parent feed without throwing if callback fails
      try {
        if (typeof onReportSuccess === 'function') {
          onReportSuccess(incidentForFeed, data);
        }
      } catch (parentErr) {
        console.warn("Parent callback notice:", parentErr);
      }

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
        
        {/* SUCCESS POPUP SCREEN */}
        {agentResponse ? (
          <div className="space-y-6 py-2 animate-in fade-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <div className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center shadow-lg ${
                agentResponse.is_duplicate 
                  ? 'bg-orange-100 text-[#F97316] ring-8 ring-orange-50' 
                  : 'bg-emerald-100 text-[#10B981] ring-8 ring-emerald-50'
              }`}>
                {agentResponse.is_duplicate ? (
                  <Layers className="w-8 h-8" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-[#0B4D3C]" />
                )}
              </div>

              <span className={`inline-block text-[11px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full ${
                agentResponse.is_duplicate
                  ? 'bg-orange-100 text-[#F97316]'
                  : 'bg-emerald-100 text-[#0B4D3C]'
              }`}>
                {agentResponse.is_duplicate ? "🔄 Spatial Cluster Merged" : "✨ New Canonical Incident Created"}
              </span>

              <h2 className="text-2xl font-black text-slate-900">
                {agentResponse.is_duplicate 
                  ? "Report Merged with Active Defect" 
                  : "Incident Successfully Logged!"}
              </h2>

              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {agentResponse.dedup_explanation}
              </p>
            </div>

            {/* Telemetry Breakdown */}
            <div className="bg-[#F4F8F6] border border-emerald-900/10 rounded-[24px] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Canonical Incident ID</span>
                  <span className="text-sm font-mono font-black text-slate-900">{agentResponse.incident_id}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Reports Merged</span>
                  <span className="text-sm font-bold text-[#F97316] flex items-center justify-end gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {agentResponse.duplicate_count || 1} Citizen Reports
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Hazard Type</span>
                  <strong className="text-slate-800 text-xs block truncate">
                    {agentResponse.analysis?.hazard_type || agentResponse.analysis?.category}
                  </strong>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {agentResponse.analysis?.confidence ? `${(agentResponse.analysis.confidence * 100).toFixed(0)}% Confidence` : 'Verified'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Assigned Unit</span>
                  <strong className="text-slate-800 text-xs block truncate">
                    {agentResponse.routing?.assigned_department}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    {agentResponse.routing?.assigned_ward}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">SLA Priority</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black text-red-600">
                      {agentResponse.routing?.priority_level}
                    </span>
                    <span className="text-[10px] text-orange-600 font-bold">
                      ({agentResponse.routing?.sla_hours}h max)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center mt-0.5">
                    <Clock className="w-2.5 h-2.5 mr-1" /> SLA Active
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-[#0B4D3C] hover:bg-[#047857] text-white font-extrabold py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition active:scale-95"
            >
              <span>Done & Return to Live Feed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <>
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

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-red-700 font-medium">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-black text-red-800 block text-xs">Validation Notice</strong>
                  <p>{errorMessage}</p>
                </div>
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
                    2. Search Place & Mark Pinpoint
                  </label>
                  {locationMsg && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ✓ {locationMsg}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={addressQuery}
                        onChange={(e) => handleAddressSearch(e.target.value)}
                        placeholder="Search landmark, street name, or metro junction..."
                        className="w-full bg-[#F4F8F6] border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0B4D3C]"
                      />
                      {isSearchingAddress && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 absolute right-3 top-3.5" />
                      )}
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

                  {searchResults.length > 0 && (
                    <div className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectSearchResult(item)}
                          className="p-3 text-xs hover:bg-[#F4F8F6] cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                            <span className="truncate text-slate-800 font-medium">{item.display_name}</span>
                          </div>
                          <span className="text-[10px] font-bold bg-emerald-50 text-[#0B4D3C] px-2 py-0.5 rounded-md shrink-0">
                            {item.ward}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-44 relative z-0">
                  <MapContainer center={[coords.lat, coords.lng]} zoom={15} scrollWheelZoom={false} className="w-full h-full">
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[coords.lat, coords.lng]} icon={customMarkerIcon} />
                    <MapRecenter lat={coords.lat} lng={coords.lng} />
                    <LocationPickerEvents onLocationSelected={handleMapPin} />
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-xl flex justify-between pointer-events-none z-[400]">
                    <span>Click anywhere on map to reposition pin</span>
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

              {/* SUBMIT BUTTON */}
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
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}