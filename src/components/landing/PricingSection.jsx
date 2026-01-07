import React, { useState, useEffect } from 'react';

const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flyp_pricing_yearly');
      if (saved === '1') setIsYearly(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('flyp_pricing_yearly', isYearly ? '1' : '0'); } catch {}
  }, [isYearly]);

  const fmtINR = (n) => `₹${Math.round(n).toLocaleString()}`;
  const priceLabel = (m) => isYearly ? `${fmtINR(m*12*0.8)}/yr` : `${fmtINR(m)}/mo`;

  const plans = [
    {
      name: 'Check-In',
      price: 'Free',
      color: 'emerald',
      features: [
        'Basic inventory tracking & billing',
        'Limited product sync',
        'Basic analytics dashboard'
      ]
    },
    {
      name: 'Onboard',
      price: priceLabel(299),
      color: 'yellow',
      features: [
        'Smart cart & OCR billing import',
        'Inventory sync & order management',
        'Advanced analytics & AI inventory'
      ]
    },
    {
      name: 'Takeoff',
      price: priceLabel(499),
      color: 'cyan',
      features: [
        'Customer analytics & realtime sync',
        'Distributor connect & automated billing',
        'Dashboards & KPIs with Gemini AI'
      ]
    },
    {
      name: 'Fly',
      price: 'Custom',
      color: 'white',
      features: [
        'Full feature access & priority support',
        'Custom integrations & multi-branch',
        'Dedicated AI support & enterprise analytics'
      ]
    }
  ];

  return (
    <section id="pricing" className="py-20 px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h3 className="text-3xl md:text-4xl font-bold mb-6">Pricing Plans</h3>
          <div className="flex items-center justify-center gap-3 text-sm mb-8">
            <span className={!isYearly ? 'text-emerald-300' : 'text-white/60'}>Monthly</span>
            <button 
              onClick={() => setIsYearly(v => !v)} 
              className="relative h-7 w-14 rounded-full bg-white/10 border border-white/15 transition-colors hover:bg-white/15"
            >
              <span className={`absolute top-0.5 ${isYearly ? 'left-7' : 'left-0.5'} h-6 w-6 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all`} />
            </button>
            <span className={isYearly ? 'text-emerald-300' : 'text-white/60'}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] border border-emerald-300/40 bg-emerald-400/10">Save 20%</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className="p-6 rounded-xl bg-white/5 backdrop-blur border border-white/10 hover:border-emerald-400/30 transition-all hover:scale-105"
            >
              <h4 className="text-xl font-bold mb-4 text-white">{plan.name}</h4>
              <p className={`text-${plan.color}-300 font-semibold text-2xl mb-6`}>{plan.price}</p>
              <ul className="text-sm text-white/70 space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button className={`w-full px-4 py-2 rounded font-semibold ${
                plan.color === 'white' 
                  ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' 
                  : `bg-${plan.color}-400/90 text-gray-900 hover:bg-${plan.color}-300`
              } transition-all`}>
                {plan.name === 'Fly' ? 'Contact Us' : 'Choose Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

