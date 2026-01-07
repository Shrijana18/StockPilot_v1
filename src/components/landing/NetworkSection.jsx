import React, { useState, useEffect, useRef } from 'react';

const NetworkSection = () => {
  const [activeRole, setActiveRole] = useState(0);
  const sectionRef = useRef(null);
  const roles = [
    { id: 0, name: 'Product Owner', icon: '📦', color: 'emerald', position: { x: 240, y: 160 } },
    { id: 1, name: 'Distributor', icon: '🏭', color: 'teal', position: { x: 520, y: 160 } },
    { id: 2, name: 'Retailer', icon: '🛒', color: 'cyan', position: { x: 820, y: 160 } }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const roleElements = entry.target.querySelectorAll('[data-role]');
            roleElements.forEach((el) => {
              const roleObserver = new IntersectionObserver(
                ([roleEntry]) => {
                  if (roleEntry.isIntersecting) {
                    const roleId = parseInt(roleEntry.target.getAttribute('data-role'), 10);
                    setActiveRole(roleId);
                  }
                },
                { rootMargin: "-40% 0px -40% 0px", threshold: 0.5 }
              );
              roleObserver.observe(el);
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
      id="story" 
      className="relative px-6 md:px-10 py-28 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center"
    >
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em] mb-4">How It Works</div>
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
            A <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">Living Network</span> for Your Supply Chain
          </h2>
          <p className="text-white/70 max-w-3xl mx-auto text-lg leading-relaxed">
            FLYP connects Product Owners, Distributors, and Retailers on a single, intelligent data layer. 
            Catalogs and bills flow downstream, while sales insights and analytics flow back up — all in real time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative h-[400px] md:h-[600px] flex items-center justify-center">
            <svg viewBox="0 0 900 300" className="w-full h-full">
              <defs>
                <linearGradient id="route" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#34d399"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <path 
                d="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" 
                fill="none" 
                stroke="url(#route)" 
                strokeWidth="8" 
                strokeLinecap="round"
                strokeDasharray="14 10"
                className="animate-dash"
              />
              {roles.map((role) => (
                <g key={role.id} transform={`translate(${role.position.x} ${role.position.y})`}>
                  <circle 
                    r="9" 
                    fill={role.color === 'emerald' ? '#34d399' : role.color === 'teal' ? '#2dd4bf' : '#22d3ee'} 
                    className={activeRole === role.id ? 'animate-pulse' : ''}
                  />
                  <text 
                    x="0" 
                    y="-20" 
                    fill="#fff" 
                    fontSize="12" 
                    textAnchor="middle"
                  >
                    {role.name}
                  </text>
                  <text 
                    x="0" 
                    y="5" 
                    fontSize="24" 
                    textAnchor="middle"
                  >
                    {role.icon}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="space-y-6">
            {roles.map((role, idx) => (
              <div
                key={role.id}
                data-role={role.id}
                className={`p-8 rounded-2xl bg-white/5 backdrop-blur border transition-all duration-500 ${
                  activeRole === role.id
                    ? role.color === 'emerald' 
                      ? 'ring-2 ring-emerald-400/80 border-emerald-400/40 scale-[1.02] shadow-2xl bg-emerald-400/5'
                      : role.color === 'teal'
                      ? 'ring-2 ring-teal-400/80 border-teal-400/40 scale-[1.02] shadow-2xl bg-teal-400/5'
                      : 'ring-2 ring-cyan-400/80 border-cyan-400/40 scale-[1.02] shadow-2xl bg-cyan-400/5'
                    : 'border-white/10 hover:border-emerald-400/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    activeRole === role.id 
                      ? role.color === 'emerald' ? 'bg-emerald-400/20' 
                        : role.color === 'teal' ? 'bg-teal-400/20' 
                        : 'bg-cyan-400/20'
                      : 'bg-white/5'
                  }`}>
                    {role.icon}
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs uppercase tracking-widest mb-2 ${
                      activeRole === role.id 
                        ? role.color === 'emerald' ? 'text-emerald-300'
                          : role.color === 'teal' ? 'text-teal-300'
                          : 'text-cyan-300'
                        : 'text-emerald-300'
                    }`}>
                      {role.name}
                    </div>
                    <h4 className="text-xl font-bold mb-3 text-white">Transform Your Operations</h4>
                    <ul className="text-white/70 text-sm space-y-2">
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 ${
                          activeRole === role.id 
                            ? role.color === 'emerald' ? 'text-emerald-400'
                              : role.color === 'teal' ? 'text-teal-400'
                              : 'text-cyan-400'
                            : 'text-emerald-400'
                        }`}>→</span>
                        <span>Real-time sync across your network</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 ${
                          activeRole === role.id 
                            ? role.color === 'emerald' ? 'text-emerald-400'
                              : role.color === 'teal' ? 'text-teal-400'
                              : 'text-cyan-400'
                            : 'text-emerald-400'
                        }`}>→</span>
                        <span>Automated workflows and billing</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 ${
                          activeRole === role.id 
                            ? role.color === 'emerald' ? 'text-emerald-400'
                              : role.color === 'teal' ? 'text-teal-400'
                              : 'text-cyan-400'
                            : 'text-emerald-400'
                        }`}>→</span>
                        <span>AI-powered insights and recommendations</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkSection;

