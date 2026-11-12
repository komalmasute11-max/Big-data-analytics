
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserSessionPersistence,
} from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyCiU-AmoJ0WhuvtmQNEIL458S74oyHREfM",
  authDomain: "energy-consumption-india.firebaseapp.com",
  projectId: "energy-consumption-india",
  appId:" 1:790246055205:web:8f471dad66b4308a40cecc",
  messagingSenderId:" 790246055205"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
});
