const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

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

async function checkProfile() {
  const profileSnap = await getDoc(doc(db, 'system_settings', 'school_profile'));
  if (profileSnap.exists()) {
    console.log("school_profile:", profileSnap.data());
  } else {
    console.log("No system_settings/school_profile");
  }

  const profileSnap2 = await getDoc(doc(db, 'system_settings', 'profile'));
  if (profileSnap2.exists()) {
    console.log("profile:", profileSnap2.data());
  }

  const classesSnap = await getDocs(collection(db, 'classes'));
  console.log("Classes in Firestore:");
  classesSnap.docs.forEach(d => console.log(d.id, d.data()));

  process.exit(0);
}

checkProfile();
