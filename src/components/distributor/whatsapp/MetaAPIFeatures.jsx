/**
 * Meta WhatsApp Business API - Feature Comparison & Upgrade
 * Shows what features unlock with Meta API integration
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { getWhatsAppConfig, WHATSAPP_PROVIDERS } from '../../../services/whatsappService';

const MetaAPIFeatures = () => {
  const [hasMetaAPI, setHasMetaAPI] = useState(false);
  const distributorId = auth.currentUser?.uid;

  React.useEffect(() => {
    const checkAPI = async () => {
      if (!distributorId) return;
      const config = await getWhatsAppConfig(distributorId);
      // Check for both Tech Provider and regular Meta API
      setHasMetaAPI(
        (config?.provider === WHATSAPP_PROVIDERS.META_TECH_PROVIDER || 
         config?.provider === WHATSAPP_PROVIDERS.META) && 
        config?.verified
      );
    };
    checkAPI();
  }, [distributorId]);

  const features = [
    {
      name: 'Full Automation',
      current: '❌ Manual clicks required',
      withAPI: '✅ Fully automated, zero clicks',
      icon: '🤖',
      impact: '10x productivity',
    },
    {
      name: 'Message Status Tracking',
      current: '❌ No status tracking',
      withAPI: '✅ See sent, delivered, read status',
      icon: '📊',
      impact: 'Know exactly what happened',
    },
    {
      name: 'Rich Media',
      current: '❌ Text + image URLs only',
      withAPI: '✅ Images, documents, videos, location',
      icon: '🎨',
      impact: 'Professional messaging',
    },
    {
      name: 'Two-Way Communication',
      current: '❌ Can only send',
      withAPI: '✅ Receive & respond to messages',
      icon: '💬',
      impact: 'Complete WhatsApp management',
    },
    {
      name: 'WhatsApp Chat Interface',
      current: '❌ No chat view',
      withAPI: '✅ Mirror WhatsApp in dashboard',
      icon: '📱',
      impact: 'Native WhatsApp experience',
    },
    {
      name: 'Message Templates',
      current: '❌ Custom messages only',
      withAPI: '✅ Official pre-approved templates',
      icon: '📝',
      impact: 'Send anytime, not just 24hr window',
    },
    {
      name: 'True Scheduling',
      current: '❌ Links only (manual send)',
      withAPI: '✅ Actual scheduled sending',
      icon: '⏰',
      impact: 'Send at perfect times automatically',
    },
    {
      name: 'Bulk Messaging',
      current: '❌ Limited by manual clicks',
      withAPI: '✅ Send to 10,000+ instantly',
      icon: '⚡',
      impact: 'Enterprise scale',
    },
    {
      name: 'Advanced Analytics',
      current: '❌ Basic message count',
      withAPI: '✅ Delivery rates, read rates, conversion',
      icon: '📈',
      impact: 'Data-driven optimization',
    },
    {
      name: 'Business Profile',
      current: '❌ No business identity',
      withAPI: '✅ Verified badge, business hours, location',
      icon: '🏢',
      impact: 'Professional appearance',
    },
    {
      name: 'Webhook Integration',
      current: '❌ No real-time updates',
      withAPI: '✅ Real-time status & incoming messages',
      icon: '🔌',
      impact: 'Instant responsiveness',
    },
    {
      name: 'Auto-Responses',
      current: '❌ Manual replies only',
      withAPI: '✅ Automated responses & workflows',
      icon: '🔄',
      impact: '24/7 automated support',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-blue-500/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-semibold mb-2 text-blue-300">🚀 Meta WhatsApp Business API</h3>
            <p className="text-sm text-gray-400">
              Unlock powerful features with official WhatsApp Business API integration
            </p>
          </div>
          {hasMetaAPI ? (
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/50">
              ✅ API Enabled
            </span>
          ) : (
            <a
              href="#/distributor-dashboard?tab=profile&section=whatsapp"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Upgrade to API →
            </a>
          )}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="space-y-4">
        {features.map((feature, index) => (
          <motion.div
            key={feature.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{feature.icon}</div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-3">{feature.name}</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-xs text-red-300 font-medium mb-2">Current (Simple Mode)</p>
                    <p className="text-sm text-gray-300">{feature.current}</p>
                  </div>
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
                    <p className="text-xs text-emerald-300 font-medium mb-2">With Meta API</p>
                    <p className="text-sm text-gray-300">{feature.withAPI}</p>
                    <p className="text-xs text-emerald-400 mt-2">💡 {feature.impact}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Benefits Summary */}
      <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 rounded-xl p-6 border border-emerald-500/20">
        <h4 className="text-xl font-semibold mb-4 text-emerald-300">🎯 Key Benefits</h4>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 rounded-lg p-4">
            <div className="text-3xl mb-2">⚡</div>
            <p className="font-semibold mb-1">10x Faster</p>
            <p className="text-xs text-gray-400">Fully automated, no manual work</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-4">
            <div className="text-3xl mb-2">📊</div>
            <p className="font-semibold mb-1">Complete Analytics</p>
            <p className="text-xs text-gray-400">Track every message in detail</p>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-4">
            <div className="text-3xl mb-2">💬</div>
            <p className="font-semibold mb-1">Two-Way Chat</p>
            <p className="text-xs text-gray-400">Receive and manage messages</p>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      {!hasMetaAPI && (
        <div className="text-center bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-8 border border-blue-500/30">
          <div className="text-5xl mb-4">🚀</div>
          <h3 className="text-2xl font-bold text-white mb-2">Ready to Unlock Premium Features?</h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Upgrade to Meta WhatsApp Business API to get full automation, two-way communication, 
            rich media support, and advanced analytics. Transform your WhatsApp from a simple sender 
            to a complete business communication platform.
          </p>
          <a
            href="#/distributor-dashboard?tab=profile&section=whatsapp"
            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105"
          >
            Upgrade to Meta API →
          </a>
        </div>
      )}
    </div>
  );
};

export default MetaAPIFeatures;

