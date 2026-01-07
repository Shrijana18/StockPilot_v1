import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const ProblemSolutionSection = () => {
  const [activeTab, setActiveTab] = useState('problem');

  const problems = [
    {
      icon: '⏰',
      title: 'Hours Wasted',
      description: 'Manual billing takes 5-10 minutes per invoice. Multiply that by hundreds of invoices per day.',
      stat: '12+ hours/week'
    },
    {
      icon: '📊',
      title: 'No Real-time Data',
      description: 'Inventory updates happen manually. Stock levels are always outdated. No visibility into what\'s selling.',
      stat: 'Outdated Info'
    },
    {
      icon: '💬',
      title: 'Poor Communication',
      description: 'Distributors and retailers communicate via phone calls and WhatsApp. No organized system.',
      stat: 'Chaos'
    },
    {
      icon: '📈',
      title: 'No Insights',
      description: 'Can\'t track which products sell best, which customers are most valuable, or predict demand.',
      stat: 'Blind Decisions'
    }
  ];

  const solutions = [
    {
      icon: '⚡',
      title: 'Voice Billing',
      description: 'Generate invoices in seconds by speaking. No typing, no errors, instant results.',
      stat: '30 sec/invoice'
    },
    {
      icon: '🤖',
      title: 'AI-Powered Inventory',
      description: 'Scan invoices with OCR, AI automatically creates inventory. Real-time sync across all devices.',
      stat: 'Real-time Sync'
    },
    {
      icon: '💬',
      title: 'Meta WhatsApp Integration',
      description: 'Send invoices, order updates, and promotions via WhatsApp Business API. Official Meta Tech Provider.',
      stat: 'Instant Delivery'
    },
    {
      icon: '📊',
      title: 'Smart Analytics',
      description: 'AI-powered insights show you what\'s selling, who\'s buying, and what to order next.',
      stat: 'Data-Driven'
    }
  ];

  return (
    <section id="problem-solution" className="py-24 px-6 md:px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em] mb-4">The Story</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            From <span className="text-red-400">Problems</span> to <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">Solutions</span>
          </h2>
          <p className="text-white/70 max-w-3xl mx-auto text-lg">
            Every business faces challenges. FLYP transforms them into opportunities.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center gap-4 mb-12">
          <button
            onClick={() => setActiveTab('problem')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'problem'
                ? 'bg-red-400/20 border-2 border-red-400/50 text-red-300 scale-105'
                : 'bg-white/5 border border-white/10 text-white/70 hover:border-red-400/30'
            }`}
          >
            The Problem
          </button>
          <button
            onClick={() => setActiveTab('solution')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'solution'
                ? 'bg-emerald-400/20 border-2 border-emerald-400/50 text-emerald-300 scale-105'
                : 'bg-white/5 border border-white/10 text-white/70 hover:border-emerald-400/30'
            }`}
          >
            FLYP Solution
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === 'problem' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === 'problem' ? 20 : -20 }}
            transition={{ duration: 0.4 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {(activeTab === 'problem' ? problems : solutions).map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-6 rounded-2xl border backdrop-blur ${
                  activeTab === 'problem'
                    ? 'bg-red-400/5 border-red-400/20 hover:border-red-400/40'
                    : 'bg-emerald-400/5 border-emerald-400/20 hover:border-emerald-400/40'
                } transition-all hover:scale-105`}
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    activeTab === 'problem'
                      ? 'bg-red-400/20 text-red-300'
                      : 'bg-emerald-400/20 text-emerald-300'
                  }`}>
                    {item.stat}
                  </span>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link to="/auth?type=register">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-4 rounded-xl font-bold text-lg text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_40px_rgba(16,185,129,0.3)] transition-all"
            >
              Transform Your Business →
            </motion.button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolutionSection;

