import React from 'react';
import { Link } from 'react-router-dom';

const DemoSection = () => {
  return (
    <section id="book-demo" className="py-20 px-6 md:px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center">
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em] mb-4">Get Started</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            See <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">FLYP in Action</span>
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Book a personalized demo and discover how FLYP can transform your supply chain operations.
          </p>
        </div>
        
        <div className="p-8 md:p-12 rounded-3xl bg-white/5 backdrop-blur border border-white/10 shadow-2xl">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">🎤</div>
              <h3 className="text-lg font-bold mb-2 text-white">Voice Billing</h3>
              <p className="text-sm text-white/70">Generate invoices in seconds with voice commands</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-lg font-bold mb-2 text-white">AI Inventory</h3>
              <p className="text-sm text-white/70">Smart inventory management with AI assistance</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-lg font-bold mb-2 text-white">Real-time Analytics</h3>
              <p className="text-sm text-white/70">Get insights that drive growth</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">🔗</div>
              <h3 className="text-lg font-bold mb-2 text-white">Network Connect</h3>
              <p className="text-sm text-white/70">Connect your entire supply chain</p>
            </div>
          </div>

          <div className="text-center space-y-4">
            <Link to="/auth?type=register">
              <button className="w-full px-8 py-4 rounded-xl font-bold text-lg text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_40px_rgba(16,185,129,0.3)] transition-all hover:scale-105">
                Start Free Trial →
              </button>
            </Link>
            <button 
              onClick={() => {
                const form = document.getElementById('demo-form');
                form?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full px-8 py-4 rounded-xl font-bold text-lg border-2 border-emerald-400/50 text-emerald-300 hover:bg-emerald-400/10 transition-all"
            >
              Schedule a Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;

