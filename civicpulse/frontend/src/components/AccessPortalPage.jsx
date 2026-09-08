import React, { useState } from 'react';
import heroBg from '../assets/bg.png';
import {
  ShieldCheck,
  Building2,
  User,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  TreePine,
  Zap
} from 'lucide-react';

export default function AccessPortalPage({ onLoginSuccess, onNavigateHome }) {
  const [authMode, setAuthMode] = useState('ADMIN'); // 'CITIZEN' | 'ADMIN'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCitizenEnter = () => {
    const citizenUser = {
      name: "Public Citizen",
      email: "citizen@civicpulse.org",
      role: "CITIZEN",
      is_verified_admin: false
    };
    onLoginSuccess(citizenUser);
  };

  const handleQuickJudgeFill = () => {
    setEmail('puttasuman27@gmail.com');
    setPassword('12345678');
    setAuthMode('ADMIN');
    setErrorMessage('');
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed. Please check your credentials.");
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setErrorMessage(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative w-full rounded-[32px] sm:rounded-[36px] overflow-hidden shadow-2xl border border-emerald-900/20 flex items-center justify-center p-4 sm:p-10 min-h-[600px] bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(11, 77, 60, 0.88) 0%, rgba(11, 77, 60, 0.75) 50%, rgba(6, 43, 33, 0.94) 100%), url(${heroBg})`
      }}
    >
      {/* Ambient background glow */}
      <div className="absolute w-80 sm:w-96 h-80 sm:h-96 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Centered Glassmorphism Card */}
      <div className="relative z-10 max-w-md w-full bg-white/95 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl border border-white/40 space-y-5">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <span className="inline-flex items-center gap-1.5 bg-[#0B4D3C] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
            <TreePine className="w-3.5 h-3.5 text-[#F97316]" /> CivicPulse Identity
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Role Access Portal
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            AI-driven resolution intelligence for citizens and municipal administrators.
          </p>
        </div>

        {/* ⚡ 1-Click Demo Fill for Evaluators */}
        <button
          type="button"
          onClick={handleQuickJudgeFill}
          className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-300 text-[#0B4D3C] p-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition hover:shadow-sm active:scale-95"
        >
          <Zap className="w-4 h-4 text-[#F97316]" />
          <span>⚡ 1-Click Commissioner Auto-Fill</span>
        </button>

        {/* Role Toggle Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F4F8F6] rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => { setAuthMode('CITIZEN'); setErrorMessage(''); }}
            className={`py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
              authMode === 'CITIZEN'
                ? 'bg-white text-[#0B4D3C] shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Citizen Mode</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthMode('ADMIN'); setErrorMessage(''); }}
            className={`py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
              authMode === 'ADMIN'
                ? 'bg-[#0B4D3C] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Govt Official</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mode 1: Public Citizen */}
        {authMode === 'CITIZEN' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-[#0B4D3C] block text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> Public Citizen Access
              </span>
              <p className="text-[11px] leading-relaxed">
                Snap defect photos, voice notes, track 50m BigQuery incident clusters, and verify fixes in real time.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCitizenEnter}
              className="w-full bg-[#F97316] hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition active:scale-95"
            >
              <span>Continue to Citizen Hub</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Mode 2: Official Admin Login (No plaintext password hint box) */
          <form onSubmit={handleAdminSubmit} className="space-y-3.5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Government Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@civicpulse.org"
                  className="w-full bg-[#F4F8F6] border border-slate-200 text-xs font-bold text-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-[#0B4D3C]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Access PIN / Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F4F8F6] border border-slate-200 text-xs font-bold text-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-[#0B4D3C]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0B4D3C] hover:bg-[#047857] text-white font-black py-3.5 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition active:scale-95 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F97316]" />
                  <span>Sign In to Admin Portal</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="pt-3 border-t border-slate-100 text-center space-y-1">
          <p className="text-[10px] text-slate-400 font-medium">
            Powered by Gemini Multimodal Vision • BigQuery GIS • Google Cloud Run
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-[11px] font-bold text-[#0B4D3C] hover:underline"
          >
            ← Back to Home
          </button>
        </div>

      </div>
    </div>
  );
}