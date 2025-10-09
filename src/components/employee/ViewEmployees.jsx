import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { db, auth } from "../../firebase/firebaseConfig";
import { FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { httpsCallable } from 'firebase/functions';
import { functions } from "../../firebase/firebaseConfig";

const ConfirmResetModal = ({ open, name, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      {/* Card */}
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md mx-4 rounded-2xl border border-white/15 bg-gray-900/90 shadow-2xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">Reset PIN?</h3>
        <p className="text-sm text-gray-300 mb-6">Are you sure you want to reset the PIN for <span className="font-medium">"{name}"</span>? The new PIN will be visible for 2 minutes.</p>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-gray-200">Cancel</button>
          <button type="button" onClick={onConfirm} className="px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/20 hover:bg-red-500/30 text-red-200">Reset PIN</button>
        </div>
      </div>
    </div>
  );
};

const ViewEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [tempPins, setTempPins] = useState({}); // { [empKey]: { pin, expiresAt } }
  const [tick, setTick] = useState(0);
  const [confirmReset, setConfirmReset] = useState({ open: false, id: null, name: "" });

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser?.uid) return;
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
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!confirmReset.open) return;
    const onKey = (e) => { if (e.key === 'Escape') setConfirmReset({ open: false, id: null, name: '' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmReset.open]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = employees.filter(emp => {
      const idVal = (emp.flypEmployeeId || emp.id || '').toString().toLowerCase();
      return (
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.role?.toLowerCase().includes(term) ||
        emp.phone?.toLowerCase?.().includes(term) ||
        idVal.includes(term)
      );
    });
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      await deleteDoc(doc(db, 'businesses', currentUser.uid, 'employees', id));
      toast.success('Employee deleted successfully');
    }
  };

  // Reset PIN handler
  const handleResetPin = async (employeeId, employeeName) => {
    // Removed window.confirm line as per instructions

    // ✅ Ensure we have a signed-in Firebase user and a fresh token so callable gets context.auth
    if (!auth.currentUser) {
      toast.error("Please sign in again.");
      return;
    }
    try {
      await auth.currentUser.getIdToken(true);
    } catch (e) {
      console.warn("Failed to refresh ID token before resetPin:", e);
    }

    try {
      const resetPinFn = httpsCallable(functions, 'resetPin');
      const res = await resetPinFn({ employeeId });

      const ok = res?.data?.success ?? false;
      const newPin = res?.data?.newPin;

      if (!ok || !newPin) {
        throw new Error(res?.data?.message || "Reset failed");
      }

      // Show PIN in UI for 2 minutes
      const empKey = employeeId;
      const expiresAt = Date.now() + 2 * 60 * 1000;
      setTempPins((prev) => ({ ...prev, [empKey]: { pin: newPin, expiresAt } }));
      setTimeout(() => {
        setTempPins((prev) => {
          const next = { ...prev };
          delete next[empKey];
          return next;
        });
      }, 2 * 60 * 1000);

      // Copy to clipboard for safer sharing instead of exposing in UI
      try {
        await navigator.clipboard.writeText(newPin);
        toast.success(`PIN reset for "${employeeName}". New PIN copied to clipboard.`);
      } catch {
        // Fallback if clipboard not available
        toast.success(`PIN reset for "${employeeName}". (Couldn't copy automatically)`);
        console.log("New PIN:", newPin);
      }
    } catch (err) {
      console.error("Reset PIN Error:", err.code, err.message, err.details);
      const code = err?.code;
      const details = err?.details;
      const message = err?.message;

      const msg =
        code === "unauthenticated" ? "You are not signed in."
        : code === "not-found" ? "Employee not found."
        : details || message || "Something went wrong while resetting the PIN.";

      toast.error(msg);
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'businesses', currentUser.uid, 'employees', emp.id), {
        status: newStatus
      });
      toast.success(`Status changed to ${newStatus}`);
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Failed to update status. Please try again.");
    }
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

  const formatCountdown = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const confirmAndReset = (employeeId, employeeName) => {
    setConfirmReset({ open: true, id: employeeId, name: employeeName });
  };

  return (
    <div className="p-4 text-white">
      <h2 className="text-2xl font-semibold mb-4">View Employees</h2>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 rounded-lg backdrop-blur-md bg-white/10 border border-white/20 placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 text-sm text-gray-200">
          Loading...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 text-sm text-gray-300">
          No employees found.
        </div>
      ) : (
        <div className="overflow-x-auto backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl shadow-xl">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider bg-white/10">
                <th className="py-3 px-4 border-b border-white/10">FLYP Employee ID</th>
                <th className="py-3 px-4 border-b border-white/10">Name</th>
                <th className="py-3 px-4 border-b border-white/10">Email</th>
                <th className="py-3 px-4 border-b border-white/10">Phone</th>
                <th className="py-3 px-4 border-b border-white/10">Role</th>
                <th className="py-3 px-4 border-b border-white/10">Access</th>
                <th className="py-3 px-4 border-b border-white/10">Status</th>
                <th className="py-3 px-4 border-b border-white/10">Presence</th>
                <th className="py-3 px-4 border-b border-white/10">Created At</th>
                <th className="py-3 px-4 border-b border-white/10">Login Link</th>
                <th className="py-3 px-4 border-b border-white/10">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="text-sm hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 border-b border-white/10 text-gray-200">{emp.flypEmployeeId || emp.id || '-'}</td>
                  <td className="py-3 px-4 border-b border-white/10">{emp.name || '-'}</td>
                  <td className="py-3 px-4 border-b border-white/10 text-gray-200">{emp.email || '-'}</td>
                  <td className="py-3 px-4 border-b border-white/10 text-gray-200">{emp.phone || '-'}</td>
                  <td className="py-3 px-4 border-b border-white/10">
                    <select
                      value={emp.role || ''}
                      onChange={async (e) => {
                        const newRole = e.target.value;
                        await updateDoc(doc(db, 'businesses', currentUser.uid, 'employees', emp.id), {
                          role: newRole
                        });
                        toast.success(`Role updated to ${newRole}`);
                      }}
                      className="text-sm px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-gray-900">Select</option>
                      <option value="Manager" className="bg-gray-900">Manager</option>
                      <option value="Sales" className="bg-gray-900">Sales</option>
                      <option value="Inventory" className="bg-gray-900">Inventory</option>
                      <option value="Admin" className="bg-gray-900">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 border-b border-white/10">
                    <div className="flex flex-col gap-1 text-xs sm:text-sm">
                      {['inventory', 'billing', 'analytics'].map((section) => (
                        <label key={section} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!emp.accessSections?.[section]}
                            onChange={async (e) => {
                              const updated = { ...(emp.accessSections || {}), [section]: e.target.checked };
                              try {
                                await updateDoc(doc(db, 'businesses', currentUser.uid, 'employees', emp.id), { accessSections: updated });
                                toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} ${e.target.checked ? 'granted' : 'revoked'} for ${emp.name || (emp.flypEmployeeId || emp.id)}`);
                              } catch (err) {
                                console.error('Access update error:', err);
                                toast.error('Failed to update access. Please try again.');
                              }
                            }}
                            className="accent-emerald-500 h-3.5 w-3.5"
                          />
                          <span className="capitalize text-gray-200">{section}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 border-b border-white/10">
                    <button
                      onClick={() => handleToggleStatus(emp)}
                      className={`px-2 py-1 rounded text-xs transition-colors border ${
                        emp.status === 'active'
                          ? 'bg-green-500/15 text-green-300 border-green-400/20'
                          : 'bg-white/10 text-gray-300 border-white/20'
                      }`}
                    >
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3 px-4 border-b border-white/10">
                    {emp.online ? (
                      <span className="text-green-300 font-medium">Online</span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Last seen: {formatLastSeen(emp.lastSeen)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 border-b border-white/10 text-gray-300">
                    {emp.createdAt?.toDate?.().toLocaleDateString() || '-'}
                  </td>
                  <td className="py-3 px-4 border-b border-white/10">
                    {(emp.flypEmployeeId || emp.id) ? (
                      <div className="flex items-center gap-3">
                        <a
                          href={`${(typeof window !== 'undefined' && window.location ? window.location.origin : 'https://flypnow.com')}/employee-login?retailerId=${encodeURIComponent(currentUser?.uid)}&empId=${encodeURIComponent(emp.flypEmployeeId || emp.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline text-sm"
                        >
                          Open Link
                        </a>
                        <button
                          onClick={() => {
                            const base = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://flypnow.com';
                            const loginLink = `${base}/employee-login?retailerId=${encodeURIComponent(currentUser?.uid)}&empId=${encodeURIComponent(emp.flypEmployeeId || emp.id)}`;
                            navigator.clipboard.writeText(loginLink);
                            toast.success('Login link copied!');
                          }}
                          className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline text-sm"
                        >
                          Copy Link
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs italic">No FLYP ID</span>
                    )}
                  </td>
                  <td className="py-3 px-4 border-b border-white/10">
                    {(() => {
                      const key = emp.flypEmployeeId || emp.id;
                      const temp = tempPins[key];
                      if (temp && temp.expiresAt > Date.now()) {
                        const remaining = temp.expiresAt - Date.now();
                        return (
                          <span className="mr-3 inline-flex items-center px-2 py-1 rounded border border-yellow-400/30 bg-yellow-500/10 text-yellow-200 text-xs">
                            PIN: <span className="font-mono ml-1">{temp.pin}</span>
                            <span className="ml-2 opacity-80">({formatCountdown(remaining)})</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="text-red-300 hover:text-red-200"
                    >
                      <FiTrash2 />
                    </button>
                    <button
                      onClick={() => confirmAndReset(emp.flypEmployeeId || emp.id, emp.name)}
                      className="ml-3 text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline text-sm"
                      type="button"
                    >
                      Reset PIN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmResetModal
        open={confirmReset.open}
        name={confirmReset.name}
        onCancel={() => setConfirmReset({ open: false, id: null, name: "" })}
        onConfirm={async () => {
          const { id, name } = confirmReset;
          setConfirmReset({ open: false, id: null, name: "" });
          await handleResetPin(id, name);
        }}
      />
    </div>
  );
};

export default ViewEmployees;