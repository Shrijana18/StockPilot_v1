export const isNativeApp = () => {
  return !!window.Capacitor?.isNativePlatform?.() || !!window?.Capacitor?.isNative;
};
