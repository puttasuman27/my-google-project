import React, { useState } from 'react';

export default function AdminDashboard() {
  const [selectedWard, setSelectedWard] = useState('Ward 14 - Central Core');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#0B4D3C]">Municipal Operations Portal</h2>
          <p className="text-xs text-slate-500">Ward Task Routing & SLA Management Queue</p>
        </div>

        <select 
          value={selectedWard} 
          onChange={(e) => setSelectedWard(e.target.value)}
          className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none"
        >
          <option>Ward 14 - Central Core</option>
          <option>Ward 12 - North Sector</option>
          <option>Ward 18 - South Industrial</option>
        </select>
      </div>

      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B4D3C] text-white">
            <tr>
              <th className="p-4">Incident ID</th>
              <th className="p-4">Category</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Department</th>
              <th className="p-4 text-center">SLA Countdown</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="p-4 font-bold text-slate-900">inc_8a084853</td>
              <td className="p-4">Streetlight</td>
              <td className="p-4">
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">P1 - High</span>
              </td>
              <td className="p-4">Electrical & Public Lighting</td>
              <td className="p-4 text-center font-bold text-[#F97316]">11h 24m remaining</td>
              <td className="p-4">
                <button className="bg-[#10B981] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-600 transition">
                  Dispatch Field Crew
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}