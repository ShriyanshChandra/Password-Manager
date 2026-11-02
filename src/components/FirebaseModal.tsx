import React, { useState } from 'react';
import { X, Cloud, Check, AlertCircle, Database, Lock, RefreshCw, Trash2 } from 'lucide-react';
import type { FirebaseConnectionConfig } from '../types/vault';
import { firebaseService } from '../services/firebaseService';
import { cyberAudio } from '../utils/cyberAudio';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const currentConfig = firebaseService.getConfig();
  const [config, setConfig] = useState<FirebaseConnectionConfig>({
    apiKey: currentConfig?.apiKey || '',
    authDomain: currentConfig?.authDomain || '',
    projectId: currentConfig?.projectId || '',
    storageBucket: currentConfig?.storageBucket || '',
    appId: currentConfig?.appId || '',
  });

  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.apiKey || !config.projectId) {
      setStatusMsg({ text: 'API Key and Project ID are mandatory.', type: 'error' });
      cyberAudio.playErrorSound();
      return;
    }

    setIsSaving(true);
    try {
      firebaseService.saveConfig(config);
      cyberAudio.playUnlockSound();
      setStatusMsg({ text: 'Firebase configuration linked! Cloud sync active.', type: 'success' });
      onConfigChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Firebase';
      setStatusMsg({ text: msg, type: 'error' });
      cyberAudio.playErrorSound();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Disconnect Firebase and switch back strictly to local offline vault?')) {
      firebaseService.clearConfig();
      setConfig({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', appId: '' });
      setStatusMsg({ text: 'Disconnected. Vault is now running offline in local storage.', type: 'info' });
      cyberAudio.playKeypress();
      onConfigChanged();
    }
  };

  return (
    <div className="cyber-modal-backdrop">
      <div
        className="cyber-card cyber-corners cyber-card-glow"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(9, 15, 20, 0.96)',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={20} color="var(--cyber-cyan)" />
            <h2 style={{ fontSize: '16px', letterSpacing: '0.08em', color: 'var(--cyber-cyan)' }}>
              CLOUD NODE // FIREBASE SYNC INTEGRATION
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

        {/* Zero Knowledge Security Assurance Notice */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 14px',
            background: 'rgba(0, 229, 255, 0.05)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            marginBottom: '18px',
            fontSize: '12px',
          }}
        >
          <Lock size={20} color="var(--cyber-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--cyber-cyan)', marginBottom: '2px' }}>
              ZERO-KNOWLEDGE CLOUD ARCHITECTURE
            </div>
            <div style={{ color: 'var(--cyber-text-muted)', lineHeight: 1.4 }}>
              Ciphertext is encrypted client-side before touching Firebase. Even if Firebase servers or Google are breached, your stored credentials remain uncrackable without your master key.
            </div>
          </div>
        </div>

        {statusMsg && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background:
                statusMsg.type === 'success'
                  ? 'var(--cyber-green-bg)'
                  : statusMsg.type === 'error'
                  ? 'var(--cyber-red-bg)'
                  : 'rgba(255,255,255,0.05)',
              border: `1px solid ${
                statusMsg.type === 'success'
                  ? 'var(--cyber-green)'
                  : statusMsg.type === 'error'
                  ? 'var(--cyber-red)'
                  : 'var(--cyber-border)'
              }`,
              color:
                statusMsg.type === 'success'
                  ? 'var(--cyber-green)'
                  : statusMsg.type === 'error'
                  ? 'var(--cyber-red)'
                  : 'var(--cyber-text-main)',
            }}
          >
            {statusMsg.type === 'success' ? (
              <Check size={16} />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle size={16} />
            ) : (
              <Database size={16} />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
              FIREBASE API KEY *
            </label>
            <input
              type="text"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="AIzaSyBxxxxxxxxxxxxxxx"
              className="cyber-input"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                PROJECT ID *
              </label>
              <input
                type="text"
                value={config.projectId}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                placeholder="cipher-vault-xxxx"
                className="cyber-input"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                AUTH DOMAIN
              </label>
              <input
                type="text"
                value={config.authDomain}
                onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
                placeholder="project.firebaseapp.com"
                className="cyber-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                STORAGE BUCKET (OPTIONAL)
              </label>
              <input
                type="text"
                value={config.storageBucket || ''}
                onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
                placeholder="project.appspot.com"
                className="cyber-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--cyber-text-muted)', marginBottom: '4px' }}>
                APP ID (OPTIONAL)
              </label>
              <input
                type="text"
                value={config.appId || ''}
                onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                placeholder="1:123456789:web:abcdef"
                className="cyber-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
            {currentConfig ? (
              <button
                type="button"
                onClick={handleClear}
                className="cyber-btn cyber-btn-danger"
                style={{ fontSize: '12px' }}
              >
                <Trash2 size={13} />
                <span>DISCONNECT CLOUD</span>
              </button>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--cyber-text-dim)' }}>
                Running in offline local encrypted mode
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="cyber-btn cyber-btn-secondary"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="cyber-btn cyber-btn-primary"
                style={{ borderColor: 'var(--cyber-cyan)', background: 'var(--cyber-cyan)', color: '#000' }}
              >
                <RefreshCw size={14} className={isSaving ? 'spin' : ''} />
                <span>{isSaving ? 'CONNECTING...' : 'SAVE & SYNC CLOUD'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
