import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  User,
  Lock,
  Mail,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('CITIZEN'); // 'CITIZEN' | 'ADMIN'
  const [email, setEmail] = useState('puttasuman27@gmail.com');
  const [password, setPassword] = useState('12345678');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleCitizenEnter = () => {
    const citizenUser = {
      name: "Public Citizen",
      email: "citizen@civicpulse.org",
      role: "CITIZEN",
      is_verified_admin: false
    };
    onLoginSuccess(citizenUser);
    onClose();
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
        throw new Error(data.detail || "Authentication failed. Check credentials.");
      }

      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black uppercase text-[#0B4D3C] tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" /> CivicPulse Role Portal
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              Select Your Access Level
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Citizen vs Municipal Official */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4F8F6] rounded-2xl border border-slate-200">
          <button
            onClick={() => { setAuthMode('CITIZEN'); setErrorMessage(''); }}
            className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              authMode === 'CITIZEN'
                ? 'bg-white text-[#0B4D3C] shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Citizen Mode</span>
          </button>

          <button
            onClick={() => { setAuthMode('ADMIN'); setErrorMessage(''); }}
            className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              authMode === 'ADMIN'
                ? 'bg-[#0B4D3C] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#F97316]" />
            <span>Govt Official</span>
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {authMode === 'CITIZEN' ? (
          /* Citizen View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-slate-600 space-y-2">
              <span className="font-bold text-[#0B4D3C] block text-sm">Public Access Unlocked</span>
              <p>
                Report hazards, track live BigQuery clusters, upvote road defects, and audit repaired sites without any government credentials.
              </p>
            </div>

            <button
              onClick={handleCitizenEnter}
              className="w-full bg-[#F97316] hover:bg-orange-600 text-white font-extrabold py-3.5 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition active:scale-95"
            >
              <span>Continue as Citizen</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Official Admin Login Form */
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Government Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="puttasuman27@gmail.com"
                  className="w-full bg-[#F4F8F6] border border-slate-200 text-xs font-bold text-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-[#0B4D3C]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">Password / Access PIN</label>
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
              <span className="text-[10px] text-slate-400 block pt-0.5">
                Default Officer Demo: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">12345678</code>
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0B4D3C] hover:bg-[#047857] text-white font-extrabold py-3.5 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition active:scale-95 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials in BigQuery...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F97316]" />
                  <span>Verify & Unlock Admin Portal</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}