import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Building2,
  Filter,
  CheckCircle2,
  Flame,
  Truck,
  ShieldCheck,
  Search,
  MapPin,
  Loader2
} from 'lucide-react';
import ResolveIssueModal from './ResolveIssueModal';

const incidentMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function AdminPortal({ incidents, onStatusChange }) {
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [dispatchingId, setDispatchingId] = useState(null);
  const [verifyingIncident, setVerifyingIncident] = useState(null);

  const WARDS = [
    { id: 'ALL', label: 'All Municipal Wards' },
    { id: 'Ward 14', label: 'Ward 14 - Central Core' },
    { id: 'Ward 49', label: 'Ward 49 - West District' },
    { id: 'Ward 94', label: 'Ward 94 - North Commercial' },
    { id: 'Ward 12', label: 'Ward 12 - Industrial Belt' }
  ];

  const filteredIncidents = incidents.filter(inc => {
    const incStatus = (inc.status || 'OPEN').toUpperCase().trim();
    const matchesWard = selectedWard === 'ALL' || (inc.ward || '').toLowerCase().includes(selectedWard.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' || incStatus === selectedStatus;
    const term = searchFilter.toLowerCase();
    const incId = (inc.incident_id || inc.id || '').toLowerCase();
    const incCat = (inc.category || '').toLowerCase();
    const incTitle = (inc.title || '').toLowerCase();
    const matchesSearch = !term || incTitle.includes(term) || incId.includes(term) || incCat.includes(term);
    return matchesWard && matchesStatus && matchesSearch;
  });

  const handleDispatchCrew = async (incident) => {
    const targetId = (incident.incident_id || incident.id).trim();
    setDispatchingId(targetId);
    try {
      const res = await fetch(`/api/v1/incidents/${targetId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' })
      });
      if (res.ok && onStatusChange) {
        onStatusChange(targetId, 'IN_PROGRESS');
      }
    } catch (err) {
      console.error("Dispatch notice:", err);
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Ward Filter */}
      <div className="bg-white p-5 sm:p-8 rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#0B4D3C] text-white">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Municipal Operations Portal</h2>
              <p className="text-xs text-slate-500">Live BigQuery SLA Routing, GIS Pinpointing & Field Crew Dispatch</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="w-full md:w-64 bg-[#F4F8F6] border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-[#0B4D3C]"
          >
            {WARDS.map(w => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Operations GIS Map */}
      <div className="bg-white p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#F97316]" /> Live Ward Map ({filteredIncidents.length} active)
          </span>
          <span className="text-slate-400 text-[11px]">BigQuery GIS</span>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-56 sm:h-64 relative z-0">
          <MapContainer
            center={[17.49367, 78.42035]}
            zoom={13}
            scrollWheelZoom={false}
            className="w-full h-full"
          >
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filteredIncidents.map((inc) => {
              const currentId = inc.incident_id || inc.id;
              const lat = parseFloat(inc.latitude || 17.49367);
              const lng = parseFloat(inc.longitude || 78.42035);
              return (
                <Marker key={currentId} position={[lat, lng]} icon={incidentMarkerIcon}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <strong className="block text-slate-900">{inc.title}</strong>
                      <span className="text-[10px] text-slate-500 block">ID: {currentId}</span>
                      <span className="text-[10px] font-bold text-orange-600 block">Status: {inc.status}</span>
                      <span className="text-[10px] text-slate-400 block">{inc.ward}</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* 3. Responsive Triage & Dispatch Table */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedStatus === st
                    ? 'bg-[#0B4D3C] text-white shadow-sm'
                    : 'bg-[#F4F8F6] text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search ID, category, or title..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#F4F8F6] border border-slate-200 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-[#0B4D3C]"
            />
          </div>
        </div>

        {/* Scrollable Container for Mobile */}
        <div className="overflow-x-auto">
          <div className="min-w-[650px]">
            {/* Table Header */}
            <div className="bg-[#0B4D3C] text-white px-6 py-3.5 text-xs font-bold grid grid-cols-6 gap-2">
              <span>Incident ID</span>
              <span>Category & Ward</span>
              <span>Priority</span>
              <span>Assigned Dept</span>
              <span>SLA Countdown</span>
              <span className="text-right">Action</span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100">
              {filteredIncidents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  No matching work orders found for the selected filter.
                </div>
              ) : (
                filteredIncidents.map((inc) => {
                  const currentId = inc.incident_id || inc.id;
                  const isResolved = (inc.status || '').toUpperCase() === 'RESOLVED';
                  const isInProgress = (inc.status || '').toUpperCase() === 'IN_PROGRESS';

                  return (
                    <div key={currentId} className="px-6 py-4 grid grid-cols-6 gap-2 items-center text-xs hover:bg-[#F4F8F6]/60 transition">
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">{currentId}</span>
                        <span className="text-[10px] text-slate-400">{inc.reportsMerged || 1} merged</span>
                      </div>

                      <div>
                        <strong className="text-slate-800 block truncate">{inc.category}</strong>
                        <span className="text-[10px] text-slate-500 block truncate">{inc.ward}</span>
                      </div>

                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          inc.severity && (inc.severity.includes('High') || inc.severity.includes('Critical'))
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-orange-50 text-[#F97316] border-orange-200'
                        }`}>
                          <Flame className="w-2.5 h-2.5 mr-1" /> {inc.severity || "P2 - Moderate"}
                        </span>
                      </div>

                      <span className="text-slate-600 truncate">{inc.department}</span>

                      <div>
                        <span className={`font-bold block ${isResolved ? 'text-[#10B981]' : 'text-[#F97316]'}`}>
                          {isResolved ? 'Verified Done' : (inc.slaCountdown || 'In Progress')}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isResolved ? 'text-emerald-600' : isInProgress ? 'text-orange-600' : 'text-slate-400'
                        }`}>
                          {isInProgress ? '● EN ROUTE' : inc.status || 'OPEN'}
                        </span>
                      </div>

                      <div className="text-right flex items-center justify-end gap-2">
                        {!isResolved ? (
                          <>
                            {!isInProgress ? (
                              <button
                                onClick={() => handleDispatchCrew(inc)}
                                disabled={dispatchingId === currentId}
                                className="bg-[#0B4D3C] hover:bg-[#047857] text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shrink-0 disabled:opacity-60 shadow-sm active:scale-95"
                              >
                                {dispatchingId === currentId ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Truck className="w-3 h-3 text-[#F97316]" />
                                )}
                                <span>Dispatch</span>
                              </button>
                            ) : (
                              <span className="bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-1 rounded-xl font-extrabold text-[11px] flex items-center gap-1 shrink-0">
                                <Truck className="w-3 h-3" /> En Route
                              </span>
                            )}

                            <button
                              onClick={() => setVerifyingIncident(inc)}
                              className="bg-[#10B981] hover:bg-emerald-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shrink-0 shadow-sm active:scale-95"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verify Fix</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Closed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolution Verification Modal */}
      <ResolveIssueModal
        isOpen={!!verifyingIncident}
        onClose={() => setVerifyingIncident(null)}
        incident={verifyingIncident}
        onResolveSuccess={(id, audit) => {
          if (onStatusChange) onStatusChange(id, 'RESOLVED');
          setVerifyingIncident(null);
        }}
      />
    </div>
  );
}