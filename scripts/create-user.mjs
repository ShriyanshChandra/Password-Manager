import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Read .env file directly without external dependencies
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf-8');
    const env = {};
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    }
    return env;
  } catch (err) {
    console.error('Could not load .env file:', err.message);
    process.exit(1);
  }
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.log(`
Usage:
  node scripts/create-user.mjs <email> <master-password>

Example:
  node scripts/create-user.mjs me@example.com MySecretKey123!
`);
  process.exit(1);
}

if (password.length < 8) {
  console.error('Error: Master password must be at least 8 characters.');
  process.exit(1);
}

console.log(`Creating user ${email} in Firebase Authentication...`);

createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    console.log(`\n User created successfully!`);
    console.log(`   UID:   ${userCredential.user.uid}`);
    console.log(`   Email: ${userCredential.user.email}`);
    console.log(`\nYou can now sign in at http://localhost:5174/ using this email and password.\n`);
    process.exit(0);
  })
  .catch((error) => {
    if (error.code === 'auth/email-already-in-use') {
      console.error(`\nNotice: User "${email}" already exists in Firebase.`);
      console.log(`If you want to reset their password, visit the Firebase Console at:`);
      console.log(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users\n`);
    } else {
      console.error(`\nFirebase Error [${error.code}]:`, error.message);
    }
    process.exit(1);
  });

