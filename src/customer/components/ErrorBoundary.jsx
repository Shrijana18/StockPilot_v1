import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to console for debugging but don't crash the app
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Silent error logging - don't show to user in production
      console.error('[Production Error]', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] flex items-center justify-center px-6">
          <div className="text-center max-w-md w-full">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Something went wrong</h3>
            <p className="text-white/60 mb-6">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold rounded-xl transition-colors"
              >
                Reload App
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/10 transition-colors"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="text-white/40 text-sm cursor-pointer">Error Details</summary>
                <pre className="mt-2 text-xs text-white/30 overflow-auto max-h-40 p-3 bg-black/20 rounded">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
