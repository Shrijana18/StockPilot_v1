import React from 'react';
import { motion } from 'framer-motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('POS Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log error details for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('pos-errors') || '[]');
      errors.push(errorDetails);
      // Keep only last 10 errors
      if (errors.length > 10) errors.shift();
      localStorage.setItem('pos-errors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to store error details:', e);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearErrors = () => {
    localStorage.removeItem('pos-errors');
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative w-full h-full min-h-screen flex items-center justify-center p-5 bg-slate-900">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -right-16 w-[60%] h-[60%] rounded-full blur-[110px] bg-gradient-to-br from-red-500/10 to-transparent" />
            <div className="absolute -bottom-32 -left-16 w-[55%] h-[55%] rounded-full blur-[110px] bg-gradient-to-br from-orange-500/10 to-transparent" />
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 text-center max-w-lg w-full"
          >
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6 border border-red-500/30">
              ⚠️
            </div>
            
            <div className="text-xl font-bold text-white mb-3">Something went wrong</div>
            <div className="text-sm text-white/70 mb-8 leading-relaxed">
              The Restaurant POS encountered an unexpected error. This has been logged for debugging.
            </div>

            {/* Error details for developers */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-xs text-orange-400 hover:text-orange-300 mb-2">
                  Error Details (Development)
                </summary>
                <div className="bg-slate-800/50 rounded-lg p-3 mt-2 text-xs text-red-300 font-mono overflow-auto max-h-32">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1 text-white/60">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleReload}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/25"
              >
                Reload Application
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleClearErrors}
                className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-all"
              >
                Clear & Continue
              </motion.button>
            </div>

            <div className="mt-6 text-xs text-white/40">
              Error ID: {Date.now().toString(36)}
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
