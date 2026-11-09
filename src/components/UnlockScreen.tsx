import React, { useState } from 'react';
import QRCode from 'qrcode';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Waves,
  Smartphone,
  Copy,
  Check,
  ArrowLeft,
  KeyRound,
  Puzzle,
} from 'lucide-react';
import { cyberAudio } from '../utils/cyberAudio';
import { firebaseService } from '../services/firebaseService';
import { vaultStorage } from '../services/vaultStorage';
import { deriveAuthHash } from '../crypto/encryption';
import {
  generateRandomBase32Secret,
  getTOTPUri,
  verifyTOTP,
} from '../crypto/passwordUtils';
import type { VaultItem, EncryptedVaultBundle } from '../types/vault';

type UnlockStep = 'credentials' | 'setup_2fa' | 'verify_2fa';

interface UnlockScreenProps {
  onUnlockSuccess: (masterKey: CryptoKey, bundle: EncryptedVaultBundle, items: VaultItem[]) => void;
  onSignIn?: (email: string, masterPassword: string) => Promise<void>;
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({
  onUnlockSuccess,
  onSignIn,
}) => {
  const [step, setStep] = useState<UnlockStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA TOTP state
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [showManualSecret, setShowManualSecret] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [activeBundle, setActiveBundle] = useState<EncryptedVaultBundle | null>(null);

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBreach, setIsBreach] = useState(false);
  const [isExtensionConnect] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('connect_extension') === 'true' || window.location.hash.includes('connect_extension');
  });

  // Helper to complete unlocking & notify parent
  const completeUnlockAndFinish = async (
    cleanEmail: string,
    pw: string,
    bundle: EncryptedVaultBundle | null
  ) => {
    let finalKey: CryptoKey;
    let finalBundle: EncryptedVaultBundle;
    let finalItems: VaultItem[];

    if (!bundle) {
      // First sign-in for this user, initialize vault with empty items
      const initResult = await vaultStorage.initializeVault(pw, undefined, false);
      finalKey = initResult.masterKey;
      finalBundle = initResult.bundle;
      finalItems = initResult.items;
    } else {
      // Unlock with Master Password
      const unlocked = await vaultStorage.unlockVault(pw);
      finalKey = unlocked.masterKey;
      finalBundle = unlocked.bundle;
      // Fetch per-account cloud credentials
      const cloudItems = await firebaseService.fetchAccountCredentials(finalKey);
      finalItems = cloudItems.length > 0 ? cloudItems : unlocked.items;
    }

    // Record login in Firestore
    await firebaseService.recordUserLogin(finalBundle.authHash, finalBundle.salt);
    cyberAudio.playUnlockSound();

    if (onUnlockSuccess) {
      onUnlockSuccess(finalKey, finalBundle, finalItems);
    } else if (onSignIn) {
      await onSignIn(cleanEmail, pw);
    }
  };

  // 1. Submit Email & Master Password
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Email address is required.');
      cyberAudio.playErrorSound();
      return;
    }

    if (!password) {
      setErrorMessage('Master password is required.');
      cyberAudio.playErrorSound();
      return;
    }

    setIsLoading(true);

    try {
      // Authenticate with Firebase Email/Password
      const user = await firebaseService.signInWithEmail(cleanEmail, password);

      // Fetch existing vault bundle (cloud or local fallback)
      let bundle = await firebaseService.fetchFromCloud();
      if (!bundle) {
        bundle = await vaultStorage.getBundle();
      }

      // If a vault bundle already exists, verify authHash against master password
      if (bundle) {
        const hash120k = await deriveAuthHash(password, bundle.salt, 120_000);
        let validPassword = hash120k === bundle.authHash;
        if (!validPassword) {
          const hash20k = await deriveAuthHash(password, bundle.salt, 20_000);
          validPassword = hash20k === bundle.authHash;
        }

        if (!validPassword) {
          await firebaseService.signOutUser();
          throw new Error('ACCESS DENIED: Master password incorrect.');
        }
      }

      setActiveBundle(bundle);

      // Check user 2FA configuration in Firestore
      const profile = await firebaseService.getUserProfile(user.uid);

      if (profile?.totpEnabled && profile?.totpSecret) {
        // Returning user with 2FA already configured -> Prompt for 6-digit code
        setTotpSecret(profile.totpSecret);
        setStep('verify_2fa');
        setTotpCode('');
        setIsLoading(false);
      } else {
        // First-time login (or 2FA not enabled) -> Show QR Code setup
        const newSecret = generateRandomBase32Secret(20);
        const otpUri = getTOTPUri(cleanEmail, newSecret);
        const qrUrl = await QRCode.toDataURL(otpUri, {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });

        setTotpSecret(newSecret);
        setQrCodeDataUrl(qrUrl);
        setStep('setup_2fa');
        setTotpCode('');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
      cyberAudio.playErrorSound();
      setIsBreach(true);
      setTimeout(() => setIsBreach(false), 2000);
      setIsLoading(false);
    }
  };

  // 2. Verify Initial 2FA Setup
  const verifySetupCode = async (codeToVerify: string) => {
    setErrorMessage('');
    const cleanCode = codeToVerify.trim();

    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit code.');
      cyberAudio.playErrorSound();
      return;
    }

    setIsLoading(true);

    try {
      const isValid = await verifyTOTP(totpSecret, cleanCode);
      if (!isValid) {
        throw new Error('Invalid 6-digit code. Please verify the code displayed in your authenticator app.');
      }

      // Save 2FA to Firestore
      await firebaseService.saveUser2FA(totpSecret);

      // Complete vault unlock
      await completeUnlockAndFinish(email.trim(), password, activeBundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setErrorMessage(msg);
      cyberAudio.playErrorSound();
      setIsBreach(true);
      setTimeout(() => setIsBreach(false), 2000);
      setIsLoading(false);
      setTotpCode('');
    }
  };

  // 3. Verify Returning 2FA Code
  const verifyReturningCode = async (codeToVerify: string) => {
    setErrorMessage('');
    const cleanCode = codeToVerify.trim();

    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit code.');
      cyberAudio.playErrorSound();
      return;
    }

    setIsLoading(true);

    try {
      const isValid = await verifyTOTP(totpSecret, cleanCode);
      if (!isValid) {
        throw new Error('Invalid verification code. Please check your authenticator app.');
      }

      // Complete vault unlock
      await completeUnlockAndFinish(email.trim(), password, activeBundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setErrorMessage(msg);
      cyberAudio.playErrorSound();
      setIsBreach(true);
      setTimeout(() => setIsBreach(false), 2000);
      setIsLoading(false);
      setTotpCode('');
    }
  };

  // Cancel & Sign Out back to credentials
  const handleBackToLogin = async () => {
    try {
      await firebaseService.signOutUser();
    } catch {
      // Ignored
    }
    setStep('credentials');
    setTotpCode('');
    setTotpSecret('');
    setQrCodeDataUrl('');
    setErrorMessage('');
    setIsLoading(false);
    setIsBreach(false);
  };

  // Copy Base32 Secret to Clipboard
  const handleCopySecret = async () => {
    if (!totpSecret) return;
    try {
      await navigator.clipboard.writeText(totpSecret);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'calc(100vh - 65px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      {/* Centered Apple Liquid Glass Card */}
      <div
        className="cyber-card"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: step === 'setup_2fa' ? '460px' : '430px',
          padding: '36px 30px',
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(32px) saturate(190%) brightness(104%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%) brightness(104%)',
          border: `1px solid ${isBreach ? 'rgba(255, 59, 48, 0.5)' : 'rgba(255, 255, 255, 0.75)'}`,
          boxShadow: isBreach
            ? '0 16px 40px rgba(255, 59, 48, 0.25)'
            : '0 24px 60px -8px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          borderRadius: '24px',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Extension Connection Request Banner */}
        {isExtensionConnect && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              background: 'rgba(255, 184, 0, 0.12)',
              border: '1px solid rgba(255, 184, 0, 0.45)',
              color: '#92400e',
              fontSize: '12px',
              borderRadius: '12px',
              boxShadow: '0 4px 14px rgba(255, 184, 0, 0.12)',
            }}
          >
            <Puzzle size={18} style={{ flexShrink: 0, color: '#d97706' }} />
            <div>
              <strong style={{ display: 'block', color: '#b45309', fontSize: '12.5px' }}>
                BROWSER EXTENSION PAIRING REQUEST
              </strong>
              Sign in below to unlock and link your vault credentials directly with the extension.
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              background: 'rgba(254, 242, 242, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#b91c1c',
              fontSize: '12.5px',
              borderRadius: '12px',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── STEP 1: CREDENTIALS (EMAIL + MASTER PASSWORD) ── */}
        {step === 'credentials' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              {/* Pill Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px',
                  background: isBreach ? 'rgba(255, 59, 48, 0.12)' : 'rgba(0, 113, 227, 0.10)',
                  border: `1px solid ${isBreach ? 'rgba(255, 59, 48, 0.3)' : 'rgba(0, 113, 227, 0.25)'}`,
                  borderRadius: '9999px',
                  marginBottom: '16px',
                }}
              >
                <ShieldCheck size={13} color={isBreach ? '#ff3b30' : '#0071e3'} />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: isBreach ? '#ff3b30' : '#0071e3',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {isBreach ? 'Access Denied' : 'Apple Liquid Glass // Zero-Knowledge'}
                </span>
              </div>

              <h1
                className="font-display"
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  color: '#1d1d1f',
                  letterSpacing: '-0.025em',
                  marginBottom: '8px',
                  lineHeight: 1.2,
                }}
              >
                Welcome Back
              </h1>

              <p style={{ fontSize: '13.5px', color: '#6e6e73', lineHeight: 1.5 }}>
                Sign in with your email and master password to unlock your personal credentials.
              </p>
            </div>

            <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Email */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#334155',
                    marginBottom: '7px',
                    fontWeight: 600,
                  }}
                >
                  <Mail size={13} color="#0071e3" />
                  <span>EMAIL ADDRESS</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="cyber-input"
                  required
                  autoFocus
                />
              </div>

              {/* Master Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#334155',
                      fontWeight: 600,
                    }}
                  >
                    <Lock size={13} color="#0071e3" />
                    <span>MASTER PASSWORD</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0071e3',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your master password"
                  className="cyber-input font-mono"
                  style={{ letterSpacing: showPassword ? 'normal' : '0.18em' }}
                  required
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="cyber-btn cyber-btn-primary"
                style={{
                  padding: '13px',
                  width: '100%',
                  fontSize: '14px',
                  marginTop: '6px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? <Lock size={16} /> : <Unlock size={16} />}
                <span>{isLoading ? 'Verifying Credentials...' : 'Unlock Vault'}</span>
              </button>

              {/* Footnote */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  paddingTop: '10px',
                  fontSize: '11.5px',
                  color: '#64748b',
                }}
              >
                <ShieldCheck size={14} color="#0d9488" />
                <span>End-to-end client encryption • PBKDF2 + AES-256-GCM</span>
              </div>
            </form>
          </>
        )}

        {/* ── STEP 2: FIRST-TIME 2FA SETUP (QR CODE) ── */}
        {step === 'setup_2fa' && (
          <div>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px',
                  background: 'rgba(2, 132, 199, 0.1)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  borderRadius: '9999px',
                  marginBottom: '12px',
                }}
              >
                <Smartphone size={13} color="#0071e3" />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#0071e3',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Authenticator Setup
                </span>
              </div>

              <h2
                className="font-display"
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  marginBottom: '6px',
                  lineHeight: 1.2,
                }}
              >
                Link Authenticator App
              </h2>

              <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
                Scan this QR code with Google Authenticator, Authy, Apple Passwords, or Microsoft Authenticator.
              </p>
            </div>

            {/* QR Code Container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: 'rgba(248, 250, 252, 0.9)',
                borderRadius: '16px',
                border: '1px solid rgba(226, 232, 240, 0.95)',
                marginBottom: '18px',
              }}
            >
              {qrCodeDataUrl ? (
                <div
                  style={{
                    padding: '10px',
                    background: '#ffffff',
                    borderRadius: '14px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(2, 132, 199, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={qrCodeDataUrl}
                    alt="Authenticator QR Code"
                    style={{ width: '180px', height: '180px', display: 'block', borderRadius: '6px' }}
                  />
                </div>
              ) : (
                <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Generating QR Code...</span>
                </div>
              )}

              {/* Title & Issuer Notice */}
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    background: 'rgba(2, 132, 199, 0.08)',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    color: '#0369a1',
                  }}
                >
                  <span>Title:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>code vault:password manager</span>
                </div>
              </div>

              {/* Manual Secret Key Toggle */}
              <div style={{ width: '100%', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowManualSecret(!showManualSecret)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0071e3',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {showManualSecret ? 'Hide manual secret' : "Can't scan QR code? View key"}
                </button>

                {showManualSecret && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1px dashed rgba(2, 132, 199, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '11.5px',
                        color: '#0f172a',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        wordBreak: 'break-all',
                      }}
                    >
                      {totpSecret}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="cyber-btn"
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                    >
                      {isCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation 6-digit Code Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifySetupCode(totpCode);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    color: '#334155',
                    marginBottom: '7px',
                    fontWeight: 600,
                  }}
                >
                  <KeyRound size={13} color="#0071e3" />
                  <span>ENTER 6-DIGIT CODE TO ACTIVATE</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTotpCode(val);
                    if (val.length === 6) {
                      verifySetupCode(val);
                    }
                  }}
                  placeholder="000000"
                  className="cyber-input font-mono"
                  style={{
                    textAlign: 'center',
                    fontSize: '22px',
                    letterSpacing: '0.35em',
                    fontWeight: 700,
                    padding: '12px',
                    borderRadius: '12px',
                  }}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || totpCode.length !== 6}
                className="cyber-btn cyber-btn-primary"
                style={{
                  padding: '12px',
                  width: '100%',
                  fontSize: '13.5px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isLoading ? 'Activating 2FA...' : 'Verify & Activate 2FA'}</span>
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  marginTop: '2px',
                }}
              >
                <ArrowLeft size={13} />
                <span>Back to Login</span>
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 3: RETURNING 2FA VERIFICATION ── */}
        {step === 'verify_2fa' && (
          <div>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px',
                  background: 'rgba(2, 132, 199, 0.1)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  borderRadius: '9999px',
                  marginBottom: '16px',
                }}
              >
                <ShieldCheck size={13} color="#0071e3" />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#0071e3',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Two-Factor Authentication
                </span>
              </div>

              <h2
                className="font-display"
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  marginBottom: '8px',
                  lineHeight: 1.2,
                }}
              >
                Enter Authenticator Code
              </h2>

              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Open your authenticator app for{' '}
                <strong style={{ color: '#0f172a' }}>code vault:password manager</strong> and enter the 6-digit code.
              </p>
            </div>

            {/* 6-digit Code Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyReturningCode(totpCode);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#334155',
                    marginBottom: '10px',
                    fontWeight: 600,
                  }}
                >
                  <KeyRound size={13} color="#0071e3" />
                  <span>6-DIGIT VERIFICATION CODE</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTotpCode(val);
                    if (val.length === 6) {
                      verifyReturningCode(val);
                    }
                  }}
                  placeholder="000 000"
                  className="cyber-input font-mono"
                  style={{
                    textAlign: 'center',
                    fontSize: '26px',
                    letterSpacing: '0.4em',
                    fontWeight: 800,
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid rgba(2, 132, 199, 0.35)',
                  }}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || totpCode.length !== 6}
                className="cyber-btn cyber-btn-primary"
                style={{
                  padding: '13px',
                  width: '100%',
                  fontSize: '14px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? <Lock size={16} /> : <Unlock size={16} />}
                <span>{isLoading ? 'Verifying Code...' : 'Verify & Unlock Vault'}</span>
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  marginTop: '4px',
                }}
              >
                <ArrowLeft size={13} />
                <span>Back to Login</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
