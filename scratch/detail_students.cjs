const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function detailCheck() {
  const classesSnap = await getDocs(collection(db, 'classes'));
  const classes = {};
  classesSnap.docs.forEach(d => {
    classes[d.id] = { id: d.id, ...d.data() };
  });

  const studentsSnap = await getDocs(collection(db, 'students'));
  console.log(`TOTAL STUDENTS IN FIRESTORE: ${studentsSnap.docs.length}\n`);

  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Group students by classId
  const byClass = {};
  students.forEach(s => {
    const cId = s.classId || 'unassigned';
    if (!byClass[cId]) byClass[cId] = [];
    byClass[cId].push(s);
  });

  for (const [cId, list] of Object.entries(byClass)) {
    const cls = classes[cId];
    const clsName = cls ? `Class ${cls.name} - ${cls.section || '-'}` : `UNKNOWN CLASS (${cId})`;
    console.log(`=== ${clsName} (ID: ${cId}) -> ${list.length} Students ===`);
    list.forEach(s => {
      console.log(`  - [ID: ${s.id}] Roll: "${s.rollNo}" | Name: "${s.name}" | Parent: "${s.parentName}" | Phone: "${s.parentPhone}" | Created: ${s.createdAt || 'N/A'}`);
    });
    console.log('');
  }

  process.exit(0);
}

detailCheck();
