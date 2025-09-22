import firestore from '@react-native-firebase/firestore';

// Use React Native Firebase which is already configured via google-services.json
const db = firestore();

// Helper to check if Firebase is available (for Expo Go compatibility)
const isFirebaseAvailable = () => {
  try {
    return db !== null && db !== undefined;
  } catch (error) {
    console.warn('Firebase not available (likely running in Expo Go):', error);
    return false;
  }
};

export { db, isFirebaseAvailable };
export default db;