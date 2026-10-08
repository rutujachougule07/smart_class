import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function ImportExcelModal({
  isOpen,
  initialCategory = 'students',
  defaultClassId = '',
  onClose,
  state,
  onImportStudents,
  onImportTeachers,
  onImportClasses,
  notifySystemChange
}) {
  const resolvedCategory = initialCategory === 'teachers' ? 'teachers' : 'students';
  const [activeCategory, setActiveCategory] = useState(resolvedCategory);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [fileName, setFileName] = useState('');
  const [rawJsonRows, setRawJsonRows] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  // Helper to format class name nicely without trailing dashes
  const formatClassName = (c) => {
    if (!c) return '';
    return c.section && c.section.trim() ? `${c.name} - ${c.section}` : c.name;
  };

  // Helper to load current enrolled students from state
  const loadInitialEnrolledStudents = () => {
    return (state.students || []).map((s, idx) => {
      const cls = state.classes.find((c) => c.id === s.classId);
      return {
        id: s.id || `st_${idx}`,
        rollNo: s.rollNo || '',
        name: s.name || '',
        classId: s.classId || '',
        className: formatClassName(cls) || 'Unassigned',
        parentName: s.parentName || '',
        parentPhone: s.parentPhone || '',
        status: 'enrolled',
        message: 'Currently in database'
      };
    });
  };

  // Helper to load current teachers from state
  const loadInitialEnrolledTeachers = () => {
    return (state.teachers || []).map((t, idx) => ({
      id: t.id || `tc_${idx}`,
      name: t.name || '',
      phone: t.phone || '',
      subject: t.subject || '',
      role: t.role || '',
      password: t.password || 'password123',
      assignedClassIds: t.assignedClassIds || (t.assignedClassId ? [t.assignedClassId] : []),
      classStr: '',
      status: 'enrolled',
      message: 'Currently in database'
    }));
  };

  // Sync category and load initial database rows when modal opens
  useEffect(() => {
    if (isOpen) {
      const cat = initialCategory === 'teachers' ? 'teachers' : 'students';
      setActiveCategory(cat);
      setImportSummary(null);
      setFileName('');
      setRawJsonRows([]);
      setIsFileUploaded(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (defaultClassId && state.classes.some((c) => c.id === defaultClassId)) {
        setSelectedClassId(defaultClassId);
      } else if (state.classes && state.classes.length > 0) {
        setSelectedClassId(state.classes[0].id);
      } else {
        setSelectedClassId('all');
      }

      if (cat === 'students') {
        setParsedRows(loadInitialEnrolledStudents());
      } else {
        setParsedRows(loadInitialEnrolledTeachers());
      }
    }
  }, [isOpen, initialCategory, defaultClassId, state.classes, state.students, state.teachers]);

  // Normalize keys helper
  const getField = (row, ...aliases) => {
    if (!row || typeof row !== 'object') return '';
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const cleanAlias = alias.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const match = keys.find((k) => {
        if (k.trim().toLowerCase() === alias.toLowerCase()) return true;
        const cleanK = k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanK === cleanAlias;
      });
      if (match && row[match] !== undefined && row[match] !== null) {
        return String(row[match]).trim();
      }
    }
    return '';
  };

  // Normalize class string to match variations (e.g. "10-A", "Class 10A", "10th A", "10A")
  const normalizeClassStr = (val) => {
    if (!val) return '';
    return String(val)
      .toLowerCase()
      .replace(/^(class|std|standard|grade|div|section)\s*/i, '')
      .replace(/\s*(class|std|standard|grade|div|section)$/i, '')
      .replace(/(\d+)(st|nd|rd|th)/i, '$1')
      .replace(/[^a-z0-9]/g, '');
  };

  // Flexible class matcher
  const matchClassIds = (str) => {
    if (!str || !state.classes) return [];
    const parts = String(str).split(/[,;/]+/).map((p) => p.trim()).filter(Boolean);
    const matched = [];

    for (const part of parts) {
      const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const normPart = normalizeClassStr(part);

      const found = state.classes.find((c) => {
        const cFullName = `${c.name} - ${c.section || ''}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cCombined = `${c.name} ${c.section || ''}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cOnlyName = (c.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (cleanPart === cFullName || cleanPart === cCombined || cleanPart === cOnlyName) return true;

        const normFullName = normalizeClassStr(`${c.name} ${c.section || ''}`);
        const normOnlyName = normalizeClassStr(c.name);
        return normPart && (normPart === normFullName || normPart === normOnlyName);
      });

      if (found && !matched.includes(found.id)) {
        matched.push(found.id);
      }
    }
    return matched;
  };

  // Process STUDENT Rows from Excel file
  const processRowsForStudents = (json, targetClassId) => {
    const defaultTargetClassObj = state.classes.find((c) => c.id === targetClassId) || state.classes[0];
    const defaultTargetClassName = formatClassName(defaultTargetClassObj) || 'Selected Class';

    const seenRollsInFile = new Set();
    const seenPhonesInFile = new Set();

    return json.map((row, index) => {
      const rollNo = getField(row, 'Roll Number', 'Roll No', 'Roll', 'RollNo', 'roll_no', 'roll');
      const name = getField(row, 'Student Full Name', 'Student Name', 'Name', 'StudentName', 'student_name');
      const parentName = getField(row, 'Parent / Guardian Name', 'Parent/Guardian Name', 'Parent Name', 'ParentName', 'Guardian Name', 'parent_name');
      const parentPhone = getField(row, 'Parent Mobile Number (10 Digits) *', 'Parent Mobile Number (10 Digits)', 'Parent Mobile Number', 'Parent Mobile', 'Parent Phone', 'Phone', 'Mobile', 'parent_phone').replace(/\D/g, '');

      const rowClassStr = getField(row, 'Class', 'ClassName', 'Class Name', 'Section', 'Grade', 'Standard', 'Std');
      let rowClassId = (targetClassId && targetClassId !== 'all') ? targetClassId : (defaultTargetClassObj ? defaultTargetClassObj.id : '');
      let rowClassName = defaultTargetClassName;

      if (rowClassStr) {
        const matchedClassIds = matchClassIds(rowClassStr);
        if (matchedClassIds.length > 0) {
          rowClassId = matchedClassIds[0];
          const foundCls = state.classes.find((c) => c.id === rowClassId);
          if (foundCls) {
            rowClassName = formatClassName(foundCls);
          }
        }
      }

      const isRollDuplicate = Boolean(
        rollNo && state.students.some((s) => s.classId === rowClassId && String(s.rollNo).trim() === String(rollNo).trim())
      );
      const isExactDuplicate = Boolean(
        rollNo && name && state.students.some((s) => s.classId === rowClassId && String(s.rollNo).trim() === String(rollNo).trim() && s.name.trim().toLowerCase() === name.trim().toLowerCase())
      );
      const fileRollKey = `${rowClassId}_${rollNo}`;
      const isFileRollDup = Boolean(rollNo && seenRollsInFile.has(fileRollKey));
      if (rollNo) seenRollsInFile.add(fileRollKey);

      let status = 'ready';
      let message = 'Ready to import';
      if (!name) {
        status = 'error';
        message = 'Missing Student Name';
      } else if (isExactDuplicate) {
        status = 'duplicate';
        message = `Student ${name} (Roll ${rollNo}) already in class`;
      } else if (isRollDuplicate || isFileRollDup) {
        status = 'duplicate';
        message = `Roll ${rollNo} already taken in this class`;
      }

      return {
        id: `file_${index}`,
        rollNo: rollNo || `${100 + index + 1}`,
        name,
        classId: rowClassId,
        className: rowClassName,
        parentName: parentName || 'Parent',
        parentPhone,
        status,
        message
      };
    });
  };

  // Process TEACHER Rows from Excel file
  const processRowsForTeachers = (json) => {
    const seenPhonesInFile = new Set();

    return json.map((row, index) => {
      const name = getField(row, 'Teacher Full Name', 'Teacher Name', 'Full Name', 'Name', 'TeacherName', 'faculty_name');
      const phoneRaw = getField(row, 'Mobile Number (10 Digits) *', 'Mobile Number (10 Digits)', 'Mobile Number', 'Phone Number', 'Mobile', 'Phone', 'mobile_number');
      const phone = phoneRaw.replace(/\D/g, '');
      const subject = getField(row, 'Teaching Subject', 'Subject', 'Department', 'Course', 'subject');
      const role = getField(row, 'Role (Class Teacher / Subject Teacher)', 'Role', 'Designation', 'Position') || 'Subject Teacher';
      const password = getField(row, 'Login Password', 'Password', 'Pass', 'Default Password') || 'password123';
      const classStr = getField(row, 'Assigned Classes', 'Assigned Class', 'Classes', 'Class', 'Sections', 'Section');

      const assignedClassIds = classStr ? matchClassIds(classStr) : [];
      const isExistingPhone = phone && phone.length === 10 && state.teachers.some((t) => t.phone === phone);
      const isFileDuplicate = phone && seenPhonesInFile.has(phone);
      if (phone) seenPhonesInFile.add(phone);

      let status = 'ready';
      let message = 'Ready to import';
      if (!name) {
        status = 'error';
        message = 'Missing Teacher Name';
      } else if (!phone || phone.length !== 10) {
        status = 'error';
        message = 'Invalid 10-digit Mobile';
      } else if (isExistingPhone || isFileDuplicate) {
        status = 'duplicate';
        message = `Mobile ${phone} already registered`;
      }

      return {
        id: `file_${index}`,
        name,
        phone,
        subject,
        role,
        password,
        assignedClassIds,
        classStr: classStr || '',
        status,
        message
      };
    });
  };

  // Load sheet data helper
  const loadSheetData = (wb, sheetName, curCat = activeCategory, curClassId = selectedClassId) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!json || json.length === 0) {
      alert(`Sheet "${sheetName}" contains no data rows.`);
      return;
    }
    setRawJsonRows(json);
    const processed = curCat === 'teachers'
      ? processRowsForTeachers(json)
      : processRowsForStudents(json, curClassId);
    setParsedRows(processed);
  };

  // Parse Uploaded Excel or CSV File
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsFileUploaded(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        let sheetToUse = wb.SheetNames[0];
        if (activeCategory === 'students') {
          const studentSheet = wb.SheetNames.find((s) => /student/i.test(s));
          if (studentSheet) sheetToUse = studentSheet;
        } else if (activeCategory === 'teachers') {
          const teacherSheet = wb.SheetNames.find((s) => /teacher/i.test(s));
          if (teacherSheet) sheetToUse = teacherSheet;
        }

        loadSheetData(wb, sheetToUse, activeCategory, selectedClassId);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        alert('Could not parse this Excel/CSV file. Please ensure valid file format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Revert back to database view
  const handleResetToDatabase = () => {
    setIsFileUploaded(false);
    setFileName('');
    setRawJsonRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (activeCategory === 'students') {
      setParsedRows(loadInitialEnrolledStudents());
    } else {
      setParsedRows(loadInitialEnrolledTeachers());
    }
  };

  // When user clicks any class card
  const handleSelectClass = (classId) => {
    setSelectedClassId(classId);
    if (isFileUploaded && rawJsonRows.length > 0 && activeCategory !== 'teachers') {
      setParsedRows(processRowsForStudents(rawJsonRows, classId === 'all' ? '' : classId));
    }
  };

  // In-table inline cell edit
  const handleCellChange = (rowId, field, value) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          const updated = { ...r, [field]: value };
          if (field === 'classId') {
            const cls = state.classes.find((c) => c.id === value);
            updated.className = formatClassName(cls) || 'Class';
          }
          if (updated.status === 'enrolled') {
            updated.status = 'ready';
            updated.message = 'Modified, ready to save';
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Get next available numeric roll number for class
  const getNextAvailableRoll = (classId) => {
    const existing = new Set();
    (state.students || []).forEach((s) => {
      if (!classId || classId === 'all' || s.classId === classId) {
        if (s.rollNo) existing.add(String(s.rollNo).trim());
      }
    });
    (parsedRows || []).forEach((r) => {
      if (!classId || classId === 'all' || r.classId === classId) {
        if (r.rollNo) existing.add(String(r.rollNo).trim());
      }
    });

    let n = 101;
    while (existing.has(String(n))) {
      n++;
    }
    return String(n);
  };

  // Helper to check if a row has a duplicate roll number within its class
  const checkDuplicateRoll = (rowId, classId, rollNo) => {
    const cleanR = String(rollNo || '').trim();
    if (!cleanR) return false;

    // Check if taken in database by another student
    const existsInDb = (state.students || []).some(
      (s) => s.id !== rowId && s.classId === classId && String(s.rollNo).trim().toLowerCase() === cleanR.toLowerCase()
    );
    if (existsInDb) return true;

    // Check if duplicated within current sheet rows
    const existsInRows = (parsedRows || []).some(
      (r) => r.id !== rowId && r.classId === classId && String(r.rollNo).trim().toLowerCase() === cleanR.toLowerCase()
    );
    return existsInRows;
  };

  // Add blank student row with guaranteed unique roll number
  const handleAddRow = () => {
    const targetCls = (selectedClassId !== 'all' && state.classes.find((c) => c.id === selectedClassId)) || state.classes[0];
    const targetClassId = targetCls ? targetCls.id : '';
    const nextRoll = getNextAvailableRoll(targetClassId);

    const newRow = {
      id: `new_${Date.now()}`,
      rollNo: nextRoll,
      name: '',
      classId: targetClassId,
      className: formatClassName(targetCls) || 'Class',
      parentName: '',
      parentPhone: '',
      status: 'ready',
      message: 'New row, ready to save'
    };
    setParsedRows((prev) => [newRow, ...prev]);
  };

  // Delete row
  const handleDeleteRow = (rowId) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Filter rows by currently clicked class card
  const displayedRows = parsedRows.filter((r) => {
    if (activeCategory === 'teachers') return true;
    if (selectedClassId === 'all') return true;
    return r.classId === selectedClassId;
  });

  // Download clean Blank Excel Template for adding new records
  const handleDownloadBlankTemplate = (cat = activeCategory) => {
    const currentClsObj = state.classes.find((c) => c.id === selectedClassId);
    const targetClassName = currentClsObj ? formatClassName(currentClsObj) : (state.classes[0] ? formatClassName(state.classes[0]) : 'Class 10 - A');
    const clsLabel = selectedClassId === 'all'
      ? 'All_Classes'
      : (currentClsObj ? formatClassName(currentClsObj).replace(/\s+/g, '_') : 'Class');

    if (cat === 'teachers') {
      const templateData = [
        {
          '#': 1,
          'Teacher Full Name': 'Amit Verma',
          'Mobile Number (10 Digits) *': '9876543211',
          'Teaching Subject': 'Mathematics',
          'Role (Class Teacher / Subject Teacher)': 'Class Teacher',
          'Login Password': 'password123',
          'Assigned Classes': targetClassName
        },
        {
          '#': 2,
          'Teacher Full Name': 'Pooja Sharma',
          'Mobile Number (10 Digits) *': '9876543212',
          'Teaching Subject': 'Science',
          'Role (Class Teacher / Subject Teacher)': 'Subject Teacher',
          'Login Password': 'password123',
          'Assigned Classes': targetClassName
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 30 },
        { wch: 20 },
        { wch: 35 },
        { wch: 18 },
        { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Add Teachers Template');
      XLSX.writeFile(wb, `Teachers_Add_Template.xlsx`);
    } else {
      const templateData = [
        {
          '#': 1,
          'Roll Number': '101',
          'Student Full Name': 'Rahul Sharma',
          'Class': targetClassName,
          'Parent / Guardian Name': 'Rajesh Sharma',
          'Parent Mobile Number (10 Digits) *': '9876543210'
        },
        {
          '#': 2,
          'Roll Number': '102',
          'Student Full Name': 'Priya Patel',
          'Class': targetClassName,
          'Parent / Guardian Name': 'Suresh Patel',
          'Parent Mobile Number (10 Digits) *': '9876543211'
        },
        {
          '#': 3,
          'Roll Number': '103',
          'Student Full Name': 'Aman Gupta',
          'Class': targetClassName,
          'Parent / Guardian Name': 'Manoj Gupta',
          'Parent Mobile Number (10 Digits) *': '9876543212'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 25 },
        { wch: 35 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Add Students Template');
      XLSX.writeFile(wb, `Students_Add_Template_${clsLabel}.xlsx`);
    }
  };

  // Export current Excel sheet (or download blank template if empty)
  const handleExportSheet = () => {
    if (displayedRows.length === 0) {
      handleDownloadBlankTemplate();
      return;
    }
    const currentClsObj = state.classes.find((c) => c.id === selectedClassId);
    const clsLabel = selectedClassId === 'all'
      ? 'All_Classes'
      : (currentClsObj ? formatClassName(currentClsObj).replace(/\s+/g, '_') : 'Class');

    if (activeCategory === 'teachers') {
      const exportData = displayedRows.map((r, i) => ({
        '#': i + 1,
        'Teacher Full Name': r.name,
        'Mobile Number (10 Digits) *': r.phone,
        'Teaching Subject': r.subject,
        'Role (Class Teacher / Subject Teacher)': r.role,
        'Login Password': r.password || 'password123',
        'Assigned Classes': r.classStr || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 30 },
        { wch: 20 },
        { wch: 35 },
        { wch: 18 },
        { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
      XLSX.writeFile(wb, `Teachers_Export_${Date.now()}.xlsx`);
    } else {
      const exportData = displayedRows.map((r, idx) => ({
        '#': idx + 1,
        'Roll Number': r.rollNo,
        'Student Full Name': r.name,
        'Class': r.className || (currentClsObj ? formatClassName(currentClsObj) : 'Unassigned'),
        'Parent / Guardian Name': r.parentName,
        'Parent Mobile Number (10 Digits) *': r.parentPhone
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 25 },
        { wch: 35 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.writeFile(wb, `Students_${clsLabel}.xlsx`);
    }
  };

  // Batch execute import into Firebase
  const handleExecuteImport = async () => {
    const toImport = skipDuplicates
      ? parsedRows.filter((r) => r.status === 'ready')
      : parsedRows.filter((r) => r.status === 'ready' || r.status === 'duplicate');

    if (toImport.length === 0) {
      alert('No new or modified rows to import! Everything is already in the database.');
      return;
    }

    // Strict validation for students: Duplicate Roll Number Prevention
    if (activeCategory !== 'teachers') {
      for (const item of toImport) {
        const cleanR = String(item.rollNo || '').trim();
        if (!cleanR) {
          alert(`Student "${item.name || 'Unnamed'}" is missing Roll Number! Please enter a Roll Number.`);
          return;
        }

        // Check if duplicate with other students already in database
        const existsInDb = state.students.some(
          (s) => s.id !== item.id && s.classId === item.classId && String(s.rollNo).trim().toLowerCase() === cleanR.toLowerCase()
        );
        if (existsInDb) {
          alert(`Already taken! Roll Number "${cleanR}" is already registered in ${item.className || 'this class'}. (हा रोल नंबर या वर्गात आधीच घेतलेला आहे)`);
          return;
        }

        // Check if duplicate within this current import batch
        const dupInBatch = toImport.filter(
          (r) => r.classId === item.classId && String(r.rollNo).trim().toLowerCase() === cleanR.toLowerCase()
        ).length;
        if (dupInBatch > 1) {
          alert(`Duplicate Roll Number "${cleanR}" found multiple times in ${item.className || 'this class'}! Each student must have a unique Roll Number.`);
          return;
        }
      }
    }

    setIsProcessing(true);

    try {
      if (activeCategory === 'teachers') {
        for (let i = 0; i < toImport.length; i++) {
          const item = toImport[i];
          setProgressText(`Importing teacher ${i + 1} of ${toImport.length}: ${item.name}...`);
          if (onImportTeachers) {
            await onImportTeachers({
              name: item.name,
              phone: item.phone,
              password: item.password,
              role: item.role,
              subject: item.subject,
              qualification: 'B.Ed',
              assignedClassIds: item.assignedClassIds
            });
          }
        }
      } else {
        for (let i = 0; i < toImport.length; i++) {
          const item = toImport[i];
          setProgressText(`Importing student ${i + 1} of ${toImport.length}: ${item.name} (${item.className})...`);
          if (onImportStudents) {
            await onImportStudents({
              rollNo: item.rollNo,
              name: item.name,
              classId: item.classId,
              parentName: item.parentName,
              parentPhone: item.parentPhone
            });
          }
        }
      }

      setImportSummary({
        category: activeCategory,
        success: toImport.length,
        skipped: parsedRows.length - toImport.length,
        total: parsedRows.length,
        className: 'All Classes'
      });

      if (notifySystemChange && toImport.length > 0) {
        await notifySystemChange({
          title: `Excel Bulk Import: ${activeCategory.toUpperCase()}`,
          content: `Bulk Excel import completed: Successfully imported and enrolled ${toImport.length} ${activeCategory} records.`,
          type: 'import',
          section: activeCategory,
          targetRole: 'All'
        });
      }

      setIsFileUploaded(false);
      setFileName('');
    } catch (err) {
      console.error('Batch import failed:', err);
      alert('An error occurred during batch import.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  if (!isOpen) return null;

  const validCount = parsedRows.filter((r) => r.status === 'ready').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length;
  const currentClassObj = state.classes.find((c) => c.id === selectedClassId);
  const currentClassName = currentClassObj ? formatClassName(currentClassObj) : 'All Classes';

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: '960px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 124, 65, 0.12)',
                color: '#107c41',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}
            >
              <i className="fa-solid fa-file-excel"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Student Class-Wise Excel Sheet & Import
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Click any class to display its Excel sheet directly. Edit, export or import new Excel files anytime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 1. CLASS BUTTONS (CLICK TO VIEW DIRECT EXCEL SHEET) */}
        {activeCategory !== 'teachers' && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-layer-group" style={{ color: 'var(--primary)' }}></i>
                Select Class to Display Excel Sheet:
              </label>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Viewing: <strong style={{ color: 'var(--primary)' }}>{currentClassName}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {/* All Classes Card */}
              <button
                type="button"
                onClick={() => handleSelectClass('all')}
                style={{
                  flex: '1 1 130px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: selectedClassId === 'all' ? '2.5px solid var(--primary)' : '1px solid #cbd5e1',
                  backgroundColor: selectedClassId === 'all' ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                  color: selectedClassId === 'all' ? 'var(--primary)' : '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: selectedClassId === 'all' ? '0 3px 8px rgba(37, 99, 235, 0.15)' : 'none',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: selectedClassId === 'all' ? 'var(--primary)' : '#f1f5f9',
                  color: selectedClassId === 'all' ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>
                  <i className="fa-solid fa-users"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', fontSize: '13px' }}>All Classes</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{state.students.length} Students</div>
                </div>
                {selectedClassId === 'all' && (
                  <i className="fa-solid fa-circle-check" style={{ color: 'var(--primary)', fontSize: '15px' }}></i>
                )}
              </button>

              {/* Each Individual Class Card */}
              {state.classes.map((c) => {
                const isSelected = c.id === selectedClassId;
                const studentCount = state.students.filter((s) => s.classId === c.id).length;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectClass(c.id)}
                    style={{
                      flex: '1 1 130px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '2.5px solid var(--primary)' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                      color: isSelected ? 'var(--primary)' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: isSelected ? '0 3px 8px rgba(37, 99, 235, 0.15)' : 'none',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--primary)' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}>
                      <i className="fa-solid fa-graduation-cap"></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', fontSize: '13px' }}>{formatClassName(c)}</div>
                      <div style={{ fontSize: '11px', color: isSelected ? 'var(--primary)' : '#64748b' }}>{studentCount} Enrolled</div>
                    </div>
                    {isSelected && (
                      <i className="fa-solid fa-circle-check" style={{ color: 'var(--primary)', fontSize: '15px' }}></i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. ACTION TOOLBAR */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ fontWeight: '800', color: '#1e293b' }}>
              <i className="fa-solid fa-table" style={{ color: '#107c41', marginRight: '5px' }}></i>
              {currentClassName} Excel Sheet:
            </span>
            <span style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>
              {displayedRows.length} Students
            </span>

            {isFileUploaded && (
              <span
                style={{
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <i className="fa-solid fa-file-excel"></i> File: {fileName}
                <button
                  type="button"
                  onClick={handleResetToDatabase}
                  style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', marginLeft: '4px', fontWeight: '800' }}
                  title="Reset to database view"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Hidden Native File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                backgroundColor: '#107c41',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(16, 124, 65, 0.2)'
              }}
              title="Upload an Excel file (.xlsx, .xls, .csv)"
            >
              <i className="fa-solid fa-file-arrow-up"></i>
              {isFileUploaded ? 'Change Excel File' : 'Upload Excel File'}
            </button>

            <button
              type="button"
              onClick={handleExportSheet}
              style={{
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Download this sheet as Excel file"
            >
              <i className="fa-solid fa-download" style={{ color: '#107c41' }}></i>
              Export Excel
            </button>

            <button
              type="button"
              onClick={() => handleDownloadBlankTemplate()}
              style={{
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                border: '1.5px solid #86efac',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.12)'
              }}
              title="Download a clean blank Excel template with headers ready to fill and add"
            >
              <i className="fa-solid fa-file-excel" style={{ color: '#16a34a' }}></i>
              Blank Excel for Add
            </button>

            <button
              type="button"
              onClick={handleAddRow}
              style={{
                backgroundColor: '#ffffff',
                color: 'var(--primary)',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Add a new blank row into the Excel sheet"
            >
              <i className="fa-solid fa-plus"></i>
              Add Row
            </button>
          </div>
        </div>

        {/* Import Success Banner */}
        {importSummary && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '20px' }}></i>
            <div>
              <div style={{ fontWeight: '800', fontSize: '13px', color: '#166534' }}>
                Import Completed Successfully!
              </div>
              <div style={{ fontSize: '12px', color: '#15803d' }}>
                Added {importSummary.success} of {importSummary.total} students into Firebase Firestore.
              </div>
            </div>
          </div>
        )}

        {/* 3. DIRECT EXCEL SHEET TABLE */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            maxHeight: '360px',
            backgroundColor: '#ffffff',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '12px'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', color: '#ffffff', zIndex: 2 }}>
              <tr>
                <th style={{ padding: '8px 10px', width: '50px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '8px 10px', width: '90px' }}>Roll No</th>
                <th style={{ padding: '8px 10px' }}>Student Full Name</th>
                <th style={{ padding: '8px 10px' }}>Parent / Guardian Name</th>
                <th style={{ padding: '8px 10px', width: '140px' }}>Parent Mobile</th>
                <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <i className="fa-solid fa-folder-open" style={{ fontSize: '28px', marginBottom: '8px', display: 'block', color: '#94a3b8' }}></i>
                    No {activeCategory === 'teachers' ? 'teachers' : 'students'} in this sheet yet.
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadBlankTemplate()}
                        style={{
                          backgroundColor: '#107c41',
                          color: '#ffffff',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-file-excel"></i>
                        Download Blank Excel for Add
                      </button>
                      <button
                        type="button"
                        onClick={handleAddRow}
                        style={{
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-plus"></i>
                        Add Row Manually
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, idx) => {
                  const isDupRoll = checkDuplicateRoll(row.id, row.classId, row.rollNo);
                  const isDup = row.status === 'duplicate' || isDupRoll;
                  const isErr = row.status === 'error';
                  const isEnrolled = row.status === 'enrolled' && !isDupRoll;

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: isErr ? '#fff1f2' : isDup ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="text"
                          value={row.rollNo}
                          title={isDupRoll ? '⚠️ Duplicate Roll Number! हा रोल नंबर या क्लासमध्ये आधीच घेतलेला आहे.' : ''}
                          onChange={(e) => handleCellChange(row.id, 'rollNo', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: isDupRoll ? '1.5px solid #ef4444' : '1px solid transparent',
                            backgroundColor: isDupRoll ? '#fef2f2' : 'transparent',
                            fontWeight: '700',
                            color: isDupRoll ? '#b91c1c' : '#1e293b',
                            fontSize: '12px'
                          }}
                          onFocus={(e) => { e.target.style.borderColor = isDupRoll ? '#ef4444' : '#94a3b8'; e.target.style.backgroundColor = isDupRoll ? '#fef2f2' : '#ffffff'; }}
                          onBlur={(e) => { e.target.style.borderColor = isDupRoll ? '#ef4444' : 'transparent'; e.target.style.backgroundColor = isDupRoll ? '#fef2f2' : 'transparent'; }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="text"
                          value={row.name}
                          placeholder="Student Name *"
                          onChange={(e) => handleCellChange(row.id, 'name', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid transparent',
                            backgroundColor: 'transparent',
                            fontWeight: '600',
                            color: '#0f172a',
                            fontSize: '12px'
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#94a3b8'; e.target.style.backgroundColor = '#ffffff'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="text"
                          value={row.parentName}
                          placeholder="Parent Name"
                          onChange={(e) => handleCellChange(row.id, 'parentName', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid transparent',
                            backgroundColor: 'transparent',
                            color: '#475569',
                            fontSize: '12px'
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#94a3b8'; e.target.style.backgroundColor = '#ffffff'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="text"
                          value={row.parentPhone}
                          placeholder="10-digit mobile"
                          onChange={(e) => handleCellChange(row.id, 'parentPhone', e.target.value.replace(/\D/g, ''))}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid transparent',
                            backgroundColor: 'transparent',
                            color: '#475569',
                            fontSize: '12px'
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#94a3b8'; e.target.style.backgroundColor = '#ffffff'; }}
                          onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.backgroundColor = 'transparent'; }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
                          title="Remove row"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Processing Spinner */}
        {isProcessing && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#eff6ff',
              color: 'var(--primary)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
            {progressText}
          </div>
        )}

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>
              Showing {displayedRows.length} of {parsedRows.length} total
            </span>
            {validCount > 0 && (
              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', fontSize: '11px' }}>
                ✓ {validCount} Ready to Import
              </span>
            )}
            {duplicateCount > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontSize: '11.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                Skip duplicates
              </label>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>
              Close
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecuteImport}
              disabled={isProcessing || validCount === 0}
              style={{
                backgroundColor: validCount > 0 ? '#107c41' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '700'
              }}
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Saving to Firebase...
                </>
              ) : validCount > 0 ? (
                <>
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  Import {validCount} Students into Firebase
                </>
              ) : (
                <>
                  <i className="fa-solid fa-circle-check"></i>
                  All Students Synced
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
