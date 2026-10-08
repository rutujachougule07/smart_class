const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

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

async function checkAttendance() {
  const snap = await getDocs(query(collection(db, 'attendance'), limit(20)));
  console.log(`Found ${snap.docs.length} attendance records:`);
  snap.docs.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}

checkAttendance();
