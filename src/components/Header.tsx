import React from 'react';
import {
  Shield,
  Lock,
  Cloud,
  Volume2,
  VolumeX,
  Tv,
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
        padding: '12px 24px',
        borderBottom: '1px solid var(--sunset-border)',
        background: 'rgba(13, 5, 32, 0.92)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand & System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--sunset-gold)',
              background: 'var(--sunset-gold-bg)',
              boxShadow: '0 0 12px var(--sunset-gold-glow)',
            }}
          >
            <Shield size={20} color="var(--sunset-gold)" />
          </div>
          <div>
            <div
              className="font-display glitch-hover"
              style={{
                fontSize: '16px',
                fontWeight: 900,
                color: 'var(--sunset-gold)',
                letterSpacing: '0.12em',
                lineHeight: 1.2,
              }}
            >
              CIPHER//VAULT
            </div>
            <div
              style={{
                fontSize: '10.5px',
                color: 'var(--cyber-text-muted)',
                letterSpacing: '0.08em',
              }}
            >
              ZERO-KNOWLEDGE :: BEACH VAULT
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div
          className="cyber-badge cyber-badge-green"
          style={{ display: 'none', md: 'inline-flex' } as React.CSSProperties}
        >
          <span className="pulse-dot" />
          <span>{isLocked ? 'ENCRYPTED' : 'ARMED & ACTIVE'}</span>
        </div>
      </div>

      {/* Middle Status Indicators (when unlocked) */}
      {!isLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Cloud Sync Status */}
          <div
            className="cyber-badge"
            style={{
              background: isFirebaseConnected ? 'var(--cyber-cyan-bg)' : 'rgba(255, 255, 255, 0.05)',
              color: isFirebaseConnected ? 'var(--cyber-cyan)' : 'var(--cyber-text-muted)',
              borderColor: isFirebaseConnected ? 'var(--cyber-cyan)' : 'var(--cyber-border-dim)',
            }}
            title={isFirebaseConnected ? 'Firebase Cloud Sync Connected' : 'Running in Local Storage Mode'}
          >
            <Cloud size={13} />
            <span>{isFirebaseConnected ? 'CLOUD: SYNCED' : 'LOCAL: OFFLINE'}</span>
          </div>

          {/* Auto Lock Countdown */}
          <div
            className="cyber-badge cyber-badge-amber"
            title="Auto-locks upon inactivity to protect your vault in RAM"
          >
            <Lock size={12} />
            <span>LOCK IN {formatTimer(autoLockSeconds)}</span>
          </div>

          {/* Security Score Badge */}
          <button
            onClick={() => {
              cyberAudio.playKeypress();
              onOpenAudit();
            }}
            className="cyber-badge"
            style={{
              background: overallScore >= 80 ? 'var(--cyber-green-bg)' : 'var(--cyber-amber-bg)',
              color: overallScore >= 80 ? 'var(--cyber-green)' : 'var(--cyber-amber)',
              borderColor: overallScore >= 80 ? 'var(--cyber-green)' : 'var(--cyber-amber)',
              cursor: 'pointer',
            }}
            title="Open Security Health Center"
          >
            <ShieldAlert size={13} />
            <span>AUDIT: {overallScore}%</span>
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
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Password & Passphrase Generator"
          >
            <KeyRound size={14} color="var(--cyber-green)" />
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
          style={{ padding: '6px 10px', fontSize: '12px' }}
          title="Browser Extension Integration"
        >
          <Puzzle size={14} color="var(--cyber-cyan)" />
          <span style={{ display: 'none', sm: 'inline' } as React.CSSProperties}>EXTENSION</span>
        </button>

        {/* CRT Scanline Toggle */}
        <button
          onClick={() => {
            cyberAudio.playKeypress();
            onToggleCrt();
          }}
          className="cyber-btn cyber-btn-secondary cyber-btn-icon"
          style={{
            borderColor: crtActive ? 'var(--cyber-green)' : 'rgba(255,255,255,0.15)',
            color: crtActive ? 'var(--cyber-green)' : 'var(--cyber-text-muted)',
          }}
          title={crtActive ? 'Disable CRT Scanlines' : 'Enable CRT Scanlines'}
        >
          <Tv size={15} />
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => {
            cyberAudio.setMuted(!soundMuted);
            onToggleSound();
          }}
          className="cyber-btn cyber-btn-secondary cyber-btn-icon"
          title={soundMuted ? 'Unmute Cyber Audio' : 'Mute Cyber Audio'}
        >
          {soundMuted ? <VolumeX size={15} /> : <Volume2 size={15} color="var(--sunset-gold)" />}
        </button>

        {/* Lock Vault Button */}
        {!isLocked && (
          <button
            onClick={() => {
              cyberAudio.playLockSound();
              onLockVault();
            }}
            className="cyber-btn cyber-btn-danger"
            style={{ padding: '6px 14px', fontSize: '12px' }}
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
