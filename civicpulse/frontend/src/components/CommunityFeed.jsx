import React from 'react';
import { Camera, ArrowRight, Flame } from 'lucide-react';
import heroBg from '../assets/hero-bg.png';

export default function CommunityFeed({ onNavigateReport }) {
  return (
    <div className="space-y-6">
      {/* Hero Banner with Background Illustration */}
      <div 
        className="relative text-white p-8 rounded-card shadow-civic overflow-hidden bg-cover bg-center border border-slate-200/20"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        {/* Dark Emerald Backdrop Overlay for Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B4D3C]/95 via-[#0B4D3C]/85 to-[#0B4D3C]/60 backdrop-blur-[1px]" />

        <div className="relative z-10 max-w-xl space-y-3">
          <span className="inline-block text-xs font-bold text-civic-mint bg-white/10 backdrop-blur-md px-3 py-1 rounded-full uppercase tracking-wider">
            Community Overview
          </span>
          <h2 className="text-3xl font-extrabold leading-tight">
            Be the Change in Your Neighborhood
          </h2>
          <p className="text-emerald-100/90 text-sm">
            Real-time crowdsourced reporting powered by Gemini Agentic Triage and automated municipal dispatch.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
              <span className="text-xs text-emerald-200 font-medium">Issues Verified Today</span>
              <p className="text-2xl font-black text-white mt-0.5">142</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
              <span className="text-xs text-amber-200 font-medium">Avg Resolution SLA</span>
              <p className="text-2xl font-black text-civic-orange mt-0.5">18.4 Hrs</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button 
        onClick={onNavigateReport}
        className="w-full bg-civic-orange hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-2xl shadow-floating flex items-center justify-between transition"
      >
        <div className="flex items-center space-x-3">
          <Camera className="w-5 h-5" />
          <span>Submit New Infrastructure Report</span>
        </div>
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Feed Cards */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-slate-900">Recent Nearby Incidents</h3>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-civic-orange">
              <Flame className="w-3 h-3 mr-1" /> High Severity (0.88)
            </span>
            <span className="text-xs text-slate-400 font-semibold">Report #rep_cb2f3e97</span>
          </div>
          <h4 className="font-bold text-slate-900 text-base">Hanging Electrical Lamp Fixture</h4>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500">Assigned: Electrical & Public Lighting Dept</span>
            <span className="text-civic-mint font-bold">● In Progress (SLA: 12h)</span>
          </div>
        </div>
      </div>
    </div>
  );
}