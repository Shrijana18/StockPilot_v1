import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { db, auth } from "../../firebase/firebaseConfig";
import { FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';

const ViewEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'businesses', currentUser.uid, 'employees'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(data);
      setFilteredEmployees(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = employees.filter(emp =>
      emp.name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.role?.toLowerCase().includes(term)
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      await deleteDoc(doc(db, 'businesses', currentUser.uid, 'employees', id));
      toast.success('Employee deleted successfully');
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'businesses', currentUser.uid, 'employees', emp.id), {
      status: newStatus
    });
    toast.success(`Status changed to ${newStatus}`);
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">View Employees</h2>
      <input
        type="text"
        placeholder="Search by name, email or role..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 w-full px-4 py-2 border border-gray-300 rounded shadow-sm"
      />
      {loading ? (
        <p>Loading...</p>
      ) : filteredEmployees.length === 0 ? (
        <p>No employees found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-semibold">
                <th className="py-2 px-4 border-b">FLYP ID</th>
                <th className="py-2 px-4 border-b">Name</th>
                <th className="py-2 px-4 border-b">Email</th>
                <th className="py-2 px-4 border-b">Phone</th>
                <th className="py-2 px-4 border-b">Role</th>
                <th className="py-2 px-4 border-b">Status</th>
                <th className="py-2 px-4 border-b">Presence</th>
                <th className="py-2 px-4 border-b">Created At</th>
                <th className="py-2 px-4 border-b">Login Link</th>
                <th className="py-2 px-4 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="text-sm hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{emp.flypId || '-'}</td>
                  <td className="py-2 px-4 border-b">{emp.name || '-'}</td>
                  <td className="py-2 px-4 border-b">{emp.email || '-'}</td>
                  <td className="py-2 px-4 border-b">{emp.phone || '-'}</td>
                  <td className="py-2 px-4 border-b">
                    <select
                      value={emp.role || ''}
                      onChange={async (e) => {
                        const newRole = e.target.value;
                        await updateDoc(doc(db, 'businesses', currentUser.uid, 'employees', emp.id), {
                          role: newRole
                        });
                        toast.success(`Role updated to ${newRole}`);
                      }}
                      className="text-sm px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="">Select</option>
                      <option value="Manager">Manager</option>
                      <option value="Sales">Sales</option>
                      <option value="Inventory">Inventory</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => handleToggleStatus(emp)}
                      className={`px-2 py-1 rounded text-xs ${
                        emp.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {emp.online ? (
                      <span className="text-green-600 font-medium">Online</span>
                    ) : (
                      <span className="text-gray-500 text-xs italic">Last seen: {formatLastSeen(emp.lastSeen)}</span>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {emp.createdAt?.toDate?.().toLocaleDateString() || '-'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {emp.flypId ? (
                      <button
                        onClick={() => {
                          const loginLink = `https://flypnow.com/employee-login?uid=${emp.flypId}`;
                          navigator.clipboard.writeText(loginLink);
                          toast.success("Login link copied!");
                        }}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Copy Link
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs italic">No FLYP ID</span>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ViewEmployees;