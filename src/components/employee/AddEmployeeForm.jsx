import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

const AddEmployeeForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Staff',
    pin: '',
    confirmPin: ''
  });
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const genPin = () => {
    const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    setFormData(prev => ({ ...prev, pin, confirmPin: pin }));
  };

  const validate = () => {
    const { name, phone, pin, confirmPin } = formData;
    if (!name?.trim()) return 'Name is required';
    if (!phone?.trim()) return 'Phone is required';
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length !== 10) return 'Phone number must have exactly 10 digits';
    if (!/^\d{6}$/.test(String(pin))) return 'PIN must be exactly 6 digits';
    if (pin !== confirmPin) return 'PIN and Confirm PIN must match';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error('User not authenticated. Please log in again.');
        return;
      }

      const { name, email, phone, role, pin } = formData;
      const normalizedPhone = phone.replace(/\D/g, '').slice(-10); // keep last 10 digits
      const formattedPhone = `+91${normalizedPhone}`;
      const createEmployee = httpsCallable(functions, 'createEmployee');

      const res = await createEmployee({ name, email, phone: formattedPhone, role, pin });
      const data = res?.data;

      if (!data?.success) throw new Error(data?.message || 'Failed to create employee');

      toast.success(`Employee created: ${data.flypEmployeeId} | PIN: ${data.pin}`);
      setFormData({ name: '', email: '', phone: '', role: 'Staff', pin: '', confirmPin: '' });
    } catch (e2) {
      console.error('Create employee error:', e2);
      toast.error(e2?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-gray-300 mb-1">Name</label>
        <input
          name="name"
          value={formData.name}
          onChange={onChange}
          className="w-full bg-white/10 border border-white/20 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          placeholder="Employee name"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Email (optional)</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={onChange}
          className="w-full bg-white/10 border border-white/20 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          placeholder="name@example.com"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Phone Number</label>
        <input
          name="phone"
          value={formData.phone}
          onChange={onChange}
          className="w-full bg-white/10 border border-white/20 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          placeholder="+91XXXXXXXXXX"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Role</label>
        <select
          name="role"
          value={formData.role}
          onChange={onChange}
          className="w-full bg-white/10 border border-white/20 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
        >
          <option>Staff</option>
          <option>Billing</option>
          <option>Inventory</option>
          <option>Analytics</option>
          <option>Manager</option>
        </select>
      </div>

      {/* PIN + Confirm PIN */}
      <div className="grid grid-cols-3 gap-2 items-end">
        <div className="col-span-1">
          <label className="block text-sm text-gray-300 mb-1">PIN (6 digits)</label>
          <input
            name="pin"
            value={formData.pin}
            onChange={(e) => {
              // Keep only digits and trim to 6
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setFormData(prev => ({ ...prev, pin: v }));
            }}
            className="w-full bg-white/10 border border-white/20 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            placeholder="******"
            inputMode="numeric"
          />
        </div>
        <div className="col-span-1">
          <label className="block text-sm text-gray-300 mb-1">Confirm PIN</label>
          <input
            name="confirmPin"
            value={formData.confirmPin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setFormData(prev => ({ ...prev, confirmPin: v }));
            }}
            className="w-full bg-white/10 border border-white/20 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            placeholder="******"
            inputMode="numeric"
          />
        </div>
        <button
          type="button"
          onClick={genPin}
          className="col-span-1 h-[42px] bg-white/10 hover:bg-white/15 border border-white/20 rounded-md text-sm text-white"
        >
          Generate PIN
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full bg-gradient-to-r from-blue-600 to-teal-500 text-white py-2 rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Creating…' : 'Create Employee'}
      </button>

      <p className="text-xs text-gray-400 mt-2">
        The Employee ID will be generated after creation and shown in the success toast.
      </p>
    </form>
  );
};

export default AddEmployeeForm;