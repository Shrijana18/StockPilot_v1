import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaRobot,
  FaBell,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaPlay,
  FaPause,
  FaEdit,
  FaTrash,
  FaPlus,
} from "react-icons/fa";

const AutomationTracking = () => {
  const [automations, setAutomations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [operations, setOperations] = useState([]);
  const [activeTab, setActiveTab] = useState("automations");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newAutomation, setNewAutomation] = useState({
    name: "",
    type: "status_update",
    trigger: "time_based",
    condition: "",
    action: "",
    enabled: true,
    schedule: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;

      setLoading(true);
      try {
        // Fetch automations
        const automationsRef = collection(
          db,
          `businesses/${productOwnerId}/automations`
        );
        const automationsSnap = await getDocs(automationsRef);
        setAutomations(
          automationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );

        // Fetch alerts
        const alertsRef = collection(db, `businesses/${productOwnerId}/alerts`);
        const alertsSnap = await getDocs(
          query(alertsRef, where("resolved", "==", false))
        );
        setAlerts(
          alertsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );

        // Fetch operations log
        const operationsRef = collection(
          db,
          `businesses/${productOwnerId}/operations`
        );
        const operationsSnap = await getDocs(
          query(operationsRef, orderBy("timestamp", "desc"))
        );
        setOperations(
          operationsSnap.docs
            .slice(0, 50)
            .map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (err) {
        console.error("Error fetching automation data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCreateAutomation = async (e) => {
    e.preventDefault();
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      await addDoc(
        collection(db, `businesses/${productOwnerId}/automations`),
        {
          ...newAutomation,
          createdAt: new Date().toISOString(),
          lastRun: null,
          runCount: 0,
        }
      );

      alert("Automation created successfully!");
      setShowCreateModal(false);
      setNewAutomation({
        name: "",
        type: "status_update",
        trigger: "time_based",
        condition: "",
        action: "",
        enabled: true,
        schedule: "",
      });
    } catch (err) {
      console.error("Error creating automation:", err);
      alert("Failed to create automation.");
    }
  };

  const toggleAutomation = async (automationId, currentStatus) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      await updateDoc(
        doc(db, `businesses/${productOwnerId}/automations`, automationId),
        { enabled: !currentStatus }
      );
    } catch (err) {
      console.error("Error toggling automation:", err);
    }
  };

  const resolveAlert = async (alertId) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      await updateDoc(
        doc(db, `businesses/${productOwnerId}/alerts`, alertId),
        { resolved: true, resolvedAt: new Date().toISOString() }
      );
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-400/20 text-red-300 border-red-400/30";
      case "warning":
        return "bg-orange-400/20 text-orange-300 border-orange-400/30";
      case "info":
        return "bg-blue-400/20 text-blue-300 border-blue-400/30";
      default:
        return "bg-gray-400/20 text-gray-300 border-gray-400/30";
    }
  };

  const getOperationColor = (type) => {
    switch (type) {
      case "success":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-orange-400";
      default:
        return "text-white/70";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Automation & Operations</h2>
          <p className="text-white/70 text-sm mt-1">
            Automate workflows and track operations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center gap-2 transition"
        >
          <FaPlus /> Create Automation
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "automations", label: "Automations", icon: <FaRobot /> },
          { id: "alerts", label: "Alerts", icon: <FaBell /> },
          { id: "operations", label: "Operations Log", icon: <FaClock /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 transition ${
              activeTab === tab.id
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Automations Tab */}
      {activeTab === "automations" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {loading ? (
            <div className="text-center py-12 text-white/50">Loading automations...</div>
          ) : automations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((automation) => (
                <motion.div
                  key={automation.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{automation.name}</h3>
                      <p className="text-sm text-white/70 mt-1">
                        Type: {automation.type} • Trigger: {automation.trigger}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        toggleAutomation(automation.id, automation.enabled)
                      }
                      className={`px-3 py-1 rounded-lg text-sm transition ${
                        automation.enabled
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                          : "bg-gray-500/20 text-gray-300 border border-gray-400/30"
                      }`}
                    >
                      {automation.enabled ? (
                        <>
                          <FaPause className="inline mr-1" /> Pause
                        </>
                      ) : (
                        <>
                          <FaPlay className="inline mr-1" /> Enable
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2 text-sm text-white/70 mb-4">
                    {automation.condition && (
                      <p>
                        <span className="text-white/50">Condition:</span> {automation.condition}
                      </p>
                    )}
                    {automation.action && (
                      <p>
                        <span className="text-white/50">Action:</span> {automation.action}
                      </p>
                    )}
                    {automation.schedule && (
                      <p>
                        <span className="text-white/50">Schedule:</span> {automation.schedule}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/50 pt-3 border-t border-white/10">
                    <span>Runs: {automation.runCount || 0}</span>
                    {automation.lastRun && (
                      <span>
                        Last run: {new Date(automation.lastRun).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No automations configured. Create your first automation to streamline operations.
            </div>
          )}
        </motion.div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-xl border p-4 ${getAlertColor(alert.severity || "info")}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {alert.severity === "critical" && (
                          <FaExclamationTriangle />
                        )}
                        {alert.severity === "warning" && <FaExclamationTriangle />}
                        {alert.severity === "info" && <FaBell />}
                        <h4 className="font-semibold">{alert.title || "Alert"}</h4>
                      </div>
                      <p className="text-sm text-white/80">{alert.message || alert.description}</p>
                      {alert.timestamp && (
                        <p className="text-xs text-white/60 mt-2">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="ml-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
                    >
                      <FaCheckCircle className="inline mr-1" /> Resolve
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No active alerts. All systems operating normally!
            </div>
          )}
        </motion.div>
      )}

      {/* Operations Log Tab */}
      {activeTab === "operations" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {operations.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {operations.map((operation) => (
                    <div
                      key={operation.id}
                      className="p-4 hover:bg-white/5 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-sm font-medium ${getOperationColor(
                                operation.type
                              )}`}
                            >
                              {operation.action || operation.type}
                            </span>
                            {operation.status && (
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  operation.status === "success"
                                    ? "bg-emerald-400/20 text-emerald-300"
                                    : operation.status === "error"
                                    ? "bg-red-400/20 text-red-300"
                                    : "bg-gray-400/20 text-gray-300"
                                }`}
                              >
                                {operation.status}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/70">
                            {operation.description || operation.message}
                          </p>
                          {operation.timestamp && (
                            <p className="text-xs text-white/50 mt-1">
                              {new Date(operation.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-white/50">
                  No operations logged yet
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Create Automation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold mb-4">Create Automation</h3>
              <form onSubmit={handleCreateAutomation} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={newAutomation.name}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Type *</label>
                  <select
                    required
                    value={newAutomation.type}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, type: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <option value="status_update">Status Update</option>
                    <option value="order_assignment">Order Assignment</option>
                    <option value="inventory_alert">Inventory Alert</option>
                    <option value="report_generation">Report Generation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Trigger *</label>
                  <select
                    required
                    value={newAutomation.trigger}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, trigger: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <option value="time_based">Time Based</option>
                    <option value="event_based">Event Based</option>
                    <option value="condition_based">Condition Based</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Condition</label>
                  <input
                    type="text"
                    value={newAutomation.condition}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, condition: e.target.value })
                    }
                    placeholder="e.g., quantity < 10"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Action</label>
                  <textarea
                    value={newAutomation.action}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, action: e.target.value })
                    }
                    rows={3}
                    placeholder="Describe the action to perform"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Schedule</label>
                  <input
                    type="text"
                    value={newAutomation.schedule}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, schedule: e.target.value })
                    }
                    placeholder="e.g., Daily at 9 AM"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AutomationTracking;

