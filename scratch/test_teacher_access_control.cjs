const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE",
  authDomain: "smartclass-3e828.firebaseapp.com",
  projectId: "smartclass-3e828",
  storageBucket: "smartclass-3e828.firebasestorage.app",
  messagingSenderId: "315485791146",
  appId: "1:315485791146:web:68257ef1f1ff327d4c01d3",
  measurementId: "G-E53GVH3JP3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Logic mirroring flutter_code/main.dart exactly
function computeAllowedClassIds(isTeacher, teacherDoc, allClasses) {
  const allExistingClassIds = new Set(allClasses.map(c => c.id));
  if (!isTeacher) return allExistingClassIds;

  const teacherDocAssignedIds = new Set();
  if (teacherDoc) {
    const list = Array.isArray(teacherDoc.assignedClassIds) ? teacherDoc.assignedClassIds.map(String) : [];
    list.forEach(id => teacherDocAssignedIds.add(id));
    if (teacherDoc.assignedClassId) {
      teacherDocAssignedIds.add(String(teacherDoc.assignedClassId));
    }
  }

  const classTeacherAssignedIds = new Set(
    allClasses
      .filter(c => teacherDoc && (c.teacherId === teacherDoc.id || c.classTeacherId === teacherDoc.id))
      .map(c => c.id)
  );

  const combined = new Set([...teacherDocAssignedIds, ...classTeacherAssignedIds]);
  return new Set([...combined].filter(cid => allExistingClassIds.has(cid)));
}

function filterAttendanceStudents(isTeacher, allStudents, effectiveSelectedClassFilter, allowedClassIds) {
  if (isTeacher) {
    if (allowedClassIds.size === 0) return [];
    if (!allowedClassIds.has(effectiveSelectedClassFilter)) return [];
    return allStudents.filter(s => s.classId === effectiveSelectedClassFilter && allowedClassIds.has(s.classId));
  }
  if (effectiveSelectedClassFilter === 'all') return allStudents;
  return allStudents.filter(s => s.classId === effectiveSelectedClassFilter);
}

function verifyAttendancePermission(isTeacher, teacherDoc, studentDoc, effectiveSelectedClassFilter, allowedClassIds) {
  if (!isTeacher) return { allowed: true };
  const sClassId = studentDoc.classId;
  if (!sClassId || !allowedClassIds.has(sClassId) || sClassId !== effectiveSelectedClassFilter) {
    return { allowed: false, reason: 'Access Denied: You are only allowed to take attendance for your assigned class!' };
  }
  // Database check
  const rawIds = new Set(Array.isArray(teacherDoc.assignedClassIds) ? teacherDoc.assignedClassIds : []);
  if (teacherDoc.assignedClassId) rawIds.add(teacherDoc.assignedClassId);
  if (!rawIds.has(sClassId)) {
    return { allowed: false, reason: 'Permission Denied: Class is not assigned to you in database.' };
  }
  return { allowed: true };
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING TEACHER-TO-CLASS STRICT ACCESS CONTROL TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Define Mock Classes
  const mockClasses = [
    { id: 'cls_10A', name: '10', section: 'A' },
    { id: 'cls_10B', name: '10', section: 'B' },
    { id: 'cls_9A', name: '9', section: 'A' },
    { id: 'cls_9B', name: '9', section: 'B' },
  ];

  // Define Mock Students
  const mockStudents = [
    { id: 's1', name: 'Aarav (10-A)', rollNo: '101', classId: 'cls_10A', attendanceStatus: 'Not Marked' },
    { id: 's2', name: 'Ananya (10-A)', rollNo: '102', classId: 'cls_10A', attendanceStatus: 'Not Marked' },
    { id: 's3', name: 'Rohan (10-B)', rollNo: '101', classId: 'cls_10B', attendanceStatus: 'Not Marked' },
    { id: 's4', name: 'Pooja (9-A)', rollNo: '101', classId: 'cls_9A', attendanceStatus: 'Not Marked' },
  ];

  // ==========================================
  // Test 1: Teacher assigned to 10-A
  // ==========================================
  console.log('Test 1: Teacher Rahul Sir assigned to Class 10-A');
  let teacherDoc = {
    id: 't_rahul',
    name: 'Rahul Sir',
    assignedClassIds: ['cls_10A'],
    assignedClassId: 'cls_10A'
  };

  let allowed = computeAllowedClassIds(true, teacherDoc, mockClasses);
  assert(allowed.size === 1 && allowed.has('cls_10A'), 'Allowed classes contains ONLY 10-A');
  assert(!allowed.has('cls_10B'), '10-B is NOT in allowed classes');
  assert(!allowed.has('cls_9A'), '9-A is NOT in allowed classes');

  let students10A = filterAttendanceStudents(true, mockStudents, 'cls_10A', allowed);
  assert(students10A.length === 2 && students10A.every(s => s.classId === 'cls_10A'), 'Loads ONLY students of 10-A (Aarav, Ananya)');

  let check10A = verifyAttendancePermission(true, teacherDoc, mockStudents[0], 'cls_10A', allowed);
  assert(check10A.allowed === true, 'Rahul Sir CAN take attendance for 10-A student');

  let check10B = verifyAttendancePermission(true, teacherDoc, mockStudents[2], 'cls_10B', allowed);
  assert(check10B.allowed === false, 'Rahul Sir CANNOT take attendance for 10-B student');

  let check9A = verifyAttendancePermission(true, teacherDoc, mockStudents[3], 'cls_9A', allowed);
  assert(check9A.allowed === false, 'Rahul Sir CANNOT take attendance for 9-A student');

  // ==========================================
  // Test 2: Tamper Attempt (direct navigation / class change)
  // ==========================================
  console.log('\nTest 2: Tamper attempt - teacher tries to pass unauthorized classId');
  let tamperedStudents = filterAttendanceStudents(true, mockStudents, 'cls_10B', allowed);
  assert(tamperedStudents.length === 0, 'Tamper attempt to load 10-B returns empty student list');

  let tamperedPermCheck = verifyAttendancePermission(true, teacherDoc, mockStudents[2], 'cls_10B', allowed);
  assert(tamperedPermCheck.allowed === false, 'Tamper attempt to save 10-B attendance is blocked');

  // ==========================================
  // Test 3: Changing assignment from Web Admin (10-A -> 10-B)
  // ==========================================
  console.log('\nTest 3: Admin reassigns Rahul Sir to Class 10-B in Web Admin');
  teacherDoc = {
    id: 't_rahul',
    name: 'Rahul Sir',
    assignedClassIds: ['cls_10B'],
    assignedClassId: 'cls_10B'
  };

  allowed = computeAllowedClassIds(true, teacherDoc, mockClasses);
  assert(allowed.size === 1 && allowed.has('cls_10B'), 'Allowed classes updated dynamically to ONLY 10-B');
  assert(!allowed.has('cls_10A'), '10-A is no longer accessible');

  let students10B = filterAttendanceStudents(true, mockStudents, 'cls_10B', allowed);
  assert(students10B.length === 1 && students10B[0].name === 'Rohan (10-B)', 'Loads ONLY students of 10-B');

  let prev10AStudents = filterAttendanceStudents(true, mockStudents, 'cls_10A', allowed);
  assert(prev10AStudents.length === 0, 'Students of 10-A are no longer accessible to Rahul Sir');

  // ==========================================
  // Test 4: Removing teacher assignment completely
  // ==========================================
  console.log('\nTest 4: Admin removes teacher assignment (No class assigned)');
  teacherDoc = {
    id: 't_rahul',
    name: 'Rahul Sir',
    assignedClassIds: [],
    assignedClassId: null
  };

  allowed = computeAllowedClassIds(true, teacherDoc, mockClasses);
  assert(allowed.size === 0, 'Allowed classes is EMPTY');

  let unassignedStudents = filterAttendanceStudents(true, mockStudents, 'cls_10B', allowed);
  assert(unassignedStudents.length === 0, 'Zero students loaded when unassigned');

  // ==========================================
  // Test 5: Multiple assigned classes (e.g. 10-A and 9-B)
  // ==========================================
  console.log('\nTest 5: Admin assigns Rahul Sir to Multiple classes (10-A and 9-B)');
  teacherDoc = {
    id: 't_rahul',
    name: 'Rahul Sir',
    assignedClassIds: ['cls_10A', 'cls_9B'],
    assignedClassId: 'cls_10A'
  };

  allowed = computeAllowedClassIds(true, teacherDoc, mockClasses);
  assert(allowed.size === 2 && allowed.has('cls_10A') && allowed.has('cls_9B'), 'Allowed classes contains 10-A and 9-B');
  assert(!allowed.has('cls_10B'), '10-B is NOT in allowed classes');
  assert(!allowed.has('cls_9A'), '9-A is NOT in allowed classes');

  // ==========================================
  // Test 6: Live Firestore Connectivity & Schema Verification
  // ==========================================
  console.log('\nTest 6: Live Firestore Connection & Schema Verification');
  try {
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    const classesSnap = await getDocs(collection(db, 'classes'));
    const studentsSnap = await getDocs(collection(db, 'students'));
    const attendanceSnap = await getDocs(collection(db, 'attendance'));

    assert(true, `Successfully connected to Firestore smartclass-3e828`);
    console.log(`    Total Teachers in Firestore: ${teachersSnap.docs.length}`);
    console.log(`    Total Classes in Firestore: ${classesSnap.docs.length}`);
    console.log(`    Total Students in Firestore: ${studentsSnap.docs.length}`);
    console.log(`    Total Attendance in Firestore: ${attendanceSnap.docs.length}`);

    // Verify actual teachers from Firestore
    teachersSnap.docs.slice(0, 3).forEach(doc => {
      const d = doc.data();
      console.log(`    Teacher: ${d.name} (${d.phone}) -> assignedClassIds: ${JSON.stringify(d.assignedClassIds || d.assignedClassId || [])}`);
    });
  } catch (err) {
    console.error('Firestore connection error:', err);
    assert(false, `Firestore connection failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
