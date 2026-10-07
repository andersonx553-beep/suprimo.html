// App estática: usa os módulos oficiais hospedados pelo Firebase. A configuração web é pública;
// o acesso aos dados é protegido pelas regras de firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrl1ofZ-AykgqBgkv4SvaQ7_nadCDAJWk",
  authDomain: "suprimo-fb90d.firebaseapp.com",
  projectId: "suprimo-fb90d",
  storageBucket: "suprimo-fb90d.firebasestorage.app",
  messagingSenderId: "556484106092",
  appId: "1:556484106092:web:3dceca171bfa208b3dc549",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const firebase = { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider };
export const EMAIL_AUTORIZADO = "andersonx553@gmail.com";
