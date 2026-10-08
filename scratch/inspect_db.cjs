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

async function inspectAll() {
  console.log('=== CLASSES ===');
  const classesSnap = await getDocs(collection(db, 'classes'));
  classesSnap.docs.forEach(d => console.log(d.id, d.data()));

  console.log('\n=== STUDENTS ===');
  const studentsSnap = await getDocs(collection(db, 'students'));
  studentsSnap.docs.forEach(d => console.log(d.id, d.data()));

  console.log('\n=== TEACHERS ===');
  const teachersSnap = await getDocs(collection(db, 'teachers'));
  teachersSnap.docs.forEach(d => console.log(d.id, d.data().name, d.data().assignedClassId, d.data().assignedClassIds));

  console.log('\n=== ATTENDANCE (sample 10) ===');
  const attSnap = await getDocs(collection(db, 'attendance'));
  console.log('Total attendance docs:', attSnap.docs.length);
  attSnap.docs.slice(0, 10).forEach(d => console.log(d.id, d.data()));

  process.exit(0);
}

inspectAll();
