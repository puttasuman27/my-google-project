import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function BeforeAfterSlider({ 
  beforeImg = "https://upload.wikimedia.org/wikipedia/commons/a/a8/Broken_street_lamp.jpg", 
  afterImg = "https://upload.wikimedia.org/wikipedia/commons/2/23/Street_lamp_in_street.jpg" 
}) {
  const [sliderPos, setSliderPos] = useState(50);

  return (
    <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-900 text-lg flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-[#10B981]" /> Closed-Loop Resolution Verification
        </h3>
        <span className="text-xs font-bold bg-emerald-100 text-[#0B4D3C] px-3 py-1 rounded-full">
          AI Confirmed PASS
        </span>
      </div>

      <div className="relative h-72 rounded-2xl overflow-hidden select-none border border-slate-200">
        <img src={afterImg} alt="After Repair" className="absolute inset-0 w-full h-full object-cover" />
        
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img src={beforeImg} alt="Before Damage" className="absolute inset-0 w-full h-full object-cover max-w-none" style={{ width: '100%' }} />
          <span className="absolute top-3 left-3 bg-red-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-md">
            BEFORE: Reported Hazard
          </span>
        </div>

        <span className="absolute top-3 right-3 bg-[#10B981]/90 text-white text-xs font-bold px-2.5 py-1 rounded-md">
          AFTER: Repaired & Verified
        </span>

        <input 
          type="range" min="0" max="100" value={sliderPos} 
          onChange={(e) => setSliderPos(Number(e.target.value))}
          className="absolute inset-0 opacity-0 w-full h-full cursor-ew-resize z-30"
        />
        <div className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl pointer-events-none z-20" style={{ left: `${sliderPos}%` }}>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white text-[#0B4D3C] rounded-full shadow-md flex items-center justify-center text-xs font-bold">
            ↔
          </div>
        </div>
      </div>
      <p className="text-xs text-center text-slate-500">Drag slider left/right to compare original report vs completed field repair.</p>
    </div>
  );
}