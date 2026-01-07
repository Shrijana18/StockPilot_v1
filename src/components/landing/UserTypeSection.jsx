import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const userTypes = [
  { id: 'all', label: 'All', icon: '🌟' },
  { id: 'retailer', label: 'Retailer', icon: '🛒' },
  { id: 'distributor', label: 'Distributor', icon: '🏭' },
  { id: 'product-owner', label: 'Product Owner', icon: '📦' }
];

const featuresByType = {
  retailer: [
    { icon: '🎤', title: 'Voice Billing', desc: 'Generate invoices in seconds by speaking' },
    { icon: '📷', title: 'OCR Import', desc: 'Scan paper invoices to auto-create inventory' },
    { icon: '💳', title: 'POS Mode', desc: 'Full-screen billing interface for counter sales' },
    { icon: '📊', title: 'Customer Analytics', desc: 'Track buying patterns and boost repeat sales' },
    { icon: '💬', title: 'WhatsApp Invoices', desc: 'Share invoices instantly via WhatsApp' },
    { icon: '🤖', title: 'Smart Inventory', desc: 'AI-powered stock management with alerts' },
  ],
  distributor: [
    { icon: '🔗', title: 'Distributor Connect', desc: 'Link with retailers and product owners seamlessly' },
    { icon: '🛒', title: 'Smart Cart', desc: 'AI suggests quantities based on retailer history' },
    { icon: '⚡', title: 'Automated Billing', desc: 'Generate invoices and track payments automatically' },
    { icon: '💳', title: 'Credit Control', desc: 'Manage credit limits and send payment reminders' },
    { icon: '🏢', title: 'Multi-Branch Sync', desc: 'Real-time inventory across all locations' },
    { icon: '📦', title: 'Order Management', desc: 'Track orders from placement to delivery' },
  ],
  'product-owner': [
    { icon: '📋', title: 'Catalog Distribution', desc: 'Push product catalogs downstream instantly' },
    { icon: '🤖', title: 'AI Inventory Generator', desc: 'Create product lines with AI assistance' },
    { icon: '📈', title: 'Real-time Analytics', desc: 'See sell-through data from all retailers' },
    { icon: '💰', title: 'Price Management', desc: 'Update prices and sync across network' },
    { icon: '🌐', title: 'Network Visibility', desc: 'Track products from factory to customer' },
    { icon: '🧠', title: 'AI Assistant', desc: 'Get insights powered by Gemini AI' },
  ],
};

const UserTypeSection = () => {
  const [activeUserType, setActiveUserType] = useState('all');

  return (
    <section id="for-you" className="relative px-6 md:px-10 py-20 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em] mb-4">Built for Everyone</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            What <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">FLYP Does</span> for You
          </h2>
          <p className="text-white/70 max-w-3xl mx-auto text-lg">
            Whether you're a Retailer, Distributor, or Product Owner — FLYP transforms how you manage your supply chain.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {userTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveUserType(type.id)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                activeUserType === type.id
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-gray-900 shadow-[0_8px_30px_rgba(16,185,129,0.35)] scale-105'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:border-emerald-400/30 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="mr-2">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeUserType === 'all' ? (
            <motion.div
              key="all"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid md:grid-cols-3 gap-6"
            >
              {['retailer', 'distributor', 'product-owner'].map((type, idx) => (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:border-emerald-400/30 transition-all"
                >
                  <div className="text-4xl mb-4">{userTypes.find(t => t.id === type)?.icon}</div>
                  <h3 className="text-xl font-bold mb-4 text-white">For {type === 'product-owner' ? 'Product Owners' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}</h3>
                  <ul className="space-y-2 text-sm text-white/70">
                    {featuresByType[type].slice(0, 3).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">✓</span>
                        <span><strong>{feature.title}:</strong> {feature.desc}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeUserType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {featuresByType[activeUserType]?.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:border-emerald-400/30 transition-all"
                >
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h4 className="text-lg font-bold mb-2 text-white">{feature.title}</h4>
                  <p className="text-sm text-white/70">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 text-center">
          <Link to="/auth?type=register">
            <button className="px-8 py-4 rounded-xl font-bold text-lg text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_40px_rgba(16,185,129,0.3)] transition-all hover:scale-105">
              Start Your Free Trial →
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default UserTypeSection;

