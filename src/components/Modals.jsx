import React, { useState, useEffect } from 'react';

export default function Modals({
  modalType,
  closeModal,
  addClass,
  addTeacher,
  addStudent,
  addExam,
  addNotice,
  schoolProfile,
  updateSchoolProfile,
  classes,
  teachers = [],
  students = [],
  openWebhookSettings
}) {
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [room, setRoom] = useState('');

  const [teacherName, setTeacherName] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherRole, setTeacherRole] = useState('Class Teacher');
  const [teacherSubject, setTeacherSubject] = useState('Mathematics');
  const [teacherQual, setTeacherQual] = useState('B.Ed');
  const [selectedClassIds, setSelectedClassIds] = useState([]);

  const [studentClass, setStudentClass] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentParent, setStudentParent] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  const [examClass, setExamClass] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examSubject, setExamSubject] = useState('');
  const [examTeacherId, setExamTeacherId] = useState('');
  const [examMax, setExamMax] = useState('100');
  const todayStr = new Date().toISOString().split('T')[0];
  const [examDate, setExamDate] = useState(todayStr);

  const [noticeMode, setNoticeMode] = useState('individual');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const noticePriority = 'Normal';
  const [noticeTarget, setNoticeTarget] = useState('Selected Parent');
  const [noticeClassId, setNoticeClassId] = useState('');
  const [noticeStudentId, setNoticeStudentId] = useState('');
  const [noticeParentKey, setNoticeParentKey] = useState('');

  const [editSchoolName, setEditSchoolName] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editSchoolId, setEditSchoolId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default values whenever props change
  useEffect(() => {
    if (classes && classes.length > 0) {
      const isStudentClassValid = classes.some((c) => c.id === studentClass);
      if (!studentClass || !isStudentClassValid) {
        setStudentClass(classes[0].id);
      }
      const isExamClassValid = classes.some((c) => c.id === examClass);
      if (!examClass || !isExamClassValid) {
        setExamClass(classes[0].id);
      }
      const isNoticeClassValid = classes.some((c) => c.id === noticeClassId);
      if (!noticeClassId || !isNoticeClassValid) {
        const initialClassId = classes[0].id;
        setNoticeClassId(initialClassId);
        const classStudents = students.filter((s) => s.classId === initialClassId);
        if (classStudents.length > 0) {
          setNoticeStudentId(classStudents[0].id);
          setNoticeParentKey(classStudents[0].parentPhone || classStudents[0].id);
        }
      }
    }
      if (schoolProfile) {
        setEditSchoolName(schoolProfile.schoolName || '');
        setEditAdminName(schoolProfile.adminName || '');
        setEditSchoolId(schoolProfile.schoolId || '');
      }

      if (modalType === 'addStudent') {
        const clsId = studentClass || (classes && classes.length > 0 ? classes[0].id : '');
        const takenRolls = new Set(
          (students || []).filter((s) => s.classId === clsId).map((s) => String(s.rollNo).trim())
        );
        let nextRoll = 101;
        while (takenRolls.has(String(nextRoll))) {
          nextRoll++;
        }
        if (!studentRoll || takenRolls.has(studentRoll.trim())) {
          setStudentRoll(String(nextRoll));
        }
      }
  }, [classes, schoolProfile, modalType, students, studentClass]);

  if (!modalType) return null;

  const toggleClassSelection = (classId) => {
    if (teacherRole === 'Class Teacher') {
      setSelectedClassIds(selectedClassIds.includes(classId) ? [] : [classId]);
    } else {
      if (selectedClassIds.includes(classId)) {
        setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
      } else {
        setSelectedClassIds([...selectedClassIds, classId]);
      }
    }
  };

  const handleSaveProfile = () => {
    if (!editSchoolName.trim() || !editAdminName.trim() || !editSchoolId.trim()) {
      alert('Please fill all school profile fields');
      return;
    }
    updateSchoolProfile({
      schoolName: editSchoolName.trim(),
      adminName: editAdminName.trim(),
      schoolId: editSchoolId.trim()
    });
    closeModal();
  };

  // Duplicate checks
  const cleanClassName = className.trim();
  const cleanClassSection = section.trim().toUpperCase();

  const normalizeCls = (n, s) => {
    const normName = String(n || '').toLowerCase().replace(/^class\s+/i, '').replace(/th$/i, '').trim();
    const normSec = String(s || '').toLowerCase().replace(/^section\s+/i, '').trim();
    return `${normName}_${normSec}`;
  };

  const isClassTaken = Boolean(
    cleanClassName &&
    cleanClassSection &&
    classes.some((c) => {
      const cName = String(c.name || '').trim().toLowerCase();
      const cSec = String(c.section || '').trim().toUpperCase();
      if (cName === cleanClassName.toLowerCase() && cSec === cleanClassSection) return true;
      return normalizeCls(c.name, c.section) === normalizeCls(cleanClassName, cleanClassSection);
    })
  );

  const cleanTeacherPhone = teacherPhone.trim().replace(/\D/g, '');
  const isTeacherPhoneTaken = cleanTeacherPhone.length === 10 && teachers.some((t) => t.phone === cleanTeacherPhone);

  const activeStudentClass = classes.find((c) => c.id === studentClass) || classes[0];
  const targetStudentClassId = activeStudentClass ? activeStudentClass.id : '';
  const cleanStudentRoll = studentRoll.trim();
  const isStudentRollTaken = Boolean(
    targetStudentClassId &&
    cleanStudentRoll &&
    students.some((s) => s.classId === targetStudentClassId && String(s.rollNo).trim().toLowerCase() === cleanStudentRoll.toLowerCase())
  );

  const cleanStudentPhone = studentPhone.trim().replace(/\D/g, '');
  const existingSibling = cleanStudentPhone.length === 10 ? students.find((s) => s.parentPhone === cleanStudentPhone) : null;

  const handleSaveTeacher = async () => {
    const cleanPhone = cleanTeacherPhone;

    if (!teacherName.trim()) {
      alert('Please enter Teacher Full Name');
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      alert('Please enter a valid 10-digit mobile number (e.g. 9876543210)');
      return;
    }

    if (isTeacherPhoneTaken) {
      alert('Already taken! हा मोबाईल नंबर आधीच नोंदणीकृत आहे.');
      return;
    }

    if (selectedClassIds.length === 0) {
      alert('Please select at least one class to assign to the teacher');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTeacher({
        name: teacherName.trim(),
        phone: cleanPhone,
        password: '111111',
        role: teacherRole,
        subject: teacherSubject || 'Mathematics',
        qualification: teacherQual,
        assignedClassIds: selectedClassIds
      });
      setTeacherName('');
      setTeacherPhone('');
      setTeacherSubject('Mathematics');
      setSelectedClassIds([]);
    } catch (e) {
      console.error(e);
      alert('Error saving teacher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveStudent = async () => {
    const targetClassId = targetStudentClassId;
    const cleanPhone = cleanStudentPhone;

    if (!studentName.trim()) {
      alert('Please enter Student Full Name');
      return;
    }
    if (!targetClassId) {
      alert('Please create a Class section first before adding students');
      return;
    }
    if (isStudentRollTaken) {
      alert('Already taken! हा रोल नंबर या क्लासमध्ये आधीच घेतलेला आहे.');
      return;
    }
    if (!/^\d{10}$/.test(cleanPhone)) {
      alert('Please enter a valid 10-digit Parent Mobile Number (e.g. 8010861316)');
      return;
    }

    const isSameStudentInClass = students.some(
      (s) => s.classId === targetClassId &&
             s.name.trim().toLowerCase() === studentName.trim().toLowerCase() &&
             String(s.rollNo).trim() === cleanStudentRoll
    );
    if (isSameStudentInClass) {
      alert(`Student "${studentName.trim()}" (Roll: ${cleanStudentRoll}) is already registered in this class!`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addStudent({
        classId: targetClassId,
        rollNo: cleanStudentRoll || '101',
        name: studentName.trim(),
        parentName: studentParent.trim() || 'Parent',
        parentPhone: cleanPhone
      });

      setStudentRoll('');
      setStudentName('');
      setStudentParent('');
      setStudentPhone('');
    } catch (e) {
      console.error(e);
      alert('Error saving student to Firebase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClass = async () => {
    if (!className.trim() || !section.trim()) {
      alert('Please enter Class Name and Section');
      return;
    }
    if (isClassTaken) {
      alert(`Class "${cleanClassName} - ${cleanClassSection}" already exists! (हा क्लास आधीच उपलब्ध आहे)`);
      return;
    }
    setIsSubmitting(true);
    try {
      await addClass({
        name: className,
        section,
        roomNumber: room
      });
      setClassName('');
      setSection('');
      setRoom('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveExam = async () => {
    const targetClassId = examClass || (classes.length > 0 ? classes[0].id : '');
    if (!examTitle.trim() || !targetClassId) {
      alert('Please enter Exam Title and select Class');
      return;
    }
    setIsSubmitting(true);
    try {
      await addExam({
        classId: targetClassId,
        title: examTitle.trim(),
        subject: examSubject.trim() || 'General',
        teacherId: examTeacherId,
        maxMarks: parseFloat(examMax) || 100,
        date: examDate || todayStr
      });
      setExamTitle('');
      setExamSubject('');
      setExamTeacherId('');
      setExamDate(todayStr);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Notice Modal Helpers
  const noticeFilteredStudents = noticeClassId ? students.filter((s) => s.classId === noticeClassId) : [];
  const noticeSelectedStudent = students.find((s) => s.id === noticeStudentId);
  const noticeParentOptions = noticeSelectedStudent ? [
    {
      key: noticeSelectedStudent.parentPhone || noticeSelectedStudent.id,
      name: noticeSelectedStudent.parentName || 'Parent / Guardian',
      phone: noticeSelectedStudent.parentPhone || '',
      label: `${noticeSelectedStudent.parentName || 'Parent / Guardian'} - ${noticeSelectedStudent.parentPhone || 'No Phone'}`
    }
  ] : [];

  const isNoticeSendDisabled = noticeMode === 'individual'
    ? (!noticeTitle.trim() || !noticeContent.trim() || !noticeClassId || !noticeStudentId || !noticeParentKey || isSubmitting)
    : (!noticeTitle.trim() || !noticeContent.trim() || isSubmitting);

  const handleSaveNotice = async () => {
    if (noticeMode === 'individual') {
      if (!noticeTitle.trim() || !noticeContent.trim() || !noticeClassId || !noticeStudentId || !noticeParentKey) {
        alert('Please fill all required notice details, class, student, and parent.');
        return;
      }
      const selectedClass = classes.find((c) => c.id === noticeClassId);
      const selectedStudent = students.find((s) => s.id === noticeStudentId);
      const parentName = selectedStudent?.parentName || 'Parent / Guardian';
      const parentPhone = selectedStudent?.parentPhone || noticeParentKey;
      const parentId = parentPhone || (selectedStudent ? `${selectedStudent.id}_parent` : '');
      const className = selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : '';
      const studentName = selectedStudent ? selectedStudent.name : '';

      setIsSubmitting(true);
      try {
        await addNotice({
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
          priority: noticePriority,
          targetRole: 'Selected Parent',
          parentId,
          parentName,
          parentPhone,
          studentId: noticeStudentId,
          studentName,
          classId: noticeClassId,
          className,
          isRead: false,
          status: 'unread',
          readBy: [],
          sentBy: 'Admin',
          author: schoolProfile?.adminName || 'Admin',
          date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        });
        alert(`Notice sent successfully to ${parentName}`);
        setNoticeTitle('');
        setNoticeContent('');
        setNoticeClassId('');
        setNoticeStudentId('');
        setNoticeParentKey('');
        closeModal();
      } catch (err) {
        console.error('Error sending individual notice:', err);
        alert('Error sending notice to parent.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!noticeTitle.trim() || !noticeContent.trim()) {
        alert('Please enter Notice Title and Details');
        return;
      }
      setIsSubmitting(true);
      try {
        await addNotice({
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
          priority: noticePriority,
          targetRole: noticeTarget,
          author: schoolProfile?.adminName || 'Admin',
          date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        });
        alert('Announcement published successfully!');
        setNoticeTitle('');
        setNoticeContent('');
        closeModal();
      } catch (err) {
        console.error('Error publishing announcement:', err);
        alert('Error publishing announcement.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="modal-overlay">
      {/* EDIT SCHOOL PROFILE MODAL */}
      {modalType === 'editProfile' && (
        <div className="modal-box">
          <div className="modal-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-gear" style={{ color: 'var(--primary)' }}></i>
              School Profile & Admin Settings
            </h3>
            <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={closeModal}></i>
          </div>
          <div className="form-group">
            <label>School / Institution Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. SmartClass Academy"
              value={editSchoolName}
              onChange={(e) => setEditSchoolName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Administrator Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Principal Administrator"
              value={editAdminName}
              onChange={(e) => setEditAdminName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>School Code / ID *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. SCH-2026-904"
              value={editSchoolId}
              onChange={(e) => setEditSchoolId(e.target.value)}
            />
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {openWebhookSettings && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  closeModal();
                  openWebhookSettings();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: '#2563eb',
                  color: '#2563eb'
                }}
              >
                <i className="fa-solid fa-network-wired"></i>
                <span>Configure Webhooks</span>
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveProfile}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CLASS MODAL */}
      {modalType === 'addClass' && (
        <div className="modal-box">
          <div className="modal-header">
            <h3>Add New Class Section</h3>
            <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={closeModal}></i>
          </div>
          <div className="form-group">
            <label>Class Name *</label>
            <input
              type="text"
              className="form-control"
              style={isClassTaken ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              placeholder="e.g. Class 10"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Section *</label>
            <input
              type="text"
              className="form-control"
              style={isClassTaken ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              placeholder="e.g. A"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
            {isClassTaken && (
              <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-circle-exclamation"></i> Class {cleanClassName} - {cleanClassSection} already exists! (हा क्लास आधीच उपलब्ध आहे)
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Room Number</label>
            <input type="text" className="form-control" placeholder="e.g. Room 101" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          


          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveClass} disabled={isSubmitting || isClassTaken}>
              {isSubmitting ? 'Saving...' : 'Save Class'}
            </button>
          </div>
        </div>
      )}

      {/* ADD TEACHER MODAL */}
      {modalType === 'addTeacher' && (
        <div className="modal-box" style={{ maxWidth: '540px' }}>
          {/* Header with Icon */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <div>
                <h3 style={{ fontSize: '19px', fontWeight: '800', margin: 0 }}>Add New Teacher</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Register teacher credentials and assign classes
                </p>
              </div>
            </div>
            <i className="fa-solid fa-xmark" style={{ cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }} onClick={closeModal}></i>
          </div>

          {/* Full Name */}
          <div className="form-group">
            <label style={{ fontWeight: '700', fontSize: '12px' }}>Teacher Full Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Rahul Sharma"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
            />
          </div>

          {/* Mobile Number */}
          <div className="form-group">
            <label style={{ fontWeight: '700', fontSize: '12px' }}>Mobile Number (10 Digits) *</label>
            <input
              type="tel"
              maxLength={10}
              className="form-control"
              style={isTeacherPhoneTaken ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              placeholder="e.g. 9876543210"
              value={teacherPhone}
              onChange={(e) => setTeacherPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {isTeacherPhoneTaken && (
              <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-circle-exclamation"></i> Already taken!
              </div>
            )}
          </div>

          {/* Role & Subject Input (Letters & Spaces Only, No Numbers Allowed) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label style={{ fontWeight: '700', fontSize: '12px' }}>Role</label>
              <select
                className="form-control"
                value={teacherRole}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setTeacherRole(newRole);
                  if (newRole === 'Class Teacher' && selectedClassIds.length > 1) {
                    setSelectedClassIds(selectedClassIds.slice(0, 1));
                  }
                }}
              >
                <option value="Class Teacher">Class Teacher</option>
                <option value="Subject Teacher">Subject Teacher</option>
                <option value="Assistant Teacher">Assistant Teacher</option>
                <option value="Head of Dept">Head of Dept</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontWeight: '700', fontSize: '12px' }}>Subject *</label>
              <select
                className="form-control"
                value={teacherSubject}
                onChange={(e) => setTeacherSubject(e.target.value)}
              >
                <option value="Mathematics">Mathematics</option>
                <option value="English">English</option>
                <option value="Science">Science</option>
                <option value="Marathi">Marathi</option>
                <option value="Hindi">Hindi</option>
                <option value="Social Science">Social Science</option>
                <option value="Computer">Computer</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>



          {/* Assign Classes (Mandatory Selection) */}
          <div className="form-group" style={{ marginTop: '4px' }}>
            <label style={{ fontWeight: '700', fontSize: '12px' }}>
              {teacherRole === 'Class Teacher'
                ? 'Assign Class (Class Teacher can only be assigned to 1 class) *'
                : 'Assign Classes (Select one or multiple standards) *'}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {classes.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#ef4444', fontStyle: 'italic' }}>
                  ⚠️ No classes available! Please create a class section first in Classes tab.
                </div>
              ) : (
                classes.map((c) => {
                  const isSelected = selectedClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClassSelection(c.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                        color: isSelected ? 'var(--primary)' : '#475569',
                        fontWeight: isSelected ? '700' : '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isSelected && <i className="fa-solid fa-check" style={{ fontSize: '11px' }}></i>}
                      <span>{c.name} - {c.section}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '12px', backgroundColor: 'var(--primary)', fontWeight: 'bold' }}
              onClick={handleSaveTeacher}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Register Teacher'}
            </button>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {modalType === 'addStudent' && (
        <div className="modal-box">
          <div className="modal-header">
            <h3>Add New Student</h3>
            <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={closeModal}></i>
          </div>
          <div className="form-group">
            <label>Assign Class *</label>
            <select
              className="form-control"
              value={studentClass || (classes.length > 0 ? classes[0].id : '')}
              onChange={(e) => setStudentClass(e.target.value)}
            >
              {classes.length === 0 ? (
                <option value="">-- No Classes Created Yet --</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                ))
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Roll Number *</label>
            <input
              type="text"
              className="form-control"
              style={isStudentRollTaken ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
              placeholder="e.g. 101"
              value={studentRoll}
              onChange={(e) => setStudentRoll(e.target.value)}
            />
            {isStudentRollTaken && (
              <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-circle-exclamation"></i> Already taken!
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Student Full Name *</label>
            <input type="text" className="form-control" placeholder="e.g. Shweta Sunil Patil" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Parent / Guardian Name</label>
            <input type="text" className="form-control" placeholder="e.g. Sunil Patil" value={studentParent} onChange={(e) => setStudentParent(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Parent Mobile Number (10 Digits) *</label>
            <input
              type="tel"
              maxLength={10}
              className="form-control"
              placeholder="8010861316"
              value={studentPhone}
              onChange={(e) => setStudentPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {existingSibling && (
              <div style={{ color: '#059669', fontSize: '11px', marginTop: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-circle-info"></i> Sibling enrolled: {existingSibling.name} ({classes.find(c => c.id === existingSibling.classId)?.name || 'Class'})
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ backgroundColor: '#2563eb', padding: '10px 24px', fontWeight: 'bold' }}
              onClick={handleSaveStudent}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving to Firebase...' : 'Save Student'}
            </button>
          </div>
        </div>
      )}

      {/* ADD EXAM MODAL */}
      {modalType === 'addExam' && (() => {
        const curTargetClassId = examClass || (classes.length > 0 ? classes[0].id : '');
        const curClass = classes.find((c) => c.id === curTargetClassId);
        const assignedTeachers = (teachers || []).filter((t) =>
          (t.assignedClassIds && t.assignedClassIds.includes(curTargetClassId)) ||
          t.assignedClassId === curTargetClassId ||
          (curClass?.assignedTeacherIds && curClass.assignedTeacherIds.includes(t.id)) ||
          (curClass?.subjectTeachers && Object.values(curClass.subjectTeachers).includes(t.id))
        );
        const otherTeachers = (teachers || []).filter((t) => !assignedTeachers.some(at => at.id === t.id));
        const classSubjects = Array.from(new Set([
          ...(curClass?.subjects || []),
          ...assignedTeachers.map(t => t.subject).filter(Boolean)
        ])).filter(s => s && s.toLowerCase() !== 'general');

        return (
          <div className="modal-box">
            <div className="modal-header">
              <h3>Schedule New Class Exam</h3>
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={closeModal}></i>
            </div>
            <div className="form-group">
              <label>Target Class *</label>
              <select
                className="form-control"
                value={examClass || (classes.length > 0 ? classes[0].id : '')}
                onChange={(e) => {
                  const newCid = e.target.value;
                  setExamClass(newCid);
                  // Auto-detect teacher for new class if subject is set
                  const nextCls = classes.find(c => c.id === newCid);
                  if (examSubject && nextCls?.subjectTeachers?.[examSubject]) {
                    setExamTeacherId(nextCls.subjectTeachers[examSubject]);
                  }
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Exam Title *</label>
              <input type="text" className="form-control" placeholder="e.g. Mid-Term Exam" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Exam Date (Calendar) *</span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  <i className="fa-regular fa-calendar" style={{ marginRight: '4px' }}></i> Past dates allowed
                </span>
              </label>
              <input
                type="date"
                className="form-control"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
              {examDate && examDate < todayStr && (
                <div style={{
                  marginTop: '6px',
                  fontSize: '11.5px',
                  color: '#b45309',
                  backgroundColor: '#fffbeb',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span><strong>Emergency Backfill:</strong> Exam is being scheduled for a past date (<strong>{examDate}</strong>). You will be directed to enter student marks immediately.</span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Subject *</span>
                {classSubjects.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Class Subjects Available</span>
                )}
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mathematics, Science, Marathi..."
                value={examSubject}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                  setExamSubject(val);
                  // Auto-select assigned teacher if matching subject
                  if (val.trim()) {
                    const matchT = assignedTeachers.find(t => t.subject?.toLowerCase() === val.trim().toLowerCase());
                    if (matchT) setExamTeacherId(matchT.id);
                  }
                }}
              />
              {classSubjects.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {classSubjects.map((subj) => (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => {
                        setExamSubject(subj);
                        const matchT = assignedTeachers.find(t => t.subject?.toLowerCase() === subj.toLowerCase());
                        if (matchT) setExamTeacherId(matchT.id);
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: examSubject.toLowerCase() === subj.toLowerCase() ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: examSubject.toLowerCase() === subj.toLowerCase() ? '#e0f2fe' : '#f8fafc',
                        color: examSubject.toLowerCase() === subj.toLowerCase() ? '#0284c7' : '#475569',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Subject Teacher Selector */}
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Assigned Subject Teacher (Faculty)</span>
                <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                  <i className="fa-solid fa-user-check" style={{ marginRight: '4px' }}></i> Syncs to Teacher Dash
                </span>
              </label>
              <select
                className="form-control"
                value={examTeacherId}
                onChange={(e) => {
                  const tid = e.target.value;
                  setExamTeacherId(tid);
                  if (tid) {
                    const tc = (teachers || []).find(t => t.id === tid);
                    if (tc && tc.subject && tc.subject !== 'General' && (!examSubject || examSubject === 'General')) {
                      setExamSubject(tc.subject);
                    }
                  }
                }}
              >
                <option value="">-- Auto-detect / No Specific Teacher --</option>
                {assignedTeachers.length > 0 && (
                  <optgroup label="Assigned to This Class">
                    {assignedTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject || 'Teacher'}) - Assigned
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherTeachers.length > 0 && (
                  <optgroup label="Other School Teachers">
                    {otherTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject || 'Teacher'})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Max Marks</label>
              <input type="number" className="form-control" value={examMax} onChange={(e) => setExamMax(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveExam} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Exam'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ADD NOTICE MODAL */}
      {modalType === 'addNotice' && (
        <div className="modal-box" style={{ maxWidth: '540px' }}>
          <div className="modal-header">
            <div>
              <h3 style={{ margin: 0 }}>Publish School Announcement</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Send direct individual notices to parents or school-wide announcements
              </p>
            </div>
            <i className="fa-solid fa-xmark" style={{ cursor: 'pointer', fontSize: '18px' }} onClick={closeModal}></i>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '8px', margin: '14px 0 16px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setNoticeMode('individual');
                setNoticeTarget('Selected Parent');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: noticeMode === 'individual' ? '#fff' : 'transparent',
                color: noticeMode === 'individual' ? 'var(--primary, #2563eb)' : '#64748b',
                boxShadow: noticeMode === 'individual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <i className="fa-solid fa-user-lock"></i> Individual Notice to Parent
            </button>
            <button
              type="button"
              onClick={() => {
                setNoticeMode('general');
                setNoticeTarget('All');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                background: noticeMode === 'general' ? '#fff' : 'transparent',
                color: noticeMode === 'general' ? 'var(--primary, #2563eb)' : '#64748b',
                boxShadow: noticeMode === 'general' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <i className="fa-solid fa-bullhorn"></i> General Broadcast
            </button>
          </div>

          <div className="form-group">
            <label>Notice Title *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Attendance Alert / Fee Reminder / Meeting"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Notice Details *</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Enter announcement body / message..."
              value={noticeContent}
              onChange={(e) => setNoticeContent(e.target.value)}
            ></textarea>
          </div>

          {/* INDIVIDUAL NOTICE FLOW: Class -> Student -> Parent */}
          {noticeMode === 'individual' && (
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '14px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-sitemap" style={{ color: '#2563eb' }}></i>
                Select Recipient (Class → Student → Parent):
              </div>

              {/* Step 1: Class Dropdown */}
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>1. Class *</label>
                <select
                  className="form-control"
                  value={noticeClassId}
                  onChange={(e) => {
                    const newClassId = e.target.value;
                    setNoticeClassId(newClassId);
                    const stus = students.filter((s) => s.classId === newClassId);
                    if (stus.length > 0) {
                      setNoticeStudentId(stus[0].id);
                      setNoticeParentKey(stus[0].parentPhone || stus[0].id);
                    } else {
                      setNoticeStudentId('');
                      setNoticeParentKey('');
                    }
                  }}
                >
                  {classes.length === 0 ? (
                    <option value="">-- No Classes Created Yet --</option>
                  ) : (
                    classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Step 2: Student Dropdown */}
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>2. Student *</label>
                <select
                  className="form-control"
                  value={noticeStudentId}
                  disabled={!noticeClassId || noticeFilteredStudents.length === 0}
                  onChange={(e) => {
                    const newStudentId = e.target.value;
                    setNoticeStudentId(newStudentId);
                    const stu = students.find((s) => s.id === newStudentId);
                    if (stu) {
                      setNoticeParentKey(stu.parentPhone || stu.id);
                    } else {
                      setNoticeParentKey('');
                    }
                  }}
                >
                  {noticeFilteredStudents.length === 0 ? (
                    <option value="">-- No students enrolled in this class --</option>
                  ) : (
                    noticeFilteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Roll: {s.rollNo})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Step 3: Parent Dropdown */}
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>3. Parent *</label>
                <select
                  className="form-control"
                  value={noticeParentKey}
                  disabled={!noticeStudentId || noticeParentOptions.length === 0}
                  onChange={(e) => setNoticeParentKey(e.target.value)}
                >
                  {noticeParentOptions.length === 0 ? (
                    <option value="">-- No parent registered for selected student --</option>
                  ) : (
                    noticeParentOptions.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))
                  )}
                </select>
                {noticeSelectedStudent && !noticeSelectedStudent.parentPhone && (
                  <div style={{ color: '#e11d48', fontSize: '11px', marginTop: '4px' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i> Warning: Student has no registered parent mobile number.
                  </div>
                )}
              </div>
            </div>
          )}

          {noticeMode !== 'individual' && (
            <div className="form-group">
              <label>Target Audience</label>
              <select className="form-control" value={noticeTarget} onChange={(e) => setNoticeTarget(e.target.value)}>
                <option value="All">All</option>
                <option value="Parents">Parents</option>
                <option value="Teachers">Teachers</option>
              </select>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button className="btn btn-secondary" onClick={closeModal} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              className="btn btn-amber"
              onClick={handleSaveNotice}
              disabled={isNoticeSendDisabled}
              style={isNoticeSendDisabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              <i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }}></i>
              {isSubmitting ? 'Sending...' : 'Send Notice'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
