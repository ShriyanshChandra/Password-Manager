import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  UserPlus,
  LogIn,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BeachScene3D, type Beach3DState } from './BeachScene3D';
import { evaluatePasswordStrength } from '../crypto/passwordUtils';
import { cyberAudio } from '../utils/cyberAudio';

interface UnlockScreenProps {
  onSignIn: (email: string, masterPassword: string) => Promise<void>;
  onSignUp: (email: string, masterPassword: string, hint?: string) => Promise<void>;
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({ onSignIn, onSignUp }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [beach3DState, setBeach3DState] = useState<Beach3DState>('LOCKED');

  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      cyberAudio.playErrorSound();
      return;
    }

    if (!password) {
      setErrorMessage('Master password is required.');
      cyberAudio.playErrorSound();
      return;
    }

    if (authMode === 'signup') {
      if (password.length < 8) {
        setErrorMessage('Master password must be at least 8 characters.');
        cyberAudio.playErrorSound();
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        cyberAudio.playErrorSound();
        return;
      }
    }

    setIsLoading(true);
    setBeach3DState('UNLOCKING');

    try {
      if (authMode === 'signin') {
        await onSignIn(email.trim(), password);
      } else {
        await onSignUp(email.trim(), password, hint);
      }
      cyberAudio.playUnlockSound();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
      cyberAudio.playErrorSound();
      setBeach3DState('BREACH');
      setTimeout(() => setBeach3DState('LOCKED'), 1400);
      setIsLoading(false);
    }
  };

  const handleUseDemoKey = () => {
    setEmail('agent@beach.vault');
    setPassword('Sunset@2026!MasterKey');
    setConfirmPassword('Sunset@2026!MasterKey');
    cyberAudio.playKeypress();
  };

  const isBreach = beach3DState === 'BREACH';

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: 'calc(100vh - 65px)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ========================================================= */}
      {/* 1. FULL VIEWPORT ANIME BEACH SUNSET THREE.JS BACKGROUND    */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <BeachScene3D vaultState={beach3DState} />
      </div>

      {/* Warm radial vignette — keeps the center card readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(13, 5, 32, 0.45) 0%, rgba(13, 5, 32, 0.82) 75%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ========================================================= */}
      {/* 2. CENTERED GLASSMORPHIC AUTH CARD                         */}
      {/* ========================================================= */}
      <div
        className="cyber-card cyber-corners cyber-card-glow"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '480px',
          margin: '0 16px',
          padding: '36px',
          background: 'rgba(14, 7, 34, 0.86)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: `1px solid ${isBreach ? 'var(--cyber-red)' : 'var(--sunset-border)'}`,
          boxShadow: isBreach
            ? '0 0 40px var(--sunset-red-glow)'
            : '0 8px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(255, 184, 0, 0.1)',
        }}
      >
        {/* Top Status Tag */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 14px',
              background: isBreach ? 'var(--sunset-red-bg)' : 'var(--sunset-gold-bg)',
              border: `1px solid ${isBreach ? 'var(--cyber-red)' : 'var(--sunset-border)'}`,
              borderRadius: '20px',
              marginBottom: '14px',
            }}
          >
            <span className={isBreach ? 'pulse-dot-red' : 'pulse-dot'} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isBreach ? 'var(--cyber-red)' : 'var(--sunset-gold)',
                letterSpacing: '0.1em',
              }}
            >
              {isBreach
                ? 'ACCESS DENIED // BREACH DETECTED'
                : 'CIPHER CORE :: ZERO-KNOWLEDGE VAULT'}
            </span>
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: 'var(--sunset-text)',
              letterSpacing: '0.08em',
              marginBottom: '6px',
            }}
          >
            {authMode === 'signin' ? 'AUTHENTICATE ACCESS' : 'CREATE PRIVATE VAULT'}
          </h1>

          <p style={{ fontSize: '12px', color: 'var(--sunset-text-muted)' }}>
            {authMode === 'signin'
              ? 'Enter your credentials to unlock your client-encrypted vault.'
              : 'Register your account with AES-256-GCM zero-knowledge security.'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              cyberAudio.playKeypress();
              setAuthMode('signin');
              setErrorMessage('');
            }}
            className="cyber-btn"
            style={{
              background: authMode === 'signin'
                ? 'linear-gradient(135deg, var(--sunset-orange), var(--sunset-gold))'
                : 'rgba(255, 255, 255, 0.04)',
              color: authMode === 'signin' ? '#0d0520' : 'var(--sunset-text)',
              borderColor: authMode === 'signin' ? 'var(--sunset-gold)' : 'var(--sunset-border-dim)',
              padding: '8px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <LogIn size={14} />
            <span>SIGN IN</span>
          </button>

          <button
            type="button"
            onClick={() => {
              cyberAudio.playKeypress();
              setAuthMode('signup');
              setErrorMessage('');
            }}
            className="cyber-btn"
            style={{
              background: authMode === 'signup'
                ? 'linear-gradient(135deg, var(--sunset-orange), var(--sunset-gold))'
                : 'rgba(255, 255, 255, 0.04)',
              color: authMode === 'signup' ? '#0d0520' : 'var(--sunset-text)',
              borderColor: authMode === 'signup' ? 'var(--sunset-gold)' : 'var(--sunset-border-dim)',
              padding: '8px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <UserPlus size={14} />
            <span>REGISTER</span>
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              background: 'var(--sunset-red-bg)',
              border: '1px solid var(--cyber-red)',
              color: 'var(--cyber-red)',
              fontSize: '12px',
              borderRadius: '4px',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                color: 'var(--sunset-text-muted)',
                marginBottom: '6px',
                fontWeight: 600,
              }}
            >
              <Mail size={12} color="var(--sunset-gold)" />
              <span>EMAIL ADDRESS</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="cyber-input"
              required
              autoFocus
            />
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: 'var(--sunset-text-muted)',
                  fontWeight: 600,
                }}
              >
                <Lock size={12} color="var(--sunset-gold)" />
                <span>MASTER PASSWORD</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--sunset-text-dim)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'HIDE' : 'SHOW'}</span>
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter secret master key..."
                className="cyber-input"
                style={{ letterSpacing: showPassword ? 'normal' : '0.18em' }}
                required
              />
            </div>

            {/* Strength Meter (signup only) */}
            {authMode === 'signup' && password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span
                    style={{
                      color: strength.score >= 3
                        ? 'var(--sunset-gold)'
                        : strength.score >= 2
                        ? 'var(--sunset-orange)'
                        : 'var(--cyber-red)',
                    }}
                  >
                    Entropy: {strength.entropy} bits ({strength.label})
                  </span>
                  <span style={{ color: 'var(--sunset-text-dim)' }}>
                    Crack time: {strength.crackTimeDisplay}
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', display: 'flex', gap: '2px', borderRadius: '2px' }}>
                  {[0, 1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        borderRadius: '2px',
                        background:
                          step <= strength.score
                            ? strength.score >= 3
                              ? 'var(--sunset-gold)'
                              : strength.score >= 2
                              ? 'var(--sunset-orange)'
                              : 'var(--cyber-red)'
                            : 'transparent',
                        boxShadow: step <= strength.score ? '0 0 6px currentColor' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password (signup) */}
          {authMode === 'signup' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  color: 'var(--sunset-text-muted)',
                  marginBottom: '6px',
                  fontWeight: 600,
                }}
              >
                CONFIRM MASTER PASSWORD
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type master key..."
                className="cyber-input"
                style={{ letterSpacing: showPassword ? 'normal' : '0.18em' }}
                required
              />
            </div>
          )}

          {/* Optional Hint (signup) */}
          {authMode === 'signup' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  color: 'var(--sunset-text-muted)',
                  marginBottom: '6px',
                  fontWeight: 600,
                }}
              >
                OPTIONAL HINT (STORED LOCALLY)
              </label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="E.g., Favorite beach + year"
                className="cyber-input"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="cyber-btn cyber-btn-primary"
            style={{ padding: '13px', width: '100%', fontSize: '13.5px', marginTop: '6px' }}
          >
            {authMode === 'signin' ? <Unlock size={16} /> : <Lock size={16} />}
            <span>
              {isLoading
                ? 'AUTHENTICATING...'
                : authMode === 'signin'
                ? 'UNLOCK VAULT'
                : 'CREATE VAULT'}
            </span>
          </button>

          {/* Footer Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '12px',
              borderTop: '1px solid var(--sunset-border-dim)',
            }}
          >
            <button
              type="button"
              onClick={handleUseDemoKey}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--sunset-cyan)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Sparkles size={12} />
              <span>PREFILL DEMO CREDENTIALS</span>
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10.5px',
                color: 'var(--sunset-text-dim)',
              }}
            >
              <ShieldCheck size={12} color="var(--sunset-gold)" />
              <span>AES-256-GCM + FIRESTORE</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
