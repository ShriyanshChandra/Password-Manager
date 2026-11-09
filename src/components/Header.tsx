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
  overallScore,
  crtActive,
  onToggleCrt,
  soundMuted,
  onToggleSound,
}) => {

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 28px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.65)',
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(28px) saturate(190%) brightness(104%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%) brightness(104%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
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
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(180deg, #0077ed 0%, #0071e3 100%)',
              boxShadow: '0 4px 14px rgba(0, 113, 227, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
            }}
          >
            <Shield size={20} color="#ffffff" />
          </div>
          <div>
            <div
              className="font-display"
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#1d1d1f',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
              }}
            >
              CIPHER // VAULT
            </div>
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: '#0071e3',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Zero-Knowledge // Encrypted Vault
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

          {/* Security Score Badge */}
          <button
            onClick={() => {
              cyberAudio.playKeypress();
              onOpenAudit();
            }}
            className="cyber-badge"
            style={{
              background: overallScore >= 80 ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 149, 0, 0.12)',
              color: overallScore >= 80 ? '#1f7a37' : '#ad6200',
              borderColor: overallScore >= 80 ? 'rgba(52, 199, 89, 0.28)' : 'rgba(255, 149, 0, 0.28)',
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
            style={{ padding: '7px 14px', fontSize: '12.5px' }}
            title="Password & Passphrase Generator"
          >
            <KeyRound size={14} color="#0071e3" />
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
          style={{ padding: '7px 13px', fontSize: '12.5px' }}
          title="Browser Extension Integration"
        >
          <Puzzle size={14} color="#0071e3" />
          <span style={{ display: 'none', sm: 'inline' } as React.CSSProperties}>EXTENSION</span>
        </button>

        {/* Lens Vignette Toggle */}
        <button
          onClick={() => {
            cyberAudio.playKeypress();
            onToggleCrt();
          }}
          className="cyber-btn cyber-btn-secondary cyber-btn-icon"
          style={{
            borderColor: crtActive ? '#0071e3' : 'rgba(0,0,0,0.1)',
            color: crtActive ? '#0071e3' : '#86868b',
          }}
          title={crtActive ? 'Disable Optical Vignette' : 'Enable Optical Vignette'}
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
          {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} color="#0071e3" />}
        </button>

        {/* Lock Vault Button */}
        {!isLocked && (
          <button
            onClick={() => {
              cyberAudio.playLockSound();
              onLockVault();
            }}
            className="cyber-btn cyber-btn-danger"
            style={{ padding: '7px 16px', fontSize: '12.5px', borderRadius: '9999px' }}
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
