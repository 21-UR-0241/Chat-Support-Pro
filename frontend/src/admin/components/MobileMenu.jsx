import React from 'react';

function MobileMenu({ 
  isOpen, 
  onClose, 
  employee, 
  activePage, 
  onPageChange, 
  onRefresh, 
  onLogout,
  stats,
  isConnected 
}) {
  
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Menu Drawer */}
      <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="mobile-menu-header">
          <div className="employee-avatar">
            {getInitials(employee.name)}
          </div>
          <div>
            <div className="employee-name">{employee.name}</div>
            <div className="employee-email">{employee.email}</div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="mobile-menu-items">
          {/* Dashboard */}
          <button
            className={`mobile-menu-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => onPageChange('dashboard')}
            type="button"
          >
            <span className="icon">💬</span>
            <span>Dashboard</span>
          </button>

          {/* Stats */}
          {stats && activePage === 'dashboard' && (
            <>
            </>
          )}

          {/* Refresh */}
          {activePage === 'dashboard' && (
            <button
              className="mobile-menu-item"
              onClick={onRefresh}
              type="button"
            >
              <span className="icon">🔄</span>
              <span>Refresh</span>
            </button>
          )}

          {/* Employee Management */}
          {employee.role === 'admin' && (
            <button
              className={`mobile-menu-item ${activePage === 'employees' ? 'active' : ''}`}
              onClick={() => onPageChange('employees')}
              type="button"
            >
              <span className="icon">👥</span>
              <span>Employees</span>
            </button>
          )}

          <div className="mobile-menu-divider" />
        </div>

        {/* Footer - Logout */}
        <div className="mobile-menu-footer">
          <button
            className="mobile-menu-logout"
            onClick={onLogout}
            type="button"
          >
            <span className="icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default MobileMenu;