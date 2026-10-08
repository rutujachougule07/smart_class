import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, counts, schoolProfile, openModal, onLogout }) {
  const navItems = [
    { id: 0, icon: 'fa-chart-pie', label: 'Overview' },
    { id: 1, icon: 'fa-door-open', label: 'Classes', count: counts.classes },
    { id: 2, icon: 'fa-chalkboard-user', label: 'Teachers', count: counts.teachers },
    { id: 3, icon: 'fa-user-graduate', label: 'Students', count: counts.students },
    { id: 4, icon: 'fa-file-signature', label: 'Exams', count: counts.exams },
    { id: 5, icon: 'fa-square-poll-vertical', label: 'Marks', count: counts.marks },
    { id: 6, icon: 'fa-bullhorn', label: 'Notice Board', count: counts.notices },
    { id: 7, icon: 'fa-file-invoice', label: 'Reports' },
    { id: 8, icon: 'fa-gear', label: 'Settings' }
  ];

  return (
    <aside id="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <i className="fa-solid fa-graduation-cap"></i>
        </div>
        <div className="brand-text">
          <h1>SmartClass</h1>
          <span>Admin Panel</span>
        </div>
      </div>

      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.id} className="nav-item">
            <a
              className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span>{item.label}</span>
              {item.count !== undefined && <span className="nav-badge">{item.count}</span>}
            </a>
          </li>
        ))}
      </ul>

      <div
        className="sidebar-footer"
        onClick={() => openModal && openModal('editProfile')}
        style={{ cursor: 'pointer' }}
        title="Settings & Profile"
      >
        <div className="admin-avatar">
          {schoolProfile.adminName ? schoolProfile.adminName[0] : 'A'}
        </div>
        <div className="admin-info">
          <h4>{schoolProfile.adminName}</h4>
          <p>{schoolProfile.schoolName}</p>
        </div>
        <i
          className="fa-solid fa-gear"
          style={{ color: '#94a3b8', fontSize: '15px' }}
          title="Edit Settings"
        ></i>
      </div>

      {onLogout && (
        <div style={{ padding: '0 16px 14px 16px' }}>
          <button
            type="button"
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              color: '#e11d48',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ffe4e6';
              e.currentTarget.style.borderColor = '#fda4af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff1f2';
              e.currentTarget.style.borderColor = '#fecdd3';
            }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Log Out Admin</span>
          </button>
        </div>
      )}
    </aside>
  );
}
