import React, { useState } from 'react';
import AddEmployeeForm from './AddEmployeeForm';
import ViewEmployees from './ViewEmployees';

const ManageEmployee = () => {
  const [activeTab, setActiveTab] = useState('add');

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded-md ${activeTab === 'add' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('add')}
        >
          ➕ Add Employee
        </button>
        <button
          className={`px-4 py-2 rounded-md ${activeTab === 'view' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
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