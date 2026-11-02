import React from 'react';
import {
  Shield,
  Lock,
  Cloud,
  Volume2,
  VolumeX,
  Sparkles,
  KeyRound,
  ShieldAlert,
  Puzzle,
} from 'lucide-react';
import { cyberAudio } from '../utils/cyberAudio';

interface HeaderProps {
  isLocked: boolean;
  onLockVault: () => void;
  onOpenGenerator: () => void;
  onOpenAudit: () => void;
  onOpenExtension: () => void;
  isFirebaseConnected: boolean;
  autoLockSeconds: number;
  overallScore: number;
  crtActive: boolean;
  onToggleCrt: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLocked,
  onLockVault,
  onOpenGenerator,
  onOpenAudit,
  onOpenExtension,
  isFirebaseConnected,
  autoLockSeconds,
  overallScore,
  crtActive,
  onToggleCrt,
  soundMuted,
  onToggleSound,
}) => {
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 28px',
        borderBottom: '1px solid rgba(14, 165, 233, 0.16)',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 20px rgba(14, 116, 144, 0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand & System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.28)',
            }}
          >
            <Shield size={20} color="#ffffff" />
          </div>
          <div>
            <div
              className="font-display"
              style={{
                fontSize: '17px',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
              }}
            >
              CIPHER//VAULT
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#0284c7',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              LIVING ANIME COASTAL VAULT
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div
          className="cyber-badge cyber-badge-green"
          style={{ display: 'none', md: 'inline-flex' } as React.CSSProperties}
        >
          <span className="pulse-dot" />
          <span>{isLocked ? 'VAULT LOCKED' : 'ONLINE & ENCRYPTED'}</span>
        </div>
      </div>

      {/* Middle Status Indicators (when unlocked) */}
      {!isLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Cloud Sync Status */}
          <div
            className="cyber-badge cyber-badge-cyan"
            title={isFirebaseConnected ? 'Firebase Cloud Sync Connected' : 'Running in Local Storage Mode'}
          >
            <Cloud size={13} />
            <span>{isFirebaseConnected ? 'CLOUD SYNCED' : 'OFFLINE MODE'}</span>
          </div>

          {/* Auto Lock Countdown */}
          <div
            className="cyber-badge cyber-badge-amber"
            title="Auto-locks upon inactivity to protect your vault in RAM"
          >
            <Lock size={12} />
            <span>AUTO-LOCK {formatTimer(autoLockSeconds)}</span>
          </div>

          {/* Security Score Badge */}
          <button
            onClick={() => {
              cyberAudio.playKeypress();
              onOpenAudit();
            }}
            className="cyber-badge"
            style={{
              background: overallScore >= 80 ? 'rgba(13, 148, 136, 0.1)' : 'rgba(217, 119, 6, 0.1)',
              color: overallScore >= 80 ? '#0f766e' : '#b45309',
              borderColor: overallScore >= 80 ? 'rgba(13, 148, 136, 0.25)' : 'rgba(217, 119, 6, 0.25)',
              cursor: 'pointer',
            }}
            title="Open Security Health Center"
          >
            <ShieldAlert size={13} />
            <span>HEALTH: {overallScore}%</span>
          </button>
        </div>
      )}

      {/* Right Action Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Generator Quick Access */}
        {!isLocked && (
          <button
            onClick={() => {
              cyberAudio.playKeypress();
              onOpenGenerator();
            }}
            className="cyber-btn cyber-btn-secondary"
            style={{ padding: '7px 13px', fontSize: '12.5px' }}
            title="Password & Passphrase Generator"
          >
            <KeyRound size={14} color="#0284c7" />
            <span style={{ display: 'none', sm: 'inline' } as React.CSSProperties}>GENERATOR</span>
          </button>
        )}

        {/* Extension Bridge */}
        <button
          onClick={() => {
            cyberAudio.playKeypress();
            onOpenExtension();
          }}
          className="cyber-btn cyber-btn-secondary"
          style={{ padding: '7px 12px', fontSize: '12.5px' }}
          title="Browser Extension Integration"
        >
          <Puzzle size={14} color="#0d9488" />
          <span style={{ display: 'none', sm: 'inline' } as React.CSSProperties}>EXTENSION</span>
        </button>

        {/* Subtle Sunlight Haze Toggle */}
        <button
          onClick={() => {
            cyberAudio.playKeypress();
            onToggleCrt();
          }}
          className="cyber-btn cyber-btn-secondary cyber-btn-icon"
          style={{
            borderColor: crtActive ? 'var(--anime-sky)' : 'var(--anime-border)',
            color: crtActive ? 'var(--anime-sky)' : 'var(--anime-text-dim)',
          }}
          title={crtActive ? 'Disable Sunlight Vignette' : 'Enable Sunlight Vignette'}
        >
          <Sparkles size={16} />
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => {
            cyberAudio.setMuted(!soundMuted);
            onToggleSound();
          }}
          className="cyber-btn cyber-btn-secondary cyber-btn-icon"
          title={soundMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} color="#0284c7" />}
        </button>

        {/* Lock Vault Button */}
        {!isLocked && (
          <button
            onClick={() => {
              cyberAudio.playLockSound();
              onLockVault();
            }}
            className="cyber-btn cyber-btn-danger"
            style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: '10px' }}
            title="Immediately locks vault and wipes master key from RAM"
          >
            <Lock size={14} />
            <span>LOCK</span>
          </button>
        )}
      </div>
    </header>
  );
};
