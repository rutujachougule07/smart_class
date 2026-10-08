import React, { useState } from 'react';

export default function NoticesTab({
  state,
  deleteNotice,
  deleteSelectedNotices,
  clearAllNotices,
  openModal
}) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'individual' | 'general'
  const [selectedNoticeIds, setSelectedNoticeIds] = useState(new Set());

  const notices = state.notices || [];

  const individualNotices = notices.filter(
    (n) => n.targetRole === 'Selected Parent' || n.studentId || n.parentPhone
  );
  const generalNotices = notices.filter(
    (n) => n.targetRole !== 'Selected Parent' && !n.studentId && !n.parentPhone
  );

  const displayedNotices =
    filterType === 'individual'
      ? individualNotices
      : filterType === 'general'
      ? generalNotices
      : notices;

  const allSelected = displayedNotices.length > 0 && displayedNotices.every((n) => selectedNoticeIds.has(n.id));

  const handleToggleSelectCard = (id) => {
    setSelectedNoticeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedNoticeIds(new Set());
    } else {
      setSelectedNoticeIds(new Set(displayedNotices.map((n) => n.id)));
    }
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    setSelectedNoticeIds(new Set());
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedNoticeIds);
    if (ids.length === 0) return;
    if (deleteSelectedNotices) {
      await deleteSelectedNotices(ids);
      setSelectedNoticeIds(new Set());
    }
  };

  const handleClearAll = async () => {
    if (clearAllNotices) {
      await clearAllNotices(filterType);
      setSelectedNoticeIds(new Set());
    }
  };

  return (
    <div>
      <div className="section-title">
        <span>School Announcements & Bulletins</span>
        <button className="btn btn-amber" onClick={() => openModal('addNotice')}>
          <i className="fa-solid fa-bullhorn"></i> Publish Notice
        </button>
      </div>

      {/* Filter Tabs & Bulk Actions Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        {/* Left: Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '20px' }}
            onClick={() => handleFilterChange('all')}
          >
            All Notices ({notices.length})
          </button>
          <button
            type="button"
            className={`btn ${filterType === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '20px' }}
            onClick={() => handleFilterChange('individual')}
          >
            <i className="fa-solid fa-user-check" style={{ marginRight: '6px' }}></i>
            Individual Parent Notices ({individualNotices.length})
          </button>
          <button
            type="button"
            className={`btn ${filterType === 'general' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '20px' }}
            onClick={() => handleFilterChange('general')}
          >
            <i className="fa-solid fa-bullhorn" style={{ marginRight: '6px' }}></i>
            General Broadcasts ({generalNotices.length})
          </button>
        </div>

        {/* Right: Bulk Selection & Clear Actions */}
        {displayedNotices.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleToggleSelectAll}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}
              title={allSelected ? "Deselect all visible notices" : "Select all visible notices"}
            >
              <i
                className={allSelected ? "fa-solid fa-square-check" : "fa-regular fa-square"}
                style={{ color: allSelected ? 'var(--primary)' : 'inherit' }}
              ></i>
              <span>{allSelected ? 'Unselect All' : 'Select All'}</span>
            </button>

            {selectedNoticeIds.size > 0 && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteSelected}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                }}
                title="Permanently delete selected notices"
              >
                <i className="fa-solid fa-trash-can"></i>
                <span>Delete Selected ({selectedNoticeIds.size})</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleClearAll}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '8px',
                borderColor: '#fca5a5',
                color: '#dc2626',
                backgroundColor: '#fef2f2',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}
              title={`Permanently clear all ${filterType === 'all' ? 'notices' : filterType + ' notices'}`}
            >
              <i className="fa-solid fa-broom"></i>
              <span>Clear All ({displayedNotices.length})</span>
            </button>
          </div>
        )}
      </div>

      {displayedNotices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          <i className="fa-regular fa-bell-slash" style={{ fontSize: '36px', marginBottom: '10px', color: '#cbd5e1' }}></i>
          <p>No notices found matching this filter.</p>
        </div>
      ) : (
        <div className="cards-grid-2">
          {displayedNotices.map((n) => {
            const isIndividual = n.targetRole === 'Selected Parent' || n.studentId || n.parentPhone;
            const isRead = n.isRead === true || (n.readBy && n.readBy.length > 0) || n.status === 'read';
            const isSelected = selectedNoticeIds.has(n.id);
            return (
              <div
                key={n.id}
                className="data-card"
                style={{
                  ...(isIndividual ? { borderTop: '3px solid var(--primary, #2563eb)' } : {}),
                  ...(isSelected
                    ? {
                        borderColor: 'var(--primary, #2563eb)',
                        backgroundColor: '#f8fafc',
                        boxShadow: '0 0 0 1.5px var(--primary, #2563eb)'
                      }
                    : {})
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {/* Checkbox for selection */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectCard(n.id)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: 'var(--primary, #2563eb)',
                        margin: 0
                      }}
                      title="Select this notice"
                    />

                    {/* Individual vs General Notice Type Indicator */}
                    {isIndividual ? (
                      <span
                        style={{
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-user-lock" style={{ fontSize: '10px' }}></i>
                        Individual Notice
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-bullhorn" style={{ fontSize: '10px' }}></i>
                        General ({n.targetRole || 'All'})
                      </span>
                    )}

                    {Boolean(n.deletedInAndroid || n.hiddenInAndroid) && (
                      <span
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid #cbd5e1'
                        }}
                        title="Removed from Android app view, but safely preserved & saved in Admin Panel."
                      >
                        <i className="fa-brands fa-android" style={{ color: '#10b981', fontSize: '11px' }}></i>
                        Preserved
                      </span>
                    )}

                    {/* Read / Unread Status Indicator */}
                    {isIndividual && (
                      <span
                        style={{
                          backgroundColor: isRead ? '#dcfce7' : '#ffedd5',
                          color: isRead ? '#15803d' : '#c2410c',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isRead ? (
                          <>
                            <i className="fa-solid fa-check-double" style={{ fontSize: '10px' }}></i>
                            Read
                          </>
                        ) : (
                          <>
                            <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i>
                            Unread
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <i
                    className="fa-solid fa-trash"
                    style={{ color: 'var(--rose)', cursor: 'pointer', fontSize: '14px', marginTop: '2px' }}
                    title="Delete Notice"
                    onClick={() => deleteNotice(n.id)}
                  ></i>
                </div>

                <h4 style={{ fontSize: '16px', fontWeight: 700, marginTop: '10px', marginBottom: '4px' }}>
                  {n.title}
                </h4>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '4px 0 8px' }}>
                  {n.content}
                </p>

                {/* Individual Recipient Details Box */}
                {isIndividual && (
                  <div
                    style={{
                      margin: '10px 0',
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-user" style={{ color: '#2563eb' }}></i>
                      <span>
                        Parent: {n.parentName || 'Parent'} {n.parentPhone ? `(${n.parentPhone})` : ''}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-graduation-cap" style={{ color: '#6366f1' }}></i>
                      <span>
                        Student: <strong>{n.studentName || 'Student'}</strong>
                        {n.className ? ` • ${n.className}` : ''}
                      </span>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #e2e8f0'
                  }}
                >
                  <span>By: {n.author || 'Admin'}</span>
                  <span>{n.date || 'Today'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
