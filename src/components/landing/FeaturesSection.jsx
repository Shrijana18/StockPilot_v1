import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';

const FeaturesSection = ({ features, lottieAnimations }) => {
  const [hoveredFeature, setHoveredFeature] = useState(null);

  return (
    <section id="features" className="py-16 px-10 bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Scale</h3>
          <p className="text-white/70 max-w-2xl mx-auto">
            Powerful features designed to automate your supply chain operations
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => {
            const animation = lottieAnimations?.[feature.key];
            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: idx * 0.1 }}
                onHoverStart={() => setHoveredFeature(feature.key)}
                onHoverEnd={() => setHoveredFeature(null)}
                className="group cursor-pointer"
              >
                <div className="p-6 rounded-xl bg-white/5 backdrop-blur border border-white/10 hover:border-emerald-400/30 transition-all duration-300 h-full">
                  {feature.badge && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200">
                      {feature.badge}
                    </span>
                  )}
                  
                  <div className="w-full h-32 mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] flex items-center justify-center">
                    {animation ? (
                      <Lottie 
                        animationData={animation} 
                        loop 
                        autoplay 
                        className="w-full h-full lottie-container"
                        rendererSettings={{
                          preserveAspectRatio: 'xMidYMid meet',
                          clearCanvas: false,
                          progressiveLoad: true,
                          hideOnTransparent: false
                        }}
                      />
                    ) : (
                      <div className="text-4xl opacity-50">{feature.icon || '✨'}</div>
                    )}
                  </div>

                  <h4 className="font-semibold text-lg text-white mb-2">{feature.title}</h4>
                  <p className="text-sm text-white/70">{feature.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

