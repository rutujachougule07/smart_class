import React, { useState, useMemo } from 'react';
import { getClassTheme } from '../services/classTheme';

const STANDARD_SUGGESTIONS = [
  'Mathematics',
  'Science',
  'English',
  'Hindi',
  'Marathi',
  'Social Science',
  'Computer',
  'History',
  'Geography',
  'Drawing',
  'Physical Ed'
];

export default function TeachersTab({
  state,
  deleteTeacher,
  updateTeacher,
  assignTeacherClass,
  assignSubjectTeacher,
  removeSubjectTeacher,
  addClassSubject,
  removeClassSubject,
  openModal,
  openImportModal,
  downloadBlankExcelTemplate
}) {
  // Search & Tab View State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('teachers'); // 'teachers' | 'classes'

  // 1. Assign Subject to Teacher Modal State
  const [isAssignSubjectModalOpen, setIsAssignSubjectModalOpen] = useState(false);
  const [subjectAssignTeacherId, setSubjectAssignTeacherId] = useState('');
  const [subjectAssignClassId, setSubjectAssignClassId] = useState('');
  const [subjectAssignSubject, setSubjectAssignSubject] = useState('');
  const [subjectAssignCustomSubject, setSubjectAssignCustomSubject] = useState('');
  const [isAssigningSubject, setIsAssigningSubject] = useState(false);

  // 2. Add Subject to Class Modal State
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [addSubjectClassId, setAddSubjectClassId] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // 3. Edit Teacher Profile State
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('Subject Teacher');
  const [editSubject, setEditSubject] = useState('Mathematics');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Open Assign Subject Modal
  const handleOpenAssignSubjectModal = (teacher = null, classItem = null, subjectName = '') => {
    const initialTeacherId = teacher?.id || state.teachers?.[0]?.id || '';
    const initialClassId = classItem?.id || state.classes?.[0]?.id || '';
    setSubjectAssignTeacherId(initialTeacherId);
    setSubjectAssignClassId(initialClassId);
    setSubjectAssignSubject(subjectName || 'Mathematics');
    setSubjectAssignCustomSubject('');
    setIsAssignSubjectModalOpen(true);
  };

  // Open Add Subject Modal
  const handleOpenAddSubjectModal = (classItem = null) => {
    setAddSubjectClassId(classItem?.id || state.classes?.[0]?.id || '');
    setNewSubjectName('');
    setIsAddSubjectModalOpen(true);
  };

  // Save Assign Subject to Teacher
  const handleSaveAssignSubject = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!subjectAssignTeacherId) {
      alert('Please select a teacher.');
      return;
    }
    if (!subjectAssignClassId) {
      alert('Please select a class.');
      return;
    }
    const finalSubj = (subjectAssignSubject === '__custom__' ? subjectAssignCustomSubject : subjectAssignSubject).trim();
    if (!finalSubj) {
      alert('Please select or enter a subject.');
      return;
    }

    setIsAssigningSubject(true);
    try {
      if (assignSubjectTeacher) {
        await assignSubjectTeacher(subjectAssignClassId, finalSubj, subjectAssignTeacherId);
      }
      setIsAssignSubjectModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setIsAssigningSubject(false);
    }
  };

  // Save Add Subject
  const handleSaveAddSubject = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!addSubjectClassId) {
      alert('Please select a class.');
      return;
    }
    if (!newSubjectName.trim()) {
      alert('Please enter a subject name.');
      return;
    }

    setIsAddingSubject(true);
    try {
      if (addClassSubject) {
        await addClassSubject(addSubjectClassId, newSubjectName.trim());
      }
      setIsAddSubjectModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setIsAddingSubject(false);
    }
  };

  // Save Edit Teacher
  const handleSaveEditTeacher = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editName.trim()) {
      alert('Please enter teacher name.');
      return;
    }
    if (!editPhone.trim() || editPhone.trim().length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSavingEdit(true);
    try {
      if (updateTeacher) {
        await updateTeacher(editingTeacher.id, {
          name: editName.trim(),
          phone: editPhone.trim(),
          password: editingTeacher?.password || '111111',
          role: editRole,
          subject: editSubject,
          assignedClassIds: editingTeacher?.assignedClassIds || []
        });
      }
      setEditingTeacher(null);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Remove Subject Handler
  const handleRemoveSubject = async (classId, subjectName) => {
    if (!window.confirm(`Are you sure you want to remove "${subjectName}" from this class?`)) return;
    try {
      if (removeClassSubject) {
        await removeClassSubject(classId, subjectName);
      }
    } catch (err) {
      console.error(err);
      alert('Error removing subject: ' + err.message);
    }
  };

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return state.teachers || [];
    return (state.teachers || []).filter((t) => {
      const name = (t.name || '').toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      const subj = (t.subject || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || subj.includes(q);
    });
  }, [state.teachers, searchQuery]);

  // Modal Class Subjects list
  const selectedModalClass = useMemo(() => {
    return (state.classes || []).find((c) => c.id === subjectAssignClassId) || null;
  }, [subjectAssignClassId, state.classes]);

  const modalClassSubjects = useMemo(() => {
    const subs = new Set([
      ...(Array.isArray(selectedModalClass?.subjects) ? selectedModalClass.subjects : []),
      ...Object.keys(selectedModalClass?.subjectTeachers || {}),
      ...STANDARD_SUGGESTIONS
    ]);
    return Array.from(subs).filter(Boolean);
  }, [selectedModalClass]);

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* Action Header & Title */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
      >
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
                fontSize: '16px'
              }}
            >
              <i className="fa-solid fa-chalkboard-user"></i>
            </span>
            <span>Teacher & Subject Management</span>
          </h2>
          <span style={{ fontSize: '12.5px', color: '#64748b' }}>
            Add teachers, assign classes, allocate subjects, and manage curriculum subjects.
          </span>
        </div>

        {/* 4 Main Action Buttons - Cohesive Premium Design System */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 1. Add New Teacher */}
          <button
            type="button"
            className="btn"
            onClick={() => openModal('addTeacher')}
            style={{
              padding: '9.5px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.06)';
            }}
          >
            <i className="fa-solid fa-user-plus" style={{ fontSize: '13px', color: '#2563eb' }}></i>
            <span>Add New Teacher</span>
          </button>

          {/* 2. Assign Class Teacher (Secondary Action) */}
          <button
            type="button"
            className="btn"
            onClick={() => handleOpenAssignClassModal()}
            style={{
              padding: '9.5px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.06)';
            }}
          >
            <i className="fa-solid fa-chalkboard" style={{ fontSize: '13px', color: '#2563eb' }}></i>
            <span>Assign Class Teacher</span>
          </button>

          {/* 3. Assign Subject to Teacher (Secondary Action) */}
          <button
            type="button"
            className="btn"
            onClick={() => handleOpenAssignSubjectModal()}
            style={{
              padding: '9.5px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.06)';
            }}
          >
            <i className="fa-solid fa-book-open-reader" style={{ fontSize: '13px', color: '#2563eb' }}></i>
            <span>Assign Subject to Teacher</span>
          </button>

          {/* 4. Add Subject to Class (Secondary Action) */}
          <button
            type="button"
            className="btn"
            onClick={() => handleOpenAddSubjectModal()}
            style={{
              padding: '9.5px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.06)';
            }}
          >
            <i className="fa-solid fa-plus-circle" style={{ fontSize: '13px', color: '#2563eb' }}></i>
            <span>Add Subject to Class</span>
          </button>

          {/* 5. Import Teachers from Excel */}
          {openImportModal && (
            <button
              type="button"
              className="btn"
              onClick={() => openImportModal('teachers')}
              style={{
                padding: '9.5px 18px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '13px',
                backgroundColor: '#ffffff',
                color: '#107c41',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1.5px solid #bbf7d0',
                boxShadow: '0 2px 6px rgba(16, 124, 65, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0fdf4';
                e.currentTarget.style.borderColor = '#86efac';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#bbf7d0';
                e.currentTarget.style.transform = 'none';
              }}
              title="Import teachers from Excel file"
            >
              <i className="fa-solid fa-file-excel" style={{ fontSize: '13px', color: '#107c41' }}></i>
              <span>Import Excel</span>
            </button>
          )}

          {/* 6. Download Blank Excel Template for Teachers */}
          {downloadBlankExcelTemplate && (
            <button
              type="button"
              className="btn"
              onClick={() => downloadBlankExcelTemplate('teachers')}
              style={{
                padding: '9.5px 18px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '13px',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1.5px solid #86efac',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dcfce7';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f0fdf4';
                e.currentTarget.style.transform = 'none';
              }}
              title="Download blank Excel template to add new teachers"
            >
              <i className="fa-solid fa-file-arrow-down" style={{ fontSize: '13px', color: '#16a34a' }}></i>
              <span>Blank Excel for Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '18px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('teachers')}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeSubTab === 'teachers' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'teachers' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'teachers' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-users" style={{ color: activeSubTab === 'teachers' ? '#2563eb' : '#64748b' }}></i>
            <span>Teachers Directory ({state.teachers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('classes')}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeSubTab === 'classes' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'classes' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'classes' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-layer-group" style={{ color: activeSubTab === 'classes' ? '#2563eb' : '#64748b' }}></i>
            <span>Class Subjects & Teachers ({state.classes.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px' }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }}
          ></i>
          <input
            type="text"
            placeholder="Search teachers by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              backgroundColor: '#ffffff',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TEACHERS DIRECTORY VIEW */}
      {/* ========================================================================= */}
      {activeSubTab === 'teachers' && (
        <div className="cards-grid-3">
          {filteredTeachers.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                color: '#64748b'
              }}
            >
              <i className="fa-solid fa-user-xmark" style={{ fontSize: '32px', opacity: 0.4, marginBottom: '10px' }}></i>
              <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: '#334155' }}>No Teachers Found</h4>
              <p style={{ margin: 0, fontSize: '12.5px' }}>Click "Add New Teacher" above to add your first faculty member.</p>
            </div>
          ) : (
            filteredTeachers.map((t) => {
              const assignedClasses = (state.classes || []).filter(
                (c) =>
                  c.teacherId === t.id ||
                  c.classTeacherId === t.id ||
                  (c.subjectTeachers && Object.values(c.subjectTeachers).includes(t.id)) ||
                  (t.assignedClassIds || []).includes(c.id)
              );

              return (
                <div
                  key={t.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1.5px solid #e2e8f0',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {t.name ? t.name[0].toUpperCase() : 'T'}
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{t.name}</h4>
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                          {t.subject || 'General'} • {t.role || 'Teacher'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTeacher(t);
                          setEditName(t.name || '');
                          setEditPhone(t.phone || '');
                          setEditRole(t.role || 'Class Teacher');
                          setEditSubject(t.subject || 'Mathematics');
                        }}
                        style={{ border: 'none', background: '#eff6ff', color: '#2563eb', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                        title="Edit Teacher"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTeacher(t.id)}
                        style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
                        title="Delete Teacher"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* Phone Info */}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#475569', backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '8px' }}>
                    <div>
                      <i className="fa-solid fa-phone" style={{ color: '#94a3b8', marginRight: '6px' }}></i>
                      <strong>{t.phone}</strong>
                    </div>
                  </div>

                  {/* Assigned Classes Breakdown */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Assigned Classes ({assignedClasses.length}):
                    </div>
                    {assignedClasses.length === 0 ? (
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>No classes assigned yet</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {assignedClasses.map((c) => {
                          const taughtSubjects = Object.entries(c.subjectTeachers || {})
                            .filter(([_, tid]) => tid === t.id)
                            .map(([s]) => s);

                          return (
                            <span
                              key={c.id}
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                fontWeight: 700
                              }}
                            >
                              Class {c.name} {c.section ? `-${c.section}` : ''} {taughtSubjects.length > 0 ? `(${taughtSubjects.join(', ')})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Fast Action Buttons on Card */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignSubjectModal(t)}
                      style={{
                        width: '100%',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: '1px solid #ddd6fe',
                        backgroundColor: '#faf5ff',
                        color: '#7c3aed',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-book-bookmark"></i>
                      <span>Assign Subject to Class</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CLASS SUBJECTS & TEACHERS MANAGEMENT VIEW */}
      {/* ========================================================================= */}
      {activeSubTab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {state.classes.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                color: '#64748b'
              }}
            >
              <i className="fa-solid fa-chalkboard" style={{ fontSize: '32px', opacity: 0.4, marginBottom: '10px' }}></i>
              <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: '#334155' }}>No Classes Configured</h4>
              <p style={{ margin: 0, fontSize: '12.5px' }}>Please add classes in the Classes section first.</p>
            </div>
          ) : (
            state.classes.map((c) => {
              const theme = getClassTheme(c);
              const classTeacher = (state.teachers || []).find(
                (t) => (c.teacherId && t.id === c.teacherId) || (c.classTeacherId && t.id === c.classTeacherId)
              );

              // All subjects in this class curriculum
              const allClassSubjects = Array.from(
                new Set([
                  ...(Array.isArray(c.subjects) ? c.subjects : []),
                  ...Object.keys(c.subjectTeachers || {})
                ])
              ).filter(Boolean);

              return (
                <div
                  key={c.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1.5px solid #e2e8f0',
                    padding: '18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Top Class Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: theme.gradient,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                          fontWeight: 800
                        }}
                      >
                        <i className={`fa-solid ${theme.icon}`}></i>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                          Class {c.name} {c.section ? `(Div ${c.section})` : ''}
                        </h3>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Subject Faculty: <strong style={{ color: Object.keys(c.subjectTeachers || {}).length > 0 ? '#16a34a' : '#94a3b8' }}>{Object.keys(c.subjectTeachers || {}).length} of {allClassSubjects.length} Assigned</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Add Subject to Class */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddSubjectModal(c)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #fed7aa',
                          backgroundColor: '#fff7ed',
                          color: '#ea580c',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-plus"></i>
                        <span>Add Subject</span>
                      </button>
                    </div>
                  </div>

                  {/* Subjects Table */}
                  {allClassSubjects.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                      No subjects added for Class {c.name} yet. Click "+ Add Subject" to add subjects to this class.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                      {allClassSubjects.map((subj) => {
                        const assignedTeacherId = c.subjectTeachers?.[subj];
                        const teacherObj = (state.teachers || []).find((t) => t.id === assignedTeacherId);

                        return (
                          <div
                            key={subj}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="fa-solid fa-book-bookmark" style={{ color: '#7c3aed', fontSize: '12px' }}></i>
                                <span>{subj}</span>
                              </div>
                              <div style={{ fontSize: '11.5px', color: teacherObj ? '#16a34a' : '#94a3b8', fontWeight: 600, marginTop: '2px' }}>
                                {teacherObj ? (
                                  <span><i className="fa-solid fa-user-tie"></i> {teacherObj.name}</span>
                                ) : (
                                  <span>No teacher assigned</span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {/* Assign / Change Subject Teacher */}
                              <button
                                type="button"
                                onClick={() => handleOpenAssignSubjectModal(teacherObj || null, c, subj)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#2563eb',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Assign/Change Teacher"
                              >
                                {teacherObj ? 'Change' : 'Assign'}
                              </button>

                              {/* Remove Subject Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSubject(c.id, subj)}
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  backgroundColor: '#fef2f2',
                                  color: '#ef4444',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                                title="Remove Subject from Class"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}



      {/* ========================================================================= */}
      {/* MODAL 2: ASSIGN SUBJECT TO TEACHER */}
      {/* ========================================================================= */}
      {isAssignSubjectModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-box" style={{ maxWidth: '480px', width: '90vw', padding: '24px', backgroundColor: '#ffffff', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Assign Subject to Teacher</h3>
              <button type="button" onClick={() => setIsAssignSubjectModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveAssignSubject}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Select Teacher *</label>
                <select
                  className="form-control"
                  value={subjectAssignTeacherId}
                  onChange={(e) => setSubjectAssignTeacherId(e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '10px', padding: '9px 12px' }}
                  required
                >
                  <option value="">-- Choose Teacher --</option>
                  {state.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Select Class *</label>
                <select
                  className="form-control"
                  value={subjectAssignClassId}
                  onChange={(e) => setSubjectAssignClassId(e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '10px', padding: '9px 12px' }}
                  required
                >
                  <option value="">-- Choose Class --</option>
                  {state.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Class {c.name} {c.section ? `-${c.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Select Subject *</label>
                <select
                  className="form-control"
                  value={subjectAssignSubject}
                  onChange={(e) => setSubjectAssignSubject(e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '10px', padding: '9px 12px' }}
                  required
                >
                  <option value="">-- Choose Subject --</option>
                  {modalClassSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Subject...</option>
                </select>

                {subjectAssignSubject === '__custom__' && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter subject name (e.g. Sanskrit, Art...)"
                    value={subjectAssignCustomSubject}
                    onChange={(e) => setSubjectAssignCustomSubject(e.target.value)}
                    style={{ fontSize: '13px', borderRadius: '10px', padding: '9px 12px', marginTop: '6px' }}
                    required
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAssignSubjectModalOpen(false)} disabled={isAssigningSubject} style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isAssigningSubject} style={{ padding: '8px 20px', backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 700 }}>
                  {isAssigningSubject ? 'Assigning...' : 'Assign Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD SUBJECT TO CLASS */}
      {/* ========================================================================= */}
      {isAddSubjectModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-box" style={{ maxWidth: '440px', width: '90vw', padding: '24px', backgroundColor: '#ffffff', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Add New Subject to Class</h3>
              <button type="button" onClick={() => setIsAddSubjectModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveAddSubject}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Select Class *</label>
                <select
                  className="form-control"
                  value={addSubjectClassId}
                  onChange={(e) => setAddSubjectClassId(e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '10px', padding: '9px 12px' }}
                  required
                >
                  <option value="">-- Choose Class --</option>
                  {state.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Class {c.name} {c.section ? `-${c.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Subject Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Mathematics, Science, Marathi, Computer..."
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '10px', padding: '9px 12px' }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddSubjectModalOpen(false)} disabled={isAddingSubject} style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isAddingSubject} style={{ padding: '8px 20px', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 700 }}>
                  {isAddingSubject ? 'Adding...' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT TEACHER PROFILE */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-box" style={{ maxWidth: '460px', width: '90vw', padding: '24px', backgroundColor: '#ffffff', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Edit Teacher Profile</h3>
              <button type="button" onClick={() => setEditingTeacher(null)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEditTeacher}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Teacher Name *</label>
                <input type="text" className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Mobile Number *</label>
                <input
                  type="tel"
                  maxLength={10}
                  className="form-control"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Role</label>
                  <select className="form-control" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                    <option value="Class Teacher">Class Teacher</option>
                    <option value="Subject Teacher">Subject Teacher</option>
                    <option value="Assistant Teacher">Assistant Teacher</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Primary Subject</label>
                  <select className="form-control" value={editSubject} onChange={(e) => setEditSubject(e.target.value)}>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Social Science">Social Science</option>
                    <option value="Computer">Computer</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTeacher(null)} disabled={isSavingEdit} style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingEdit} style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700 }}>
                  {isSavingEdit ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
