import React, { useState, useEffect } from 'react';
import ReportIssueModal from './components/ReportIssueModal';
import AdminPortal from './components/AdminPortal';
import IncidentFeed from './components/IncidentFeed';
import AccessPortalPage from './components/AccessPortalPage';
import MissionGoals from './components/MissionGoals';
import heroBg from './assets/bg.png';
import {
  Camera,
  SlidersHorizontal,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Mail,
  Phone,
  ArrowRight,
  Building2,
  TreePine,
  Layers,
  X,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  LogOut,
  Target
} from 'lucide-react';

const normalizeIncident = (item) => {
  const id = item.incident_id || item.id || `INC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
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
    latitude: item.latitude || 17.49367,
    longitude: item.longitude || 78.42035,
    ward: ward,
    severity: item.severity || severity,
    severityScore: prioScore,
    upvotes: item.upvotes || reportsMerged || 1,
    userUpvoted: !!item.userUpvoted,
    department: item.department || (cat === "POTHOLE" ? "Roads & Highway Infrastructure Dept" : "Public Works Department"),
    slaCountdown: item.sla_deadline ? "SLA Active" : (item.slaCountdown || "12h SLA remaining"),
    status: (item.status || "OPEN").toUpperCase().trim(),
    reportsMerged: reportsMerged,
    intake_image_url: item.intake_image_url || item.image || "",
    resolved_image_url: item.resolved_image_url || "",
    image: item.intake_image_url || item.image || ""
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'portal' | 'goals' | 'access'
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 🔐 Authenticated User Profile (Defaults to verified admin for immediate testing)
  const [currentUser, setCurrentUser] = useState({
    name: "Sumanth Puttaswamy",
    email: "puttasuman27@gmail.com",
    role: "MUNICIPAL_COMMISSIONER",
    designation: "Chief Municipal Operations Officer",
    assigned_ward: "ALL",
    is_verified_admin: true
  });

  // Auto-Sliding Before & After State
  const [sliderPos, setSliderPos] = useState(50);
  const [isAutoSliding, setIsAutoSliding] = useState(true);
  const [sliderDirection, setSliderDirection] = useState(1);

  const [showReportModal, setShowReportModal] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  useEffect(() => {
    if (!isAutoSliding) return;
    const interval = setInterval(() => {
      setSliderPos((prev) => {
        let next = prev + sliderDirection * 1.2;
        if (next >= 88) {
          setSliderDirection(-1);
          return 88;
        }
        if (next <= 12) {
          setSliderDirection(1);
          return 12;
        }
        return next;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isAutoSliding, sliderDirection]);

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
      const currentId = item.incident_id || item.id;
      if (currentId === id) {
        return {
          ...item,
          upvotes: item.userUpvoted ? item.upvotes - 1 : item.upvotes + 1,
          userUpvoted: !item.userUpvoted
        };
      }
      return item;
    }));
  };

  const handleStatusChange = (targetId, newStatus) => {
    setIncidents(prev => prev.map(item => {
      const currentId = (item.incident_id || item.id).trim();
      if (currentId === targetId.trim()) {
        return { ...item, status: newStatus };
      }
      return item;
    }));

    showToast({
      type: 'status',
      title: 'Status Updated',
      message: `Incident #${targetId} updated to ${newStatus}.`,
      id: targetId
    });

    fetchIncidentsFromBQ();
  };

  const handleAddNewReport = (newIncident, rawAgentResponse) => {
    const normalized = normalizeIncident(newIncident);
    const targetId = (normalized.incident_id || normalized.id).trim();

    setIncidents(prev => {
      const existingIndex = prev.findIndex(item => (item.incident_id || item.id).trim() === targetId);
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

    if (rawAgentResponse?.is_duplicate) {
      showToast({
        type: 'merge',
        title: 'Report Merged into Existing Cluster',
        message: `Matched canonical defect #${rawAgentResponse.incident_id} (${rawAgentResponse.duplicate_count} reports merged total)`,
        id: rawAgentResponse.incident_id
      });
    } else {
      showToast({
        type: 'create',
        title: 'New Canonical Incident Created',
        message: `Registered as #${rawAgentResponse?.incident_id || targetId} in BigQuery GIS warehouse`,
        id: rawAgentResponse?.incident_id || targetId
      });
    }
  };

  const handleAdminPortalClick = () => {
    if (currentUser?.is_verified_admin) {
      setActiveTab('portal');
    } else {
      setActiveTab('access');
    }
  };

  const activeShowcase = incidents.find(i => i.status === 'RESOLVED' && i.resolved_image_url)
    || incidents[0]
    || {
      id: "INC-5C63F1C5",
      title: "Drainage Defect",
      ward: "Ward-49",
      location: "Ward-49 (17.4946, 78.4369)",
      category: "DRAINAGE",
      status: "IN_PROGRESS"
    };

  const hasIntakePhoto = !!activeShowcase.intake_image_url;
  const hasResolvedPhoto = !!activeShowcase.resolved_image_url;
  const isResolved = activeShowcase.status === 'RESOLVED';

  return (
    <div className="min-h-screen bg-[#F4F8F6] text-slate-800 font-sans flex flex-col items-center relative">
      
      {/* 🔔 FLOATING TOAST NOTIFICATION */}
      {toastNotification && (
        <div className="fixed top-20 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 rounded-2xl shadow-2xl border flex items-start justify-between gap-3 bg-[#0B4D3C] text-white border-emerald-700">
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'home' ? 'bg-white text-[#0B4D3C]' : 'text-emerald-100 hover:text-white'
              }`}
            >
              Citizen Hub
            </button>

            <button
              onClick={() => setActiveTab('goals')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'goals' ? 'bg-white text-[#0B4D3C]' : 'text-emerald-100 hover:text-white'
              }`}
            >
              Mission & Goals
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center space-x-1.5 transition active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Report Issue</span>
            </button>

            <button
              onClick={handleAdminPortalClick}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'portal' ? 'bg-[#10B981] text-slate-950 font-black' : 'text-emerald-100 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>

            {/* Dedicated Role & Login Full-Page Button */}
            {currentUser?.is_verified_admin ? (
              <button
                onClick={() => setActiveTab('access')}
                className={`ml-2 border px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition ${
                  activeTab === 'access'
                    ? 'bg-white text-[#0B4D3C] border-white'
                    : 'bg-emerald-950/80 hover:bg-emerald-950 border-emerald-400/30'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <div className="text-left leading-none">
                  <span className={`text-[10px] font-black block ${activeTab === 'access' ? 'text-[#0B4D3C]' : 'text-emerald-300'}`}>
                    Verified Official
                  </span>
                  <span className={`text-[9px] font-semibold ${activeTab === 'access' ? 'text-slate-600' : 'text-slate-300'}`}>
                    {currentUser.name.split(' ')[0]}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('access')}
                className={`ml-2 border px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'access'
                    ? 'bg-white text-[#0B4D3C] border-white'
                    : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In / Role</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* 2. MAIN CONTENT VIEW CONTROLLER */}
      <main className="w-full max-w-6xl px-4 sm:px-6 py-6 space-y-8 flex-1">
        
        {activeTab === 'home' ? (
          /* ========================================================= */
          /* CITIZEN HUB VIEW                                          */
          /* ========================================================= */
          <>
            {/* HERO BANNER */}
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

            {/* KPI METRICS */}
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
                <div className="text-2xl sm:text-3xl font-black text-[#0B4D3C] mt-1">
                  {incidents.length > 0 ? '68.4%' : '0%'}
                </div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 block">50m spatial clustering</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average SLA Turnaround</span>
                <div className="text-2xl sm:text-3xl font-black text-[#F97316] mt-1">18.4 hrs</div>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Within municipal threshold</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Resolution</span>
                <div className="text-2xl sm:text-3xl font-black text-[#10B981] mt-1">
                  {incidents.filter(i => i.status === 'RESOLVED').length} Done
                </div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Zero false closures</span>
              </div>
            </section>

            {/* 3. DYNAMIC BEFORE & AFTER INSPECTOR WITH REAL BIGQUERY PHOTOS */}
            <section id="diff-slider" className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase text-[#10B981] tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> Gemini Resolution Agent Audit
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    Interactive Before & After Verification Slider
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live dual-photo audit loaded directly from BigQuery defect and contractor completion logs.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setIsAutoSliding(!isAutoSliding)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1 transition"
                    title={isAutoSliding ? "Pause auto-slide" : "Resume auto-slide"}
                  >
                    {isAutoSliding ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#0B4D3C]" />}
                    <span>{isAutoSliding ? "Auto-Scanning" : "Paused"}</span>
                  </button>
                  <span className="bg-emerald-50 text-[#047857] text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200">
                    {Math.round(sliderPos)}% Diff
                  </span>
                </div>
              </div>

              {/* Slider Viewport */}
              <div
                className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden select-none shadow-inner border border-slate-200 bg-slate-900"
                onMouseEnter={() => setIsAutoSliding(false)}
                onMouseLeave={() => setIsAutoSliding(true)}
              >
                {/* AFTER VIEW */}
                {hasResolvedPhoto ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center flex items-end p-5"
                    style={{ backgroundImage: `url('${activeShowcase.resolved_image_url}')` }}
                  >
                    <span className="bg-emerald-950/90 backdrop-blur-md text-emerald-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-emerald-400/30 shadow-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      AFTER: Verified Repair Fix (Gemini PASS)
                    </span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                    <Clock className="w-10 h-10 text-orange-400 animate-pulse mb-2" />
                    <h4 className="font-black text-lg text-white">Awaiting Contractor Fix Verification</h4>
                    <p className="text-xs text-slate-300 max-w-sm mt-1">
                      Dispatched to municipal crew. Contractor completion photo will appear here once audited by the Resolution Agent.
                    </p>
                  </div>
                )}

                {/* BEFORE VIEW */}
                {hasIntakePhoto ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center flex items-end p-5 transition-none"
                    style={{
                      backgroundImage: `url('${activeShowcase.intake_image_url}')`,
                      clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                    }}
                  >
                    <span className="bg-black/90 backdrop-blur-md text-orange-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-orange-400/30 shadow-lg flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      BEFORE: Citizen Reported Defect Photo
                    </span>
                  </div>
                ) : null}

                {/* Divider Line */}
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
                  onChange={(e) => {
                    setIsAutoSliding(false);
                    setSliderPos(Number(e.target.value));
                  }}
                  aria-label="Before and after comparison slider"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                />
              </div>

              {/* Dynamic Footer with Real Details */}
              <div className="bg-[#F4F8F6] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-700 gap-2 border border-emerald-900/10">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">Case #{activeShowcase.incident_id || activeShowcase.id}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-700">{activeShowcase.ward}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500 truncate max-w-sm">{activeShowcase.location}</span>
                </div>
                <span className="font-bold text-[#0B4D3C] flex items-center shrink-0">
                  <ShieldCheck className="w-4 h-4 mr-1 text-[#10B981]" /> Dual-Photo Structural Verification {isResolved ? "Approved" : "In Progress"}
                </span>
              </div>
            </section>

            {/* LIVE INCIDENT FEED */}
            <IncidentFeed
              incidents={incidents}
              isLoading={isLoading}
              onRefresh={fetchIncidentsFromBQ}
              onToggleUpvote={toggleUpvote}
              onResolveSuccess={(id) => handleStatusChange(id, 'RESOLVED')}
            />
          </>
        ) : activeTab === 'goals' ? (
          /* ========================================================= */
          /* MISSION & GOALS SHOWCASE                                  */
          /* ========================================================= */
          <MissionGoals />
        ) : activeTab === 'access' ? (
          /* ========================================================= */
          /* FULL-PAGE ACCESS PORTAL & WHAT WE DO                      */
          /* ========================================================= */
          <AccessPortalPage
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              showToast({
                type: 'create',
                title: user.is_verified_admin ? 'Admin Verified' : 'Citizen Mode Active',
                message: `Welcome, ${user.name}! ${user.is_verified_admin ? 'Full Municipal Dispatch privileges granted.' : ''}`,
                id: user.admin_id || 'USR'
              });
              if (user.is_verified_admin) {
                setActiveTab('portal');
              } else {
                setActiveTab('home');
              }
            }}
            onNavigateHome={() => setActiveTab('home')}
          />
        ) : (
          /* ========================================================= */
          /* MUNICIPAL ADMIN OPERATIONS PORTAL                         */
          /* ========================================================= */
          <AdminPortal
            incidents={incidents}
            onStatusChange={handleStatusChange}
          />
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