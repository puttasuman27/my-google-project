import React, { useState, useEffect } from 'react';
import ReportIssueModal from './components/ReportIssueModal';
import heroBg from './assets/bg.png';
import {
  Camera,
  MapPin,
  CheckCircle2,
  Flame,
  SlidersHorizontal,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  ThumbsUp,
  Mail,
  Phone,
  ArrowRight,
  Building2,
  TreePine,
  RefreshCw,
  Search,
  Layers,
  X
} from 'lucide-react';

const normalizeIncident = (item) => {
  const id = item.incident_id || item.id || `inc_${Math.random().toString(36).substring(2, 9)}`;
  const cat = (item.category || "POTHOLE").toUpperCase();
  const ward = item.assigned_ward || item.ward || "Ward 14 - Central Core";
  const lat = item.latitude ? Number(item.latitude).toFixed(4) : null;
  const lng = item.longitude ? Number(item.longitude).toFixed(4) : null;
  const loc = item.location || (lat && lng ? `${ward} (${lat}, ${lng})` : ward);
  const prioScore = item.priority_score ?? item.severityScore ?? 0.5;
  const reportsMerged = item.duplicate_count ?? item.reportsMerged ?? 1;

  let severity = "P2 - Moderate";
  if (prioScore >= 0.8) severity = "P1 - Critical";
  else if (prioScore >= 0.5) severity = "P1 - High";

  return {
    id: id,
    incident_id: id,
    title: item.title || `${cat} Hazard`,
    category: cat,
    location: loc,
    ward: ward,
    severity: item.severity || severity,
    severityScore: prioScore,
    upvotes: item.upvotes || reportsMerged || 1,
    userUpvoted: !!item.userUpvoted,
    department: item.department || (cat === "POTHOLE" ? "Roads & Highway Infrastructure Dept" : "Public Works Department"),
    slaCountdown: item.sla_deadline ? "SLA Active" : (item.slaCountdown || "12h SLA remaining"),
    status: item.status || "IN_PROGRESS",
    reportsMerged: reportsMerged,
    image: item.image || "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80"
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'portal'
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [showReportModal, setShowReportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // 🔔 Floating Toast Notification State
  const [toastNotification, setToastNotification] = useState(null);

  const showToast = (toast) => {
    setToastNotification(toast);
    setTimeout(() => {
      setToastNotification(null);
    }, 7000);
  };

  const fetchIncidentsFromBQ = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/incidents');
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.incidents || []);
        const validList = rawList
          .filter(item => item && (item.category || item.title))
          .map(normalizeIncident);
        setIncidents(validList);
      }
    } catch (err) {
      console.warn("Error fetching incidents from backend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentsFromBQ();
  }, []);

  const toggleUpvote = (id) => {
    setIncidents(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          upvotes: item.userUpvoted ? item.upvotes - 1 : item.upvotes + 1,
          userUpvoted: !item.userUpvoted
        };
      }
      return item;
    }));
  };

  // 🔄 Add or merge new report (Modal stays open until citizen clicks Done)
  const handleAddNewReport = (newIncident, rawAgentResponse) => {
    const normalized = normalizeIncident(newIncident);

    setIncidents(prev => {
      const existingIndex = prev.findIndex(item => item.id === normalized.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          reportsMerged: normalized.reportsMerged,
          upvotes: (updated[existingIndex].upvotes || 1) + 1,
          severityScore: normalized.severityScore,
          severity: normalized.severity
        };
        return updated;
      }
      return [normalized, ...prev];
    });

    // Trigger dashboard toast notification
    if (rawAgentResponse?.is_duplicate) {
      showToast({
        type: 'merge',
        title: 'Report Merged into Existing Cluster',
        message: `Matched canonical defect #${rawAgentResponse.incident_id} (${rawAgentResponse.duplicate_count} merged total)`,
        id: rawAgentResponse.incident_id
      });
    } else {
      showToast({
        type: 'create',
        title: 'New Canonical Incident Created',
        message: `Registered as #${rawAgentResponse?.incident_id || normalized.id} in BigQuery GIS warehouse`,
        id: rawAgentResponse?.incident_id || normalized.id
      });
    }
  };

  const filteredIncidents = incidents.filter(inc => {
    const term = searchQuery.toLowerCase();
    const titleMatch = inc.title ? inc.title.toLowerCase().includes(term) : false;
    const locationMatch = inc.location ? inc.location.toLowerCase().includes(term) : false;
    const categoryMatch = inc.category ? inc.category.toLowerCase().includes(term) : false;
    return titleMatch || locationMatch || categoryMatch;
  });

  return (
    <div className="min-h-screen bg-[#F4F8F6] text-slate-800 font-sans flex flex-col items-center relative">
      
      {/* 🔔 FLOATING TOAST NOTIFICATION */}
      {toastNotification && (
        <div className="fixed top-20 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-top-4 duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-start justify-between gap-3 ${
            toastNotification.type === 'merge'
              ? 'bg-[#0B4D3C] text-white border-emerald-700'
              : 'bg-[#0B4D3C] text-white border-emerald-700'
          }`}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#F97316] text-white shrink-0 mt-0.5">
                {toastNotification.type === 'merge' ? <Layers className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-black uppercase text-[#F97316] tracking-wider">
                  {toastNotification.title}
                </span>
                <p className="text-xs text-emerald-100 font-medium leading-tight">
                  {toastNotification.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="text-emerald-300 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP NAVBAR */}
      <header className="w-full bg-[#0B4D3C] text-white px-6 sm:px-12 py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setActiveTab('home')}
          >
            <div className="w-4 h-4 rounded-full bg-[#F97316] ring-4 ring-[#F97316]/30"></div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none">CivicPulse AI</span>
              <span className="text-[10px] text-emerald-200 font-semibold tracking-wider">Resolution Intelligence</span>
            </div>
          </div>

          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'home' ? 'bg-white text-[#0B4D3C]' : 'text-emerald-100 hover:text-white'
              }`}
            >
              Citizen Hub
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm flex items-center space-x-1.5 transition active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Report Issue</span>
            </button>
            <button
              onClick={() => setActiveTab('portal')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'portal' ? 'bg-[#10B981] text-slate-950 font-black' : 'text-emerald-100 hover:text-white'
              }`}
            >
              Admin Portal
            </button>
          </nav>
        </div>
      </header>

      {/* 2. MAIN HUB CONTENT */}
      <main className="w-full max-w-6xl px-4 sm:px-6 py-6 space-y-8 flex-1">
        {activeTab === 'home' ? (
          <>
            {/* HERO SECTION */}
            <section
              className="relative w-full rounded-[36px] overflow-hidden shadow-xl bg-cover bg-center border border-emerald-900/20"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(11, 77, 60, 0.94) 0%, rgba(11, 77, 60, 0.78) 55%, rgba(11, 77, 60, 0.45) 100%), url(${heroBg})`,
                minHeight: '420px'
              }}
            >
              <div className="p-8 sm:p-14 max-w-2xl text-white flex flex-col justify-center min-h-[420px]">
                <span className="inline-flex items-center gap-1.5 bg-[#F97316] text-white text-[11px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full w-fit mb-4 shadow-sm">
                  <TreePine className="w-3.5 h-3.5" /> Be The Change
                </span>
                
                <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
                  Building a Better, Cleaner City Together.
                </h1>
                
                <p className="text-emerald-100 text-sm sm:text-base mt-3 leading-relaxed">
                  Transforming civic maintenance from a passive complaint log into active resolution intelligence. Powered by Gemini Multimodal Vision, BigQuery GIS, and real-time SLA tracking.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="bg-[#F97316] hover:bg-orange-600 text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-lg flex items-center space-x-2 transition transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Report Hazard or Trash</span>
                  </button>

                  <a
                    href="#diff-slider"
                    className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white font-bold text-sm px-6 py-3.5 rounded-2xl transition flex items-center space-x-2"
                  >
                    <span>Inspect AI Fix Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </section>

            {/* KPI BAR */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Incident Clusters</span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{incidents.length}</div>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> Synced with BigQuery
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI Deduplication</span>
                <div className="text-2xl sm:text-3xl font-black text-[#0B4D3C] mt-1">68.4%</div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 block">50m spatial clustering</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average SLA Turnaround</span>
                <div className="text-2xl sm:text-3xl font-black text-[#F97316] mt-1">18.4 hrs</div>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Within municipal threshold</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Resolution</span>
                <div className="text-2xl sm:text-3xl font-black text-[#10B981] mt-1">99.1%</div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Zero false closures</span>
              </div>
            </section>

            {/* MOTTO & PILLARS */}
            <section className="bg-emerald-900/5 border border-emerald-900/10 p-6 sm:p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <span className="text-xs font-black uppercase text-[#0B4D3C] tracking-wider">Our Community Creed</span>
                <h3 className="text-2xl font-black text-slate-900">Empowering Spotless, Safe Neighborhoods</h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
                  We don't just count complaints. CivicPulse connects citizen awareness with municipal field action through automated triage, eliminating paperwork and accelerating physical repairs.
                </p>
              </div>

              <div className="flex gap-3">
                <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center w-28 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0B4D3C] flex items-center justify-center mx-auto mb-1 font-black text-xs">1</div>
                  <span className="text-[11px] font-bold text-slate-800">Spot & Snap</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center w-28 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#F97316] flex items-center justify-center mx-auto mb-1 font-black text-xs">2</div>
                  <span className="text-[11px] font-bold text-slate-800">AI Triage</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center w-28 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#10B981] flex items-center justify-center mx-auto mb-1 font-black text-xs">3</div>
                  <span className="text-[11px] font-bold text-slate-800">Verified Fix</span>
                </div>
              </div>
            </section>

            {/* BEFORE & AFTER SLIDER */}
            <section id="diff-slider" className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase text-[#10B981] tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> AI Resolution Audit
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    Interactive Before & After Verification Slider
                  </h3>
                  <p className="text-xs text-slate-500">
                    Drag the slider horizontally to audit real physical repairs verified by the Gemini Resolution Agent.
                  </p>
                </div>
                <span className="bg-emerald-50 text-[#047857] text-xs font-bold px-3.5 py-1.5 rounded-full border border-emerald-200 self-start sm:self-auto">
                  Slide Position: {sliderPos}%
                </span>
              </div>

              <div className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden select-none shadow-inner border border-slate-200">
                <div
                  className="absolute inset-0 bg-cover bg-center flex items-end p-5"
                  style={{ backgroundImage: `url('https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1200&q=80')` }}
                >
                  <span className="bg-emerald-950/80 backdrop-blur-md text-emerald-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-emerald-400/30">
                    AFTER: Clean Asphalt Patch (Gemini Status: PASS - 99.4%)
                  </span>
                </div>

                <div
                  className="absolute inset-0 bg-cover bg-center flex items-end p-5 transition-none"
                  style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1200&q=80')`,
                    filter: 'grayscale(70%) contrast(150%) brightness(0.65)',
                    clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                  }}
                >
                  <span className="bg-black/80 backdrop-blur-md text-orange-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-orange-400/30">
                    BEFORE: 18cm Road Hazard Subsidence
                  </span>
                </div>

                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl z-20 pointer-events-none"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-9 h-9 rounded-full bg-white text-[#0B4D3C] shadow-xl flex items-center justify-center border-2 border-[#0B4D3C]">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  aria-label="Before and after comparison slider"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                />
              </div>

              <div className="bg-[#F4F8F6] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-700 gap-2">
                <span className="font-semibold">Case #inc_8a084853 • Ward 14 Central Core</span>
                <span className="font-bold text-[#0B4D3C] flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1 text-[#10B981]" /> Dual-Photo Structural Verification Approved
                </span>
              </div>
            </section>

            {/* LIVE ACTIVE INCIDENTS FEED */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Active Incident Feed
                    <button
                      onClick={fetchIncidentsFromBQ}
                      title="Refresh from BigQuery"
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0B4D3C]' : ''}`} />
                    </button>
                  </h3>
                  <p className="text-xs text-slate-500">Live clusters streamed from BigQuery warehouse</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search incidents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-[#0B4D3C]"
                  />
                </div>
              </div>

              {filteredIncidents.length === 0 ? (
                <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-[24px] text-slate-400 text-sm">
                  No active incidents found in BigQuery warehouse.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredIncidents.map((inc) => (
                    <div key={inc.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            inc.severity && (inc.severity.includes('High') || inc.severity.includes('Critical'))
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-orange-50 text-[#F97316] border border-orange-200'
                          }`}>
                            <Flame className="w-3 h-3 mr-1" /> {inc.severity || "P2 - Moderate"}
                          </span>

                          <button
                            onClick={() => toggleUpvote(inc.id)}
                            className={`flex items-center space-x-1 text-xs font-bold px-2.5 py-1 rounded-xl transition ${
                              inc.userUpvoted
                                ? 'bg-emerald-50 text-[#047857] border border-emerald-200'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${inc.userUpvoted ? 'fill-current' : ''}`} />
                            <span>{inc.upvotes || 1}</span>
                          </button>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm mt-3">{inc.title}</h4>
                        <p className="text-xs text-slate-500 mt-1 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-slate-400 shrink-0" /> {inc.location}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                        <span className="text-slate-400 text-[11px] font-mono">{inc.reportsMerged || 1} merged</span>
                        <span className={`font-bold ${inc.status === 'RESOLVED' ? 'text-[#10B981]' : 'text-[#F97316]'}`}>
                          {inc.slaCountdown || "In Progress"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          /* MUNICIPAL ADMIN PORTAL VIEW */
          <section className="space-y-6">
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Municipal Operations Portal</h2>
                <p className="text-xs text-slate-500 mt-0.5">Live BigQuery SLA Routing & Work Orders</p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Filter Ward:</span>
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="bg-[#F4F8F6] border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B4D3C]"
                >
                  <option value="ALL">All Wards</option>
                  <option value="Ward 14 - Central Core">Ward 14 - Central Core</option>
                  <option value="Ward 12 - North Industrial">Ward 12 - North Industrial</option>
                  <option value="Ward 08 - South Suburbs">Ward 08 - South Suburbs</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-[#0B4D3C] text-white px-6 py-3.5 text-xs font-bold grid grid-cols-6 gap-2">
                <span>Incident ID</span>
                <span>Category</span>
                <span>Priority</span>
                <span>Department</span>
                <span>SLA Countdown</span>
                <span className="text-right">Action</span>
              </div>

              <div className="divide-y divide-slate-100">
                {incidents
                  .filter(inc => selectedWard === 'ALL' || inc.ward.includes(selectedWard) || selectedWard.includes(inc.ward))
                  .map((inc) => (
                    <div key={inc.id} className="px-6 py-4 grid grid-cols-6 gap-2 items-center text-xs hover:bg-[#F4F8F6]/60 transition">
                      <span className="font-mono font-bold text-slate-900">{inc.id}</span>
                      <span className="text-slate-600">{inc.category}</span>
                      <span>
                        <span className={`font-extrabold px-2 py-0.5 rounded-md border ${
                          inc.severity && (inc.severity.includes('High') || inc.severity.includes('Critical'))
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-orange-50 text-[#F97316] border-orange-200'
                        }`}>
                          {inc.severity || "P2 - Moderate"}
                        </span>
                      </span>
                      <span className="text-slate-600">{inc.department}</span>
                      <span className="font-bold text-[#F97316]">{inc.slaCountdown}</span>
                      <div className="text-right">
                        <button
                          onClick={() => alert(`Crew dispatched for ${inc.id} in ${inc.ward}`)}
                          className="bg-[#10B981] hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl transition"
                        >
                          Dispatch Crew
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* REPORT ISSUE MODAL */}
      <ReportIssueModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReportSuccess={handleAddNewReport}
      />

      {/* FOOTER */}
      <footer className="w-full bg-[#0B4D3C] text-white mt-12 pt-12 pb-8 px-6 sm:px-12 border-t border-emerald-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-emerald-800/80 text-xs">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 rounded-full bg-[#F97316]"></div>
              <span className="text-lg font-black tracking-tight">CivicPulse AI</span>
            </div>
            <p className="text-emerald-200/80 leading-relaxed">
              Empowering proactive citizens and accountable municipal governance through agentic multi-modal intelligence.
            </p>
            <div className="text-[11px] text-emerald-300 font-bold">
              Built for CodeVipassana / Patchamomma Challenge
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-white text-sm">Emergency Helplines</h4>
            <div className="flex items-center space-x-2 text-emerald-100">
              <Phone className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Ward 14 Control: 1800-425-8899</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-100">
              <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Public Works Dispatch: +91 80 2266 0000</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-100">
              <Mail className="w-3.5 h-3.5 text-emerald-300" />
              <span>triage@civicpulse.org</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm">Google Cloud Architecture</h4>
            <ul className="space-y-1 text-emerald-200/80">
              <li>• Google AI Studio (Gemini 3.6 Flash)</li>
              <li>• Cloud Run Serverless APIs</li>
              <li>• BigQuery GIS Spatial Clustering</li>
              <li>• Firebase Firestore Realtime Sync</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-white text-sm">Send Feedback</h4>
            {feedbackSuccess ? (
              <div className="bg-emerald-800/60 p-3 rounded-xl text-emerald-200 text-xs">
                ✓ Thank you for helping improve your neighborhood!
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFeedbackSuccess(true);
                }}
                className="space-y-2"
              >
                <input
                  type="text"
                  placeholder="Suggestions or remarks..."
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-200/50 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  className="w-full bg-[#F97316] hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs transition"
                >
                  Submit Feedback
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row justify-between items-center text-[11px] text-emerald-300/60 gap-2">
          <span>© 2026 CivicPulse Platform. All rights reserved.</span>
          <span>Open Civic Resolution Intelligence Engine</span>
        </div>
      </footer>
    </div>
  );
}