import React from 'react';
import { motion } from 'framer-motion';

const DynamicChart = ({ config, data, title }) => {
  // Normalize data input to always be an array when charts expect arrays
  const safeData = Array.isArray(data)
    ? data
    : Array.isArray(config?.data)
    ? config.data
    : [];

  const renderChart = () => {
    if (!config) return null;

    switch (config.type) {
      case 'line':
        return <LineChart data={safeData} config={config} />;
      case 'bar':
        return <BarChart data={safeData} config={config} />;
      case 'pie':
        return <PieChart data={safeData} config={config} />;
      case 'number':
        return <NumberDisplay data={data} config={config} />;
      case 'table':
        return <DataTable data={safeData} config={config} />;
      default:
        return <div className="text-white/60 text-center py-8">Chart type not supported</div>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4 h-80 overflow-hidden shadow-lg relative group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-full"></div>
          <h4 className="font-semibold text-white text-sm truncate">{title}</h4>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-emerald-300 font-medium">Live</span>
        </div>
      </div>
      
      <div className="h-full overflow-auto">
        {renderChart()}
      </div>
    </motion.div>
  );
};

// Enhanced Line Chart Component
const LineChart = ({ data, config }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/50">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-sm">No data available</div>
      </div>
    );
  }
  
  const values = data.map(d => Number(d.value) || 0);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);

  return (
    <div className="h-full flex flex-col">
      {/* Value indicators */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-emerald-300 font-medium">
          Max: {maxValue.toLocaleString()}
        </div>
        <div className="text-xs text-cyan-300 font-medium">
          Min: {minValue.toLocaleString()}
        </div>
      </div>
      
      <div className="flex-1 relative">
        <svg className="w-full h-full" viewBox="0 0 300 200">
          {/* Enhanced grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.1)" />
            </linearGradient>
          </defs>
          
          {/* Grid background */}
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Area under curve */}
          <path
            d={`M 10 190 ${data.map((point, index) => {
              const x = (index / (data.length - 1)) * 280 + 10;
              const y = 190 - ((point.value - minValue) / range) * 170;
              return `L ${x} ${y}`;
            }).join(' ')} L 290 190 Z`}
            fill="url(#areaGradient)"
          />
          
          {/* Animated line path */}
          <motion.path
            d={data.map((point, index) => {
              const x = (index / (data.length - 1)) * 280 + 10;
              const y = 190 - ((point.value - minValue) / range) * 170;
              return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          
          {/* Animated data points */}
          {data.map((point, index) => {
            const x = (index / (data.length - 1)) * 280 + 10;
            const y = 190 - ((point.value - minValue) / range) * 170;
            return (
              <motion.circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="#10b981"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="hover:r-6 transition-all duration-300 cursor-pointer"
              >
                <title>{point.label || point.date || `Point ${index + 1}`}: {point.value}</title>
              </motion.circle>
            );
          })}
        </svg>
      </div>
      
      {/* Enhanced X-axis labels */}
      <div className="flex justify-between text-xs text-white/60 mt-3">
        {data.map((point, index) => (
          <span key={index} className="truncate font-medium">
            {point.label || point.date || `P${index + 1}`}
          </span>
        ))}
      </div>
    </div>
  );
};

// Enhanced Bar Chart Component
const BarChart = ({ data, config }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/50">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-sm">No data available</div>
      </div>
    );
  }
  
  const maxValue = Math.max(...data.map(d => Number(d.value) || 0), 1);
  
  return (
    <div className="h-full flex flex-col">
      {/* Value indicators */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs text-emerald-300 font-medium">
          Max: {maxValue.toLocaleString()}
        </div>
        <div className="text-xs text-cyan-300 font-medium">
          Total: {data.reduce((sum, item) => sum + (Number(item.value) || 0), 0).toLocaleString()}
        </div>
      </div>
      
      <div className="flex-1 flex items-end justify-between gap-2 px-2">
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 100;
          return (
            <motion.div 
              key={index} 
              className="flex flex-col items-center flex-1 group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <motion.div
                className="w-full bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-400 rounded-t-lg transition-all duration-300 hover:opacity-90 relative overflow-hidden"
                style={{ height: `${height}%`, minHeight: '8px' }}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                whileHover={{ scale: 1.05 }}
              >
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {/* Value label on hover */}
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </div>
                </div>
              </motion.div>
              
              <div className="text-xs text-white/70 mt-2 truncate w-full text-center font-medium">
                {item.label || `Item ${index + 1}`}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Enhanced value labels */}
      <div className="flex justify-between text-xs text-white/60 mt-3">
        {data.map((item, index) => (
          <span key={index} className="truncate font-medium">
            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </span>
        ))}
      </div>
    </div>
  );
};

// Enhanced Pie Chart Component
const PieChart = ({ data, config }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/50">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-sm">No data available</div>
      </div>
    );
  }
  
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  let cumulativePercentage = 0;

  return (
    <div className="h-full flex items-center justify-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full" viewBox="0 0 200 200">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const startAngle = (cumulativePercentage / 100) * 360;
            const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
            
            const startAngleRad = (startAngle - 90) * (Math.PI / 180);
            const endAngleRad = (endAngle - 90) * (Math.PI / 180);
            
            const x1 = 100 + 80 * Math.cos(startAngleRad);
            const y1 = 100 + 80 * Math.sin(startAngleRad);
            const x2 = 100 + 80 * Math.cos(endAngleRad);
            const y2 = 100 + 80 * Math.sin(endAngleRad);
            
            const largeArcFlag = percentage > 50 ? 1 : 0;
            
            const pathData = [
              `M 100 100`,
              `L ${x1} ${y1}`,
              `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');
            
            cumulativePercentage += percentage;
            
            return (
              <motion.path
                key={index}
                d={pathData}
                fill={`hsl(${(index * 137.5) % 360}, 70%, 60%)`}
                className="hover:opacity-80 transition-opacity cursor-pointer"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                whileHover={{ scale: 1.05 }}
              >
                <title>{item.label || `Item ${index + 1}`}: {item.value} ({percentage.toFixed(1)}%)</title>
              </motion.path>
            );
          })}
        </svg>
        
        {/* Enhanced center text */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="text-center">
            <div className="text-xl font-bold text-white">{total.toLocaleString()}</div>
            <div className="text-xs text-white/60 font-medium">Total</div>
          </div>
        </motion.div>
      </div>
      
      {/* Enhanced Legend */}
      <div className="ml-6 space-y-3">
        {data.map((item, index) => (
          <motion.div 
            key={index} 
            className="flex items-center gap-3 group cursor-pointer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ x: 5 }}
          >
            <div
              className="w-4 h-4 rounded-lg shadow-lg"
              style={{ backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 60%)` }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90 font-medium truncate">
                {item.label || `Item ${index + 1}`}
              </div>
              <div className="text-xs text-white/60">
                {item.value.toLocaleString()} ({(item.value / total * 100).toFixed(1)}%)
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Enhanced Number Display Component
const NumberDisplay = ({ data, config }) => {
  const value = data.value || data;
  const label = config.label || 'Value';
  
  return (
    <div className="h-full flex flex-col items-center justify-center text-center relative">
      {/* Animated background circle */}
      <motion.div 
        className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      
      {/* Main value */}
      <motion.div 
        className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-3"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {typeof value === 'number' ? value.toLocaleString() : (() => {
          if (value == null) return '-';
          if (typeof value === 'string') return value;
          try {
            const json = JSON.stringify(value);
            return json.length > 120 ? json.slice(0, 117) + '…' : json;
          } catch (_) {
            return String(value);
          }
        })()}
      </motion.div>
      
      {/* Label */}
      <motion.div 
        className="text-lg text-white/80 font-medium mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {label}
      </motion.div>
      
      {/* Change indicator */}
      {config.change && (
        <motion.div 
          className={`text-sm px-4 py-2 rounded-full font-semibold ${
            config.change > 0 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
              : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center gap-1">
            {config.change > 0 ? (
              <motion.div
                animate={{ y: [-2, 2, -2] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ↗
              </motion.div>
            ) : (
              <motion.div
                animate={{ y: [2, -2, 2] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ↘
              </motion.div>
            )}
            <span>{config.change > 0 ? '+' : ''}{config.change}%</span>
          </div>
        </motion.div>
      )}
      
      {/* Additional metrics if available */}
      {config.subtitle && (
        <motion.div 
          className="text-xs text-white/50 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          {config.subtitle}
        </motion.div>
      )}
    </div>
  );
};

// Data Table Component
const DataTable = ({ data, config }) => {
  const columns = config.columns || Object.keys(data[0] || {});
  
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/20">
            {columns.map((col, index) => (
              <th key={index} className="text-left p-2 text-white/80 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, index) => (
            <tr key={index} className="border-b border-white/10">
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="p-2 text-white/70">
                  {typeof row[col] === 'number' ? row[col].toLocaleString() : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <div className="text-xs text-white/60 text-center py-2">
          Showing 10 of {data.length} rows
        </div>
      )}
    </div>
  );
};

export default DynamicChart;
