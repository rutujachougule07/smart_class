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

async function checkStudents() {
  const snap = await getDocs(collection(db, 'students'));
  console.log(`Found ${snap.docs.length} students in Firestore:`);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log({
      id: d.id,
      name: data.name,
      rollNo: data.rollNo,
      classId: data.classId,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      phone: data.phone,
      contact: data.contact,
      mobile: data.mobile,
      attendanceStatus: data.attendanceStatus,
      attendanceDate: data.attendanceDate
    });
  });
  process.exit(0);
}

checkStudents();
