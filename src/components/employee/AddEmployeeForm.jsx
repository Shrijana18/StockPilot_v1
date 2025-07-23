import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { doc, setDoc } from 'firebase/firestore';

// ✅ Shared Firebase instance
import { auth, db, functions } from '../../firebase/firebaseConfig';

const AddEmployeeForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Staff',
    phone: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const generateFlypId = () => {
    return 'FLYP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, role, phone } = formData;
    if (!name || !email || !password || !phone) return toast.error('Please fill all fields');

    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error('User not authenticated. Please log in again.');
        return;
      }

      const flypId = generateFlypId();
      const createEmployee = httpsCallable(functions, 'createEmployee');

      try {
        const result = await createEmployee({
          name,
          email,
          password,
          role,
          retailerId: currentUser.uid,
          phone,
          flypId,
        });

        if (!result.data.success) {
          throw new Error(result.data.message || 'Failed to create employee');
        }

        // ✅ Write to employeeIndex collection for login mapping
        await setDoc(doc(db, 'employeeIndex', flypId), {
          uid: result.data.uid,
          retailerId: currentUser.uid,
          email: email,
        });

        // ✅ Also add employee under the business' Firestore path for login lookups
        await setDoc(
          doc(db, `businesses/${currentUser.uid}/employees/${result.data.uid}`),
          {
            name,
            email,
            phone,
            role,
            createdAt: new Date(),
            flypId,
            uid: result.data.uid,
            status: 'active',
          }
        );
      } catch (funcErr) {
        console.error('Callable function error:', funcErr);
        toast.error(funcErr.message || 'Failed to create employee via function');
        return;
      }


      toast.success('Employee created successfully!');
      setFormData({ name: '', email: '', password: '', role: 'Staff', phone: '' });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow p-6 rounded-lg w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4">Add Employee</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium">Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Password</label>
        <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Phone Number</label>
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full border px-3 py-2 rounded" placeholder="+91XXXXXXXXXX" required />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Role</label>
        <select name="role" value={formData.role} onChange={handleChange} className="w-full border px-3 py-2 rounded">
          <option value="Staff">Staff</option>
          <option value="Manager">Manager</option>
        </select>
      </div>

      <button type="submit" disabled={loading} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
        {loading ? 'Creating...' : 'Create Employee'}
      </button>
    </form>
  );
};

export default AddEmployeeForm;