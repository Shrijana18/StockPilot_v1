import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { initGA4, trackPageView } from "../utils/analytics";
import { SectionSkeleton } from '../components/landing/LoadingSkeleton';

// Lazy load all sections for better performance
const HeroSection = lazy(() => import('../components/landing/HeroSection'));
const UserTypeSection = lazy(() => import('../components/landing/UserTypeSection'));
const StorySection = lazy(() => import('../components/landing/StorySection'));
const NetworkSection = lazy(() => import('../components/landing/NetworkSection'));
const FeaturesSection = lazy(() => import('../components/landing/FeaturesSection'));
const DemoSection = lazy(() => import('../components/landing/DemoSection'));
const PricingSection = lazy(() => import('../components/landing/PricingSection'));
const FooterSection = lazy(() => import('../components/landing/FooterSection'));

// Import Lottie animations
import voiceBillingAnim from '../../public/assets/voice-billing.json';
import aiInventory from "../../public/assets/AI_Inventory.json";
import posMode from "../../public/assets/POS.json";
import distributorConnect from "../../public/assets/Distributor.json";
import aiHSNSupport from "../../public/assets/AI_Support.json";
import secureCloud from "../../public/assets/Secure_Cloud.json";
import customerAnalysis from "../../public/assets/Customer_Analysis.json";
import fastOnboard from "../../public/assets/Fast_Onboard.json";

const LandingPageNew = () => {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [shrinkHeader, setShrinkHeader] = useState(false);
  const [currentSection, setCurrentSection] = useState('hero');
  const [animationData, setAnimationData] = useState(null);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroAnimRef = useRef(null);
  const auraRef = useRef(null);

  const features = [
    {
      key: 'voice-billing',
      title: 'Voice Billing',
      desc: 'Generate invoices in seconds with the fastest voice-powered billing. Speak, confirm, done.',
      badge: 'New',
      lottie: voiceBillingAnim,
    },
    {
      key: 'ai-inventory',
      title: 'AI Inventory',
      desc: 'AI-powered inventory creation and optimization—smarter, faster, always up-to-date.',
      badge: 'New',
      lottie: aiInventory,
    },
    {
      key: 'ai-hsn',
      title: 'AI HSN Code Support',
      desc: 'Bill faster with instant, accurate HSN code suggestions powered by AI.',
      badge: 'New',
      lottie: aiHSNSupport,
    },
    {
      key: 'pos-mode',
      title: 'POS Mode',
      desc: 'Switch your dashboard to a full point-of-sale experience for seamless counter billing.',
      badge: 'New',
      lottie: posMode,
    },
    {
      key: 'cloud-security',
      title: 'Secure Cloud',
      desc: 'Your data is encrypted, cloud-backed, and always available—privacy and peace of mind.',
      badge: 'New',
      lottie: secureCloud,
    },
    {
      key: 'distributor-connect',
      title: 'Distributor Connect',
      desc: 'Connect and sync with distributors instantly—collaborate and share in real time.',
      badge: 'New',
      lottie: distributorConnect,
    },
    {
      key: 'customer-analysis',
      title: 'Customer Analysis',
      desc: 'Advanced analytics to understand, segment, and grow your customer base.',
      badge: 'New',
      lottie: customerAnalysis,
    },
    {
      key: 'fast-onboarding',
      title: 'Fast Onboarding',
      desc: 'Go from invoice to insight in minutes with our guided, AI-assisted setup process.',
      badge: 'New',
      lottie: fastOnboard,
    }
  ];

  const lottieAnimations = {
    'voice-billing': voiceBillingAnim,
    'ai-inventory': aiInventory,
    'pos-mode': posMode,
    'distributor-connect': distributorConnect,
    'ai-hsn': aiHSNSupport,
    'cloud-security': secureCloud,
    'customer-analysis': customerAnalysis,
    'fast-onboarding': fastOnboard,
  };

  const sections = [
    { id: 'hero', label: 'Intro' },
    { id: 'for-you', label: 'For You' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'story', label: 'Network' },
    { id: 'features', label: 'Features' },
    { id: 'book-demo', label: 'Demo' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'contact', label: 'Contact' },
  ];

  // Initialize AOS and Analytics
  useEffect(() => {
    AOS.init({ duration: 1000, once: true, easing: 'cubic-bezier(.2,.7,.3,1)' });
    initGA4();
    trackPageView();
  }, []);

  // Lazy load hero animation
  useEffect(() => {
    const target = heroAnimRef.current;
    if (target && !prefersReducedMotion) {
      const ioAnim = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          fetch("/assets/supplyFlow.json")
            .then((res) => res.json())
            .then(setAnimationData)
            .catch(console.error);
          ioAnim.disconnect();
        }
      }, { threshold: 0.2 });
      ioAnim.observe(target);
    }
  }, [prefersReducedMotion]);

  // Scroll progress and header shrink
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const sp = total > 0 ? (window.scrollY / total) * 100 : 0;
      setScrollProgress(sp);
      setShrinkHeader(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Section observer for navigation
  useEffect(() => {
    const opts = { root: null, rootMargin: '-40% 0px -55% 0px', threshold: 0.1 };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { 
        if (e.isIntersecting) setCurrentSection(e.target.id); 
      });
    }, opts);
    sections.forEach((s) => { 
      const el = document.getElementById(s.id); 
      if (el) io.observe(el); 
    });
    return () => io.disconnect();
  }, []);

  // Ambient cursor aura
  useEffect(() => {
    if (prefersReducedMotion || !auraRef.current) return;
    let af = 0;
    const onMove = (e) => {
      if (af) return;
      af = requestAnimationFrame(() => {
        if (auraRef.current) {
          auraRef.current.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
        }
        af = 0;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [prefersReducedMotion]);

  const dismissIntroVideo = () => {
    if (introFading) return;
    setIntroFading(true);
    setTimeout(() => {
      setShowIntroOverlay(false);
    }, 650);
  };

  return (
    <div className="text-white min-h-screen bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] relative overflow-x-hidden">
      {/* Fixed background layers to prevent white screens */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#020617]" />
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617]" />
      
      {/* Intro Video Overlay */}
      {showIntroOverlay && !prefersReducedMotion && (
        <div className={`fixed inset-0 z-80 flex items-center justify-center bg-[#020617] transition-opacity duration-600 ${introFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <button 
            onClick={dismissIntroVideo}
            className="absolute top-4 right-4 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-all"
          >
            Skip
          </button>
          <div className="text-center">
            <div className="text-6xl mb-4 animate-pulse">🚀</div>
            <div className="text-4xl font-bold text-white">FLYP</div>
            <div className="text-white/60 mt-2">India's First Supply Chain OS</div>
          </div>
        </div>
      )}

      {/* Ambient cursor aura */}
      <div 
        ref={auraRef} 
        aria-hidden 
        className="fixed top-0 left-0 z-0 pointer-events-none w-[300px] h-[300px] rounded-full" 
        style={{ 
          background: 'radial-gradient(150px 150px at center, rgba(16,185,129,0.25), rgba(16,185,129,0.0) 70%)', 
          filter: 'blur(20px)' 
        }} 
      />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#020617]/90 border-b border-white/10 py-4 px-6 md:py-5 md:px-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/assets/flyp_logo.png" alt="FLYP" className="h-12 md:h-16" />
          </Link>
          
          <nav className={`hidden md:flex gap-5 ${shrinkHeader ? 'text-sm' : 'text-base'} transition-all`}>
            <a href="#for-you" className="hover:text-emerald-300 transition-colors">For You</a>
            <a href="#how-it-works" className="hover:text-emerald-300 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-emerald-300 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-emerald-300 transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth?type=login")}
              className="px-4 py-2 rounded border border-white/20 hover:border-emerald-400/60 transition-all text-sm"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/auth?type=register")}
              className="px-4 py-2 rounded bg-emerald-400 hover:bg-emerald-300 text-gray-900 font-semibold shadow-lg text-sm"
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* Scroll Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-blue-500 z-50 transition-[width]" 
        style={{ width: `${scrollProgress}%` }} 
      />

      {/* Section Navigator */}
      <nav aria-label="Section navigator" className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-3">
        {sections.map((s) => (
          <a 
            key={s.id} 
            href={`#${s.id}`} 
            className={`w-3 h-3 rounded-full border transition-all ${
              currentSection === s.id 
                ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 border-transparent scale-125' 
                : 'bg-white/5 border-white/20 hover:border-emerald-400/60'
            }`}
            title={s.label}
          />
        ))}
      </nav>

      {/* Main Content with Lazy Loading */}
      <main>
        <Suspense fallback={<SectionSkeleton />}>
          <div ref={heroAnimRef}>
            <HeroSection animationData={animationData} />
          </div>
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <UserTypeSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <StorySection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <NetworkSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <FeaturesSection features={features} lottieAnimations={lottieAnimations} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <DemoSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <PricingSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <FooterSection />
        </Suspense>
      </main>

      {/* Global Styles */}
      <style>{`
        @keyframes animate-word { 
          from { opacity: 0; filter: blur(8px); transform: translateY(8px); } 
          to { opacity: 1; filter: blur(0); transform: translateY(0); } 
        }
        .animate-word { animation: animate-word 0.7s ease both; }
        html { scroll-behavior: smooth; }
        * { transition: background-color 0.3s ease, border-color 0.3s ease; }
        body { background: #020617; }
        section { min-height: 100vh; }
        @keyframes dash { to { stroke-dashoffset: -340; } }
        .animate-dash { animation: dash 3.8s linear infinite; }
      `}</style>
    </div>
  );
};

export default LandingPageNew;

