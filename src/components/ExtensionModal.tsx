import React, { useState } from 'react';
import { X, Puzzle, Shield, Globe, Terminal, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { cyberAudio } from '../utils/cyberAudio';
import { firebaseService } from '../services/firebaseService';
import type { VaultItem, EncryptedVaultBundle } from '../types/vault';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultBundle?: EncryptedVaultBundle | null;
  items?: VaultItem[];
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  vaultBundle,
  items,
}) => {
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncToExtension = () => {
    cyberAudio.playCopySound();
    if (!vaultBundle) {
      setSyncFeedback('Unlock your vault first to sync credentials.');
      return;
    }

    try {
      window.postMessage(
        {
          type: 'CIPHER_VAULT_SYNC_PAYLOAD',
          bundle: vaultBundle,
          items: items || [],
          accountEmail: firebaseService.getCurrentUser()?.email || undefined,
        },
        '*'
      );
      setSyncFeedback(`Successfully broadcasted ${items?.length || 0} credentials to CIPHER//VAULT Extension!`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      setSyncFeedback(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="cyber-modal-backdrop">
      <div
        className="cyber-card cyber-corners"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'rgba(255, 255, 255, 0.93)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(14, 165, 233, 0.22)',
          boxShadow: '0 20px 60px -8px rgba(14, 116, 144, 0.22), 0 4px 16px rgba(0,0,0,0.06)',
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
              background: 'rgba(14, 165, 233, 0.05)',
              border: '1px solid rgba(14, 165, 233, 0.16)',
              borderRadius: '8px',
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
              background: 'rgba(14, 165, 233, 0.05)',
              border: '1px solid rgba(14, 165, 233, 0.16)',
              borderRadius: '8px',
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
              background: 'rgba(14, 165, 233, 0.05)',
              border: '1px solid rgba(14, 165, 233, 0.16)',
              borderRadius: '8px',
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

        {/* Live Extension Sync Action */}
        <div
          style={{
            padding: '16px',
            background: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            borderRadius: '10px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ color: 'var(--cyber-cyan)', fontWeight: 700, fontSize: '13px' }}>
              DIRECT EXTENSION SYNCHRONIZATION
            </div>
            {syncFeedback && (
              <span style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> {syncFeedback}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--cyber-text-muted)', fontSize: '12px', marginBottom: '12px' }}>
            Transfers your encrypted vault payload and decrypted memory cache directly to your installed CIPHER//VAULT browser extension via client-side bridge.
          </p>
          <button
            onClick={handleSyncToExtension}
            className="cyber-btn cyber-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={!vaultBundle}
          >
            <Zap size={15} />
            <span>SYNC {items?.length || 0} CREDENTIALS TO EXTENSION</span>
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} className="cyber-btn cyber-btn-secondary">
            <span>CLOSE</span>
          </button>
          <button onClick={onClose} className="cyber-btn cyber-btn-primary">
            <span>CONTINUE IN WEB VAULT</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
