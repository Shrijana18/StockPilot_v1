import React from 'react';
import { motion } from 'framer-motion';

/**
 * PanelErrorBoundary — lightweight per-panel recovery.
 * Shows an inline error card with Retry (re-mounts the panel) and
 * Hard Reload (full page, last resort) buttons.
 * Does NOT blank the entire app — only the panel that crashed.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[POS Panel Error]', error?.message, info?.componentStack?.split('\n')[1]?.trim());
    try {
      const log = JSON.parse(localStorage.getItem('pos-errors') || '[]');
      log.unshift({ msg: error?.message, ts: Date.now() });
      localStorage.setItem('pos-errors', JSON.stringify(log.slice(0, 10)));
    } catch (_) {}
  }

  retry = () => {
    this.setState(s => ({ hasError: false, error: null, retryKey: s.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.label || 'This section';
      return (
        <div className="flex-1 flex items-center justify-center p-8 min-h-[240px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="max-w-sm w-full text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <div className="text-base font-bold text-white mb-1">{label} ran into an issue</div>
            <div className="text-xs text-white/50 mb-5 leading-relaxed">
              The rest of the app is unaffected. You can retry or reload the page.
            </div>

            <div className="flex gap-2 justify-center">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={this.retry}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                🔄 Retry
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white/70 hover:text-white text-xs font-semibold transition-all"
              >
                Hard Reload
              </motion.button>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.retryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export default ErrorBoundary;
