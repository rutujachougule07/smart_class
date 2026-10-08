import React, { useState, useMemo } from 'react';
import ClassBadge from './ClassBadge';
import { isClassMatch } from '../services/classUtils';

export default function ExamsTab({ state, deleteExam, openModal, setActiveTab, navigateToExamMarks }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered exams based on search query, class, and date
  const filteredExams = useMemo(() => {
    return (state.exams || []).filter((e) => {
      const cid = e.classId || e.class_id;
      const cls = (state.classes || []).find((c) => c.id === cid);
      const classNameDisplay = cls ? `${cls.name} ${cls.section}` : (e.className || '');

      // 1. Class filter
      if (selectedClassFilter !== 'all' && !isClassMatch(cid, selectedClassFilter, state.classes)) {
        return false;
      }

      // 2. Date filter
      if (dateFilter === 'past') {
        if (!e.date || e.date >= todayStr) return false;
      } else if (dateFilter === 'today') {
        if (e.date !== todayStr) return false;
      } else if (dateFilter === 'upcoming') {
        if (!e.date || e.date <= todayStr) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (e.title || '').toLowerCase().includes(q);
        const subjMatch = (e.subject || '').toLowerCase().includes(q);
        const classMatch = classNameDisplay.toLowerCase().includes(q);
        const dateMatch = (e.date || '').toLowerCase().includes(q);
        if (!titleMatch && !subjMatch && !classMatch && !dateMatch) return false;
      }

      return true;
    });
  }, [state.exams, state.classes, selectedClassFilter, dateFilter, searchQuery, todayStr]);

  // Counts for quick overview
  const pastCount = useMemo(
    () => (state.exams || []).filter((e) => e.date && e.date < todayStr).length,
    [state.exams, todayStr]
  );
  const todayCount = useMemo(
    () => (state.exams || []).filter((e) => e.date === todayStr).length,
    [state.exams, todayStr]
  );
  const upcomingCount = useMemo(
    () => (state.exams || []).filter((e) => e.date && e.date > todayStr).length,
    [state.exams, todayStr]
  );

  const handleOpenMarks = (examId, classId) => {
    if (navigateToExamMarks) {
      navigateToExamMarks(examId, classId);
    } else if (setActiveTab) {
      setActiveTab(5);
    }
  };

  return (
    <div>
      {/* Header & Create Exam */}
      <div className="section-title">
        <div>
          <span style={{ fontSize: '18px', fontWeight: 800 }}>Class Examination Schedules</span>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Schedule new exams, manage past date emergency exams, and fill student marks
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('addExam')}>
          <i className="fa-solid fa-plus"></i> Create Exam
        </button>
      </div>

      {/* Mini Stats Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Total Scheduled Exams</h5>
            <h2 style={{ fontSize: '20px', margin: '2px 0', color: 'var(--text-primary)' }}>{state.exams?.length || 0}</h2>
            <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Active in Database</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', width: '36px', height: '36px', fontSize: '15px' }}>
            <i className="fa-solid fa-book-bookmark"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Past / Emergency Backdated</h5>
            <h2 style={{ fontSize: '20px', margin: '2px 0', color: '#b45309' }}>{pastCount}</h2>
            <p style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>Completed Offline</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', width: '36px', height: '36px', fontSize: '15px' }}>
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Today's Exams</h5>
            <h2 style={{ fontSize: '20px', margin: '2px 0', color: 'var(--teal)' }}>{todayCount}</h2>
            <p style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 600 }}>In Progress Today</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--teal)', width: '36px', height: '36px', fontSize: '15px' }}>
            <i className="fa-regular fa-calendar-check"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '12px 16px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Upcoming Exams</h5>
            <h2 style={{ fontSize: '20px', margin: '2px 0', color: '#16a34a' }}>{upcomingCount}</h2>
            <p style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Scheduled Ahead</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', width: '36px', height: '36px', fontSize: '15px' }}>
            <i className="fa-regular fa-calendar-days"></i>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '13px'
            }}
          ></i>
          <input
            type="text"
            className="form-control"
            placeholder="Search exam title, subject, class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '13px' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="Clear search"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Class Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Class:</span>
            <select
              className="form-control"
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12.5px', minWidth: '130px' }}
            >
              <option value="all">All Classes</option>
              {(state.classes || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* Date / Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Date:</span>
            <select
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12.5px', minWidth: '140px' }}
            >
              <option value="all">All Dates</option>
              <option value="past">🕒 Past Exams (Emergency)</option>
              <option value="today">📅 Today's Exams</option>
              <option value="upcoming">🗓️ Upcoming Exams</option>
            </select>
          </div>

          {/* Reset Filters button if any active */}
          {(searchQuery || selectedClassFilter !== 'all' || dateFilter !== 'all') && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setSelectedClassFilter('all');
                setDateFilter('all');
              }}
              style={{ padding: '6px 10px', fontSize: '12px', color: '#64748b' }}
              title="Reset all filters"
            >
              <i className="fa-solid fa-arrow-rotate-left" style={{ marginRight: '4px' }}></i> Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content List */}
      {state.exams.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-secondary)',
          background: 'white',
          borderRadius: '12px',
          border: '2px dashed #cbd5e1',
          margin: '10px 0'
        }}>
          <i className="fa-solid fa-file-circle-xmark" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '16px' }}></i>
          <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>No Exams Scheduled</h4>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 20px' }}>
            No exams have been scheduled yet. You can create an exam for today, a future date, or choose a past date to record emergency offline marks.
          </p>
          <button className="btn btn-primary" onClick={() => openModal('addExam')}>
            <i className="fa-solid fa-plus"></i> Schedule New Exam
          </button>
        </div>
      ) : filteredExams.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-secondary)',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          margin: '10px 0'
        }}>
          <i className="fa-solid fa-filter-circle-xmark" style={{ fontSize: '36px', color: '#cbd5e1', marginBottom: '12px' }}></i>
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>No Exams Found</h4>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
            No examinations match your current search or filter criteria.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setSelectedClassFilter('all');
              setDateFilter('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="cards-grid-2">
          {filteredExams.map((e) => {
            const cid = e.classId || e.class_id;
            const cls = (state.classes || []).find((c) => c.id === cid);
            const classNameDisplay = cls ? `${cls.name} - ${cls.section}` : (e.className || (cid === 'all' || !cid ? 'All Classes' : `Class ${cid}`));
            const linkedMarksCount = (state.marks || []).filter(
              (m) =>
                m.examId === e.id ||
                (m.examTitle === e.title || m.examId === e.title) ||
                (m.id && m.id.endsWith(`_${e.id}`))
            ).length;

            const isPastExam = Boolean(e.date && e.date < todayStr);
            const isTodayExam = Boolean(e.date && e.date === todayStr);

            return (
              <div key={e.id} className="data-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {/* Title & Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>{e.title}</h4>
                      {Boolean(e.deletedInAndroid || e.hiddenInAndroid) && (
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Removed from Android app, but safely preserved & saved in Admin Panel."
                        >
                          <i className="fa-brands fa-android" style={{ color: '#10b981' }}></i>
                          Preserved
                        </span>
                      )}
                    </div>
                    <ClassBadge classItem={classNameDisplay} />
                  </div>

                  {/* Subject & Marks Info */}
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 6px' }}>
                    Subject: <strong style={{ color: 'var(--text-primary)' }}>{e.subject || 'General'}</strong> • Max Marks: <strong style={{ color: 'var(--text-primary)' }}>{e.maxMarks || 100}</strong>
                  </p>

                  {/* Date Badge & Evaluation Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {/* Date Tag */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      backgroundColor: isPastExam ? '#fffbeb' : isTodayExam ? '#eff6ff' : '#f0fdf4',
                      color: isPastExam ? '#b45309' : isTodayExam ? '#1d4ed8' : '#15803d',
                      border: `1px solid ${isPastExam ? '#fde68a' : isTodayExam ? '#bfdbfe' : '#bbf7d0'}`
                    }}>
                      <i className={isPastExam ? 'fa-solid fa-clock-rotate-left' : isTodayExam ? 'fa-regular fa-calendar-check' : 'fa-regular fa-calendar-days'}></i>
                      <span>Date: {e.date || 'Not set'}</span>
                      {isPastExam && <span style={{ opacity: 0.85 }}>(Past Exam)</span>}
                      {isTodayExam && <span style={{ opacity: 0.85 }}>(Today)</span>}
                    </span>

                    {/* Marks count */}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: linkedMarksCount > 0 ? 'var(--teal)' : 'var(--text-muted)' }}>
                      <i className="fa-solid fa-clipboard-check" style={{ marginRight: '4px' }}></i>
                      {linkedMarksCount > 0 ? `${linkedMarksCount} Evaluated` : 'No marks entered'}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onClick={() => handleOpenMarks(e.id, cid)}
                    title="Open Marks Management and fill marks for this exam"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                    <span>Fill / View Marks</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      color: 'var(--rose)',
                      borderColor: '#fca5a5'
                    }}
                    onClick={() => deleteExam(e.id)}
                    title="Permanently delete this exam and its marks"
                  >
                    <i className="fa-solid fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
