import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage, empAuth, empFunctions } from '../../../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { FiCamera, FiX, FiCheckCircle } from 'react-icons/fi';

const StartSessionModal = ({ open, onClose, employeeId, distributorId, onSessionStarted }) => {
  const [step, setStep] = useState(1); // 1: Camera ready, 3: Review, 4: Success
  const [capturedImage, setCapturedImage] = useState(null);
  const [countdown, setCountdown] = useState(null); // null, 3, 2, or 1
  const [uploading, setUploading] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setCapturedImage(null);
      setUploading(false);
      setCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [open]);

  useEffect(() => {
    if (open && step === 1) {
      startCamera();
    } else if (!open || step === 3 || step === 4) {
      stopCamera();
    }
    return () => {
      if (step !== 1) stopCamera();
    };
  }, [open, step]);

  const startCamera = async () => {
    try {
      stopCamera(); // Stop any existing stream first
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera for selfie
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('[StartSession] Camera ready, video dimensions:', {
            width: videoRef.current?.videoWidth,
            height: videoRef.current?.videoHeight
          });
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast.error('Could not access camera. Please grant camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('[StartSession] Video or canvas ref not available');
      toast.error('Camera not ready. Please try again.');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is ready (readyState 4 = HAVE_ENOUGH_DATA)
    if (video.readyState < 2) {
      console.error('[StartSession] Video not ready, readyState:', video.readyState);
      toast.error('Camera not ready. Please wait a moment for the camera to initialize.');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('[StartSession] Video dimensions are zero');
      toast.error('Camera not ready. Please wait a moment and try again.');
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    console.log('[StartSession] Image captured successfully, data URL length:', imageData.length);
    if (!imageData || imageData.length < 100) {
      console.error('[StartSession] Invalid image data');
      toast.error('Failed to capture image. Please try again.');
      return;
    }
    
    setCapturedImage(imageData);
    setStep(3);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setStep(1);
  };

  const uploadSelfieAndStartSession = async () => {
    if (!capturedImage || !employeeId || !distributorId) return;

    setUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Get current auth user to verify employeeId matches
      const currentAuthUser = empAuth.currentUser;
      if (!currentAuthUser) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Use auth.uid as employeeId (this is the Firestore document ID)
      const authEmployeeId = currentAuthUser.uid;
      
      console.log('[StartSession] Auth UID:', authEmployeeId, 'Prop employeeId:', employeeId, 'DistributorId:', distributorId);

      // Upload to Firebase Storage first
      const tempSessionId = `session_${Date.now()}`;
      const storageRef = ref(storage, `sessions/${distributorId}/${authEmployeeId}/${tempSessionId}.jpg`);
      console.log('[StartSession] Uploading selfie to Storage...');
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      console.log('[StartSession] Selfie uploaded successfully:', downloadURL);

      // Use Cloud Function to create session (bypasses Firestore rules, more secure and reliable)
      // IMPORTANT: Use empFunctions (from empApp) so it uses empAuth automatically
      const createEmployeeSession = httpsCallable(empFunctions, 'createEmployeeSession');
      
      console.log('[StartSession] Calling createEmployeeSession Cloud Function with empAuth...');
      console.log('[StartSession] Using empAuth - auth.uid:', authEmployeeId, 'distributorId:', distributorId);
      
      // Call with the employee's auth context (empAuth is used automatically by empFunctions)
      const result = await createEmployeeSession({
        selfieUrl: downloadURL,
        distributorId: distributorId // Pass it explicitly to help the function
      });

      if (!result.data.success) {
        throw new Error(result.data.message || 'Failed to create session');
      }

      const createdSessionId = result.data.sessionId;
      console.log('[StartSession] Session created successfully via Cloud Function, sessionId:', createdSessionId);

      toast.success('Session started successfully!');

      // Immediately call callback to update dashboard state
      // The onSnapshot listener in the dashboard will pick up the sessionActive change
      onSessionStarted?.({ sessionId: createdSessionId, selfieUrl: downloadURL });
      
      // Show success step briefly
      setStep(4);
    } catch (error) {
      console.error('Error starting session:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to start session. Please try again.';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please ensure Firestore rules are deployed and you are properly authenticated.';
      } else if (error.code === 'unauthenticated') {
        errorMessage = 'Not authenticated. Please log in again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setStep(1);
    setCapturedImage(null);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">Start Your Session</h2>
              <p className="text-sm text-gray-400 mt-1">
                {step === 1 && (countdown ? `Capturing in ${countdown}...` : 'Position yourself in front of the camera')}
                {step === 3 && 'Review your photo'}
                {step === 4 && 'Session started successfully!'}
              </p>
            </div>
            {step !== 4 && (
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Camera View */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-emerald-500/30">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-white text-6xl font-bold">{countdown}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4">
                  {step === 1 && (
                    <button
                      onClick={() => {
                        // Check if camera is ready before allowing capture
                        if (!videoRef.current) {
                          toast.error('Camera not initialized. Please wait.');
                          return;
                        }
                        
                        const video = videoRef.current;
                        if (video.readyState < 2) {
                          toast.error('Camera not ready. Please wait a moment for the camera to initialize.');
                          return;
                        }
                        
                        if (video.videoWidth === 0 || video.videoHeight === 0) {
                          toast.error('Camera not ready. Please wait a moment.');
                          return;
                        }

                        // Start countdown
                        setCountdown(3);
                        
                        // Clear any existing interval
                        if (countdownIntervalRef.current) {
                          clearInterval(countdownIntervalRef.current);
                        }
                        
                        // Countdown then capture
                        let currentCountdown = 3;
                        countdownIntervalRef.current = setInterval(() => {
                          currentCountdown--;
                          setCountdown(currentCountdown);
                          
                          if (currentCountdown <= 0) {
                            if (countdownIntervalRef.current) {
                              clearInterval(countdownIntervalRef.current);
                              countdownIntervalRef.current = null;
                            }
                            setCountdown(null);
                            capturePhoto();
                          }
                        }, 1000);
                      }}
                      disabled={countdown !== null}
                      className="flex items-center gap-3 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiCamera className="w-5 h-5" />
                      {countdown ? `Capturing in ${countdown}...` : 'Capture Photo'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-6">
                {capturedImage ? (
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-emerald-500/30">
                    <img
                      src={capturedImage}
                      alt="Captured selfie"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('[StartSession] Image preview error');
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-red-500/30 flex items-center justify-center">
                    <div className="text-white text-center">
                      <p className="text-lg mb-2">No image captured</p>
                      <p className="text-sm text-gray-400">Please retake the photo</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={retakePhoto}
                    className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold rounded-lg transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={uploadSelfieAndStartSession}
                    disabled={uploading || !capturedImage}
                    className="flex items-center gap-3 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Starting Session...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="w-5 h-5" />
                        Start Session
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <div className="space-y-6 text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="flex justify-center"
                >
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <FiCheckCircle className="w-12 h-12 text-emerald-400" />
                  </div>
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Session Started!</h3>
                  <p className="text-gray-400">You can now access all features</p>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StartSessionModal;

