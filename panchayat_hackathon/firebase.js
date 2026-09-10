// Replace the values below with your Firebase Web App configuration.
// Firebase Console -> Project settings -> Your apps -> Web app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLEvFLipdfbyri1tuoMXe01W1LIdubjbk",
  authDomain: "panchayat-b4b7b.firebaseapp.com",
  projectId: "panchayat-b4b7b",
  storageBucket: "panchayat-b4b7b.firebasestorage.app",
  messagingSenderId: "581310790684",
  appId: "1:581310790684:web:2cb1bd217de8239d2373d9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
