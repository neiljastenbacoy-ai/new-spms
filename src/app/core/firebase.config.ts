import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyA5m8W2KQ2cenQKmgw24r0JmdXvEDRTf7s',
  authDomain: 'spms-914c4.firebaseapp.com',
  projectId: 'spms-914c4',
  messagingSenderId: '931168210710',
  appId: '1:931168210710:web:d3558df842a528d54c0a37',
  measurementId: 'G-JLJK0B8SVD'
});

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
