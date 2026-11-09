# AGENTS.md :: CIPHER//VAULT Agent Guidelines & Project Rules

This document outlines architectural mandates, security protocols, and operational workflows for all AI agents and developers working on the **CIPHER//VAULT** codebase.

---

## 1. Project Overview & Confidentiality
- **Purpose**: A personal, zero-knowledge password manager and credential management platform with a Web App (React + Vite + Three.js) and Browser Extension (Manifest V3).
- **Target Deployment**: Vercel (Production Web App) + Chrome/Brave Web Store (Extension).
- **Confidentiality**: This is a personal private project. Never expose, commit, or leak sensitive keys, credentials, or personal secrets in public repositories or logs.

---

## 2. Zero-Knowledge Cryptographic Architecture
1. **Client-Side Only Decryption**:
   - Master Passwords NEVER leave the client browser.
   - Master Key Derivation: Native Web Crypto API (`window.crypto.subtle`) using **PBKDF2-SHA256** with 120,000 iterations and a cryptographically random 16-byte salt.
   - Payload Encryption: **AES-256-GCM** authenticated cipher with a fresh 12-byte random IV for every save operation.
   - Separate Authentication Hash: A secondary derived PBKDF2 hash verifies master password validity without ever decrypting entries or sending the decryption key.
2. **Backend Storage**:
   - Firestore only ever stores ciphertext bundles:
     ```typescript
     {
       version: number;
       salt: string;       // Base64 (16 bytes)
       authHash: string;   // Base64 (32 bytes)
       iv: string;         // Base64 (12 bytes)
       ciphertext: string; // Base64 (AES-GCM encrypted JSON)
       hint?: string;      // Optional unencrypted user hint
       updatedAt: number;  // Epoch ms
       lastSyncedAt: number;
     }
     ```
   - Even if the Firebase database or Google Cloud project were inspected, stored data remains cryptographically impenetrable without the client's master key.

---

## 3. Firebase Backend Rules & Conventions
1. **Active Firebase Project**:
   - **Project ID**: `password-manager-3d385`
   - **Web App ID**: `1:17985720951:web:adf4277cf3b203d813ac72`
2. **Authentication**:
   - Email/Password Authentication is the primary auth provider.
   - Each user's vault is stored in Firestore under document path: `vaults/{userId}` where `userId == request.auth.uid`.
3. **Firestore Security Rules**:
   - Every read, create, update, and delete MUST strictly enforce `request.auth.uid == userId`.
   - Never allow public reads (`allow read: if true;` is strictly forbidden).
   - Validated schema constraints: Size limits on all fields, required fields checking, and no extraneous fields allowed.
4. **Firebase Agent Skills**:
   - Always consult and follow the installed Firebase agent skills located in `.agents/skills/`:
     - `firebase-basics`
     - `firebase-auth-basics`
     - `firebase-firestore`
     - `firestore-rules-creation`
     - `firebase-security-rules-auditor`
   - Always run Firebase CLI commands via `npx -y firebase-tools@latest <command>` (never raw `firebase`).

---

## 4. HTTPS, Network, and Vercel Deployment Directives
1. **HTTPS Only**:
   - All external communication MUST enforce TLS 1.3 / HTTPS.
   - Security headers configured in `vercel.json`:
     - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
2. **Build and Deployment**:
   - Build command: `npm run build` (`tsc -b && vite build`)
   - Output directory: `dist`
   - Zero console errors and zero TypeScript warnings before committing.

---

## 5. UI / UX & 3D Three.js Design System
- **Theme**: Apple Liquid Glass (2025 HIG / macOS Tahoe / iOS 26 / visionOS) — translucent physical optical glass materials with real-time refraction, dispersion, and specular lighting.
- **3D Scene** (`src/components/AppleLiquidGlass3D.tsx`):
  - Procedural physical liquid glass surface with real-time Snell's Law refraction and Index of Refraction (IOR 1.48 - 1.52).
  - Chromatic dispersion: physical separation of Red, Green, and Blue light wavelengths producing authentic spectral prism fringes along curved glass contours.
  - Geometry-responsive specular highlights & silhouette rim sheen: tracks user pointer with silky spring interpolation (`lerp`).
  - Apple Studio environment: Deep space titanium (`#0a0b10`) transitioning to subtle sapphire blue and celestial violet ambient caustic orbs.
  - State reactions: BREACH → crimson optical refraction warning, UNLOCKING → luminous iris blue resonance pulse.
- **Palette**:
  - Apple System Blue: `#0071e3`, hover `#0077ed`, active `#0062c4`
  - Apple System Indigo: `#5856d6`
  - Apple System Purple: `#af52de`
  - Apple System Green: `#34c759`
  - Apple System Orange: `#ff9500`
  - Apple System Red: `#ff3b30`
  - Primary Label: `#1d1d1f`
  - Secondary Label: `#6e6e73`
  - Tertiary Label: `#86868b`
  - Translucent Glass Surfaces: `rgba(255, 255, 255, 0.75)` with `backdrop-filter: blur(28px) saturate(190%) brightness(104%)`
  - Specular Highlights: `inset 0 1px 0 rgba(255, 255, 255, 0.85)`
- **Typography**: Apple San Francisco font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif`), with `SF Mono` / `JetBrains Mono` for cryptograms and hashes.
- **Feedback**: Synthesized Web Audio feedback, ambient optical lens vignette, real-time password strength estimators.

---

## 6. Core Agent Operational Rules
1. **DOM Access Directive**: Never use DOM until specified in the prompt.
