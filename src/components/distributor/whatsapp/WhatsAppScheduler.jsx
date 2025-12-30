/**
 * WhatsApp Scheduler - Intelligent Message Scheduling
 * Schedule messages for optimal times, auto-followups, and smart delays
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

const WhatsAppScheduler = () => {
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    message: '',
    recipients: [],
    scheduledFor: '',
    timezone: 'Asia/Kolkata',
    repeat: 'once', // once, daily, weekly
  });

  const distributorId = auth.currentUser?.uid;

  useEffect(() => {
    if (!distributorId) return;
    loadScheduledMessages();
  }, [distributorId]);

  const loadScheduledMessages = async () => {
    try {
      const scheduledRef = collection(db, 'businesses', distributorId, 'whatsappScheduled');
      const q = query(scheduledRef, orderBy('scheduledFor', 'asc'));
      const snapshot = await getDocs(q);
      const scheduled = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setScheduledMessages(scheduled);
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleData.message || !scheduleData.scheduledFor) {
      toast.error('Please fill in message and schedule time');
      return;
    }

    try {
      const scheduledRef = collection(db, 'businesses', distributorId, 'whatsappScheduled');
      await addDoc(scheduledRef, {
        ...scheduleData,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      toast.success('Message scheduled!');
      setShowScheduleModal(false);
      setScheduleData({
        message: '',
        recipients: [],
        scheduledFor: '',
        timezone: 'Asia/Kolkata',
        repeat: 'once',
      });
      loadScheduledMessages();
    } catch (error) {
      console.error('Error scheduling message:', error);
      toast.error('Failed to schedule message');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-1">⏰ Smart Scheduling</h3>
          <p className="text-sm text-gray-400">Schedule messages for optimal times</p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          + Schedule Message
        </button>
      </div>

      {/* Scheduled Messages */}
      <div className="space-y-3">
        {scheduledMessages.map((scheduled) => (
          <div key={scheduled.id} className="bg-slate-900/80 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300 mb-1 line-clamp-2">{scheduled.message}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                  <span>📅 {new Date(scheduled.scheduledFor).toLocaleString()}</span>
                  <span>👥 {scheduled.recipients?.length || 0} recipients</span>
                  {scheduled.repeat !== 'once' && (
                    <span>🔄 {scheduled.repeat}</span>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                scheduled.status === 'scheduled' ? 'bg-blue-500/20 text-blue-300' :
                scheduled.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-gray-500/20 text-gray-300'
              }`}>
                {scheduled.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {scheduledMessages.length === 0 && (
        <div className="text-center py-12 bg-slate-900/80 rounded-xl border border-white/10">
          <div className="text-4xl mb-3">⏰</div>
          <p className="text-gray-400">No scheduled messages</p>
          <p className="text-sm text-gray-500 mt-2">Schedule your first message to send at the perfect time</p>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-2xl w-full">
            <h3 className="text-xl font-semibold mb-4">Schedule Message</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Message</label>
                <textarea
                  value={scheduleData.message}
                  onChange={(e) => setScheduleData({ ...scheduleData, message: e.target.value })}
                  rows={4}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                  placeholder="Enter message to schedule..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Schedule For</label>
                <input
                  type="datetime-local"
                  value={scheduleData.scheduledFor}
                  onChange={(e) => setScheduleData({ ...scheduleData, scheduledFor: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Repeat</label>
                <select
                  value={scheduleData.repeat}
                  onChange={(e) => setScheduleData({ ...scheduleData, repeat: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSchedule}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
              >
                Schedule
              </button>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppScheduler;

