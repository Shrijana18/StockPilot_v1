import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';

const FeatureShowcase = ({ features, lottieAnimations }) => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const uniqueFeatures = [
    {
      id: 'meta-whatsapp',
      title: 'Meta WhatsApp Business API',
      subtitle: 'Official Meta Tech Provider',
      description: 'FLYP is an official Meta Technology Provider. Send invoices, order updates, stock alerts, and promotional campaigns directly via WhatsApp Business API. Full template management, inbox, and automation.',
      icon: '💬',
      color: 'from-[#0084FF] to-[#0066CC]',
      badge: 'Meta Official',
      lottie: null,
      features: ['WhatsApp Inbox', 'Template Management', 'Automated Campaigns', 'Order Status Updates', 'Stock Alerts']
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
    },
  ];

  return (
    <section id="unique-features" className="py-24 px-6 md:px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen flex items-center">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em] mb-4">Unique Features</div>
          <h2 className="text-4xl md:text-6xl font-extrabold mb-4">
            Features That Make <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">FLYP Unique</span>
          </h2>
          <p className="text-white/70 max-w-3xl mx-auto text-lg">
            India's most advanced supply chain platform with cutting-edge technology
          </p>
        </div>

        {/* Interactive Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {uniqueFeatures.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: idx * 0.1 }}
              onHoverStart={() => setHoveredIndex(idx)}
              onHoverEnd={() => setHoveredIndex(null)}
              onClick={() => setActiveFeature(idx)}
              className={`relative p-6 rounded-2xl bg-white/5 backdrop-blur border cursor-pointer transition-all duration-300 ${
                activeFeature === idx
                  ? 'border-emerald-400/50 scale-105 shadow-2xl bg-emerald-400/10'
                  : hoveredIndex === idx
                  ? 'border-white/30 scale-102 shadow-xl'
                  : 'border-white/10 hover:border-emerald-400/30'
              }`}
            >
              {feature.badge && (
                <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200">
                  {feature.badge}
                </span>
              )}
              
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-3xl mb-4`}>
                {feature.lottie ? (
                  <Lottie 
                    animationData={feature.lottie} 
                    loop 
                    autoplay 
                    className="w-full h-full"
                    rendererSettings={{
                      preserveAspectRatio: 'xMidYMid meet',
                      clearCanvas: false,
                      progressiveLoad: true,
                      hideOnTransparent: false
                    }}
                  />
                ) : (
                  <span>{feature.icon}</span>
                )}
              </div>

              <h3 className="text-lg font-bold mb-1 text-white">{feature.title}</h3>
              <p className="text-xs text-emerald-300/80 mb-2">{feature.subtitle}</p>
              <p className="text-sm text-white/70 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Active Feature Detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-12 p-8 rounded-3xl bg-white/5 backdrop-blur border border-white/10"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${uniqueFeatures[activeFeature].color} flex items-center justify-center text-4xl flex-shrink-0`}>
                {uniqueFeatures[activeFeature].lottie ? (
                  <Lottie 
                    animationData={uniqueFeatures[activeFeature].lottie} 
                    loop 
                    autoplay 
                    className="w-full h-full"
                    rendererSettings={{
                      preserveAspectRatio: 'xMidYMid meet',
                      clearCanvas: false,
                      progressiveLoad: true,
                      hideOnTransparent: false
                    }}
                  />
                ) : (
                  <span>{uniqueFeatures[activeFeature].icon}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-2xl font-bold text-white">{uniqueFeatures[activeFeature].title}</h3>
                  {uniqueFeatures[activeFeature].badge && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      uniqueFeatures[activeFeature].id === 'meta-whatsapp'
                        ? 'bg-[#0084FF]/20 border border-[#0084FF]/40 text-[#0084FF]'
                        : 'bg-emerald-400/20 border border-emerald-300/40 text-emerald-200'
                    }`}>
                      {uniqueFeatures[activeFeature].badge}
                    </span>
                  )}
                </div>
                <p className="text-emerald-300/80 mb-4">{uniqueFeatures[activeFeature].subtitle}</p>
                <p className="text-white/80 leading-relaxed text-lg mb-4">{uniqueFeatures[activeFeature].description}</p>
                {uniqueFeatures[activeFeature].features && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {uniqueFeatures[activeFeature].features.map((feat, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm">
                        {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default FeatureShowcase;

