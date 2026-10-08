import React, { useMemo } from 'react';
import ClassBadge from './ClassBadge';
import { getClassTheme } from '../services/classTheme';
import { getTeacherAssignedSubjectForClass } from '../services/teacherUtils';

export default function Overview({ state, setActiveTab, openModal, openImportModal }) {
  const todayDate = new Date().toISOString().split('T')[0];
  const studentsList = state.students || [];
  const classesList = state.classes || [];
  const teachersList = state.teachers || [];
  const totalStudents = studentsList.length;

  // Pre-indexed today's attendance map: key `${studentId}` or `${rollNo}` -> status
  const todayAttendanceMap = useMemo(() => {
    const map = new Map();
    if (!state.attendance || state.attendance.length === 0) return map;

    const latestMap = new Map();
    for (let i = 0; i < state.attendance.length; i++) {
      const a = state.attendance[i];
      if (!a) continue;
      const rawDate = a.date || a.attendanceDate || (typeof a.recordedAt === 'string' ? a.recordedAt.split('T')[0] : a.recordedAt) || '';
      const aDate = String(rawDate).trim().slice(0, 10);
      if (aDate !== todayDate) continue;

      const rawStatus = String(a.status || a.attendanceStatus || '').trim().toLowerCase();
      let status = null;
      if (rawStatus === 'absent') status = 'Absent';
      else if (rawStatus === 'present') status = 'Present';
      if (!status) continue;

      const t = String(a.recordedAt || a.createdAt || a.updatedAt || '');

      const sId = a.studentId || a.student_id;
      if (sId) {
        const existing = latestMap.get(sId);
        if (!existing || t.localeCompare(existing.t) > 0) {
          latestMap.set(sId, { status, t });
        }
      }

      const roll = a.rollNo || a.roll_no;
      if (roll !== undefined && roll !== null && roll !== '') {
        const rollKey = `roll_${roll}`;
        const existing = latestMap.get(rollKey);
        if (!existing || t.localeCompare(existing.t) > 0) {
          latestMap.set(rollKey, { status, t });
        }
      }
    }

    latestMap.forEach((val, key) => {
      map.set(key, val.status);
    });
    return map;
  }, [state.attendance, todayDate]);

  // Pre-aggregated student count per class for O(1) cards
  const studentCountByClassId = useMemo(() => {
    const map = {};
    for (let i = 0; i < studentsList.length; i++) {
      const cid = studentsList[i]?.classId;
      if (cid) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [studentsList]);

  const teachersById = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < teachersList.length; i++) {
      const t = teachersList[i];
      if (t?.id) map.set(t.id, t);
    }
    return map;
  }, [teachersList]);

  // Single fast pass to calculate today's attendance stats
  const { todayPresent, todayMarked } = useMemo(() => {
    let present = 0;
    let marked = 0;

    for (let i = 0; i < studentsList.length; i++) {
      const s = studentsList[i];
      let status = todayAttendanceMap.get(s.id) || (s.rollNo ? todayAttendanceMap.get(`roll_${s.rollNo}`) : null);

      if (!status && s.attendanceDate === todayDate && s.attendanceStatus) {
        const raw = String(s.attendanceStatus).trim().toLowerCase();
        if (raw === 'present') status = 'Present';
        else if (raw === 'absent') status = 'Absent';
      }

      if (status === 'Present') {
        present++;
        marked++;
      } else if (status === 'Absent') {
        marked++;
      }
    }
    return { todayPresent: present, todayMarked: marked };
  }, [studentsList, todayAttendanceMap, todayDate]);

  const attendancePercent = todayMarked > 0 ? Math.round((todayPresent / todayMarked) * 100) : 0;

  return (
    <div>
      {/* Modern & Attractive Welcome Banner */}
      <div className="welcome-banner" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #2563eb 100%)',
        borderRadius: '20px',
        padding: '26px 32px',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Accent Glow Ring */}
        <div style={{
          position: 'absolute',
          right: '-40px',
          bottom: '-40px',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }}></div>

        <div className="banner-left" style={{ position: 'relative', zIndex: 2 }}>
          <span className="school-code" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(254, 240, 138, 0.2)',
            border: '1px solid rgba(254, 240, 138, 0.4)',
            padding: '4px 12px',
            borderRadius: '20px',
            color: '#fef08a',
            fontSize: '11px',
            fontWeight: '800',
            letterSpacing: '0.6px',
            marginBottom: '10px'
          }}>
            <i className="fa-solid fa-shield-halved" style={{ fontSize: '12px' }}></i> {state.schoolProfile?.schoolId || 'SCH-2026-904'}
          </span>
          
          <h3 style={{
            fontSize: '26px',
            fontWeight: '800',
            color: '#ffffff',
            letterSpacing: '-0.5px',
            margin: '4px 0 6px 0',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {state.schoolProfile?.schoolName || 'SmartClass Academy'}
          </h3>
          
          <p style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <i className="fa-solid fa-user-check" style={{ color: '#38bdf8' }}></i>
            <span>Administrator: <strong>{state.schoolProfile?.adminName || 'Admin'}</strong></span>
          </p>
        </div>

        <div className="banner-right" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 2 }}>
          <div className="school-badge-icon" style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05))',
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            color: '#ffffff',
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
          }}>
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => setActiveTab(3)}>
          <div className="stat-info">
            <h5>Total Students</h5>
            <h2>{studentsList.length}</h2>
            <p>{classesList.length} Classes Enrolled</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
            <i className="fa-solid fa-users"></i>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab(2)}>
          <div className="stat-info">
            <h5>Total Teachers</h5>
            <h2>{teachersList.length}</h2>
            <p>Faculty Members</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--purple)' }}>
            <i className="fa-solid fa-chalkboard-user"></i>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab(1)}>
          <div className="stat-info">
            <h5>Active Classes</h5>
            <h2>{classesList.length}</h2>
            <p>All Sections & Streams</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--teal)' }}>
            <i className="fa-solid fa-door-open"></i>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab(3)} title="Click to view Students Attendance">
          <div className="stat-info">
            <h5>Today's Attendance</h5>
            <h2>{todayMarked > 0 ? `${attendancePercent}%` : 'Pending'}</h2>
            <p>{todayMarked > 0 ? `${todayPresent} / ${todayMarked} Present (${todayMarked}/${totalStudents} Taken)` : 'Not Taken Today'}</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: todayMarked > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: todayMarked > 0 ? 'var(--emerald)' : '#64748b' }}>
            <i className={`fa-solid ${todayMarked > 0 ? 'fa-circle-check' : 'fa-clock'}`}></i>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="section-title">Quick Admin Actions</div>
      <div className="quick-actions-bar">
        <div className="action-btn-card" onClick={() => openModal('addClass')}>
          <div className="action-icon-box">
            <i className="fa-solid fa-door-open"></i>
          </div>
          <span>Add Class</span>
        </div>
        <div className="action-btn-card" onClick={() => openModal('addTeacher')}>
          <div className="action-icon-box">
            <i className="fa-solid fa-chalkboard-user"></i>
          </div>
          <span>Add Teacher</span>
        </div>
        <div className="action-btn-card" onClick={() => openModal('addStudent')}>
          <div className="action-icon-box">
            <i className="fa-solid fa-user-graduate"></i>
          </div>
          <span>Add Student</span>
        </div>
        <div className="action-btn-card" onClick={() => openModal('addExam')}>
          <div className="action-icon-box">
            <i className="fa-solid fa-file-signature"></i>
          </div>
          <span>Create Exam</span>
        </div>
        <div className="action-btn-card" onClick={() => openModal('addNotice')}>
          <div className="action-icon-box">
            <i className="fa-solid fa-bullhorn"></i>
          </div>
          <span>Publish Notice</span>
        </div>
        <div className="action-btn-card" onClick={() => setActiveTab(3)}>
          <div className="action-icon-box">
            <i className="fa-solid fa-file-invoice"></i>
          </div>
          <span>Student Report</span>
        </div>
        {openImportModal && (
          <div className="action-btn-card" onClick={() => openImportModal('students')}>
            <div className="action-icon-box">
              <i className="fa-solid fa-file-excel"></i>
            </div>
            <span>Import Excel</span>
          </div>
        )}
      </div>

      {/* Class Directory Overview */}
      <div className="section-title">
        <span>Class Directory Overview</span>
        <a style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setActiveTab(1)}>View All Classes</a>
      </div>

      <div className="cards-grid-3">
        {classesList.map((c) => {
          const studentCount = studentCountByClassId[c.id] || 0;
          const teacher = (c.teacherId && teachersById.get(c.teacherId)) || (c.classTeacherId && teachersById.get(c.classTeacherId)) || null;
          const theme = getClassTheme(c);

          return (
            <div
              key={c.id}
              className="data-card"
              style={{
                borderRadius: '16px',
                border: '1.5px solid #e2e8f0',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0, 0, 0, 0.07)';
                e.currentTarget.style.borderColor = theme.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.02)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: theme.gradient }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <ClassBadge classItem={c} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-door-open" style={{ fontSize: '11px', color: '#94a3b8' }}></i>
                  <span>{c.roomNumber || 'Room 101'}</span>
                </span>
              </div>
              <div style={{ marginTop: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  Class Teacher: {teacher ? `${teacher.name} (${getTeacherAssignedSubjectForClass(teacher, c)})` : <span style={{ color: 'var(--rose)' }}>Not Assigned</span>}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  <strong style={{ color: theme.color }}>{studentCount}</strong> Students Enrolled
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
