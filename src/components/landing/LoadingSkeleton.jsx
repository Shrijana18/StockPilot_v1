import React from 'react';

export const SectionSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] flex items-center justify-center">
    <div className="w-full max-w-6xl mx-auto px-6 py-20">
      <div className="animate-pulse space-y-8">
        <div className="h-12 bg-white/5 rounded-lg w-3/4 mx-auto"></div>
        <div className="h-8 bg-white/5 rounded-lg w-1/2 mx-auto"></div>
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white/5 rounded-xl"></div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const CardSkeleton = () => (
  <div className="animate-pulse p-6 rounded-2xl bg-white/5 border border-white/10">
    <div className="h-8 bg-white/5 rounded-lg w-3/4 mb-4"></div>
    <div className="h-4 bg-white/5 rounded w-full mb-2"></div>
    <div className="h-4 bg-white/5 rounded w-5/6"></div>
  </div>
);

export default SectionSkeleton;

