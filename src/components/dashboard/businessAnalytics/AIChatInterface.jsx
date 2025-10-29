import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AIChatInterface = ({ chatHistory, currentQuery, setCurrentQuery, onSendQuery, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    // Only scroll within the chat container, not the entire page
    if (messagesEndRef.current) {
      const chatContainer = messagesEndRef.current.closest('.overflow-y-auto');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (currentQuery) {
      setInputValue(currentQuery);
      setCurrentQuery('');
    }
  }, [currentQuery, setCurrentQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendQuery(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-[600px] flex flex-col bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden shadow-lg">
      {/* Chat Header */}
      <div className="p-4 border-b border-white/20 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-400/25">
              <span className="text-sm font-bold text-slate-900">AI</span>
            </div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">Analytics Assistant</h3>
            <p className="text-xs text-white/60">AI-powered business intelligence</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-emerald-300 font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {chatHistory.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-emerald-500 text-slate-900'
                    : 'bg-white/10 text-white border border-white/20'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                {message.data && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="mt-2 p-2 bg-black/20 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-3 bg-cyan-400 rounded-full"></div>
                      <span className="text-xs font-semibold text-cyan-300">Data Summary</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(message.data).map(([key, value]) => {
                        const renderValue = (v) => {
                          if (v == null) return '-';
                          if (typeof v === 'number') return v.toLocaleString();
                          if (typeof v === 'string') return v;
                          if (Array.isArray(v)) return `${v.length} items`;
                          if (typeof v === 'object') {
                            try {
                              const json = JSON.stringify(v);
                              return json.length > 60 ? json.slice(0, 57) + '…' : json;
                            } catch (_) {
                              return '[object]';
                            }
                          }
                          return String(v);
                        };
                        return (
                          <div key={key} className="flex justify-between items-center py-0.5 gap-2">
                            <span className="text-xs capitalize text-white/80 truncate">{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="text-xs font-mono text-white font-medium truncate max-w-[50%] text-right">
                              {renderValue(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10">
                  <div className="text-xs opacity-60">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  {message.type === 'ai' && (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                      <span className="text-xs text-emerald-300">AI</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white/10 text-white border border-white/20 p-3 rounded-lg backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <motion.div 
                    className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div 
                    className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div 
                    className="w-1.5 h-1.5 bg-teal-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
                <span className="text-xs font-medium">AI is analyzing...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-white/20 bg-white/5">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about sales, profit, inventory..."
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
              disabled={isLoading}
            />
          </div>
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <motion.div
                  className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Analyzing...
              </>
            ) : (
              'Send'
            )}
          </motion.button>
        </form>
      </div>
    </div>
  );
};

export default AIChatInterface;
