import React, { useState, useMemo, useEffect } from 'react';
import { getClassTheme } from '../services/classTheme';
import { getTeacherAssignedSubjectForClass } from '../services/teacherUtils';

export default function ClassesTab({
  state,
  deleteClass,
  updateClass,
  assignTeacherClass,
  assignSubjectTeacher,
  removeSubjectTeacher,
  addClassSubject,
  removeClassSubject,
  openModal,
  openImportModal,
  setActiveTab
}) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');

  // Edit Class Modal state
  const [editingClass, setEditingClass] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Subject Teachers Dropdown state
  const [openSubjectDropdown, setOpenSubjectDropdown] = useState(null); // classId | null

  // Close subject teachers dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.subject-teachers-dropdown-wrapper')) {
        setOpenSubjectDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Natural sequence sorting (e.g. 1, 2, 3... 10 - A, 10 - B)
  const sortedClasses = useMemo(() => {
    return [...(state.classes || [])].sort((a, b) => {
      const parseNum = (val) => {
        const match = String(val || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };
      const numA = parseNum(a.name);
      const numB = parseNum(b.name);
      if (numA !== numB) return numA - numB;

      const nameCmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (nameCmp !== 0) return nameCmp;

      return String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [state.classes]);

  // Unique sections list for quick filter
  const uniqueSections = useMemo(() => {
    const secs = new Set();
    (state.classes || []).forEach((c) => {
      const s = String(c.section || '').trim().toUpperCase();
      if (s) secs.add(s);
    });
    return Array.from(secs).sort();
  }, [state.classes]);

  // Filtered classes by search and section
  const filteredClasses = useMemo(() => {
    return sortedClasses.filter((c) => {
      const cSec = String(c.section || '').trim().toUpperCase();
      if (sectionFilter !== 'all' && cSec !== sectionFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const secMatch = (c.section || '').toLowerCase().includes(q);
      const roomMatch = (c.roomNumber || '').toLowerCase().includes(q);
      const teacher = state.teachers.find(
        (t) => (c.teacherId && t.id === c.teacherId) || (c.classTeacherId && t.id === c.classTeacherId)
      );
      const teacherMatch = teacher ? (teacher.name || '').toLowerCase().includes(q) : false;
      return nameMatch || secMatch || roomMatch || teacherMatch;
    });
  }, [sortedClasses, sectionFilter, searchQuery, state.teachers]);

  // High-performance student count map for O(1) class cards
  const studentCountByClassId = useMemo(() => {
    const map = {};
    const students = state.students || [];
    for (let i = 0; i < students.length; i++) {
      const cid = students[i]?.classId;
      if (cid) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [state.students]);

  const teachersById = useMemo(() => {
    const map = new Map();
    (state.teachers || []).forEach((t) => {
      if (t?.id) map.set(t.id, t);
    });
    return map;
  }, [state.teachers]);

  // Metrics
  const totalClasses = state.classes?.length || 0;
  const totalStudents = state.students?.length || 0;
  const assignedTeachersCount = (state.classes || []).filter(
    (c) => Boolean(c.teacherId || c.classTeacherId || (c.assignedTeacherIds && c.assignedTeacherIds.length > 0) || (c.subjectTeachers && Object.keys(c.subjectTeachers).length > 0))
  ).length;

  const handleOpenEdit = (c) => {
    setEditingClass(c);
    setEditName(c.name || '');
    setEditSection(c.section || '');
    setEditRoom(c.roomNumber || 'Room 101');
  };

  // Duplicate check for edit modal
  const cleanEditName = editName.trim();
  const cleanEditSection = editSection.trim().toUpperCase();
  const isEditDuplicate = Boolean(
    editingClass &&
    cleanEditName &&
    cleanEditSection &&
    (state.classes || []).some((c) => {
      if (c.id === editingClass.id) return false;
      const cName = String(c.name || '').trim().toLowerCase();
      const cSec = String(c.section || '').trim().toUpperCase();
      return cName === cleanEditName.toLowerCase() && cSec === cleanEditSection;
    })
  );

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!cleanEditName || !cleanEditSection) {
      alert('Please enter Class Name and Section');
      return;
    }
    if (isEditDuplicate) {
      alert(`Class "${cleanEditName} - ${cleanEditSection}" already exists! (हा क्लास आधीच उपलब्ध आहे)`);
      return;
    }

    setIsSaving(true);
    try {
      if (updateClass) {
        await updateClass(editingClass.id, {
          name: cleanEditName,
          section: cleanEditSection,
          roomNumber: editRoom.trim() || 'Room 101'
        });
      }
      setEditingClass(null);
    } catch (err) {
      console.error(err);
      alert('Error updating class: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="section-title" style={{ marginBottom: '18px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
              }}
            >
              <i className="fa-solid fa-chalkboard-user"></i>
            </span>
            <span>Class & Section Management</span>
          </h2>
          <p style={{ margin: '4px 0 0 46px', fontSize: '12px', color: '#64748b' }}>
            Configure academic classes, section divisions, assigned class teachers, and student enrollments
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {openImportModal && (
            <button
              className="btn btn-secondary"
              onClick={() => openImportModal('students')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '12.5px'
              }}
            >
              <i className="fa-solid fa-file-excel" style={{ color: '#107c41' }}></i>
              <span>Import Excel</span>
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => openModal('addClass')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '12.5px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <i className="fa-solid fa-plus"></i>
            <span>Add New Class</span>
          </button>
        </div>
      </div>

      {/* Modern Stats Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '22px'
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}
          >
            <i className="fa-solid fa-door-open"></i>
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Configured Classes
            </span>
            <strong style={{ fontSize: '22px', color: '#0f172a', fontWeight: 800 }}>{totalClasses}</strong>
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}
          >
            <i className="fa-solid fa-user-graduate"></i>
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Enrolled Students
            </span>
            <strong style={{ fontSize: '22px', color: '#0f172a', fontWeight: 800 }}>{totalStudents}</strong>
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}
          >
            <i className="fa-solid fa-chalkboard-user"></i>
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
              Assigned Teachers
            </span>
            <strong style={{ fontSize: '22px', color: '#0f172a', fontWeight: 800 }}>
              {assignedTeachersCount} / {totalClasses}
            </strong>
          </div>
        </div>
      </div>

      {/* Modern Filter & Search Toolbar */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          marginBottom: '22px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* Search Input */}
        <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '13px'
            }}
          ></i>
          <input
            type="text"
            placeholder="Search class, section, room or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: '#f8fafc',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2563eb';
              e.target.style.backgroundColor = '#ffffff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#cbd5e1';
              e.target.style.backgroundColor = '#f8fafc';
            }}
          />
        </div>

        {/* Section Division Pills */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Section:</span>
          <button
            type="button"
            onClick={() => setSectionFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: sectionFilter === 'all' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
              backgroundColor: sectionFilter === 'all' ? '#eff6ff' : '#ffffff',
              color: sectionFilter === 'all' ? '#2563eb' : '#64748b',
              transition: 'all 0.2s ease'
            }}
          >
            All ({sortedClasses.length})
          </button>
          {uniqueSections.map((sec) => {
            const count = sortedClasses.filter((c) => String(c.section || '').trim().toUpperCase() === sec).length;
            const isAct = sectionFilter === sec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => setSectionFilter(sec)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isAct ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: isAct ? '#eff6ff' : '#ffffff',
                  color: isAct ? '#2563eb' : '#64748b',
                  transition: 'all 0.2s ease'
                }}
              >
                Div {sec} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern Class Cards Grid */}
      <div className="cards-grid-3">
        {filteredClasses.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '18px',
              border: '1px dashed #cbd5e1',
              color: '#64748b'
            }}
          >
            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '36px', opacity: 0.4, marginBottom: '12px', display: 'block' }}></i>
            <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#334155' }}>No Classes Match Filter</h4>
            <p style={{ margin: 0, fontSize: '13px' }}>Try adjusting your search query or section filter above.</p>
          </div>
        ) : (
          filteredClasses.map((c) => {
            const studentCount = studentCountByClassId[c.id] || 0;
            const assignedTeacher = (c.teacherId && teachersById.get(c.teacherId)) || (c.classTeacherId && teachersById.get(c.classTeacherId)) || null;
            const theme = getClassTheme(c);
            const classSubjects = Array.from(
              new Set([
                ...(Array.isArray(c.subjects) ? c.subjects : []),
                ...Object.keys(c.subjectTeachers || {})
              ])
            ).filter(Boolean);
            const assignedSubjectsCount = Object.values(c.subjectTeachers || {}).filter(Boolean).length;
            const isOpen = openSubjectDropdown === c.id;

            return (
              <div
                key={c.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.05)',
                  overflow: 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px -4px rgba(15, 23, 42, 0.08)';
                  e.currentTarget.style.borderColor = theme.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(15, 23, 42, 0.05)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* Decorative Top Accent Bar */}
                <div style={{ height: '4px', background: theme.gradient, borderTopLeftRadius: '14px', borderTopRightRadius: '14px' }}></div>

                {/* Card Body */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {/* 1. Class Name, Division, Room Number, and Total Students clearly at the top */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: theme.gradient,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          boxShadow: `0 4px 10px -2px ${theme.accent}35`,
                          flexShrink: 0
                        }}
                      >
                        <i className={`fa-solid ${theme.icon}`}></i>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
                            Class {c.name}
                          </h3>
                          {c.section && (
                            <span
                              style={{
                                background: theme.softBg,
                                color: theme.color,
                                border: `1px solid ${theme.border}`,
                                padding: '1px 6px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800
                              }}
                            >
                              Div {c.section}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <i className="fa-solid fa-door-open" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
                          <span>{c.roomNumber || 'Room 101'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Students clearly displayed at top */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 9px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                      title={`Total Students: ${studentCount}`}
                    >
                      <i className="fa-solid fa-users" style={{ fontSize: '11px', color: '#2563eb' }}></i>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Total Students:</span>
                      <strong style={{ color: '#0f172a' }}>{studentCount}</strong>
                    </span>
                  </div>

                  {/* 2. Show the Subject Faculty clearly */}
                  <div
                    style={{
                      backgroundColor: assignedSubjectsCount > 0 ? '#faf5ff' : '#f8fafc',
                      border: `1px solid ${assignedSubjectsCount > 0 ? '#ddd6fe' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      padding: '9px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: assignedSubjectsCount > 0 ? '#7c3aed' : '#cbd5e1',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 800,
                        flexShrink: 0
                      }}
                    >
                      <i className="fa-solid fa-graduation-cap" style={{ fontSize: '13px' }}></i>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: assignedSubjectsCount > 0 ? '#6d28d9' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1 }}>
                        Subject Faculty
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: assignedSubjectsCount > 0 ? '#0f172a' : '#94a3b8',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {assignedSubjectsCount > 0 ? `${assignedSubjectsCount} of ${classSubjects.length} Subjects Assigned` : 'No Faculty Assigned'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                        Click below to view & manage
                      </div>
                    </div>
                  </div>

                  {/* 3. Simple "View Subjects & Teachers" dropdown to see subject-wise teacher assignments */}
                  <div className="subject-teachers-dropdown-wrapper" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenSubjectDropdown(isOpen ? null : c.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 11px',
                        borderRadius: '8px',
                        border: isOpen ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: isOpen ? '#eff6ff' : '#ffffff',
                        color: '#1e293b',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-book-open" style={{ color: '#2563eb', fontSize: '11px' }}></i>
                        <span style={{ color: '#0f172a' }}>View Subjects & Teachers</span>
                        <span
                          style={{
                            backgroundColor: classSubjects.length > 0 ? '#f0fdf4' : '#f1f5f9',
                            color: classSubjects.length > 0 ? '#15803d' : '#64748b',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '999px',
                            border: `1px solid ${classSubjects.length > 0 ? '#bbf7d0' : '#e2e8f0'}`
                          }}
                        >
                          {classSubjects.length}
                        </span>
                      </div>
                      <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '9.5px', color: '#64748b' }}></i>
                    </button>

                    {isOpen && (
                      <div
                        style={{
                          marginTop: '6px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '9px',
                          padding: '9px 11px',
                          maxHeight: '170px',
                          overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Subject Assignments
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#15803d' }}>
                              {assignedSubjectsCount} Assigned
                            </span>
                            {setActiveTab && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenSubjectDropdown(null);
                                  setActiveTab(2);
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: '#2563eb',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <span>Assign in Teachers Tab</span>
                                <i className="fa-solid fa-arrow-right" style={{ fontSize: '8.5px' }}></i>
                              </button>
                            )}
                          </div>
                        </div>

                        {classSubjects.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {classSubjects.map((subj) => {
                              const tid = c.subjectTeachers?.[subj];
                              const t = state.teachers.find((tc) => tc.id === tid);
                              return (
                                <div
                                  key={subj}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #edf2f7',
                                    fontSize: '11.5px'
                                  }}
                                >
                                  <span style={{ fontWeight: 700, color: '#334155' }}>{subj}</span>
                                  {t ? (
                                    <span style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '10px' }}></i>
                                      {t.name}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
                                      Not Assigned
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '8px 4px', color: '#64748b', fontSize: '11.5px' }}>
                            No subjects added yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Card Footer Actions: Import, Edit, Delete */}
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: '11px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    {openImportModal ? (
                      <button
                        type="button"
                        onClick={() => openImportModal('students', c.id)}
                        style={{
                          padding: '6px 11px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#15803d',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease'
                        }}
                        title={`Import Students into Class ${c.name} - ${c.section}`}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dcfce7')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                      >
                        <i className="fa-solid fa-file-excel"></i>
                        <span>Import</span>
                      </button>
                    ) : <div />}

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        style={{
                          padding: '6px 11px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Edit Class Details"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteClass(c.id)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#dc2626',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Delete Class"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                      >
                        <i className="fa-solid fa-trash"></i>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* EDIT CLASS MODAL */}
      {/* ========================================================================= */}
      {editingClass && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: '520px',
              width: '95vw',
              padding: '24px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Edit Class Section
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Update details for Class {editingClass.name} - {editingClass.section}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
                    Class Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={isEditDuplicate ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. 10"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
                    Section *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={isEditDuplicate ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    placeholder="e.g. A or B"
                    required
                  />
                </div>
              </div>

              {isEditDuplicate && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-circle-exclamation"></i> Class {cleanEditName} - {cleanEditSection} already exists! (हा क्लास आधीच उपलब्ध आहे)
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', display: 'block' }}>
                  Room Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editRoom}
                  onChange={(e) => setEditRoom(e.target.value)}
                  placeholder="e.g. Room 101"
                />
              </div>



              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingClass(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || isEditDuplicate}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
