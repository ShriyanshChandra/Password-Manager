import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Waves,
} from 'lucide-react';
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
  const [isBreach, setIsBreach] = useState(false);

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

    try {
      await onSignIn(email.trim(), password);
      cyberAudio.playUnlockSound();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
      cyberAudio.playErrorSound();
      setIsBreach(true);
      setTimeout(() => setIsBreach(false), 2000);
      setIsLoading(false);
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
      {/* Centered Glassmorphic Anime Card */}
      <div
        className="cyber-card"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '430px',
          padding: '38px 32px',
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${isBreach ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.95)'}`,
          boxShadow: isBreach
            ? '0 16px 40px rgba(239, 68, 68, 0.25)'
            : '0 20px 50px rgba(14, 116, 144, 0.16), 0 4px 16px rgba(0, 0, 0, 0.04)',
          borderRadius: '20px',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Card Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* Pill Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              background: isBreach ? 'rgba(239, 68, 68, 0.1)' : 'rgba(2, 132, 199, 0.1)',
              border: `1px solid ${isBreach ? 'rgba(239, 68, 68, 0.3)' : 'rgba(2, 132, 199, 0.25)'}`,
              borderRadius: '9999px',
              marginBottom: '16px',
            }}
          >
            <Waves size={13} color={isBreach ? '#ef4444' : '#0284c7'} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isBreach ? '#ef4444' : '#0284c7',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {isBreach ? 'Access Denied' : 'Zero-Knowledge Coastal Vault'}
            </span>
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              marginBottom: '8px',
              lineHeight: 1.2,
            }}
          >
            Welcome Back
          </h1>

          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Sign in with your email and master password to unlock your personal credentials.
          </p>
        </div>

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

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email Textbox */}
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
              <Mail size={13} color="#0284c7" />
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

          {/* Master Password Textbox */}
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
                <Lock size={13} color="#0284c7" />
                <span>MASTER PASSWORD</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
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

          {/* Submit Button */}
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
            <span>{isLoading ? 'Decrypting Vault...' : 'Unlock Vault'}</span>
          </button>

          {/* Security Footnote */}
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
      </div>
    </div>
  );
};
