import React, { useState } from 'react';
import AddEmployeeForm from './AddEmployeeForm';
import ViewEmployees from './ViewEmployees';

const ManageEmployee = () => {
  const [activeTab, setActiveTab] = useState('add');

  return (
    <div className="p-6 text-white backdrop-blur-lg bg-gradient-to-b from-gray-900/60 to-gray-800/60 rounded-2xl border border-white/10 shadow-xl">
      <div className="flex gap-4 mb-8 justify-center">
        <button
          className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 border backdrop-blur-md ${
            activeTab === 'add'
              ? 'bg-gradient-to-r from-blue-600 to-teal-500 text-white border-transparent shadow-md'
              : 'bg-white/10 border-white/20 text-gray-300 hover:text-white hover:bg-white/15'
          }`}
          onClick={() => setActiveTab('add')}
        >
          ➕ Add Employee
        </button>

        <button
          className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 border backdrop-blur-md ${
            activeTab === 'view'
              ? 'bg-gradient-to-r from-blue-600 to-teal-500 text-white border-transparent shadow-md'
              : 'bg-white/10 border-white/20 text-gray-300 hover:text-white hover:bg-white/15'
          }`}
          onClick={() => setActiveTab('view')}
        >
          👁️ View Employees
        </button>
      </div>

      {activeTab === 'add' && <AddEmployeeForm />}

      {activeTab === 'view' && <ViewEmployees />}
    </div>
  );
};

export default ManageEmployee;