import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';

const UnifiedFeaturesSection = ({ features, lottieAnimations }) => {
  const [activeFeature, setActiveFeature] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Combine all unique features and regular features
  const allFeatures = [
    {
      id: 'meta-whatsapp',
      title: 'Meta WhatsApp Business API',
      subtitle: 'Official Meta Tech Provider',
      description: 'FLYP is an official Meta Technology Provider. Send invoices, order updates, stock alerts, and promotional campaigns directly via WhatsApp Business API. Full template management, inbox, and automation.',
      icon: '💬',
      color: 'from-[#0084FF] to-[#0066CC]',
      badge: 'Meta Official',
      lottie: null,
      features: ['WhatsApp Inbox', 'Template Management', 'Automated Campaigns', 'Order Status Updates', 'Stock Alerts'],
      category: 'unique'
    },
    {
      id: 'voice-billing',
      title: 'Voice Billing',
      subtitle: 'Speak to Invoice',
      description: 'Generate invoices in seconds using voice commands. Real-time WebSocket streaming for instant transcription. No typing required.',
      icon: '🎤',
      color: 'from-emerald-400 to-teal-400',
      badge: 'AI-Powered',
      lottie: lottieAnimations?.['voice-billing'],
      category: 'unique'
    },
    {
      id: 'ai-inventory',
      title: 'AI Inventory',
      subtitle: 'Smart Stock Management',
      description: 'OCR invoice scanning, image recognition, barcode lookup. AI automatically creates and organizes your inventory from paper invoices.',
      icon: '🤖',
      color: 'from-purple-400 to-pink-400',
      badge: 'AI-Powered',
      lottie: lottieAnimations?.['ai-inventory'],
      category: 'unique'
    },
    {
      id: 'ai-hsn',
      title: 'AI HSN Code Support',
      subtitle: 'Instant HSN Suggestions',
      description: 'Bill faster with instant, accurate HSN code suggestions powered by AI.',
      icon: '🔍',
      color: 'from-blue-400 to-indigo-400',
      badge: 'AI-Powered',
      lottie: lottieAnimations?.['ai-hsn'],
      category: 'scale'
    },
    {
      id: '3d-store',
      title: '3D Store View',
      subtitle: 'Virtual Store Layout',
      description: 'Design multi-floor store layouts, place products visually, and navigate in stunning 3D. Know exactly where everything is, instantly.',
      icon: '🏪',
      color: 'from-cyan-400 to-blue-400',
      badge: 'Unique',
      lottie: null,
      category: 'unique'
    },
    {
      id: 'smart-assistant',
      title: 'Gemini AI Assistant',
      subtitle: 'Intelligent Insights',
      description: 'Ask questions in natural language. Get instant answers about sales, inventory, customers, and more. Powered by Google Gemini AI.',
      icon: '🧠',
      color: 'from-yellow-400 to-orange-400',
      badge: 'AI-Powered',
      lottie: null,
      category: 'unique'
    },
    {
      id: 'distributor-connect',
      title: 'Distributor Connect',
      subtitle: 'Real-time Network',
      description: 'Connect with distributors and retailers instantly. Share catalogs, sync inventory, and collaborate in real-time across your entire supply chain.',
      icon: '🔗',
      color: 'from-teal-400 to-cyan-400',
      badge: 'Real-time',
      lottie: lottieAnimations?.['distributor-connect'],
      category: 'unique'
    },
    {
      id: 'pos-mode',
      title: 'POS Mode',
      subtitle: 'Full Counter Experience',
      description: 'Switch your dashboard to a full-screen POS mode. Perfect for counter sales with fast billing, payment processing, and receipt printing.',
      icon: '💳',
      color: 'from-indigo-400 to-purple-400',
      badge: 'Fast',
      lottie: lottieAnimations?.['pos-mode'],
      category: 'unique'
    },
    {
      id: 'employee-management',
      title: 'Employee Management',
      subtitle: 'Multi-User Access',
      description: 'Create employee accounts with PIN-based login. Track activities, manage permissions, and enable multi-user access for your business.',
      icon: '👥',
      color: 'from-green-400 to-emerald-400',
      badge: 'Secure',
      lottie: null,
      category: 'unique'
    },
    {
      id: 'cloud-security',
      title: 'Secure Cloud',
      subtitle: 'Encrypted & Backed Up',
      description: 'Your data is encrypted, cloud-backed, and always available—privacy and peace of mind.',
      icon: '🔒',
      color: 'from-slate-400 to-gray-400',
      badge: 'Secure',
      lottie: lottieAnimations?.['cloud-security'],
      category: 'scale'
    },
    {
      id: 'customer-analysis',
      title: 'Customer Analysis',
      subtitle: 'Advanced Analytics',
      description: 'Advanced analytics to understand, segment, and grow your customer base.',
      icon: '📊',
      color: 'from-pink-400 to-rose-400',
      badge: 'Analytics',
      lottie: lottieAnimations?.['customer-analysis'],
      category: 'scale'
    },
    {
      id: 'fast-onboarding',
      title: 'Fast Onboarding',
      subtitle: 'AI-Assisted Setup',
      description: 'Go from invoice to insight in minutes with our guided, AI-assisted setup process.',
      icon: '🚀',
      color: 'from-violet-400 to-purple-400',
      badge: 'Fast',
      lottie: lottieAnimations?.['fast-onboarding'],
      category: 'scale'
    },
  ];

  return (
    <section id="features" className="py-32 md:py-40 px-6 md:px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] relative">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header - Apple-like large typography */}
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="text-emerald-300/80 text-xs uppercase tracking-[0.3em] mb-6 font-medium">Complete Feature Suite</div>
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 leading-tight tracking-tight">
            Everything You Need to <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">Scale</span>
          </h2>
          <p className="text-white/70 max-w-3xl mx-auto text-xl md:text-2xl leading-relaxed">
            India's most advanced supply chain platform with cutting-edge technology designed to automate your operations
          </p>
        </motion.div>

        {/* Feature Grid - Apple-like clean cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
          {allFeatures.map((feature, idx) => {
            const animation = feature.lottie || lottieAnimations?.[feature.id];
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.05 }}
                onHoverStart={() => setHoveredIndex(idx)}
                onHoverEnd={() => setHoveredIndex(null)}
                onClick={() => setActiveFeature(activeFeature === idx ? null : idx)}
                className={`relative p-8 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border cursor-pointer transition-all duration-500 h-full flex flex-col group ${
                  activeFeature === idx
                    ? 'border-emerald-400/50 scale-[1.02] shadow-2xl bg-emerald-400/10'
                    : hoveredIndex === idx
                    ? 'border-white/20 scale-[1.01] shadow-xl bg-white/[0.05]'
                    : 'border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                }`}
                whileHover={{ y: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {feature.badge && (
                  <span className={`absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                    feature.id === 'meta-whatsapp'
                      ? 'bg-[#0084FF]/20 border-[#0084FF]/40 text-[#0084FF]'
                      : 'bg-emerald-400/20 border-emerald-300/40 text-emerald-200'
                  }`}>
                    {feature.badge}
                  </span>
                )}
                
                {/* Icon/Animation Container - Apple-like smooth */}
                <motion.div 
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-3xl mb-4 flex-shrink-0 relative overflow-hidden`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {animation ? (
                    <motion.div
                      className="w-full h-full"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <Lottie 
                        animationData={animation} 
                        loop 
                        autoplay 
                        className="w-full h-full" 
                        style={{ 
                          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))',
                        }}
                        rendererSettings={{
                          preserveAspectRatio: 'xMidYMid meet',
                          clearCanvas: false,
                          progressiveLoad: true,
                          hideOnTransparent: false
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.span
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {feature.icon}
                    </motion.span>
                  )}
                  {/* Subtle glow effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-20 blur-xl -z-10`} />
                </motion.div>

                {/* Content */}
                <div className="flex-1 flex flex-col">
                  <h3 className="text-lg font-bold mb-1 text-white">{feature.title}</h3>
                  <p className="text-xs text-emerald-300/80 mb-2">{feature.subtitle}</p>
                  <p className="text-sm text-white/70 leading-relaxed flex-1">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Active Feature Detail Modal */}
        <AnimatePresence>
          {activeFeature !== null && allFeatures[activeFeature] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 p-8 rounded-3xl bg-white/5 backdrop-blur border border-white/10"
            >
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${allFeatures[activeFeature].color} flex items-center justify-center text-4xl flex-shrink-0`}>
                  {allFeatures[activeFeature].lottie ? (
                    <Lottie 
                      animationData={allFeatures[activeFeature].lottie} 
                      loop 
                      autoplay 
                      className="w-full h-full" 
                    />
                  ) : (
                    <span>{allFeatures[activeFeature].icon}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-2xl font-bold text-white">{allFeatures[activeFeature].title}</h3>
                    {allFeatures[activeFeature].badge && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        allFeatures[activeFeature].id === 'meta-whatsapp'
                          ? 'bg-[#0084FF]/20 border border-[#0084FF]/40 text-[#0084FF]'
                          : 'bg-emerald-400/20 border border-emerald-300/40 text-emerald-200'
                      }`}>
                        {allFeatures[activeFeature].badge}
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-300/80 mb-4">{allFeatures[activeFeature].subtitle}</p>
                  <p className="text-white/80 leading-relaxed text-lg mb-4">{allFeatures[activeFeature].description}</p>
                  {allFeatures[activeFeature].features && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {allFeatures[activeFeature].features.map((feat, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm">
                          {feat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setActiveFeature(null)}
                  className="text-white/60 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default UnifiedFeaturesSection;

