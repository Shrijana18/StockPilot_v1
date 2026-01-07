import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';

const MetaBadge = lazy(() => import('./MetaBadge'));

const words = ['Built to Fly', 'Inventory that Thinks', 'Analytics that Act', 'Stop running your business start flying it', 'Automate Everything', 'Billing in Seconds'];

const HeroSection = ({ animationData }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [metrics, setMetrics] = useState({ hours: 0, accuracy: 0, growth: 0 });

  useEffect(() => {
    const id = setInterval(() => setWordIndex((i) => (i + 1) % words.length), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const t0 = performance.now();
        const dur = 1600;
        const tick = () => {
          const p = Math.min(1, (performance.now() - t0) / dur);
          const easeOut = 1 - Math.pow(1 - p, 3);
          setMetrics({
            hours: Math.floor(easeOut * 12),
            accuracy: Math.floor(80 + easeOut * 18),
            growth: Math.floor(5 + easeOut * 25),
          });
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <section 
      id="hero" 
      className="relative min-h-screen flex flex-col-reverse md:flex-row items-center justify-center px-6 md:px-10 py-24 overflow-hidden bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(800px 300px at 10% 10%, rgba(16,185,129,0.06), transparent 60%), radial-gradient(600px 240px at 90% 20%, rgba(34,197,94,0.06), transparent 60%)'
      }} />
      
      <div className="w-full md:w-1/2 text-center md:text-left z-10 space-y-8 max-w-2xl">
        <motion.div
          className="mb-4 flex flex-wrap justify-center md:justify-start gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-400/10 border border-emerald-300/40 text-[11px] uppercase tracking-[0.26em] text-emerald-200 backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>India's First Supply Chain OS</span>
          </motion.div>
          <Suspense fallback={null}>
            <MetaBadge />
          </Suspense>
        </motion.div>

        <motion.h1 
          className="text-5xl md:text-7xl font-extrabold leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <motion.span 
            className="block bg-gradient-to-r from-white via-emerald-100 to-[#00e676] bg-clip-text text-transparent"
            animate={{ 
              backgroundPosition: ['0%', '100%', '0%'],
            }}
            transition={{ 
              duration: 5, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            style={{ backgroundSize: '200% 100%' }}
          >
            FLYP
          </motion.span>
          <motion.span 
            key={wordIndex} 
            className="block mt-3 text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-white via-emerald-200 to-cyan-200 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {words[wordIndex]}
          </motion.span>
          <motion.span 
            className="block mt-4 text-xl md:text-2xl font-semibold bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            India's <span className="font-bold">First</span> • <span className="font-bold">Fastest</span> • <span className="font-bold">Frictionless</span>
          </motion.span>
        </motion.h1>

        <motion.p 
          className="text-lg md:text-xl text-white/80 max-w-xl leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <strong className="text-emerald-300">FLYP</strong> is India's first complete Supply Chain Operating System. Connect <strong className="text-white">Retailers</strong>, <strong className="text-white">Distributors</strong>, and <strong className="text-white">Product Owners</strong> on one intelligent platform. Automate billing, inventory, orders, and analytics — all in real-time.
        </motion.p>

        <motion.div 
          className="flex gap-4 justify-center md:justify-start text-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          {[
            { value: `${metrics.hours}h/wk`, label: 'Saved Ops', color: 'emerald' },
            { value: `${metrics.accuracy}%`, label: 'OCR Accuracy', color: 'teal' },
            { value: `${metrics.growth}%`, label: 'Faster Billing', color: 'cyan' }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              className="px-5 py-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl hover:border-emerald-400/30 transition-all"
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-white/60 text-xs mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          className="mt-8 flex gap-4 flex-wrap justify-center md:justify-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <Link to="/auth?type=register">
            <motion.button 
              className="px-8 py-3 rounded-xl font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_10px_40px_rgba(16,185,129,0.3)]"
              whileHover={{ scale: 1.05, boxShadow: "0_20px_60px_rgba(16,185,129,0.4)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              Get Started Free →
            </motion.button>
          </Link>
          <motion.button 
            onClick={() => {
              const demo = document.getElementById('book-demo');
              demo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-8 py-3 rounded-xl border-2 border-white/20 hover:border-emerald-300/60 hover:bg-emerald-400/10 transition-all backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            Book a Demo
          </motion.button>
        </motion.div>
      </div>

      <motion.div 
        className="w-full md:w-1/2 flex justify-center z-10 mt-12 md:mt-0"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.4 }}
      >
        <motion.div 
          className="w-full max-w-[30rem] aspect-square rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {animationData ? (
            <Lottie 
              animationData={animationData} 
              loop 
              autoplay
              className="w-full h-full relative z-10 lottie-container" 
              rendererSettings={{
                preserveAspectRatio: 'xMidYMid meet',
                clearCanvas: false,
                progressiveLoad: true,
                hideOnTransparent: false
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 rounded-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            </div>
          )}
          
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-3xl blur-xl opacity-20 -z-10" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
