import React, { useState } from 'react';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
import { useRef } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { app } from "../firebase/firebaseConfig";

const auth = getAuth(app);
const db = getFirestore(app);

const libraries = ['places'];

const Register = ({ role = 'retailer' }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    address: '',
    state: '',
    country: '',
    zipcode: '',
    role: role,
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const autocompleteRef = useRef(null);

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place || !place.address_components) return;

    const addressObj = {
      address: place.formatted_address || '',
      city: '',
      state: '',
      country: '',
      zipcode: '',
    };

    for (const component of place.address_components) {
      const types = component.types;
      if (types.includes("locality")) addressObj.city = component.long_name;
      if (types.includes("administrative_area_level_1")) addressObj.state = component.long_name;
      if (types.includes("country")) addressObj.country = component.long_name;
      if (types.includes("postal_code")) addressObj.zipcode = component.long_name;
    }

    setFormData(prev => ({
      ...prev,
      ...addressObj,
    }));
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const userId = userCredential.user.uid;

      await setDoc(doc(db, 'businesses', userId), {
        ...formData,
        createdAt: new Date().toISOString()
      });

      setSuccess('✅ Registered successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <LoadScript
      googleMapsApiKey="AIzaSyC2SC9SufL8OJGCrulZWpkU3yv4EZZCOPs"
      libraries={libraries}
    >
      <div className="p-8 bg-white/10 backdrop-blur-md text-white rounded-2xl shadow-2xl w-full max-w-xl border border-white/20 animate-fadeInUp">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Register as {role.charAt(0).toUpperCase() + role.slice(1)}
        </h2>
        <p className="text-sm text-center text-cyan-300 mb-2">
          You're signing up as a <strong>{role.charAt(0).toUpperCase() + role.slice(1)}</strong>
        </p>

        {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
        {success && <div className="text-green-400 mb-3 text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="businessName"
            placeholder="Business Name"
            value={formData.businessName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="ownerName"
            placeholder="Owner Name"
            value={formData.ownerName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="city"
            placeholder="City"
            value={formData.city}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />

          <Autocomplete
            onLoad={ref => (autocompleteRef.current = ref)}
            onPlaceChanged={handlePlaceChanged}
          >
            <input
              type="text"
              placeholder="Search Address"
              className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
            />
          </Autocomplete>

          <input
            type="text"
            name="address"
            placeholder="Address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="city"
            placeholder="City"
            value={formData.city}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="state"
            placeholder="State"
            value={formData.state}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="zipcode"
            placeholder="Zipcode"
            value={formData.zipcode}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />
          <input
            type="text"
            name="country"
            placeholder="Country"
            value={formData.country}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
          />

          <input
            type="text"
            name="role"
            value={role.charAt(0).toUpperCase() + role.slice(1)}
            disabled
            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 placeholder-white/60 focus:outline-none transition-all duration-300 cursor-not-allowed"
          />

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 text-white py-2 px-4 rounded-xl mt-6 font-semibold tracking-wide shadow-md"
          >
            Register
          </button>
        </form>
      </div>
    </LoadScript>
  );
};

export default Register;