import React from 'react';
import {
  ShieldCheck,
  Target,
  Sparkles,
  Users,
  Building2,
  TrendingUp,
  Award,
  Zap,
  Clock,
  Layers,
  HeartHandshake
} from 'lucide-react';

export default function MissionGoals() {
  return (
    <section className="space-y-6 pt-4">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#0B4D3C] via-[#0D5C48] to-[#10B981] p-8 sm:p-10 rounded-[32px] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 bg-[#F97316] text-white text-[11px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full shadow-sm">
            <Target className="w-3.5 h-3.5" /> Civic Mission & Vision 2030
          </span>
          <h2 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight">
            Building Smarter, Accountable, and Hazard-Free Neighborhoods.
          </h2>
          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
            CivicPulse transforms municipal operations from slow, paperwork-heavy complaint logs into real-time 
            <strong> Resolution Intelligence</strong> powered by Gemini Multimodal Vision, BigQuery GIS, and automated dual-photo audits.
          </p>
        </div>

        {/* Background Decorative Rings */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
      </div>

      {/* 2. Core Operational Pillars (Aesthetic Cards with imagery) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1 */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center font-black">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Zero Duplicate Noise</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When 50 citizens report the same deep pothole, our BigQuery GIS clustering engine merges them into a single canonical cluster within 50 meters, eliminating backlogs.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-50 text-[11px] font-bold text-orange-600 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> 68.4% Average Redundancy Reduction
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#0B4D3C] flex items-center justify-center font-black">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Predictive SLA Routing</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Automated routing directs high-priority arterial hazards to specialized municipal dispatch crews with 12h, 24h, and 48h active countdown timers.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-50 text-[11px] font-bold text-[#0B4D3C] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> 18.4 hrs Average Turnaround Time
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#10B981] flex items-center justify-center font-black">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Dual-Photo AI Verification</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Zero fake closures. Field contractors and citizens must provide repair photos audited by the Gemini Resolution Agent before tickets can be marked resolved.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-50 text-[11px] font-bold text-emerald-600 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" /> 99.1% Verified Fix Accuracy
          </div>
        </div>
      </div>

      {/* 3. Community Creed & Leadership Showcase */}
      <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
            alt="Citizen Leader"
            className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-md"
          />
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[#0B4D3C] tracking-wider block">Citizen Voice & Governance</span>
            <h4 className="font-black text-slate-900 text-base">"Transparent cities built by proactive citizens."</h4>
            <p className="text-xs text-slate-500">Empowering ward communities with open, verifiable defect accountability.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#F4F8F6] px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
          <HeartHandshake className="w-4 h-4 text-[#F97316]" />
          <span>Open Civic Resolution Intelligence Engine</span>
        </div>
      </div>
    </section>
  );
}