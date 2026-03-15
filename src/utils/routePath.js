/**
 * Get the current app path in a way that works for both BrowserRouter and HashRouter.
 * - BrowserRouter: path is in window.location.pathname
 * - HashRouter: path is in window.location.hash (e.g. #/dashboard -> /dashboard)
 */
export function getCurrentPath() {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash || '';
  if (hash.length > 1 && hash.startsWith('#')) {
    const pathAndQuery = hash.slice(1).split('?')[0];
    return pathAndQuery || '/';
  }
  return window.location.pathname || '/';
}
