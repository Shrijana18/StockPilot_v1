import React, { useState, useRef, useCallback } from 'react';

/**
 * Advanced Design Tools Component
 * Features:
 * - Boundary drawing (polygon, rectangle, freehand)
 * - Measurement tools
 * - Smart alignment guides
 * - Element manipulation (move, resize, rotate, delete)
 */

const AdvancedDesignTools = ({
  onDrawBoundary,
  onMeasure,
  onAlign,
  selectedTool,
  onToolSelect,
  isDrawing,
  onCancelDrawing,
}) => {
  return (
    <div className="space-y-3">
      {/* Drawing Tools */}
      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>✏️</span> Drawing Tools
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onToolSelect('boundary-rectangle')}
            className={`px-3 py-2 rounded-lg text-xs transition-all ${
              selectedTool === 'boundary-rectangle'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            📐 Rectangle
          </button>
          <button
            onClick={() => onToolSelect('boundary-polygon')}
            className={`px-3 py-2 rounded-lg text-xs transition-all ${
              selectedTool === 'boundary-polygon'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            🔷 Polygon
          </button>
          <button
            onClick={() => onToolSelect('boundary-freehand')}
            className={`px-3 py-2 rounded-lg text-xs transition-all ${
              selectedTool === 'boundary-freehand'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            ✏️ Freehand
          </button>
          <button
            onClick={() => onToolSelect('measure')}
            className={`px-3 py-2 rounded-lg text-xs transition-all ${
              selectedTool === 'measure'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            📏 Measure
          </button>
        </div>
        {isDrawing && (
          <button
            onClick={onCancelDrawing}
            className="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30"
          >
            Cancel Drawing
          </button>
        )}
      </div>

      {/* Alignment Tools */}
      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>🎯</span> Smart Alignment
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => onAlign('left')}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-left"
          >
            ← Align Left
          </button>
          <button
            onClick={() => onAlign('center')}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-left"
          >
            ↔ Align Center
          </button>
          <button
            onClick={() => onAlign('right')}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-left"
          >
            → Align Right
          </button>
          <button
            onClick={() => onAlign('distribute')}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-left"
          >
            ⚖️ Distribute Evenly
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>⚡</span> Quick Actions
        </h3>
        <div className="space-y-2 text-xs text-white/70">
          <div className="flex items-center justify-between">
            <span>Snap to Grid</span>
            <span className="text-emerald-400">ON</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Smart Guides</span>
            <span className="text-emerald-400">ON</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Auto-Align</span>
            <span className="text-emerald-400">ON</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedDesignTools;

