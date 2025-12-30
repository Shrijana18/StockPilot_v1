import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FiX, FiUser, FiMail, FiPhone, FiSave, FiImage, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';

const EditEmployeeModal = ({ open, onClose, employee, currentUser }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    profilePictureUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        profilePictureUrl: employee.profilePictureUrl || ''
      });
      setImagePreview(employee.profilePictureUrl || null);
      setImageFile(null);
    }
  }, [employee]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    // Remove the selected new image file
    setImageFile(null);
    
    // Clear preview completely - user wants to remove the image
    setImagePreview(null);
    setForm(prev => ({ ...prev, profilePictureUrl: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setLoading(true);
    try {
      let profilePictureUrl = form.profilePictureUrl;

      // Upload new image if selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          const imagePath = `employee_photos/${currentUser.uid}/${employee.id}`;
          const storageRef = ref(storage, imagePath);
          
          // Delete old image if exists (optional - to save storage)
          if (form.profilePictureUrl) {
            try {
              const oldImageRef = ref(storage, imagePath);
              await deleteObject(oldImageRef);
            } catch (deleteError) {
              // Ignore if old image doesn't exist
              console.log('Old image not found or already deleted');
            }
          }

          await uploadBytes(storageRef, imageFile);
          profilePictureUrl = await getDownloadURL(storageRef);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast.error('Failed to upload image');
          setUploadingImage(false);
          setLoading(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      } else if (imagePreview === null && employee.profilePictureUrl) {
        // User wants to remove existing image
        try {
          const imagePath = `employee_photos/${currentUser.uid}/${employee.id}`;
          const oldImageRef = ref(storage, imagePath);
          await deleteObject(oldImageRef);
          profilePictureUrl = null;
        } catch (deleteError) {
          // Image might not exist in storage, just set to null
          console.log('Image not found in storage, clearing reference');
          profilePictureUrl = null;
        }
      }

      // Update employee document
      await updateDoc(
        doc(db, 'businesses', currentUser.uid, 'distributorEmployees', employee.id),
        {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          profilePictureUrl: profilePictureUrl || null,
          updatedAt: new Date()
        }
      );
      toast.success('Employee information updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee information');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !employee) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-white/20">
                    <FiUser className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Edit Employee</h2>
                    <p className="text-xs text-gray-400">Update personal information</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <FiImage className="w-4 h-4" />
                    Profile Picture
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Preview */}
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Profile preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FiUser className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-xs transition-all"
                          title="Remove image"
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    {/* Upload Button */}
                    <div className="flex-1">
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer transition-all">
                          <FiImage className="w-4 h-4" />
                          {imageFile ? 'Change Picture' : 'Upload Picture'}
                        </span>
                      </label>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF (max 5MB)</p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <FiUser className="w-4 h-4" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Enter full name"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <FiMail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="employee@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <FiPhone className="w-4 h-4" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="+91 1234567890"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-white font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingImage}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(loading || uploadingImage) ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {uploadingImage ? 'Uploading...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <FiSave className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EditEmployeeModal;

