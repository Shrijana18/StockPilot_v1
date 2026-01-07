import React from 'react';
import { Link } from 'react-router-dom';

const FooterSection = () => {
  return (
    <footer id="contact" className="relative bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] text-white px-6 pt-12 pb-2 border-t border-white/10" style={{ minHeight: 'auto', marginBottom: 0, paddingBottom: '0.5rem' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8 text-left">
          <div>
            <h4 className="font-bold mb-3 text-emerald-300">About FLYP</h4>
            <p className="text-white/70 text-sm">
              India's first complete Supply Chain Operating System. Connect your entire network, automate operations, and grow faster.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-3 text-emerald-300">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><a href="#for-you" className="hover:text-emerald-300 transition-colors">For You</a></li>
              <li><a href="#features" className="hover:text-emerald-300 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-emerald-300 transition-colors">Pricing</a></li>
              <li><a href="#book-demo" className="hover:text-emerald-300 transition-colors">Book Demo</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3 text-emerald-300">Contact</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>Email: admin@flypnow.com</li>
              <li>Phone: +91 82638 74329</li>
              <li className="mt-4">
                <Link to="/auth?type=register" className="inline-block px-4 py-2 rounded-lg bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/30 transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 text-center pb-0">
          <p>© {new Date().getFullYear()} FLYP Corporation Private Limited — All Rights Reserved.</p>
          <p className="mt-2 mb-0 text-white/60 text-xs">Built with ❤️ for India's Supply Chain</p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;

