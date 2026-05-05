import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/EmployeeManagement.css';

function EmployeeManagement({ currentUser, onBack }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    employeeName: '', // Internal real name (for response tracking)
    email: '',
    password: '',
    role: 'agent',
    canViewAllStores: true,
    isActive: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Load all employees
  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await api.getEmployees();
      setEmployees(data || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // Open modal for new employee
  const handleAddNew = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      employeeName: '',
      email: '',
      password: '',
      role: 'agent',
      canViewAllStores: true,
      isActive: true,
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  // Open modal for editing
  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      employeeName: employee.employeeName || '',
      email: employee.email,
      password: '', // Don't prefill password
      role: employee.role,
      canViewAllStores: employee.canViewAllStores,
      isActive: employee.isActive,
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Validation
      if (!formData.name || !formData.email) {
        setError('Display name and email are required');
        return;
      }

      if (!editingEmployee && !formData.password) {
        setError('Password is required for new employees');
        return;
      }

      if (formData.password && formData.password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      if (editingEmployee) {
        // Update existing employee
        await api.updateEmployee(editingEmployee.id, formData);
        setSuccess('Employee updated successfully');
      } else {
        // Create new employee
        await api.createEmployee(formData);
        setSuccess('Employee created successfully');
      }

      // Reload list and close modal
      await loadEmployees();
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      console.error('Save employee error:', err);
      setError(err.message || 'Failed to save employee');
    }
  };

  // Toggle employee active status
  const handleToggleStatus = async (employee) => {
    if (!window.confirm(`Are you sure you want to ${employee.isActive ? 'deactivate' : 'activate'} ${employee.name}?`)) {
      return;
    }

    try {
      await api.updateEmployee(employee.id, {
        isActive: !employee.isActive
      });
      await loadEmployees();
      setSuccess(`Employee ${employee.isActive ? 'deactivated' : 'activated'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update employee status');
    }
  };

  // Delete employee
  const handleDelete = async (employee) => {
    if (employee.id === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${employee.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteEmployee(employee.id);
      await loadEmployees();
      setSuccess('Employee deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete employee');
    }
  };

  // Send the response-time report to Discord on demand.
  // Backend skips the post if there's been no activity in the past hour.
  const handleSendDiscordReport = async () => {
    if (!window.confirm('Send the response-time report to the Discord channel now?')) {
      return;
    }
    try {
      await api.triggerDiscordReport();
      setSuccess('📊 Report sent (skipped if no activity in the past hour)');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Discord send error:', err);
      setError(err.message || 'Failed to send Discord report');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleSendDailyReport = async () => {
    if (!window.confirm('Send the daily activity report to the Discord channel now?')) {
      return;
    }
    try {
      await api.triggerDailyDiscordReport();
      setSuccess('📅 Daily report sent — check the channel');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Daily Discord send error:', err);
      setError(err.message || 'Failed to send daily report');
      setTimeout(() => setError(''), 4000);
    }
  };


  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    // Search filter — matches display name, employee name, or email
    const q = searchQuery.toLowerCase();
    const matchesSearch = emp.name.toLowerCase().includes(q) ||
                         (emp.employeeName || '').toLowerCase().includes(q) ||
                         emp.email.toLowerCase().includes(q);

    // Role filter
    const matchesRole = filterRole === 'all' || emp.role === filterRole;

    // Status filter
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && emp.isActive) ||
                         (filterStatus === 'inactive' && !emp.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Get role badge class
  const getRoleBadgeClass = (role) => {
    return role === 'admin' ? 'role-badge-admin' : 'role-badge-agent';
  };

  // Format avg response time for display — always in minutes
  const formatResponseTime = (minutes) => {
    if (minutes == null) return '—';
    if (minutes === 0) return '0 min';
    return `${minutes.toFixed(1)} min`;
  };

  // Color-code by response speed
  const getResponseTimeClass = (minutes) => {
    if (minutes == null) return 'response-none';
    if (minutes <= 2) return 'response-fast';      // green — excellent
    if (minutes <= 10) return 'response-medium';   // yellow — acceptable
    return 'response-slow';                         // red — needs improvement
  };

  // ─────────────────────────────────────────────────────────────────
  // CSV DOWNLOAD — grouped report, one section per agent
  // Each agent section shows: summary header → column headers → per-customer rows
  // ─────────────────────────────────────────────────────────────────

  // Escape a value for safe CSV output — handles commas, quotes, newlines
  const escapeCSV = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (/[,"\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleDownload = () => {
    // Only include agents who have actually replied to someone
    const agentsWithData = filteredEmployees.filter(emp =>
      emp.responsesByCustomer && emp.responsesByCustomer.length > 0
    );

    if (!agentsWithData.length) {
      setError('No response data to export');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Sort agents by total replies descending — busiest at the top of the file
    const sortedAgents = [...agentsWithData].sort((a, b) => {
      const totalA = (a.responsesByCustomer || []).reduce((sum, r) => sum + (r.responseCount || 0), 0);
      const totalB = (b.responsesByCustomer || []).reduce((sum, r) => sum + (r.responseCount || 0), 0);
      return totalB - totalA;
    });

    const csvLines = [];

    for (const emp of sortedAgents) {
      const responses = emp.responsesByCustomer || [];
      const totalReplies = responses.reduce((sum, r) => sum + (r.responseCount || 0), 0);
      const agentLabel = emp.employeeName ? `${emp.employeeName} (${emp.name})` : emp.name;

      // Agent summary header row
      csvLines.push(escapeCSV(
        `${agentLabel} replied to ${totalReplies} message${totalReplies === 1 ? '' : 's'} across ${responses.length} customer${responses.length === 1 ? '' : 's'}`
      ));

      // Column headers for this agent's section
      csvLines.push(
        ['Client Email', 'Avg Response Time (min)', 'Reply Count']
          .map(escapeCSV)
          .join(',')
      );

      // Data rows — sorted by most replies first so top customer relationships show first
      const sortedResponses = [...responses].sort(
        (a, b) => (b.responseCount || 0) - (a.responseCount || 0)
      );
      for (const r of sortedResponses) {
        csvLines.push([
          r.customerEmail,
          r.avgResponseMinutes != null ? r.avgResponseMinutes.toFixed(1) : '',
          r.responseCount,
        ].map(escapeCSV).join(','));
      }

      // Blank line between agents for visual separation
      csvLines.push('');
    }

    // Build CSV with UTF-8 BOM so Excel opens accented characters correctly
    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filterSuffix = (filterRole !== 'all' || filterStatus !== 'all' || searchQuery)
      ? '-filtered'
      : '';
    const filename = `agent-response-report${filterSuffix}-${date}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess(
      `Exported ${sortedAgents.length} agent report${sortedAgents.length === 1 ? '' : 's'} to ${filename}`
    );
    setTimeout(() => setSuccess(''), 3000);
  };

  // Navigate back to dashboard
  const handleBack = () => {
    if (onBack && typeof onBack === 'function') {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="employee-management">
      {/* Header */}
      <div className="em-header">
        <div className="em-header-left">
          <button
            className="btn-back-icon"
            onClick={handleBack}
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            ←
          </button>
          <div className="em-title-group">
            <h1>👥 Employee Management</h1>
            <p className="em-subtitle">{employees.length} total employees</p>
          </div>
        </div>
        <div className="em-header-right">
          <button
            className="btn-secondary"
            onClick={handleSendDiscordReport}
            title="Send the response-time report to the Discord channel now (skips if no activity in the past hour)"
          >
            📊 Send Manual Report
          </button>
                    <button
            className="btn-secondary"
            onClick={handleSendDailyReport}
            title="Send the daily activity report — past 24h conversations, sent/received messages, active employees"
          >
            📅 Send Daily Report
          </button>
          <button
            className="btn-secondary"
            onClick={handleDownload}
            disabled={!filteredEmployees.length}
            title="Download agent response report as CSV — grouped by agent with per-customer response times"
          >
            📥 Download CSV
          </button>
          <button className="btn-primary" onClick={handleAddNew}>
            ➕ Add Employee
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="alert alert-success">
          ✅ {success}
        </div>
      )}
      {error && !showModal && (
        <div className="alert alert-error">
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      <div className="em-filters">
        <div className="filter-search">
          <input
            type="text"
            placeholder="🔍 Search by display name, employee name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="agent">Agent</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Employee Table */}
      <div className="em-table-container">
        {loading ? (
          <div className="em-loading">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="em-empty">
            <p>No employees found</p>
          </div>
        ) : (
          <table className="em-table">
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Employee Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Conversations</th>
                <th>Avg Response</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee.id}>
                  <td>
                    <div className="employee-name">
                      <div className="employee-avatar">
                        {employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="name">{employee.name}</div>
                        {employee.id === currentUser?.id && (
                          <span className="you-badge">You</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-label="Employee Name">
                    {employee.employeeName
                      ? <span className="employee-real-name">{employee.employeeName}</span>
                      : <span className="employee-real-name-empty">—</span>
                    }
                  </td>
                  <td data-label="Email">{employee.email}</td>
                  <td data-label="Role">
                    <span className={`role-badge ${getRoleBadgeClass(employee.role)}`}>
                      {employee.role}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className={`status-badge ${employee.isActive ? 'status-active' : 'status-inactive'}`}>
                      {employee.isActive ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </td>
                  <td data-label="Last Login">
                    {employee.lastLogin ? new Date(employee.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td data-label="Conversations" className="text-center">
                    {employee.totalConversationsHandled || 0}
                  </td>
                  <td data-label="Avg Response" className="text-center">
                    <span
                      className={`response-time ${getResponseTimeClass(employee.avgResponseMinutes)}`}
                      title={
                        employee.avgResponseMinutes != null
                          ? `${employee.employeeName || employee.name} — based on ${employee.totalResponsesCounted || 0} reply${employee.totalResponsesCounted === 1 ? '' : 'ies'} to customer messages (auto-replies excluded)`
                          : 'No response data yet'
                      }
                    >
                      ⏱️ {formatResponseTime(employee.avgResponseMinutes)}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-edit"
                        onClick={() => handleEdit(employee)}
                        title="Edit"
                        aria-label="Edit employee"
                      >
                        ✏️
                      </button>
                      <button
                        className={`btn-action ${employee.isActive ? 'btn-deactivate' : 'btn-activate'}`}
                        onClick={() => handleToggleStatus(employee)}
                        title={employee.isActive ? 'Deactivate' : 'Activate'}
                        aria-label={employee.isActive ? 'Deactivate employee' : 'Activate employee'}
                        disabled={employee.id === currentUser?.id}
                      >
                        {employee.isActive ? '🔒' : '🔓'}
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDelete(employee)}
                        title="Delete"
                        aria-label="Delete employee"
                        disabled={employee.id === currentUser?.id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {error && (
                <div className="alert alert-error">
                  ⚠️ {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="name">
                  Display Name * <span className="label-hint">(shown to customers)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sarah from Support"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="employeeName">
                  Employee Name <span className="label-hint">(internal — for response tracking)</span>
                </label>
                <input
                  id="employeeName"
                  type="text"
                  value={formData.employeeName}
                  onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                  placeholder="e.g. Sarah Dela Cruz"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                  disabled={editingEmployee}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  Password {editingEmployee ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  minLength={8}
                  required={!editingEmployee}
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.canViewAllStores}
                    onChange={(e) => setFormData({ ...formData, canViewAllStores: e.target.checked })}
                  />
                  <span>Can view all stores</span>
                </label>
              </div>

              <div className="form-group-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Active account</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeManagement;