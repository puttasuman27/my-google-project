import React, { useState } from 'react';
import {
  Flame,
  ThumbsUp,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import ResolveIssueModal from './ResolveIssueModal';

export default function IncidentFeed({ incidents, isLoading, onRefresh, onToggleUpvote, onResolveSuccess }) {
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'RESOLVED'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncidentToResolve, setSelectedIncidentToResolve] = useState(null);

  const filtered = incidents.filter(inc => {
    const isResolved = (inc.status || '').toUpperCase() === 'RESOLVED';
    const matchesTab = activeTab === 'RESOLVED' ? isResolved : !isResolved;
    const term = searchQuery.toLowerCase();
    const matchesSearch = !term ||
      (inc.title && inc.title.toLowerCase().includes(term)) ||
      (inc.category && inc.category.toLowerCase().includes(term)) ||
      (inc.location && inc.location.toLowerCase().includes(term));
    return matchesTab && matchesSearch;
  });

  return (
    <section className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Active Incident Feed
            <button
              onClick={onRefresh}
              title="Refresh from BigQuery"
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0B4D3C]' : ''}`} />
            </button>
          </h3>
          <p className="text-xs text-slate-500">Live clusters streamed from BigQuery warehouse with 48h resolution audit</p>
        </div>

        {/* Tabs & Search */}
        <div className="flex items-center gap-2">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeTab === 'ACTIVE' ? 'bg-[#0B4D3C] text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Active Hazards
            </button>
            <button
              onClick={() => setActiveTab('RESOLVED')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                activeTab === 'RESOLVED' ? 'bg-[#10B981] text-slate-950 font-extrabold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Verified Fixes
            </button>
          </div>

          <div className="relative w-full sm:w-56">
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
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-[24px] text-slate-400 text-sm">
          No incidents found under the "{activeTab.toLowerCase()}" filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((inc) => (
            <div
              key={inc.id}
              className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    inc.status === 'RESOLVED'
                      ? 'bg-emerald-50 text-[#047857] border border-emerald-200'
                      : inc.severity && (inc.severity.includes('High') || inc.severity.includes('Critical'))
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-orange-50 text-[#F97316] border border-orange-200'
                  }`}>
                    {inc.status === 'RESOLVED' ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <Flame className="w-3 h-3 mr-1" />
                    )}
                    {inc.status === 'RESOLVED' ? 'Verified Fixed' : (inc.severity || "P2 - Moderate")}
                  </span>

                  <button
                    onClick={() => onToggleUpvote(inc.id)}
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
                
                {inc.status !== 'RESOLVED' ? (
                  <button
                    onClick={() => setSelectedIncidentToResolve(inc)}
                    className="text-[#0B4D3C] hover:text-[#047857] font-bold text-xs flex items-center gap-1 hover:underline"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Verify Fix</span>
                  </button>
                ) : (
                  <span className="font-bold text-[#10B981] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Closed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verification Modal triggered from citizen feed */}
      <ResolveIssueModal
        isOpen={!!selectedIncidentToResolve}
        onClose={() => setSelectedIncidentToResolve(null)}
        incident={selectedIncidentToResolve}
        onResolveSuccess={(id, audit) => {
          if (onResolveSuccess) onResolveSuccess(id, audit);
          setSelectedIncidentToResolve(null);
        }}
      />
    </section>
  );
}