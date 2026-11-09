# CIPHER//VAULT — Chrome & Brave Browser Extension (Manifest V3)

A zero-knowledge, client-side encrypted password manager, generator, and intelligent autofill assistant designed with an Anime Beach Sunset cybernetic aesthetic.

---

## 📁 Architecture Overview

```text
extension/
├── manifest.json              # Chrome Manifest V3 specification
├── popup.html                 # Extension popup HTML entrypoint
├── popup.css                  # Cybernetic Anime Beach Sunset popup styling
├── icons/                     # Icons (16x16, 32x32, 48x48, 128x128 PNGs)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── generate_icons.py     # Deterministic PNG icon generator
├── src/
│   ├── background.ts          # MV3 Service Worker (alarms, badges, auto-lock, tab router)
│   ├── content.ts             # Injected Content Script (DOM input detection, 1-click autofill)
│   ├── content.css            # Scoped injected styles for inline autofill badge
│   ├── popup.tsx              # React popup application (Matching, Vault, Generator, Add, Sync)
│   ├── crypto/
│   │   ├── extensionCrypto.ts # PBKDF2-SHA256 (120,000 iter) + AES-256-GCM Web Crypto
│   │   └── passwordGen.ts     # Cybernetic password/passphrase generator with entropy scoring
│   ├── services/
│   │   ├── extensionStorage.ts# chrome.storage.local persistence & session tracking
│   │   └── urlMatcher.ts      # Active tab domain parser & credential matcher
│   └── types/
│       └── extension.ts       # Shared TypeScript interfaces & message contracts
├── tsconfig.json              # Extension TypeScript configuration with @types/chrome
└── vite.config.ts             # Bundler compiling to ready-to-load `dist-extension/`
```

---

## 🔐 Zero-Knowledge Security Model

1. **Client-Side Only Decryption**:
   - Master cipher keys **never leave local browser memory**.
   - Derived using native Web Crypto API (`crypto.subtle`) via **PBKDF2-SHA256** with 120,000 iterations and a cryptographically secure 16-byte random salt.
   - Encrypted with **AES-256-GCM** using fresh 12-byte initialization vectors (IV) for every write operation.
2. **Independent Auth Verifier**:
   - Secondary derived PBKDF2 authentication hash verifies master cipher validity before decrypting any entries, preventing corrupted trial decryptions.
3. **Auto-Lock Security**:
   - Volatile decrypted credentials and session `CryptoKey` instances reside strictly in volatile memory.
   - Background alarms automatically purge decrypted data upon inactivity.

---

## 🚀 Development & Build Workflows

### 1. Build the Extension
Builds the extension into the `dist-extension/` directory ready for loading:
```bash
npm run build:extension
```

### 2. Live Watch Mode (Development)
Watches for changes in `extension/` and automatically re-bundles:
```bash
npm run dev:extension
```

### 3. Build Everything (Web App + Extension)
```bash
npm run build:all
```

---

## 🌐 Loading Unpacked into Chrome / Brave

1. Open **Chrome** or **Brave** and navigate to:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
2. Enable **Developer mode** (toggle in top right corner).
3. Click **Load unpacked**.
4. Select the **`dist-extension`** directory in this repository:
   `/Users/shriyanshchandra/Coding/Projects/Password Manager/dist-extension`
5. Pin **CIPHER//VAULT** to your browser toolbar!

---

## ⚡ Core Features

- **Domain-Aware Autofill**: Automatically identifies the active website and displays matching credentials. 1-click `[⚡ AUTOFILL]` instantly fills login forms.
- **Cybernetic Password Generator**: Generates high-entropy passwords, passphrases, and PINs with customizable rules and real-time entropy scoring.
- **Web App Synchronization**: Export encrypted backup JSON from the web app and import directly into the extension (or vice versa) without exposing cleartext credentials.
- **Active Tab Badge Indicator**: Shows the count of available credentials for the current website right on the toolbar icon.

