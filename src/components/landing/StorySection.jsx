import React, { useState, useEffect, useRef } from 'react';

const StorySection = () => {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef(null);

  const steps = [
    {
      number: 1,
      title: 'Sign Up & Onboard',
      description: 'Create your account in 2 minutes. Our AI-assisted onboarding helps you set up inventory, connect with partners, and configure billing in under 30 minutes.',
      icon: '🚀',
      color: 'emerald'
    },
    {
      number: 2,
      title: 'Connect Your Network',
      description: 'Link with distributors, retailers, or product owners. Share catalogs, sync inventory, and enable real-time collaboration across your entire supply chain.',
      icon: '🔗',
      color: 'teal'
    },
    {
      number: 3,
      title: 'Automate & Grow',
      description: 'Start billing with voice commands, track inventory automatically, get AI-powered insights, and watch your business grow with real-time analytics.',
      icon: '📈',
      color: 'cyan'
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const stepElements = entry.target.querySelectorAll('[data-step]');
            stepElements.forEach((el, idx) => {
              const stepObserver = new IntersectionObserver(
                ([stepEntry]) => {
                  if (stepEntry.isIntersecting) {
                    setActiveStep(idx);
                  }
                },
                { threshold: 0.6 }
              );
              stepObserver.observe(el);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      id="how-it-works" 
      className="relative py-24 px-6 md:px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center"
    >
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em] mb-4">Simple & Powerful</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            How <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">FLYP Works</span>
          </h2>
          <p className="text-white/70 max-w-3xl mx-auto text-lg">
            Three simple steps to transform your supply chain operations
          </p>
        </div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 via-teal-400 to-cyan-400 transform -translate-x-1/2 opacity-20" />

          <div className="space-y-12 md:space-y-20">
            {steps.map((step, idx) => (
              <div
                key={idx}
                data-step={idx}
                className={`relative flex flex-col md:flex-row items-center gap-8 ${
                  idx % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Step Number Circle */}
                <div className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold transition-all duration-500 ${
                  step.color === 'emerald' 
                    ? 'bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border-2 border-emerald-400/30'
                    : step.color === 'teal'
                    ? 'bg-gradient-to-br from-teal-400/20 to-teal-600/20 border-2 border-teal-400/30'
                    : 'bg-gradient-to-br from-cyan-400/20 to-cyan-600/20 border-2 border-cyan-400/30'
                } ${
                  activeStep === idx ? 'scale-110 shadow-[0_0_40px_rgba(16,185,129,0.4)]' : 'scale-100'
                }`}>
                  {step.icon}
                </div>

                {/* Content Card */}
                <div className={`flex-1 p-8 rounded-2xl bg-white/5 backdrop-blur border transition-all duration-500 ${
                  activeStep === idx 
                    ? step.color === 'emerald'
                      ? 'border-emerald-400/50 shadow-[0_20px_60px_rgba(16,185,129,0.2)] scale-105'
                      : step.color === 'teal'
                      ? 'border-teal-400/50 shadow-[0_20px_60px_rgba(16,185,129,0.2)] scale-105'
                      : 'border-cyan-400/50 shadow-[0_20px_60px_rgba(16,185,129,0.2)] scale-105'
                    : 'border-white/10 scale-100'
                }`}>
                  <div className="text-sm text-emerald-300/80 mb-2">Step {step.number}</div>
                  <h3 className="text-2xl font-bold mb-4 text-white">{step.title}</h3>
                  <p className="text-white/70 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StorySection;

