const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs, query, limit } = require('firebase/firestore');

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

async function checkWebhooks() {
  try {
    console.log("Checking system_settings/webhooks...");
    const snap = await getDoc(doc(db, 'system_settings', 'webhooks'));
    if (snap.exists()) {
      console.log("Webhooks config in Firestore:", JSON.stringify(snap.data(), null, 2));
    } else {
      console.log("No webhooks doc found in Firestore!");
    }

    console.log("\nChecking webhook_logs...");
    try {
      const logsSnap = await getDocs(query(collection(db, 'webhook_logs'), limit(10)));
      console.log(`Found ${logsSnap.docs.length} logs in webhook_logs`);
      logsSnap.forEach(d => console.log(d.id, JSON.stringify(d.data(), null, 2)));
    } catch (e) {
      console.log("Error querying logs:", e.message);
    }
  } catch (err) {
    console.error("Firestore error:", err);
  }
  process.exit(0);
}

checkWebhooks();
