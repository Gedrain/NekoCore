const SUPER_ADMIN = "Your Super Admin Email";

const CFG = {
    fb: {
  apiKey: "Your API Key",
  authDomain: "Your Auth Domain",
  databaseURL: "Your Database URL",
  projectId: "Your Project ID",
  storageBucket: "Your Storage Bucket",
  messagingSenderId: "Your Messaging Sender ID",
  appId: "Your App ID",
  measurementId: "Your Measurement ID"

    }
};

firebase.initializeApp(CFG.fb);
const db = firebase.database();
const auth = firebase.auth();