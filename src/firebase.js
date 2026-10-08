import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDocs,
  doc,
  onSnapshot,
  query,
  writeBatch
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ==================== LIVE FIREBASE CONFIGURATION ====================
export const firebaseConfig = {
  apiKey: "AIzaSyA1EP6tc9Z7BSmdCFDNvwG1hxK-W1GNIoE",
  authDomain: "smartclass-3e828.firebaseapp.com",
  projectId: "smartclass-3e828",
  storageBucket: "smartclass-3e828.firebasestorage.app",
  messagingSenderId: "315485791146",
  appId: "1:315485791146:web:68257ef1f1ff327d4c01d3",
  measurementId: "G-E53GVH3JP3"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ==================== FIRESTORE REAL-TIME SERVICES ====================
export const firebaseService = {
  // Collection मधील डेटा real-time मध्ये मिळवण्यासाठी
  subscribeCollection: (collectionName, callback) => {
    try {
      const q = query(collection(db, collectionName));
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
      }, (error) => {
        console.warn(`Firestore read notice [${collectionName}]:`, error);
      });
    } catch (e) {
      console.warn(`Firestore connection notice [${collectionName}]:`, e);
      return () => {};
    }
  },

  // Test Live Firebase Connectivity
  testConnection: async () => {
    try {
      const testRef = await addDoc(collection(db, '_test_connection'), {
        timestamp: new Date().toISOString(),
        source: 'Web Admin Panel'
      });
      await deleteDoc(doc(db, '_test_connection', testRef.id));
      return { success: true, message: 'Connected to Firebase Project: smartclass-3e828' };
    } catch (e) {
      console.error("Firebase Test Error:", e);
      return { success: false, error: e.message || e.toString() };
    }
  },

  // Firestore मध्ये नवीन डेटा जोडण्यासाठी (Add)
  addDocument: async (collectionName, data) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (e) {
      console.error(`Firestore write error [${collectionName}]:`, e);
      throw e;
    }
  },

  // Firestore मधील डेटा अपडेट करण्यासाठी (Update)
  updateDocument: async (collectionName, docId, data) => {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Firestore update error [${collectionName} - ${docId}]:`, e);
      throw e;
    }
  },

  // Firestore मधील डेटा सेट/मर्ज करण्यासाठी (Set with merge)
  setDocument: async (collectionName, docId, data, merge = true) => {
    try {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge });
      return docId;
    } catch (e) {
      console.error(`Firestore setDoc error [${collectionName} - ${docId}]:`, e);
      throw e;
    }
  },

  // Firestore मधून एका विशिष्ट आयटमचा डेटा पूर्णपणे डिलीट करण्यासाठी (Delete Single Document)
  deleteDocument: async (collectionName, docId) => {
    try {
      await deleteDoc(doc(db, collectionName, docId));
    } catch (e) {
      console.error(`Firestore delete error [${docId}]:`, e);
      throw e;
    }
  },

  // Firestore मधून संपूर्ण कलेक्शन रिकामे (Wipe / Clear Collection) करण्यासाठी
  clearCollectionDocuments: async (collectionName) => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, collectionName, docSnap.id)));
      await Promise.all(deletePromises);
    } catch (e) {
      console.error(`Error clearing collection [${collectionName}]:`, e);
    }
  },

  // Exam आणि त्याचे सर्व संबंधित marks / exam_results Firestore मधून cascade delete करण्यासाठी
  deleteExamAndMarks: async (examId, examTitle) => {
    try {
      const batch = writeBatch(db);
      let marksDeletedCount = 0;

      // 1. Delete records from 'marks' collection linked to this exam
      const marksSnap = await getDocs(collection(db, 'marks'));
      marksSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const matchesExamId = data.examId === examId;
        const matchesExamTitle = examTitle && (data.examTitle === examTitle || data.examId === examTitle);
        const matchesDocId = docId.endsWith(`_${examId}`) || (examTitle && docId.endsWith(`_${examTitle}`));

        if (matchesExamId || matchesExamTitle || matchesDocId) {
          batch.delete(docSnap.ref);
          marksDeletedCount++;
        }
      });

      // 2. Delete records from 'exam_results' collection (Android app marks)
      try {
        const resultsSnap = await getDocs(collection(db, 'exam_results'));
        resultsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          const matchesExamId = data.examId === examId || docId.startsWith(`res_${examId}_`);

          if (matchesExamId) {
            batch.delete(docSnap.ref);
            marksDeletedCount++;
          }
        });
      } catch (err) {
        console.warn('Notice cleaning exam_results:', err);
      }

      // 3. Delete any exam announcement notice linked to this exam
      try {
        const noticeRef = doc(db, 'notices', `notice_exam_${examId}`);
        batch.delete(noticeRef);
      } catch (err) {}

      // 4. Delete the exam document itself
      const examRef = doc(db, 'exams', examId);
      batch.delete(examRef);

      await batch.commit();
      return { success: true, marksDeletedCount };
    } catch (e) {
      console.error(`Error deleting exam and marks [${examId}]:`, e);
      throw e;
    }
  }
};

export default app;
