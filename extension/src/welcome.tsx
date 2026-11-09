import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Shield,
  Key,
  Globe,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  Terminal,
  Zap,
  Lock,
} from 'lucide-react';
import type { VaultStatus } from './types/extension';

export const WelcomeApp: React.FC = () => {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Demo Sandbox test fields
  const [demoUser, setDemoUser] = useState<string>('');
  const [demoPass, setDemoPass] = useState<string>('');
  const [demoFeedback, setDemoFeedback] = useState<string>('');

  const checkStatus = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_VAULT_STATUS' }, (res) => {
        if (res && res.success && res.data) {
          setStatus(res.data.status);
          if (res.data.status.isInitialized && res.data.status.itemCount > 0) {
            setLastSyncedTime(new Date().toLocaleTimeString());
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
    // Poll every 2 seconds to automatically detect when user logs in on localhost or vercel
    const interval = setInterval(checkStatus, 2000);

    const handleMessage = (
      msg: { type: string; credentials?: { username?: string; password?: string } },
      _sender: unknown,
      sendResponse: (res: { success: boolean }) => void
    ) => {
      if (msg.type === 'FILL_CREDENTIALS' && msg.credentials) {
        if (msg.credentials.username) setDemoUser(msg.credentials.username);
        if (msg.credentials.password) setDemoPass(msg.credentials.password);
        setDemoFeedback('✓ Successfully autofilled from CIPHER//VAULT Extension!');
        sendResponse({ success: true });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }

    return () => {
      clearInterval(interval);
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    };
  }, [checkStatus]);

  const handleSandboxAutofill = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_ALL_CREDENTIALS' }, (res) => {
        if (res && res.success && res.data && res.data.length > 0) {
          const item = res.data[0];
          setDemoUser(item.username || '');
          setDemoPass(item.password || '');
          setDemoFeedback(`✓ Successfully autofilled "${item.title}" (${item.username || 'user'})!`);
        } else {
          setDemoFeedback('No credentials in vault yet. Connect and sync with your web app first!');
        }
      });
    }
  };

  const handleOpenLogin = (target: 'local' | 'prod') => {
    setIsSyncing(true);
    const targetUrl = target === 'prod'
      ? 'https://password-manager-phi-nine.vercel.app/?connect_extension=true'
      : (window.location.port === '5173'
          ? 'http://localhost:5173/?connect_extension=true'
          : 'http://localhost:5174/?connect_extension=true');

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: targetUrl });
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  const isConnected = status && status.isUnlocked;

  return (
    <div className="welcome-page">
      {/* Header */}
      <header className="welcome-header">
        <div className="welcome-brand">
          <div className="welcome-brand-icon">
            <Shield size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="welcome-brand-title">CIPHER//VAULT</div>
            <div className="welcome-brand-tagline">ZERO-KNOWLEDGE BROWSER EXTENSION ONBOARDING</div>
          </div>
        </div>

        <div>
          {isSyncing ? (
            <div className="pulse-indicator" style={{ borderColor: 'var(--gold-primary)' }}>
              <div className="pulse-dot" />
              AUTHENTICATING IN WEB DEPLOYMENT...
            </div>
          ) : isConnected ? (
            <div className="pulse-indicator" style={{ borderColor: '#00e5a3', color: '#00e5a3', background: 'rgba(0, 229, 163, 0.08)' }}>
              <div className="pulse-dot" style={{ background: '#00e5a3', boxShadow: '0 0 10px #00e5a3' }} />
              {status?.accountEmail ? `ALWAYS SIGNED IN: ${status.accountEmail}` : 'ALWAYS SIGNED IN & CONNECTED'}
            </div>
          ) : (
            <div className="pulse-indicator">
              <div className="pulse-dot" />
              WAITING FOR LOGIN & SYNC
            </div>
          )}
        </div>
      </header>

      {/* Hero Card */}
      {!isConnected ? (
        <div className="welcome-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold-primary)', marginBottom: '8px' }}>
            <Key size={18} />
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>FIRST-TIME ACTIVATION</span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: '12px', color: 'var(--text-main)' }}>
            CONNECT TO YOUR CIPHER VAULT
          </h1>

          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px', maxWidth: '700px' }}>
            To enable zero-knowledge autofill in your browser, connect this extension with your Web Vault.
            Log in with your Master Password on your web deployment, and your encrypted credentials will securely sync to this browser extension.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '28px' }}>
            <button
              onClick={() => handleOpenLogin('local')}
              className="btn-launch-primary"
            >
              <Zap size={16} />
              LOGIN VIA LOCALHOST (5173)
              <ExternalLink size={14} />
            </button>

            <button
              onClick={() => handleOpenLogin('prod')}
              className="btn-launch-secondary"
            >
              <Globe size={15} />
              LOGIN VIA PRODUCTION (VERCEL)
              <ExternalLink size={13} />
            </button>

            <button
              onClick={checkStatus}
              className="btn-launch-secondary"
              title="Refresh connection status"
            >
              <RefreshCw size={14} />
              CHECK SYNC STATUS
            </button>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '8px', background: 'rgba(16, 8, 37, 0.7)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold-primary)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              <Terminal size={14} />
              HOW THE HANDSHAKE WORKS
            </div>
            <ol style={{ paddingLeft: '18px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.7 }}>
              <li>Clicking above opens your CIPHER//VAULT deployment with the connection flag.</li>
              <li>Sign in using your account credentials and master password (+ 2FA).</li>
              <li>Once unlocked, the web app directly transfers your encrypted vault bundle to the extension.</li>
              <li>Your master key never touches any remote server—it remains encrypted client-side.</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="welcome-card" style={{ borderColor: 'rgba(0, 229, 163, 0.4)', boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 30px rgba(0, 229, 163, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <CheckCircle size={32} color="#00e5a3" />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: '#00e5a3', fontSize: '20px' }}>
                VAULT SUCCESSFULLY LINKED & ACTIVE!
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Zero-knowledge client-side encryption is synchronized.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', margin: '20px 0' }}>
            <div className="feature-box">
              <div className="feature-box-title">
                <Key size={14} />
                CREDENTIALS SYNCED
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gold-primary)', fontFamily: 'var(--font-display)' }}>
                {status?.itemCount || 0}
              </div>
            </div>

            <div className="feature-box">
              <div className="feature-box-title">
                <Lock size={14} />
                ENCRYPTION
              </div>
              <div style={{ fontSize: '13px', color: '#00e5a3', fontWeight: 600 }}>
                AES-256-GCM + PBKDF2
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                120,000 Rounds
              </div>
            </div>

            <div className="feature-box">
              <div className="feature-box-title">
                <Globe size={14} />
                AUTOFILL READY
              </div>
              <div style={{ fontSize: '13px', color: 'var(--gold-primary)', fontWeight: 600 }}>
                Active on All Domains
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Synced: {lastSyncedTime || 'Just now'}
              </div>
            </div>

            <div className="feature-box">
              <div className="feature-box-title">
                <Shield size={14} />
                PERSISTENT CONNECTION
              </div>
              <div style={{ fontSize: '13px', color: '#00e5a3', fontWeight: 600 }}>
                Always Signed In
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Auto-reconnects on reboot
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={() => handleOpenLogin('local')}
              className="btn-launch-secondary"
            >
              <RefreshCw size={13} />
              RE-SYNC FROM LOCALHOST (5173)
            </button>
            <button
              onClick={() => handleOpenLogin('prod')}
              className="btn-launch-secondary"
            >
              <Globe size={13} />
              RE-SYNC FROM VERCEL
            </button>
          </div>
        </div>
      )}

      {/* Live Autofill Testing Sandbox */}
      <div className="welcome-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold-primary)', marginBottom: '8px' }}>
          <Zap size={16} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>INTERACTIVE AUTOFILL SANDBOX</span>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', marginBottom: '8px' }}>
          TEST INLINE EXTENSION AUTOFILL
        </h3>

        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '18px' }}>
          Notice the subtle glowing CIPHER//VAULT icon placed inside the password field below. Click it or use your extension toolbar popup to fill!
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (demoUser || demoPass) {
              setDemoFeedback(`Successfully tested login with user: ${demoUser || '(empty)'}`);
            } else {
              setDemoFeedback('Click the extension popup or the lock icon inside the password field to autofill credentials!');
            }
          }}
          style={{ maxWidth: '420px', background: 'rgba(13, 5, 32, 0.8)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
        >
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              USERNAME / EMAIL
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="e.g. user@example.com"
              value={demoUser}
              onChange={(e) => setDemoUser(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#0d0520',
                border: '1px solid rgba(255, 184, 0, 0.3)',
                borderRadius: '6px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '13px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={demoPass}
                onChange={(e) => setDemoPass(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 10px',
                  background: '#0d0520',
                  border: '1px solid rgba(255, 184, 0, 0.3)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={handleSandboxAutofill}
                title="CIPHER//VAULT: Click to test inline autofill"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '22px',
                  height: '22px',
                  borderRadius: '4px',
                  background: '#100825',
                  border: '1px solid #ffb800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(255, 184, 0, 0.4)',
                  padding: 0,
                }}
              >
                <Lock size={12} color="#ffb800" />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-launch-primary"
              style={{ flex: 1, padding: '10px 8px', fontSize: '11px' }}
              onClick={handleSandboxAutofill}
            >
              <Zap size={14} />
              AUTOFILL CREDENTIALS
            </button>

            <button
              type="button"
              className="btn-launch-secondary"
              style={{ flex: 1, padding: '10px 8px', fontSize: '11px' }}
              onClick={() => {
                if (demoUser || demoPass) {
                  setDemoFeedback(`Successfully verified credentials for user: ${demoUser || '(empty)'}`);
                } else {
                  setDemoFeedback('Click AUTOFILL CREDENTIALS or the lock icon inside the password field to test!');
                }
              }}
            >
              TEST SUBMIT
            </button>
          </div>

          {demoFeedback && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--gold-primary)', textAlign: 'center' }}>
              {demoFeedback}
            </div>
          )}
        </form>
      </div>

      {/* Feature Walkthrough */}
      <div className="feature-grid">
        <div className="feature-box">
          <div className="feature-box-title">
            <Shield size={16} />
            Zero-Knowledge Web Crypto
          </div>
          <div className="feature-box-desc">
            Your master password is never stored or transmitted anywhere. Decryption happens purely in volatile memory.
          </div>
        </div>

        <div className="feature-box">
          <div className="feature-box-title">
            <Zap size={16} />
            Smart Domain Detection
          </div>
          <div className="feature-box-desc">
            The extension badge dynamically reflects credentials matching the domain you are visiting in real time.
          </div>
        </div>

        <div className="feature-box">
          <div className="feature-box-title">
            <Lock size={16} />
            Automatic Session Lock
          </div>
          <div className="feature-box-desc">
            Decrypted memory is automatically purged upon inactivity based on your configurable auto-lock duration.
          </div>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('welcome-root');
if (rootElement) {
  createRoot(rootElement).render(<WelcomeApp />);
}
