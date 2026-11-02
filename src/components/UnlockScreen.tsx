import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { BeachScene3D, type Beach3DState } from './BeachScene3D';
import { cyberAudio } from '../utils/cyberAudio';

interface UnlockScreenProps {
  onSignIn: (email: string, masterPassword: string) => Promise<void>;
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [beach3DState, setBeach3DState] = useState<Beach3DState>('LOCKED');

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

    setIsLoading(true);
    setBeach3DState('UNLOCKING');

    try {
      await onSignIn(email.trim(), password);
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

      {/* Warm radial vignette overlay */}
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
      {/* 2. CENTERED AUTHENTICATION CARD                            */}
      {/* ========================================================= */}
      <div
        className="cyber-card cyber-corners cyber-card-glow"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '440px',
          margin: '0 16px',
          padding: '36px',
          background: 'rgba(14, 7, 34, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${isBreach ? 'var(--cyber-red)' : 'var(--sunset-border)'}`,
          boxShadow: isBreach
            ? '0 0 40px var(--sunset-red-glow)'
            : '0 8px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(255, 184, 0, 0.1)',
        }}
      >
        {/* Header */}
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
              {isBreach ? 'ACCESS DENIED' : 'ZERO-KNOWLEDGE VAULT'}
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
            SIGN IN
          </h1>

          <p style={{ fontSize: '12.5px', color: 'var(--sunset-text-muted)' }}>
            Enter your email and master password to unlock your vault.
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              marginBottom: '18px',
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

        {/* Auth Form: Only Email and Password */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email Textbox */}
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
              placeholder="Enter your email"
              className="cyber-input"
              required
              autoFocus
            />
          </div>

          {/* Master Password Textbox */}
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

            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your master password"
              className="cyber-input"
              style={{ letterSpacing: showPassword ? 'normal' : '0.18em' }}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="cyber-btn cyber-btn-primary"
            style={{ padding: '13px', width: '100%', fontSize: '13.5px', marginTop: '4px' }}
          >
            {isLoading ? <Lock size={16} /> : <Unlock size={16} />}
            <span>{isLoading ? 'AUTHENTICATING...' : 'SIGN IN & UNLOCK'}</span>
          </button>

          {/* Security footnote */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              paddingTop: '8px',
              fontSize: '11px',
              color: 'var(--sunset-text-dim)',
            }}
          >
            <ShieldCheck size={13} color="var(--sunset-gold)" />
            <span>End-to-end client decrypted • AES-256-GCM</span>
          </div>
        </form>
      </div>
    </div>
  );
};
