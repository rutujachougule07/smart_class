import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { getTeacherAssignedSubjectForClass } from '../services/teacherUtils';
import { isClassMatch, resolveCanonicalClassId, resolveCanonicalClassName } from '../services/classUtils';
import { formatWhatsAppPhone } from '../services/webhookService';

export default function MarksTab({
  state,
  saveStudentMarks,
  deleteExam,
  addClassSubject,
  openModal,
  setActiveTab,
  targetExamForMarks,
  triggerWebhookDispatch,
  openWebhookSettings
}) {
  // Class selection state (defaults to first class if available)
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [modalExamId, setModalExamId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Handle auto-focusing on an exam passed from ExamsTab or after Exam creation
  useEffect(() => {
    if (targetExamForMarks && targetExamForMarks.examId) {
      if (targetExamForMarks.classId && targetExamForMarks.classId !== 'all') {
        setSelectedClassId(targetExamForMarks.classId);
      }
      setSelectedExamId(targetExamForMarks.examId);
    }
  }, [targetExamForMarks]);

  // Edit / Enter Marks Modal state
  const [editingStudent, setEditingStudent] = useState(null);
  const [formMarks, setFormMarks] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Student Detail / Report Card Modal state
  const [viewingStudent, setViewingStudent] = useState(null);

  // Auto-select first class if none selected or invalid
  useEffect(() => {
    if (state.classes && state.classes.length > 0) {
      const isValid = state.classes.some((c) => c.id === selectedClassId);
      if (!selectedClassId || !isValid) {
        setSelectedClassId(state.classes[0].id);
      }
    }
  }, [state.classes, selectedClassId]);

  const selectedClass = state.classes.find((c) => c.id === selectedClassId) || state.classes[0];
  const currentClassId = selectedClass?.id || selectedClassId;



  // Helper to parse roll numbers for serial sorting (1, 2, 3... 101, 102...)
  const parseRollNo = (roll) => {
    if (roll === undefined || roll === null || roll === '') return 999999;
    const num = Number(roll);
    if (!isNaN(num)) return num;
    const match = String(roll).match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
  };

  // Pre-aggregated student count per class for O(1) dropdown rendering
  const studentCountByClassId = useMemo(() => {
    const map = {};
    const students = state.students || [];
    for (let i = 0; i < students.length; i++) {
      const cid = students[i]?.classId;
      if (cid) map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [state.students]);

  // Class-wise Students: ONLY students belonging to the selected class, sorted strictly serial-wise by roll number
  const classStudents = useMemo(() => {
    return (state.students || [])
      .filter((s) => s.classId === currentClassId)
      .sort((a, b) => {
        const rollA = parseRollNo(a.rollNo);
        const rollB = parseRollNo(b.rollNo);
        if (rollA !== rollB) return rollA - rollB;
        return (
          String(a.rollNo || '').localeCompare(String(b.rollNo || ''), undefined, { numeric: true, sensitivity: 'base' }) ||
          (a.name || '').localeCompare(b.name || '')
        );
      });
  }, [state.students, currentClassId]);

  // Search filter using deferred value for smooth typing
  const filteredStudents = useMemo(() => {
    const q = (deferredSearchQuery || '').trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const rollMatch = String(s.rollNo || '').toLowerCase().includes(q);
      const idMatch = String(s.id || '').toLowerCase().includes(q);
      return nameMatch || rollMatch || idMatch;
    });
  }, [classStudents, deferredSearchQuery]);

  // Helper to determine if an exam is assigned to the given class
  const isExamAssignedToClass = (e, classId, cls) => {
    if (!e) return false;
    const eClassId = e.classId || e.class_id;

    // 1. Direct or normalized class match
    if (isClassMatch(eClassId, classId, state.classes)) return true;

    // 2. Array of assigned classes
    if (Array.isArray(e.assignedClassIds) && e.assignedClassIds.some((cid) => isClassMatch(cid, classId, state.classes))) return true;
    if (Array.isArray(e.classes) && e.classes.some((cid) => isClassMatch(cid, classId, state.classes))) return true;

    // 3. Class name match
    if (cls && e.className && isClassMatch(e.className, classId, state.classes)) return true;

    // 4. Global exam (only if it has no classId assigned and is marked 'all' or 'global')
    if (eClassId === 'all' || eClassId === 'global' || !eClassId) return true;

    // 5. Existing marks recorded in this class for this exam
    const hasMarksInClass = (state.marks || []).some(
      (m) => isClassMatch(m.classId, classId, state.classes) && (
        m.examId === e.id ||
        m.exam_id === e.id ||
        (e.title && (m.examTitle?.toLowerCase() === e.title.toLowerCase() || m.exam_title?.toLowerCase() === e.title.toLowerCase()))
      )
    );
    if (hasMarksInClass) return true;

    return false;
  };

  // Exams strictly scoped for this selected class
  const explicitClassExams = (state.exams || []).filter((e) =>
    isExamAssignedToClass(e, currentClassId, selectedClass)
  );

  // Auto-discover any exams from marks records for this class (e.g. Android exams or General Evaluation)
  const existingExamIds = new Set(explicitClassExams.map((e) => e.id));
  const existingExamTitles = new Set(explicitClassExams.map((e) => (e.title || '').toLowerCase()));
  const discoveredExams = [];

  (state.marks || []).forEach((m) => {
    // Must belong to this class via classId match or student matching
    const belongsToClass = isClassMatch(m.classId, currentClassId, state.classes) ||
      (!m.classId && classStudents.some((s) => s.id === m.studentId || (s.rollNo && (String(s.rollNo) === String(m.rollNo) || String(s.rollNo) === String(m.studentId)))));

    if (belongsToClass) {
      const eid = m.examId || m.exam_id;
      if (!eid || eid === 'general') return;
      const etitle = m.examTitle || m.exam_title || `Exam ${eid}`;
      if (etitle.toLowerCase() === 'general evaluation') return;

      if (!existingExamIds.has(eid) && !existingExamTitles.has(etitle.toLowerCase())) {
        existingExamIds.add(eid);
        existingExamTitles.add(etitle.toLowerCase());
        discoveredExams.push({
          id: eid,
          title: etitle,
          subject: m.subject || 'All Subjects',
          classId: currentClassId,
          totalMarks: m.maxTotal || m.totalMarks || 100,
          passingMarks: m.passingMarks || 35,
          isDiscovered: true
        });
      }
    }
  });

  const classExams = [...explicitClassExams, ...discoveredExams];
  const selectedExam = classExams.find((e) => e.id === selectedExamId);
  const examTitle = selectedExam ? selectedExam.title : (selectedExamId === 'all' ? (classExams.length > 0 ? 'All Exams' : 'No Exam Scheduled') : 'No Exam');

  // Faculty responsible for evaluating marks for this class / exam subject
  const examSubject = selectedExam?.subject || selectedExam?.title?.match(/\(([^)]+)\)/)?.[1];
  const subjectTeacherId = examSubject && selectedClass?.subjectTeachers?.[examSubject];
  const matchedTeacher = (state.teachers || []).find((t) => t.id === subjectTeacherId) ||
    (state.teachers || []).find((t) => selectedClass?.subjectTeachers && Object.values(selectedClass.subjectTeachers).includes(t.id));
  const teacherDisplayName = matchedTeacher?.name || selectedClass?.teacherName || selectedClass?.teacher;
  const teacherSubject = examSubject || (matchedTeacher && getTeacherAssignedSubjectForClass(matchedTeacher, selectedClass));

  // Auto-sync selectedExamId when selectedClass changes:
  // If previously selected exam is not in current classExams, reset to 'all'
  useEffect(() => {
    if (selectedExamId !== 'all') {
      if (targetExamForMarks && targetExamForMarks.examId === selectedExamId) {
        return;
      }
      const exists = classExams.some((e) => e.id === selectedExamId);
      if (!exists) {
        setSelectedExamId('all');
      }
    }
  }, [selectedClassId, classExams, selectedExamId, targetExamForMarks]);

  // Dynamic Subjects: strictly determined for the selected class, exams, and student mark records
  const getSubjectsForView = () => {
    let subs = [];

    const normKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const addUniqueSubj = (rawName) => {
      const clean = String(rawName || '').trim().replace(/_/g, ' ');
      if (!clean || clean.toLowerCase() === 'general') return;
      const targetNorm = normKey(clean);
      const aliases = {
        socialstudies: 'socialscience',
        socialscience: 'socialscience',
        maths: 'mathematics',
        math: 'mathematics',
        mathematics: 'mathematics'
      };
      const canonical = aliases[targetNorm] || targetNorm;
      const exists = subs.some((existing) => {
        const exNorm = normKey(existing);
        const exCanonical = aliases[exNorm] || exNorm;
        return exCanonical === canonical;
      });
      if (!exists) {
        subs.push(clean);
      }
    };

    // 1. From class curriculum (strictly the subjects chosen/configured for this class)
    if (selectedClass && Array.isArray(selectedClass.subjects) && selectedClass.subjects.length > 0) {
      selectedClass.subjects.forEach(addUniqueSubj);
    } else if (selectedClass?.subject) {
      addUniqueSubj(selectedClass.subject);
    }

    // 2. From all exams belonging to this class
    classExams.forEach((e) => {
      if (Array.isArray(e.subjects)) {
        e.subjects.forEach(addUniqueSubj);
      } else if (e.subject && e.subject.toLowerCase() !== 'general' && e.subject.toLowerCase() !== 'all') {
        addUniqueSubj(e.subject);
      }
    });

    // 3. From any existing marks recorded for this class/students
    const classStudentIdSet = new Set(classStudents.map((s) => s.id));
    (state.marks || []).forEach((m) => {
      if (m.classId && m.classId !== currentClassId) return;
      const belongsToClass = m.classId === currentClassId || classStudentIdSet.has(m.studentId);
      if (belongsToClass && m.marks && typeof m.marks === 'object') {
        Object.keys(m.marks).forEach(addUniqueSubj);
      }
    });

    // 4. Fallback only if no subjects are configured for this class, exams, or marks
    if (subs.length === 0) {
      if (selectedClass?.subjects && selectedClass.subjects.length > 0) {
        selectedClass.subjects.forEach(addUniqueSubj);
      }
    }

    return subs;
  };

  const dynamicSubjects = getSubjectsForView();

  // Helper to read subject marks case-insensitively and alias-aware
  const getSubjectMark = (marksMap, targetSubj) => {
    if (!marksMap || typeof marksMap !== 'object') return undefined;

    // 1. Direct exact match
    if (marksMap[targetSubj] !== undefined && marksMap[targetSubj] !== '') {
      return marksMap[targetSubj];
    }

    const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normTarget = normalize(targetSubj);

    // 2. Normalized match (e.g. "Social Studies" vs "SocialScience" vs "social_studies")
    for (const [key, val] of Object.entries(marksMap)) {
      if (val !== undefined && val !== '' && normalize(key) === normTarget) {
        return val;
      }
    }

    // 3. Known subject aliases
    const aliases = {
      math: ['mathematics', 'maths', 'algebra', 'geometry'],
      maths: ['mathematics', 'math', 'algebra', 'geometry'],
      mathematics: ['maths', 'math', 'algebra', 'geometry'],
      science: ['generalscience', 'sci', 'evs', 'physics', 'chemistry', 'biology'],
      socialstudies: ['socialscience', 'social', 'sst', 'history', 'civics', 'geography'],
      socialscience: ['socialstudies', 'social', 'sst', 'history', 'civics', 'geography'],
      english: ['eng', 'englishgrammar'],
      marathi: ['mar', 'marathigrammar'],
      hindi: ['hin', 'hindigrammar'],
      computer: ['computerscience', 'comp', 'it', 'ict'],
      computerscience: ['computer', 'comp', 'it', 'ict']
    };

    const targetAliases = aliases[normTarget] || [];
    for (const [key, val] of Object.entries(marksMap)) {
      if (val !== undefined && val !== '') {
        const normKey = normalize(key);
        if (targetAliases.includes(normKey)) {
          return val;
        }
      }
    }

    return undefined;
  };

  // Helper to find existing marks record for a student
  const getStudentMarksRecord = (studentId, specificExamId = null) => {
    if (classExams.length === 0) return null;
    const marksList = state.marks || [];
    const examToMatch = specificExamId || selectedExamId;

    const student = classStudents.find((s) => s.id === studentId) || (state.students || []).find((s) => s.id === studentId);
    const matchesStudent = (m) => {
      if (!m) return false;
      const mStudentId = m.studentId || m.student_id;
      if (mStudentId === studentId) return true;
      if (student && student.rollNo) {
        if (String(mStudentId) === String(student.rollNo) || String(m.rollNo) === String(student.rollNo) || String(m.roll_no) === String(student.rollNo)) return true;
      }
      if (student && student.name && m.studentName && m.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()) return true;
      return false;
    };

    const matchesClass = (m) => {
      if (!m) return false;
      const mClassId = m.classId || m.class_id;
      if (mClassId) return isClassMatch(mClassId, currentClassId, state.classes);
      return student && isClassMatch(student.classId, currentClassId, state.classes);
    };

    if (examToMatch === 'all') {
      const studentClassMarks = marksList.filter(
        (m) => {
          if (!matchesStudent(m) || !matchesClass(m)) return false;
          // Must belong to one of the class's valid exams
          const belongsToClassExam = classExams.some(
            (e) => e.id === m.examId || (e.title && m.examTitle && e.title.toLowerCase() === m.examTitle.toLowerCase())
          );
          return belongsToClassExam;
        }
      );
      if (studentClassMarks.length === 0) return null;

      // Merge marks across all records for this student so all subjects have marks displayed
      const mergedMarks = {};
      let totalSum = 0;
      let hasAnyNumericMarks = false;

      // Sort chronological so newer entries take precedence for duplicate subjects
      const sorted = [...studentClassMarks].sort((a, b) => new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || a.createdAt || 0));
      sorted.forEach((m) => {
        if (m.marks && typeof m.marks === 'object') {
          Object.entries(m.marks).forEach(([subj, val]) => {
            const cleanSubj = String(subj || '').trim().replace(/_/g, ' ');
            if (cleanSubj && cleanSubj.toLowerCase() !== 'general' && val !== undefined && val !== '' && val !== null) {
              mergedMarks[cleanSubj] = val;
            }
          });
        }
      });

      // Calculate total
      Object.values(mergedMarks).forEach((v) => {
        const num = Number(v);
        if (!isNaN(num)) {
          totalSum += num;
          hasAnyNumericMarks = true;
        }
      });

      const latestRecord = sorted[sorted.length - 1] || {};
      const subjectCount = Object.keys(mergedMarks).length || dynamicSubjects.length;
      const maxTotal = subjectCount * 100;
      const percentage = (hasAnyNumericMarks && maxTotal > 0)
        ? parseFloat(((totalSum / maxTotal) * 100).toFixed(1))
        : (latestRecord.percentage || 0);

      return {
        ...latestRecord,
        marks: mergedMarks,
        total: hasAnyNumericMarks ? totalSum : latestRecord.total,
        maxTotal: maxTotal,
        percentage: percentage
      };
    }

    const currentExam = classExams.find((e) => e.id === examToMatch) || selectedExam;
    return marksList.find(
      (m) =>
        matchesStudent(m) &&
        matchesClass(m) &&
        (m.examId === examToMatch ||
          m.exam_id === examToMatch ||
          m.examId?.toLowerCase() === examToMatch?.toLowerCase() ||
          (currentExam && (
            m.examTitle?.toLowerCase() === currentExam.title?.toLowerCase() ||
            m.exam_title?.toLowerCase() === currentExam.title?.toLowerCase() ||
            m.examId?.toLowerCase() === currentExam.id?.toLowerCase() ||
            m.examId?.toLowerCase() === currentExam.title?.toLowerCase()
          )))
    );
  };

  // Grade calculation
  const calculateGrade = (percentage) => {
    if (percentage === null || percentage === undefined || isNaN(percentage)) {
      return { grade: '-', color: '#64748b', bg: '#f1f5f9', label: 'Not Graded' };
    }
    if (percentage >= 90) return { grade: 'A+', color: '#16a34a', bg: '#dcfce7', label: 'Outstanding' };
    if (percentage >= 80) return { grade: 'A', color: '#2563eb', bg: '#dbeafe', label: 'Excellent' };
    if (percentage >= 70) return { grade: 'B+', color: '#0284c7', bg: '#e0f2fe', label: 'Very Good' };
    if (percentage >= 60) return { grade: 'B', color: '#d97706', bg: '#fef3c7', label: 'Good' };
    if (percentage >= 50) return { grade: 'C', color: '#ea580c', bg: '#ffedd5', label: 'Average' };
    if (percentage >= 40) return { grade: 'D', color: '#ca8a04', bg: '#fef9c3', label: 'Pass' };
    return { grade: 'F', color: '#dc2626', bg: '#fee2e2', label: 'Needs Improvement' };
  };

  // Compute student stats with robust fallback
  const getStudentStats = (record) => {
    if (!record || !record.marks || Object.keys(record.marks).length === 0) {
      return { hasMarks: false, total: '-', percentage: '-', percentNum: null, gradeInfo: calculateGrade(null) };
    }
    let total = record.total;
    if (total === undefined || total === null || isNaN(total)) {
      total = Object.values(record.marks).reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
    let percentNum = record.percentage;
    if (percentNum === undefined || percentNum === null || isNaN(percentNum)) {
      const maxTotal = record.maxTotal || (dynamicSubjects.length * (selectedExam ? (parseFloat(selectedExam.maxMarks) || 100) : 100));
      percentNum = maxTotal > 0 ? parseFloat(((total / maxTotal) * 100).toFixed(1)) : 0;
    }
    const gradeStyle = calculateGrade(percentNum);
    const gradeInfo = {
      grade: record.grade || gradeStyle.grade,
      label: record.gradeLabel || gradeStyle.label,
      color: gradeStyle.color,
      bg: gradeStyle.bg
    };
    return {
      hasMarks: true,
      total,
      percentage: `${percentNum}%`,
      percentNum,
      gradeInfo
    };
  };

  // Open Edit / Enter Marks Modal
  const handleOpenEditMarks = (student) => {
    if (classExams.length === 0) {
      alert("No examination created for this class yet. Please schedule an examination first before entering marks.");
      if (openModal) openModal('addExam');
      else if (setActiveTab) setActiveTab(4);
      return;
    }
    setEditingStudent(student);
    const initialExamId = selectedExamId !== 'all' ? selectedExamId : (classExams[0]?.id || '');
    if (!initialExamId) return;
    setModalExamId(initialExamId);
    const existing = getStudentMarksRecord(student.id, initialExamId);
    const initialMarks = {};

    dynamicSubjects.forEach((subj) => {
      const val = existing && existing.marks ? getSubjectMark(existing.marks, subj) : undefined;
      initialMarks[subj] = val !== undefined ? val : '';
    });

    setFormMarks(initialMarks);
  };

  const handleModalExamChange = (newExamId) => {
    setModalExamId(newExamId);
    if (!editingStudent) return;
    const existing = getStudentMarksRecord(editingStudent.id, newExamId);
    const initialMarks = {};
    dynamicSubjects.forEach((subj) => {
      const val = existing && existing.marks ? getSubjectMark(existing.marks, subj) : undefined;
      initialMarks[subj] = val !== undefined ? val : '';
    });
    setFormMarks(initialMarks);
  };

  const modalExamObj = classExams.find((e) => e.id === modalExamId) || selectedExam || classExams[0];

  // Live calculations for Edit Modal
  const computeLiveStats = () => {
    let total = 0;
    let count = 0;
    const activeExam = modalExamObj;
    const maxMarksPerSubj = activeExam ? (parseFloat(activeExam.maxMarks) || 100) : 100;
    const allSubjects = Array.from(new Set([...dynamicSubjects, ...Object.keys(formMarks)]));

    allSubjects.forEach((subj) => {
      const val = formMarks[subj];
      if (val !== '' && val !== null && !isNaN(val)) {
        total += parseFloat(val);
        count++;
      }
    });

    const maxTotal = allSubjects.length * maxMarksPerSubj;
    const percentage = count > 0 && maxTotal > 0 ? parseFloat(((total / maxTotal) * 100).toFixed(1)) : null;
    const gradeInfo = calculateGrade(percentage);

    return { total, maxTotal, percentage, gradeInfo, count };
  };

  // Save marks to Firestore
  const handleSaveMarks = async () => {
    if (!editingStudent) return;
    if (classExams.length === 0) {
      alert("Cannot save marks: No examination exists for this class. Please schedule an exam first.");
      return;
    }

    setIsSaving(true);
    try {
      const activeExam = modalExamObj || classExams[0];
      if (!activeExam) {
        alert("Please select a valid exam to save marks.");
        setIsSaving(false);
        return;
      }
      const targetExamId = activeExam.id;
      const targetExamTitle = activeExam.title || 'Exam';

      const existing = getStudentMarksRecord(editingStudent.id, targetExamId);
      const { total, maxTotal, percentage, gradeInfo } = computeLiveStats();

      // Clean marks map across all subjects
      const allSubjects = Array.from(new Set([...dynamicSubjects, ...Object.keys(formMarks)]));
      const cleanedMarks = {};
      allSubjects.forEach((subj) => {
        const v = formMarks[subj];
        cleanedMarks[subj] = (v !== '' && v !== null && !isNaN(v)) ? parseFloat(v) : 0;
      });

      const marksPayload = {
        studentId: editingStudent.id,
        studentName: editingStudent.name || '',
        rollNo: editingStudent.rollNo || '',
        classId: selectedClassId,
        className: selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : '',
        examId: targetExamId,
        examTitle: targetExamTitle,
        marks: cleanedMarks,
        total: total,
        maxTotal: maxTotal,
        percentage: percentage !== null ? percentage : 0,
        grade: gradeInfo.grade,
        gradeLabel: gradeInfo.label,
        updatedAt: new Date().toISOString()
      };

      if (existing && existing.id) {
        marksPayload.id = existing.id;
      }

      await saveStudentMarks(marksPayload);
      alert(`Marks saved successfully for ${editingStudent.name}!`);
      setEditingStudent(null);
    } catch (err) {
      console.error("Error saving marks:", err);
      alert("Failed to save marks. Please check database permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  // Export Marksheet CSV
  const handleExportCSV = () => {
    if (classExams.length === 0) {
      alert("No examinations found for this class. Please schedule an exam first to export marksheet.");
      return;
    }
    if (classStudents.length === 0) {
      alert("No students in this class to export.");
      return;
    }

    let csv = '\uFEFF';
    csv += ['Roll No', 'Student Name', 'Class', 'Exam', ...dynamicSubjects, 'Total', 'Max Total', 'Percentage'].join(',') + '\n';

    classStudents.forEach((student) => {
      const record = getStudentMarksRecord(student.id);
      const studentMarks = record?.marks || {};
      const total = record ? record.total : '-';
      const maxTotal = record ? record.maxTotal : dynamicSubjects.length * 100;
      const pct = record && record.percentage !== undefined ? `${record.percentage}%` : '-';

      const row = [
        `"${student.rollNo || ''}"`,
        `"${student.name || ''}"`,
        `"${selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : ''}"`,
        `"${examTitle}"`,
        ...dynamicSubjects.map((s) => (studentMarks[s] !== undefined ? studentMarks[s] : '-')),
        `"${total}"`,
        `"${maxTotal}"`,
        `"${pct}"`
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Marks_${selectedClass?.name || 'Class'}_${selectedClass?.section || ''}_${examTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dispatch Class Exam Marks via WhatsApp / Webhook
  const handleDispatchClassMarks = () => {
    if (!triggerWebhookDispatch) {
      alert('WhatsApp / Webhook dispatch service is not available.');
      return;
    }
    if (!classStudents || classStudents.length === 0) {
      alert('No students found in the selected class to dispatch marks.');
      return;
    }

    const examTitle = selectedExamId === 'all'
      ? 'All Exams Performance Report'
      : (state.exams?.find((e) => e.id === selectedExamId)?.title || 'Exam Performance Report');

    const targetStudents = classStudents.map((s) => {
      const record = getStudentMarksRecord(s.id);
      const studentMarks = record?.marks || {};
      const total = record ? Number(record.total) || 0 : 0;
      const maxTotal = record ? Number(record.maxTotal) || (dynamicSubjects.length * 100) : (dynamicSubjects.length * 100);
      const pct = record && record.percentage !== undefined ? parseFloat(record.percentage) || 0 : 0;

      const subjectMarks = dynamicSubjects.map((subj) => {
        const score = studentMarks[subj] !== undefined ? studentMarks[subj] : '-';
        return {
          subject: subj,
          score: score,
          maxMarks: 100,
          remarks: typeof score === 'number' ? (score >= 40 ? 'Passed' : 'Needs improvement') : ''
        };
      });

      return {
        ...s,
        studentId: s.id,
        rollNo: s.rollNo || s.roll_no || '',
        name: s.name,
        className: selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : 'Class',
        division: selectedClass?.section || '-',
        parentContact: formatWhatsAppPhone(s.parentPhone || s.parent_phone || s.phone || s.mobile || ''),
        parentPhone: formatWhatsAppPhone(s.parentPhone || s.parent_phone || s.phone || s.mobile || ''),
        parentName: s.parentName || s.father_name || s.fatherName || 'Parent / Guardian',
        totalMarks: maxTotal,
        marksObtained: total,
        totalScore: total,
        totalMax: maxTotal,
        percentage: pct,
        grade: pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'Passed' : 'Remedial',
        result: pct >= 40 ? 'PASSED' : 'REMEDIAL',
        resultStatus: pct >= 40 ? 'PASSED' : 'REMEDIAL',
        subjectMarks: subjectMarks,
        examTitle: examTitle,
        date: new Date().toISOString().split('T')[0]
      };
    });

    triggerWebhookDispatch({
      type: 'exam',
      scope: 'bulk',
      students: targetStudents,
      classInfo: selectedClass
        ? { id: selectedClass.id, name: selectedClass.name, section: selectedClass.section }
        : { id: selectedClassId, name: 'Class' },
      schoolProfile: state.schoolProfile || {},
      examInfo: { title: examTitle, date: new Date().toLocaleDateString('en-IN') }
    });
  };

  // Metrics for current class
  const classMarksList = classStudents.map((s) => getStudentMarksRecord(s.id)).filter(Boolean);
  const totalGraded = classMarksList.length;
  const avgPercentage = totalGraded > 0
    ? (classMarksList.reduce((acc, m) => acc + (parseFloat(m.percentage) || 0), 0) / totalGraded).toFixed(1)
    : '0.0';

  const liveStats = editingStudent ? computeLiveStats() : null;

  return (
    <div>
      {/* Section Title Header */}
      <div className="section-title">
        <div>
          <span style={{ fontSize: '18px', fontWeight: 800 }}>Marks Management</span>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Class-wise student academic performance and subject marks evaluation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {selectedExamId !== 'all' && selectedExam && deleteExam && (
            <button
              className="btn btn-secondary"
              onClick={() => deleteExam(selectedExam.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--rose)', borderColor: '#fca5a5' }}
              title="Delete this exam and all its recorded marks"
            >
              <i className="fa-solid fa-trash"></i> Delete Exam & Marks
            </button>
          )}
          <button className="btn btn-teal" onClick={handleExportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-file-excel"></i> Export Marksheet
          </button>
          {triggerWebhookDispatch && (
            <button
              type="button"
              className="btn"
              onClick={handleDispatchClassMarks}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700
              }}
              title="Dispatch class exam marks report to all parents via WhatsApp / Webhook"
            >
              <i className="fa-brands fa-whatsapp"></i> Send Class Marks (WhatsApp)
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Enrolled Students</h5>
            <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>{classStudents.length}</h2>
            <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>{selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : 'Selected Class'}</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', width: '40px', height: '40px', fontSize: '16px' }}>
            <i className="fa-solid fa-users"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Marks Evaluated</h5>
            <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>{totalGraded} / {classStudents.length}</h2>
            <p style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 600 }}>
              {teacherDisplayName ? `By ${teacherDisplayName}` : (classStudents.length > 0 ? `${Math.round((totalGraded / classStudents.length) * 100)}% Complete` : '0%')}
            </p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--teal)', width: '40px', height: '40px', fontSize: '16px' }}>
            <i className="fa-solid fa-clipboard-check"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Class Average</h5>
            <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>{avgPercentage}%</h2>
            <p style={{ fontSize: '11px', color: 'var(--purple)', fontWeight: 600 }}>Academic Performance</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--purple)', width: '40px', height: '40px', fontSize: '16px' }}>
            <i className="fa-solid fa-chart-line"></i>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-info">
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Subjects</h5>
            <h2 style={{ fontSize: '22px', margin: '4px 0', color: 'var(--text-primary)' }}>{dynamicSubjects.length}</h2>
            <p style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 600 }}>Database Dynamic</p>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--amber)', width: '40px', height: '40px', fontSize: '16px' }}>
            <i className="fa-solid fa-book-open"></i>
          </div>
        </div>
      </div>

      {/* Filter Header: Class dropdown & Exam dropdown & Teacher badge & Search */}
      <div className="filter-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Class Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-door-open" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>
              Class:
            </label>
            <select
              className="form-control"
              style={{ minWidth: '180px', padding: '8px 12px', fontWeight: 700 }}
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedExamId('all');
              }}
            >
              {state.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section} ({studentCountByClassId[c.id] || 0} students)
                </option>
              ))}
            </select>
          </div>

          {/* Exam Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-file-signature" style={{ color: 'var(--teal)', marginRight: '6px' }}></i>
              Exam:
            </label>
            <select
              className="form-control"
              style={{ minWidth: '220px', padding: '8px 12px', fontWeight: 600 }}
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={!state.exams || classExams.length === 0}
            >
              {!state.exams ? (
                <option value="">Loading exams...</option>
              ) : classExams.length === 0 ? (
                <option value="" disabled>No exams assigned to this class.</option>
              ) : (
                <>
                  <option value="all">All Exams</option>
                  {classExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} {e.date ? `(${e.date})` : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Teacher Badge */}
          {teacherDisplayName && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#166534',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <i className="fa-solid fa-chalkboard-user" style={{ color: '#16a34a', fontSize: '15px' }}></i>
              <span>
                Teacher: <strong style={{ color: '#14532d' }}>{teacherDisplayName}</strong>
                {teacherSubject ? <span style={{ color: '#15803d', fontWeight: 500 }}> ({teacherSubject})</span> : ''}
              </span>
            </div>
          )}

          {/* Search student box */}
          <div className="search-input-box" style={{ flex: 1, minWidth: '220px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
            <input
              type="text"
              placeholder={`Search students in ${selectedClass?.name || 'class'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearchQuery('')}></i>
            )}
          </div>
        </div>
      </div>

      {/* If No Exams Created for this class: Display High-IQ Empty State instead of Mark Filling Table */}
      {classExams.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1.5px dashed #cbd5e1',
          padding: '60px 24px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          maxWidth: '680px',
          margin: '20px auto 40px'
        }}>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '16px',
            boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.15)'
          }}>
            <i className="fa-solid fa-file-circle-plus"></i>
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            No Examination Created for {selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : 'this class'}
          </h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', maxWidth: '480px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Mark filling boxes and score evaluations are only available for scheduled examinations. Please create or schedule an exam first to start entering student marks.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openModal ? openModal('addExam') : (setActiveTab && setActiveTab(4))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 24px',
                fontSize: '13.5px',
                fontWeight: 700,
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              <i className="fa-solid fa-plus"></i> Create Examination Now
            </button>
            {setActiveTab && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab(4)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 20px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  borderRadius: '10px'
                }}
              >
                <i className="fa-solid fa-list-check"></i> View All Exams
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Emergency Backdated Exam Banner */}
          {selectedExam && selectedExam.date && selectedExam.date < new Date().toISOString().split('T')[0] && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#92400e',
              fontSize: '13px'
            }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '18px', color: '#d97706' }}></i>
              <div style={{ flex: 1 }}>
                <strong>Emergency Backdated Exam:</strong> Currently managing marks for <strong>{selectedExam.title}</strong> conducted on <strong>{selectedExam.date}</strong>. You can enter or update student marks directly below.
              </div>
            </div>
          )}

          {/* Info Banner when exams exist but no marks are entered yet */}
          {classStudents.length > 0 && totalGraded === 0 && (
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#1e40af',
              fontSize: '13px'
            }}>
              <i className="fa-solid fa-circle-info" style={{ fontSize: '18px', color: 'var(--primary)' }}></i>
              <div style={{ flex: 1 }}>
                <strong>{selectedExamId !== 'all' ? 'No marks available for this exam.' : 'No marks entered yet.'}</strong>{' '}
                Marks have not been recorded yet for {selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : 'this class'}
                {teacherDisplayName ? ` by teacher ${teacherDisplayName}` : ''}. Click <strong>Enter Marks</strong> on any student below to record scores.
              </div>
            </div>
          )}

          {/* Student Marks Table */}
          <div className="data-table-container">
        {filteredStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-user-slash" style={{ fontSize: '42px', color: '#cbd5e1', marginBottom: '12px' }}></i>
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>No Students Found</h4>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              {classStudents.length === 0
                ? `No students are enrolled in ${selectedClass?.name || 'this class'} yet.`
                : 'No students match your search query.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Roll</th>
                  <th>Student Name</th>
                  {dynamicSubjects.map((subj) => (
                    <th key={subj} style={{ textAlign: 'center' }}>
                      {subj}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', background: '#f1f5f9' }}>Total</th>
                  <th style={{ textAlign: 'center', background: '#f1f5f9' }}>%</th>
                  <th style={{ textAlign: 'right', minWidth: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const record = getStudentMarksRecord(student.id);
                  const marksMap = record?.marks || {};
                  const { hasMarks, total: totalMarks, percentage, gradeInfo } = getStudentStats(record);

                  return (
                    <tr key={student.id} style={{ transition: 'background-color 0.15s' }}>
                      <td>
                        <span className="roll-badge">{student.rollNo || '•'}</span>
                      </td>
                      <td>
                        <div
                          style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--primary)' }}
                          onClick={() => setViewingStudent(student)}
                          title="Click to view detailed report card"
                        >
                          {student.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Parent: {student.parentName || 'Parent'}
                        </div>
                      </td>

                      {/* Subject Marks Columns */}
                      {dynamicSubjects.map((subj) => {
                        const markVal = getSubjectMark(marksMap, subj);
                        const isEntered = markVal !== undefined && markVal !== null && markVal !== '';
                        return (
                          <td key={subj} style={{ textAlign: 'center', fontWeight: isEntered ? 700 : 400, color: isEntered ? '#0f172a' : '#94a3b8' }}>
                            {isEntered ? (
                              <span style={{ color: '#0f172a', fontWeight: 700 }}>{markVal}</span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Not Entered</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total */}
                      <td style={{ textAlign: 'center', fontWeight: 800, background: '#f8fafc', color: hasMarks ? '#0f172a' : '#94a3b8' }}>
                        {hasMarks ? totalMarks : <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>}
                      </td>

                      {/* Percentage */}
                      <td style={{ textAlign: 'center', fontWeight: 700, background: '#f8fafc', color: hasMarks ? 'var(--primary)' : '#94a3b8' }}>
                        {hasMarks ? percentage : <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={`btn ${hasMarks ? 'btn-secondary' : 'btn-primary'}`}
                          style={{
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            ...(hasMarks ? { color: 'var(--primary)', borderColor: 'var(--primary)' } : {})
                          }}
                          onClick={() => handleOpenEditMarks(student)}
                          title={hasMarks ? "Edit Marks" : "Enter Marks"}
                        >
                          <i className={`fa-solid ${hasMarks ? 'fa-pen-to-square' : 'fa-plus'}`}></i>
                          <span>{hasMarks ? 'Edit' : 'Enter Marks'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* ==================== 1. EDIT / ENTER MARKS MODAL ==================== */}
      {editingStudent && (
        <div className="modal-overlay" onClick={() => !isSaving && setEditingStudent(null)}>
          <div className="modal-box" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  {getStudentMarksRecord(editingStudent.id) ? 'Edit Student Marks' : 'Enter Student Marks'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {editingStudent.name} • Roll: {editingStudent.rollNo} • {selectedClass?.name} - {selectedClass?.section}
                </p>
              </div>
              <i className="fa-solid fa-xmark" style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => !isSaving && setEditingStudent(null)}></i>
            </div>

            {/* Context Header */}
            <div style={{
              margin: '14px 0',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Target Exam: </span>
                {classExams.length > 1 && selectedExamId === 'all' ? (
                  <select
                    className="form-control"
                    style={{ display: 'inline-block', width: 'auto', padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}
                    value={modalExamId}
                    onChange={(e) => handleModalExamChange(e.target.value)}
                  >
                    {classExams.map((e) => (
                      <option key={e.id} value={e.id}>{e.title}</option>
                    ))}
                  </select>
                ) : (
                  <strong>{modalExamObj?.title || examTitle}</strong>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Max Per Subject: </span>
                <strong>{modalExamObj ? modalExamObj.maxMarks : (selectedExam ? selectedExam.maxMarks : 100)}</strong>
              </div>
            </div>

            {/* Subject Input Fields Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                <i className="fa-solid fa-book-open" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>
                Subject Scores
              </span>
            </div>

            {/* Subject Input Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {Array.from(new Set([...dynamicSubjects, ...Object.keys(formMarks)])).map((subj) => (
                <div key={subj} className="form-group" style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{subj}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                      Max {modalExamObj ? modalExamObj.maxMarks : (selectedExam ? selectedExam.maxMarks : 100)}
                    </span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max={modalExamObj ? modalExamObj.maxMarks : (selectedExam ? selectedExam.maxMarks : 100)}
                    placeholder="Enter score"
                    value={formMarks[subj] !== undefined ? formMarks[subj] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormMarks((prev) => ({
                        ...prev,
                        [subj]: val
                      }));
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Live Calculation Preview Banner */}
            {liveStats && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Total Marks:</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#14532d' }}>
                    {liveStats.total} <span style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>/ {liveStats.maxTotal}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Percentage:</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#14532d' }}>
                    {liveStats.percentage !== null ? `${liveStats.percentage}%` : '—'}
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingStudent(null)} disabled={isSaving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveMarks}
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
                <span>{isSaving ? 'Saving...' : 'Save & Calculate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. STUDENT DETAIL REPORT CARD MODAL ==================== */}
      {viewingStudent && (
        <div className="modal-overlay" onClick={() => setViewingStudent(null)}>
          <div className="modal-box" style={{ maxWidth: '620px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Student Evaluation Details
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {examTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                style={{ border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Student Metadata Card */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Student Name: </span>
                <strong style={{ color: '#0f172a' }}>{viewingStudent.name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Roll Number: </span>
                <strong style={{ color: '#0f172a' }}>{viewingStudent.rollNo || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Class & Section: </span>
                <strong style={{ color: '#0f172a' }}>{selectedClass?.name} - {selectedClass?.section}</strong>
              </div>
            </div>

            {/* Subject-wise Marks Table */}
            {(() => {
              const record = getStudentMarksRecord(viewingStudent.id);
              const marksMap = record?.marks || {};
              const maxMarksPerSubj = selectedExam ? (parseFloat(selectedExam.maxMarks) || 100) : 100;
              const { hasMarks, total: totalMarks, percentage, percentNum, gradeInfo } = getStudentStats(record);
              const maxTotal = record?.maxTotal || (dynamicSubjects.length * maxMarksPerSubj);

              return (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Subject</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Max Marks</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Marks Obtained</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dynamicSubjects.map((subj) => {
                        const obtained = getSubjectMark(marksMap, subj);
                        const isEntered = obtained !== undefined && obtained !== null && obtained !== '';

                        return (
                          <tr key={subj} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{subj}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>{maxMarksPerSubj}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: isEntered ? '#0f172a' : '#94a3b8' }}>
                              {isEntered ? obtained : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Summary Highlights */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    padding: '14px',
                    backgroundColor: hasMarks ? '#f0fdf4' : '#f8fafc',
                    borderRadius: '12px',
                    border: hasMarks ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Marks</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                        {hasMarks ? `${totalMarks} / ${maxTotal}` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Percentage</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                        {hasMarks ? percentage : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Result</div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: hasMarks ? (percentNum >= 40 ? '#16a34a' : '#dc2626') : '#94a3b8'
                      }}>
                        {hasMarks ? (percentNum >= 40 ? 'PASSED' : 'FAILED') : 'PENDING'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                {(() => {
                  const phone = formatWhatsAppPhone(viewingStudent.parentPhone || viewingStudent.parent_phone || viewingStudent.phone || viewingStudent.mobile || '');
                  const record = getStudentMarksRecord(viewingStudent.id);
                  const examTitle = selectedExamId === 'all'
                    ? 'All Exams Performance Report'
                    : (state.exams?.find((e) => e.id === selectedExamId)?.title || 'Exam Performance Report');
                  const message = `*${state.schoolProfile?.name || 'SmartClass Academy'} - Exam Report Card*\n\n` +
                    `*Student:* ${viewingStudent.name} (Roll: ${viewingStudent.rollNo || '-'})\n` +
                    `*Class:* ${selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : '-'}\n` +
                    `*Exam:* ${examTitle}\n\n` +
                    `*Subject Marks:*\n` +
                    dynamicSubjects.map((sub) => `• ${sub}: ${record?.marks?.[sub] !== undefined ? record?.marks?.[sub] : '-'}/100`).join('\n') +
                    `\n\n*Total Marks:* ${record?.total !== undefined ? record?.total : '-'}/${record?.maxTotal !== undefined ? record?.maxTotal : '-'}\n` +
                    `*Percentage:* ${record?.percentage !== undefined ? `${record?.percentage}%` : '-'}\n` +
                    `*Result:* ${(parseFloat(record?.percentage) || 0) >= 40 ? 'PASSED' : 'REMEDIAL REQUIRED'}\n\n` +
                    `_Sent via School Management System_`;

                  const handleSendSingleViaWebhook = () => {
                    const singleTarget = {
                      ...viewingStudent,
                      studentId: viewingStudent.id,
                      rollNo: viewingStudent.rollNo || viewingStudent.roll_no || '',
                      name: viewingStudent.name,
                      className: selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : 'Class',
                      division: selectedClass?.section || '-',
                      parentContact: phone,
                      parentPhone: phone,
                      parentName: viewingStudent.parentName || 'Parent / Guardian',
                      totalMarks: record ? Number(record.maxTotal) || 100 : 100,
                      marksObtained: record ? Number(record.total) || 0 : 0,
                      totalScore: record ? Number(record.total) || 0 : 0,
                      totalMax: record ? Number(record.maxTotal) || 100 : 100,
                      percentage: record && record.percentage !== undefined ? parseFloat(record.percentage) || 0 : 0,
                      grade: (parseFloat(record?.percentage) || 0) >= 40 ? 'Passed' : 'Remedial',
                      result: (parseFloat(record?.percentage) || 0) >= 40 ? 'PASSED' : 'REMEDIAL',
                      resultStatus: (parseFloat(record?.percentage) || 0) >= 40 ? 'PASSED' : 'REMEDIAL',
                      examTitle: examTitle,
                      date: new Date().toISOString().split('T')[0]
                    };
                    triggerWebhookDispatch({
                      type: 'exam',
                      scope: 'single',
                      student: singleTarget,
                      classInfo: selectedClass ? { id: selectedClass.id, name: selectedClass.name, section: selectedClass.section } : { id: selectedClassId, name: 'Class' },
                      schoolProfile: state.schoolProfile || {},
                      examInfo: { title: examTitle, date: new Date().toLocaleDateString('en-IN') }
                    });
                  };

                  return (
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {triggerWebhookDispatch && (
                        <button
                          type="button"
                          className="btn"
                          onClick={handleSendSingleViaWebhook}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#0d9488',
                            color: '#ffffff',
                            fontWeight: 600
                          }}
                          title="Dispatch report to parent via automated WhatsApp webhook"
                        >
                          <i className="fa-solid fa-bolt"></i> Auto Webhook
                        </button>
                      )}
                      <a
                        href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          textDecoration: 'none',
                          fontWeight: 600
                        }}
                        title={phone ? `Open WhatsApp Web chat with parent (${phone})` : 'Share on WhatsApp'}
                      >
                        <i className="fa-brands fa-whatsapp"></i> WhatsApp Web
                      </a>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const stu = viewingStudent;
                    setViewingStudent(null);
                    handleOpenEditMarks(stu);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Edit Marks
                </button>
                <button className="btn btn-secondary" onClick={() => setViewingStudent(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
