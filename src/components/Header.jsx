import React, { useState, useRef, useEffect, useMemo } from 'react';

const READ_STORAGE_KEY = 'smartclass_admin_read_notifs';

// Helper to format timestamps into clean relative or friendly strings
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch (e) {
    return 'Recent';
  }
};

// Map notification category to icon, colors, and target tab
const getNotificationDetails = (n) => {
  const type = (n.type || '').toLowerCase();
  const section = (n.section || '').toLowerCase();
  const title = (n.title || '').toLowerCase();

  if (type === 'marks' || section === 'marks' || title.includes('marks')) {
    return {
      icon: 'fa-solid fa-chart-column',
      bg: '#fef3c7',
      color: '#b45309',
      tagBg: '#fffbeb',
      tagColor: '#92400e',
      badge: 'MARKS',
      actionHint: 'View in Marks',
      tabIndex: 5
    };
  }

  if (type === 'exam' || section === 'exams' || title.includes('exam')) {
    return {
      icon: 'fa-solid fa-calendar-check',
      bg: '#ffedd5',
      color: '#c2410c',
      tagBg: '#fff7ed',
      tagColor: '#9a3412',
      badge: 'EXAM',
      actionHint: 'View in Exams',
      tabIndex: 4
    };
  }

  if (type === 'attendance' || section === 'attendance' || title.includes('attendance')) {
    return {
      icon: 'fa-solid fa-clipboard-user',
      bg: '#dcfce7',
      color: '#15803d',
      tagBg: '#f0fdf4',
      tagColor: '#166534',
      badge: 'ATTENDANCE',
      actionHint: 'View Attendance',
      tabIndex: 3
    };
  }

  if (type === 'student' || section === 'students' || title.includes('student')) {
    return {
      icon: 'fa-solid fa-user-graduate',
      bg: '#eff6ff',
      color: '#1d4ed8',
      tagBg: '#f0fdf4',
      tagColor: '#1e40af',
      badge: 'STUDENT',
      actionHint: 'View in Students',
      tabIndex: 3
    };
  }

  if (type === 'teacher' || section === 'teachers' || title.includes('teacher')) {
    return {
      icon: 'fa-solid fa-chalkboard-user',
      bg: '#f3e8ff',
      color: '#7e22ce',
      tagBg: '#faf5ff',
      tagColor: '#6b21a8',
      badge: 'TEACHER',
      actionHint: 'View Teachers',
      tabIndex: 2
    };
  }

  if (type === 'class' || section === 'classes' || title.includes('class')) {
    return {
      icon: 'fa-solid fa-school',
      bg: '#ecfdf5',
      color: '#047857',
      tagBg: '#f0fdf4',
      tagColor: '#065f46',
      badge: 'CLASS',
      actionHint: 'View Classes',
      tabIndex: 1
    };
  }

  if (type === 'import' || title.includes('excel') || title.includes('import')) {
    return {
      icon: 'fa-solid fa-file-excel',
      bg: '#ccfbf1',
      color: '#0f766e',
      tagBg: '#f0fdfa',
      tagColor: '#115e59',
      badge: 'EXCEL IMPORT',
      actionHint: 'View Data',
      tabIndex: 3
    };
  }

  return {
    icon: 'fa-solid fa-bell',
    bg: '#eff6ff',
    color: '#2563eb',
    tagBg: '#f8fafc',
    tagColor: '#475569',
    badge: 'ACTIVITY',
    actionHint: 'View Section',
    tabIndex: 0
  };
};

export default function Header({
  activeTab = 0,
  schoolProfile = {},
  notifications = [],
  setActiveTab,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotification,
  clearAllNotifications,
  onLogout,
  onGoToLanding
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'students' | 'staff' | 'academics'
  const notifRef = useRef(null);

  // Local storage cache for persistent read IDs across reloads
  const [localReadIds, setLocalReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY);
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (e) {
      return new Set();
    }
  });

  // Sync state if localStorage changes in another tab
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === READ_STORAGE_KEY) {
        try {
          setLocalReadIds(new Set(e.newValue ? JSON.parse(e.newValue) : []));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  // Tab Title & Subtitle Mapping
  const tabTitles = [
    ['Dashboard Overview', 'School operational metrics & real-time control center'],
    ['Class Management', 'Manage school sections, class teachers & capacity'],
    ['Teacher Directory', 'Faculty profiles, qualifications & class assignments'],
    ['Student Management', 'Enrolled students registry, filters & Excel bulk operations'],
    ['Exam Schedules', 'Class examination timetables, schedules & exam papers'],
    ['Marks Management', 'Student academic performance, subject marks & report card grades'],
    ['Notice Board', 'School wide announcements & bulletins'],
    ['Reports & Parent Communication', 'Class-wise student progress cards, attendance updates & parent broadcasts']
  ];

  const titleInfo = tabTitles[activeTab] || tabTitles[0];

  // Helper to determine if an item is read
  const isItemRead = (n) => Boolean(n.isRead || localReadIds.has(n.id));

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !isItemRead(n)).length;
  }, [notifications, localReadIds]);

  // Handle Mark Single Item Read + Navigation
  const handleItemClick = (item) => {
    const details = getNotificationDetails(item);

    // 1. Mark as read immediately in local state & localStorage
    if (!isItemRead(item)) {
      setLocalReadIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        try {
          localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch (e) {}
        return next;
      });

      if (markNotificationAsRead) {
        markNotificationAsRead(item.id);
      }
    }

    // 2. Navigate to relevant tab if applicable
    const targetTab = item.tabIndex !== undefined && item.tabIndex !== null ? item.tabIndex : details.tabIndex;
    if (targetTab !== null && targetTab !== undefined && setActiveTab) {
      setActiveTab(targetTab);
    }

    // 3. Close panel
    setIsNotifOpen(false);
  };

  // Handle Mark All Read
  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    const allIds = notifications.map((n) => n.id).filter(Boolean);

    setLocalReadIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (err) {}
      return next;
    });

    if (markAllNotificationsAsRead) {
      markAllNotificationsAsRead();
    }
  };

  // Handle Clear Single Notification
  const handleClearSingle = (e, notifId) => {
    e.stopPropagation();
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      next.delete(notifId);
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (err) {}
      return next;
    });

    if (clearNotification) {
      clearNotification(notifId);
    }
  };

  // Handle Clear All Notifications
  const handleClearAll = (e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to clear all notifications?")) {
      setLocalReadIds(new Set());
      try {
        localStorage.removeItem(READ_STORAGE_KEY);
      } catch (err) {}

      if (clearAllNotifications) {
        clearAllNotifications();
      }
    }
  };

  // Filter categorization counts
  const studentAttList = useMemo(() => {
    return notifications.filter((n) => {
      const t = (n.type || '').toLowerCase();
      const s = (n.section || '').toLowerCase();
      return t === 'student' || t === 'attendance' || s === 'students' || s === 'attendance' || n.studentId;
    });
  }, [notifications]);

  const staffList = useMemo(() => {
    return notifications.filter((n) => {
      const t = (n.type || '').toLowerCase();
      const s = (n.section || '').toLowerCase();
      return t === 'teacher' || t === 'class' || s === 'teachers' || s === 'classes';
    });
  }, [notifications]);

  const academicsList = useMemo(() => {
    return notifications.filter((n) => {
      const t = (n.type || '').toLowerCase();
      const s = (n.section || '').toLowerCase();
      return t === 'exam' || t === 'marks' || s === 'exams' || s === 'marks';
    });
  }, [notifications]);

  // Displayed notifications based on active filter
  const displayedNotifications = useMemo(() => {
    if (filterType === 'unread') {
      return notifications.filter((n) => !isItemRead(n));
    }
    if (filterType === 'students') {
      return studentAttList;
    }
    if (filterType === 'staff') {
      return staffList;
    }
    if (filterType === 'academics') {
      return academicsList;
    }
    return notifications;
  }, [notifications, filterType, localReadIds, studentAttList, staffList, academicsList]);

  return (
    <header style={{ position: 'relative' }}>
      {/* Component Specific Keyframes & Scrollbar Styling */}
      <style>{`
        @keyframes notifPanelIn {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .notif-panel-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .notif-panel-scroll::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .notif-panel-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .notif-panel-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .notif-bell-btn:hover {
          background-color: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
        }
        .notif-filters-bar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Page Title & Subtitle */}
      <div className="header-title">
        <h2>{titleInfo[0]}</h2>
        <p>{titleInfo[1]}</p>
      </div>

      {/* Header Actions */}
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* School ID Badge */}
        <div className="badge-tag">
          <i className="fa-solid fa-shield-halved" style={{ color: 'var(--teal, #0d9488)' }}></i>
          <span>{schoolProfile.schoolId || 'SCH-2026-904'}</span>
        </div>

        {/* Date Badge */}
        <div className="badge-tag">
          <i className="fa-regular fa-calendar"></i>
          <span>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
        </div>

        {/* Mobile-Style Notification Bell Button & Dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="notif-bell-btn"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            style={{
              position: 'relative',
              backgroundColor: isNotifOpen ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${isNotifOpen ? '#2563eb' : 'var(--border-color, #e2e8f0)'}`,
              color: isNotifOpen ? '#2563eb' : '#334155',
              padding: '7px 13px',
              borderRadius: '9px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              transition: 'all 0.15s ease',
              boxShadow: isNotifOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none'
            }}
            title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
          >
            <i
              className="fa-solid fa-bell"
              style={{
                fontSize: '14px',
                color: unreadCount > 0 ? '#2563eb' : isNotifOpen ? '#2563eb' : '#64748b'
              }}
            ></i>
            <span>Notifications</span>

            {/* UNREAD BADGE: ONLY rendered if unreadCount > 0. Disappears completely when 0 */}
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  padding: '1px 6px',
                  borderRadius: '12px',
                  minWidth: '18px',
                  textAlign: 'center',
                  boxShadow: '0 2px 5px rgba(239, 68, 68, 0.35)',
                  lineHeight: '1.4'
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* MOBILE-STYLE NOTIFICATION PANEL DROPDOWN */}
          {isNotifOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '460px',
                maxWidth: 'calc(100vw - 20px)',
                height: 'calc(100vh - 86px)',
                maxHeight: 'calc(100vh - 86px)',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.06)',
                zIndex: 1500,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'notifPanelIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Panel Top Header */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flexShrink: 1 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      flexShrink: 0
                    }}
                  >
                    <i className="fa-solid fa-bell"></i>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'nowrap' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        Notifications
                      </h4>
                      {unreadCount > 0 ? (
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            border: '1px solid #fecaca',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            lineHeight: '1.2'
                          }}
                        >
                          {unreadCount} New
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            border: '1px solid #a7f3d0',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            lineHeight: '1.2'
                          }}
                        >
                          ✓ Caught up
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {notifications.length} recent admin activit{notifications.length === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Mark all as read button */}
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#2563eb',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#c7d2fe';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                      title="Mark all notifications as read"
                    >
                      <i className="fa-solid fa-check-double" style={{ fontSize: '10px' }}></i>
                      <span>Mark read</span>
                    </button>
                  )}

                  {/* Clear all notifications button */}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        color: '#e11d48',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
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
                      title="Clear and delete all notifications"
                    >
                      <i className="fa-regular fa-trash-can" style={{ fontSize: '10px' }}></i>
                      <span>Clear all</span>
                    </button>
                  )}

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen(false)}
                    style={{
                      border: 'none',
                      background: '#f8fafc',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: '#64748b',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.color = '#64748b';
                    }}
                    title="Close"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>

              {/* Filter Tabs Bar */}
              <div
                className="notif-filters-bar"
                style={{
                  padding: '9px 14px',
                  display: 'flex',
                  gap: '6px',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  flexShrink: 0
                }}
              >
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  style={{
                    border: 'none',
                    backgroundColor: filterType === 'all' ? '#2563eb' : '#ffffff',
                    color: filterType === 'all' ? '#ffffff' : '#64748b',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: filterType === 'all' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('unread')}
                  style={{
                    border: 'none',
                    backgroundColor: filterType === 'unread' ? '#2563eb' : '#ffffff',
                    color: filterType === 'unread' ? '#ffffff' : unreadCount > 0 ? '#ef4444' : '#64748b',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: filterType === 'unread' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('students')}
                  style={{
                    border: 'none',
                    backgroundColor: filterType === 'students' ? '#2563eb' : '#ffffff',
                    color: filterType === 'students' ? '#ffffff' : '#64748b',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: filterType === 'students' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  Students ({studentAttList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('staff')}
                  style={{
                    border: 'none',
                    backgroundColor: filterType === 'staff' ? '#2563eb' : '#ffffff',
                    color: filterType === 'staff' ? '#ffffff' : '#64748b',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: filterType === 'staff' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  Staff & Classes ({staffList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('academics')}
                  style={{
                    border: 'none',
                    backgroundColor: filterType === 'academics' ? '#2563eb' : '#ffffff',
                    color: filterType === 'academics' ? '#ffffff' : '#64748b',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: filterType === 'academics' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  Exams & Marks ({academicsList.length})
                </button>
              </div>

              {/* Notification Items List Container (Vertical Scrolling) */}
              <div
                className="notif-panel-scroll"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {displayedNotifications.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: '#f1f5f9',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        marginBottom: '14px'
                      }}
                    >
                      <i className="fa-regular fa-bell-slash"></i>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#475569' }}>
                      {filterType === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: '#94a3b8',
                        marginTop: '6px',
                        maxWidth: '290px',
                        lineHeight: '1.45'
                      }}
                    >
                      {filterType === 'unread'
                        ? 'All administrative activities have been marked as read.'
                        : 'Activities across students, teachers, marks, and classes will appear here automatically.'}
                    </div>
                  </div>
                ) : (
                  displayedNotifications.map((n) => {
                    const details = getNotificationDetails(n);
                    const read = isItemRead(n);
                    const timeAgo = formatTimeAgo(n.createdAt || n.timestamp || n.date);

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleItemClick(n)}
                        style={{
                          padding: '13px 16px',
                          borderBottom: '1px solid #f1f5f9',
                          borderLeft: read ? '3.5px solid transparent' : '3.5px solid #2563eb',
                          backgroundColor: read ? '#ffffff' : '#f8faff',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          transition: 'background-color 0.15s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = read ? '#f8fafc' : '#eff6ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = read ? '#ffffff' : '#f8faff';
                        }}
                        title={`Click to open ${details.actionHint}`}
                      >
                        {/* Section Icon Box */}
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '15px',
                            backgroundColor: details.bg,
                            color: details.color,
                            marginTop: '2px'
                          }}
                        >
                          <i className={details.icon}></i>
                        </div>

                        {/* Notification Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Top Row: Category tag + Time + Unread indicator dot */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '3px',
                              gap: '6px'
                            }}
                          >
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: '800',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: details.tagBg,
                                color: details.tagColor,
                                border: `1px solid ${details.color}25`,
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {details.badge}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '10.5px', color: read ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>
                                {timeAgo}
                              </span>
                              {!read && (
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2563eb',
                                    display: 'inline-block',
                                    boxShadow: '0 0 0 2px #dbeafe'
                                  }}
                                  title="Unread notification"
                                ></span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleClearSingle(e, n.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                  e.currentTarget.style.color = '#ef4444';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = '#94a3b8';
                                }}
                                title="Clear / Dismiss notification"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          </div>

                          {/* Title: Bold when unread */}
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: read ? '600' : '750',
                              color: read ? '#334155' : '#0f172a',
                              lineHeight: '1.35',
                              marginBottom: '3px'
                            }}
                          >
                            {n.title}
                          </div>

                          {/* Content / Message */}
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: read ? '#64748b' : '#475569',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: '1.4',
                              marginBottom: '6px'
                            }}
                          >
                            {n.message || n.content}
                          </div>

                          {/* Contextual Chips & Navigation Link */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {n.studentName && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8'
                                  }}
                                >
                                  👤 {n.studentName}
                                </span>
                              )}
                              {n.className && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569'
                                  }}
                                >
                                  🏫 {n.className}
                                </span>
                              )}
                            </div>

                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                color: read ? '#94a3b8' : '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <span>{details.actionHint}</span>
                              <i className="fa-solid fa-arrow-right" style={{ fontSize: '9.5px' }}></i>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Panel Footer */}
              <div
                style={{
                  padding: '12px 18px',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0
                }}
              >
                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-bolt" style={{ color: 'var(--teal, #0d9488)', fontSize: '11px' }}></i>
                  <span>Real-time Admin Activity Feed</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#2563eb',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title="Mark all unread notifications as read"
                    >
                      Mark all read ({unreadCount})
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#e11d48',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Clear and delete all notifications"
                    >
                      <i className="fa-regular fa-trash-can" style={{ fontSize: '10.5px' }}></i>
                      Clear all ({notifications.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Return to Public Campus Website Button */}
        {onGoToLanding && (
          <button
            type="button"
            onClick={onGoToLanding}
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#334155',
              padding: '7px 13px',
              borderRadius: '9px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.color = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#334155';
            }}
            title="View Public College Landing Page"
          >
            <i className="fa-solid fa-house" style={{ fontSize: '12px' }}></i>
            <span>Campus Website</span>
          </button>
        )}

        {/* Admin Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#e11d48',
              padding: '7px 13px',
              borderRadius: '9px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
            title="Log out of Admin Panel"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" style={{ fontSize: '12px' }}></i>
            <span>Logout</span>
          </button>
        )}
      </div>
    </header>
  );
}
