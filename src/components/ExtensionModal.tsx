import React from 'react';
import { X, Puzzle, Shield, Globe, Terminal, ArrowRight } from 'lucide-react';
import { cyberAudio } from '../utils/cyberAudio';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="cyber-modal-backdrop">
      <div
        className="cyber-card cyber-corners cyber-card-glow"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'rgba(9, 15, 20, 0.96)',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Puzzle size={20} color="var(--cyber-cyan)" />
            <h2 style={{ fontSize: '16px', letterSpacing: '0.08em', color: 'var(--cyber-cyan)' }}>
              BROWSER EXTENSION // CROSS-WEB AUTOFILL
            </h2>
          </div>
          <button
            onClick={() => {
              cyberAudio.playKeypress();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: 'var(--cyber-text-dim)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Feature Overview */}
        <p style={{ fontSize: '13px', color: 'var(--cyber-text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
          The CIPHER//VAULT Browser Extension (Manifest V3) extends your zero-knowledge vault directly into Chrome, Edge, and Brave browsers to auto-detect login inputs, generate strong credentials on the fly, and autofill accounts securely.
        </p>

        {/* Architecture Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--cyber-border-dim)',
            }}
          >
            <Globe size={18} color="var(--cyber-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--cyber-text-main)', fontSize: '13px' }}>
                1. Contextual Login Detection
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cyber-text-muted)', marginTop: '2px' }}>
                Detects username, password, and 2FA fields across any website matching current domain URLs.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--cyber-border-dim)',
            }}
          >
            <Shield size={18} color="var(--cyber-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--cyber-text-main)', fontSize: '13px' }}>
                2. Shared Zero-Knowledge Crypto
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cyber-text-muted)', marginTop: '2px' }}>
                Uses the exact same PBKDF2 + AES-GCM engine inside the extension service worker. Data stays encrypted at all times.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--cyber-border-dim)',
            }}
          >
            <Terminal size={18} color="var(--cyber-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--cyber-text-main)', fontSize: '13px' }}>
                3. Seamless Cloud or Local Sync
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cyber-text-muted)', marginTop: '2px' }}>
                Syncs with your Firebase Firestore encrypted payload or browser storage instantly.
              </div>
            </div>
          </div>
        </div>

        {/* Extension Scaffold Notice */}
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(0, 255, 102, 0.05)',
            border: '1px solid var(--cyber-border)',
            marginBottom: '20px',
            fontSize: '12px',
          }}
        >
          <div style={{ color: 'var(--cyber-green)', fontWeight: 700, marginBottom: '4px' }}>
            DEVELOPMENT ROADMAP
          </div>
          <div style={{ color: 'var(--cyber-text-muted)' }}>
            We have prepared the shared crypto engine and types so the Chrome Extension folder can directly consume `src/crypto/encryption.ts`. As soon as you review the web app, we will generate the full extension package!
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} className="cyber-btn cyber-btn-primary">
            <span>CONTINUE IN WEB VAULT</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
