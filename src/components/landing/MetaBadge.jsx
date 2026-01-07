import React from 'react';
import { motion } from 'framer-motion';

const MetaBadge = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#0084FF]/20 to-[#0066CC]/20 border border-[#0084FF]/40 backdrop-blur-sm"
      title="Official Meta Tech Provider"
    >
      {/* Meta Infinity Logo - Continuous Loop */}
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Meta Infinity Symbol - Continuous loop path */}
        <path 
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" 
          fill="#0084FF"
          opacity="0.15"
        />
        {/* Infinity symbol - stylized as Meta logo */}
        <circle cx="9" cy="12" r="2" fill="#0084FF"/>
        <circle cx="15" cy="12" r="2" fill="#0084FF"/>
        <path 
          d="M11 10c0 .6.4 1 1 1s1-.4 1-1-.4-1-1-1-1 .4-1 1zm2 0c0 .6.4 1 1 1s1-.4 1-1-.4-1-1-1-1 .4-1 1z" 
          fill="#0084FF"
        />
        <path 
          d="M11 14c0 .6.4 1 1 1s1-.4 1-1-.4-1-1-1-1 .4-1 1zm2 0c0 .6.4 1 1 1s1-.4 1-1-.4-1-1-1-1 .4-1 1z" 
          fill="#0084FF"
        />
      </svg>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#0084FF] whitespace-nowrap">
        Meta Tech Provider
      </span>
    </motion.div>
  );
};

export default MetaBadge;
