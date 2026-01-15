import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../../../public/assets/loading.json';

const LoadingScreen = ({ message = 'Loading…' }) => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#020617] text-white/80">
    <div className="w-40 h-40 md:w-52 md:h-52">
      <Lottie animationData={loadingAnimation} loop autoplay />
    </div>
    <div className="mt-4 text-sm uppercase tracking-[0.3em] text-emerald-200/70">
      {message}
    </div>
  </div>
);

export default LoadingScreen;
