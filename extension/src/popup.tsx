import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Lock,
  Unlock,
  Key,
  Shield,
  RefreshCw,
  PlusCircle,
  Settings,
  Copy,
  Check,
  Eye,
  EyeOff,
  Zap,
  Globe,
  Download,
  Upload,
} from 'lucide-react';
import type {
  ExtensionVaultItem,
  VaultStatus,
  ActiveTabInfo,
  EncryptedVaultBundle,
} from './types/extension';
import { generatePassword, estimatePasswordEntropy } from './crypto/passwordGen';
import { deriveKey, deriveAuthHash, encryptVault, generateSalt } from './crypto/extensionCrypto';

export const PopupApp: React.FC = () => {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabInfo>({ url: '', domain: '', title: '' });
  const [activeNav, setActiveNav] = useState<'matching' | 'all' | 'generator' | 'add' | 'settings'>('matching');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Unlock state
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [showMasterPassword, setShowMasterPassword] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  // Decrypted vault data in popup view
  const [matchingItems, setMatchingItems] = useState<ExtensionVaultItem[]>([]);
  const [allItems, setAllItems] = useState<ExtensionVaultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Generator state
  const [genLength, setGenLength] = useState<number>(18);
  const [genUpper, setGenUpper] = useState<boolean>(true);
  const [genLower, setGenLower] = useState<boolean>(true);
  const [genNumbers, setGenNumbers] = useState<boolean>(true);
  const [genSymbols, setGenSymbols] = useState<boolean>(true);
  const [genMode, setGenMode] = useState<'password' | 'passphrase'>('password');
  const [generatedPass, setGeneratedPass] = useState<string>(() =>
    generatePassword({
      length: 18,
      useUpper: true,
      useLower: true,
      useNumbers: true,
      useSymbols: true,
      avoidAmbiguous: true,
      mode: 'password',
      wordCount: 4,
    })
  );

  // Add Item state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  // Import/Export state
  const [importJson, setImportJson] = useState<string>('');
  const [showImportArea, setShowImportArea] = useState<boolean>(false);

  const loadCredentials = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    chrome.runtime.sendMessage({ type: 'GET_MATCHING_CREDENTIALS' }, (res) => {
      if (res && res.success && res.data) {
        setMatchingItems(res.data);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_ALL_CREDENTIALS' }, (res) => {
      if (res && res.success && res.data) {
        setAllItems(res.data);
      }
    });
  }, []);

  const fetchStatus = useCallback(() => {
    setIsLoading(true);
    setErrorMessage('');

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_VAULT_STATUS' }, (res) => {
        setIsLoading(false);
        if (res && res.success && res.data) {
          setStatus(res.data.status);
          setActiveTab(res.data.activeTab);

          // Pre-fill Add Form with tab info
          if (res.data.activeTab) {
            setNewUrl(res.data.activeTab.url || '');
            setNewTitle(res.data.activeTab.domain ? res.data.activeTab.domain.split('.')[0].toUpperCase() : '');
          }

          if (res.data.status.isUnlocked) {
            loadCredentials();
          }
        } else {
          setErrorMessage(res?.error || 'Failed to communicate with CIPHER//VAULT background service.');
        }
      });
    } else {
      setIsLoading(false);
      // Fallback preview mode
      setStatus({
        isInitialized: true,
        isUnlocked: false,
        itemCount: 0,
        matchingCount: 0,
        activeDomain: 'github.com',
      });
      setActiveTab({ url: 'https://github.com/login', domain: 'github.com', title: 'Sign in to GitHub' });
    }
  }, [loadCredentials]);

  const regeneratePassword = useCallback(() => {
    const pass = generatePassword({
      length: genLength,
      useUpper: genUpper,
      useLower: genLower,
      useNumbers: genNumbers,
      useSymbols: genSymbols,
      avoidAmbiguous: true,
      mode: genMode,
      wordCount: 4,
    });
    setGeneratedPass(pass);
  }, [genLength, genUpper, genLower, genNumbers, genSymbols, genMode]);

  // Initialize status & active tab
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    setIsUnlocking(true);
    setErrorMessage('');

    chrome.runtime.sendMessage({ type: 'UNLOCK_VAULT', masterPassword }, (res) => {
      setIsUnlocking(false);
      if (res && res.success) {
        setMasterPassword('');
        fetchStatus();
      } else {
        setErrorMessage(res?.error || 'Master cipher key invalid. Decryption rejected.');
      }
    });
  };

  const handleLock = () => {
    chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }, () => {
      setMatchingItems([]);
      setAllItems([]);
      fetchStatus();
      setActiveNav('matching');
    });
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect this account from CIPHER//VAULT Extension? Persistent credentials will be purged.')) {
      chrome.runtime.sendMessage({ type: 'DISCONNECT_ACCOUNT' }, () => {
        setMatchingItems([]);
        setAllItems([]);
        fetchStatus();
        setActiveNav('matching');
      });
    }
  };

  const handleAutofill = (item: ExtensionVaultItem) => {
    chrome.runtime.sendMessage({
      type: 'AUTOFILL_TAB',
      credentials: {
        username: item.username,
        password: item.password,
        url: item.url,
      },
    }, (res) => {
      if (res && res.success) {
        setCopiedField(`autofill-${item.id}`);
        setTimeout(() => setCopiedField(null), 1500);
      } else {
        alert(res?.error || 'Autofill failed on this page.');
      }
    });
  };

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const togglePasswordVisibility = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Please enter a credential title.');
      return;
    }

    const item: ExtensionVaultItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: newTitle.trim(),
      category: 'login',
      username: newUsername.trim(),
      password: newPassword,
      url: newUrl.trim(),
      notes: newNotes.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL', item }, (res) => {
      if (res && res.success) {
        // Reset form
        setNewTitle('');
        setNewUsername('');
        setNewPassword('');
        setNewNotes('');
        loadCredentials();
        setActiveNav('matching');
      } else {
        alert(res?.error || 'Failed to save credential.');
      }
    });
  };

  const handleExportVault = () => {
    chrome.storage.local.get('cipher_vault_encrypted_bundle', (result) => {
      const bundle = result['cipher_vault_encrypted_bundle'];
      if (!bundle) {
        alert('No encrypted vault bundle found to export.');
        return;
      }
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `cipher-vault-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  };

  const handleImportVault = () => {
    try {
      const parsed = JSON.parse(importJson) as EncryptedVaultBundle;
      if (!parsed.salt || !parsed.authHash || !parsed.ciphertext || !parsed.iv) {
        throw new Error('Invalid bundle format: Missing required cryptographic fields.');
      }
      chrome.runtime.sendMessage({ type: 'UPDATE_VAULT_BUNDLE', bundle: parsed }, (res) => {
        if (res && res.success) {
          alert('Vault bundle imported successfully! Please unlock with the bundle\'s master key.');
          setImportJson('');
          setShowImportArea(false);
          fetchStatus();
        } else {
          alert(res?.error || 'Import failed.');
        }
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Invalid JSON format: ${errMsg}`);
    }
  };

  const handleCreateFreshVault = async (pwd: string) => {
    if (!pwd || pwd.length < 8) {
      alert('Master password must be at least 8 characters.');
      return;
    }
    try {
      const salt = generateSalt(16);
      const key = await deriveKey(pwd, salt);
      const authHash = await deriveAuthHash(pwd, salt);
      const bundle = await encryptVault([], key, salt, authHash, 'Initial Vault');

      chrome.runtime.sendMessage({ type: 'UPDATE_VAULT_BUNDLE', bundle }, () => {
        alert('Vault created! Please unlock with your new master password.');
        fetchStatus();
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Vault initialization error: ${errMsg}`);
    }
  };

  const filteredAllItems = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const entropyData = estimatePasswordEntropy(generatedPass);

  return (
    <div>
      {/* Header */}
      <header className="cv-header">
        <div className="cv-logo">
          <div className="cv-logo-icon">
            <Shield size={15} strokeWidth={2.5} />
          </div>
          <div>
            <div className="cv-logo-title">CIPHER//VAULT</div>
            {status?.accountEmail && (
              <div
                style={{
                  fontSize: '9px',
                  color: '#00e5a3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '1px',
                }}
                title={`Always Signed In: ${status.accountEmail}`}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#00e5a3',
                    boxShadow: '0 0 6px #00e5a3',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    maxWidth: '130px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {status.accountEmail}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab.domain && (
            <div className="cv-domain-pill" title={activeTab.url}>
              <Globe size={10} style={{ display: 'inline', marginRight: '4px' }} />
              {activeTab.domain}
            </div>
          )}

          {status?.isUnlocked && (
            <button
              onClick={handleLock}
              className="cv-btn-secondary"
              title="Lock Vault Now"
              style={{ padding: '4px 6px' }}
            >
              <Lock size={12} />
            </button>
          )}
        </div>
      </header>

      {/* Navigation (Only when unlocked) */}
      {status?.isUnlocked && (
        <nav className="cv-nav">
          <button
            className={`cv-nav-btn ${activeNav === 'matching' ? 'active' : ''}`}
            onClick={() => setActiveNav('matching')}
          >
            <Key size={14} />
            <span>Matching ({matchingItems.length})</span>
          </button>
          <button
            className={`cv-nav-btn ${activeNav === 'all' ? 'active' : ''}`}
            onClick={() => setActiveNav('all')}
          >
            <Shield size={14} />
            <span>Vault ({allItems.length})</span>
          </button>
          <button
            className={`cv-nav-btn ${activeNav === 'generator' ? 'active' : ''}`}
            onClick={() => setActiveNav('generator')}
          >
            <RefreshCw size={14} />
            <span>Generate</span>
          </button>
          <button
            className={`cv-nav-btn ${activeNav === 'add' ? 'active' : ''}`}
            onClick={() => setActiveNav('add')}
          >
            <PlusCircle size={14} />
            <span>Add</span>
          </button>
          <button
            className={`cv-nav-btn ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveNav('settings')}
          >
            <Settings size={14} />
            <span>Sync</span>
          </button>
        </nav>
      )}

      {/* Main Container */}
      <div className="cv-container">
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gold-primary)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <div>Initializing Secure Context...</div>
          </div>
        )}

        {/* State: Not Initialized (First time opening) */}
        {!isLoading && status && !status.isInitialized && (
          <div className="cv-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255, 184, 0, 0.12)',
                border: '1px solid var(--gold-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                boxShadow: '0 0 14px var(--gold-glow)',
              }}
            >
              <Zap size={20} color="#ffb800" />
            </div>

            <h3 style={{ color: 'var(--gold-primary)', marginBottom: '6px', fontFamily: 'var(--font-display)', fontSize: '13px' }}>
              CONNECT TO WEB VAULT
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '14px', lineHeight: 1.4 }}>
              Authenticate through your CIPHER//VAULT deployment to sync your credentials.
            </p>

            <button
              className="cv-btn-primary"
              style={{ marginBottom: '8px' }}
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                  chrome.tabs.create({ url: 'http://localhost:5173/?connect_extension=true' });
                } else {
                  window.open('http://localhost:5173/?connect_extension=true', '_blank');
                }
              }}
            >
              <Zap size={14} />
              LOGIN VIA LOCALHOST (5173)
            </button>

            <button
              className="cv-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                  chrome.tabs.create({ url: 'https://password-manager-phi-nine.vercel.app/?connect_extension=true' });
                } else {
                  window.open('https://password-manager-phi-nine.vercel.app/?connect_extension=true', '_blank');
                }
              }}
            >
              <Globe size={13} />
              LOGIN VIA VERCEL DEPLOYMENT
            </button>

            <button
              className="cv-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}
              onClick={() => {
                const welcomeUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
                  ? chrome.runtime.getURL('welcome.html')
                  : 'welcome.html';
                if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                  chrome.tabs.create({ url: welcomeUrl });
                } else {
                  window.open(welcomeUrl, '_blank');
                }
              }}
            >
              <Shield size={13} />
              OPEN EXTENSION SETUP PAGE
            </button>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <button
                className="cv-btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '10px' }}
                onClick={() => setShowImportArea(!showImportArea)}
              >
                <Upload size={12} />
                MANUAL IMPORT OR CREATE
              </button>
            </div>

            {showImportArea && (
              <div style={{ marginTop: '12px', textAlign: 'left' }}>
                <textarea
                  className="cv-input"
                  style={{ height: '70px', fontSize: '10px' }}
                  placeholder="Paste encrypted JSON bundle here..."
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    className="cv-btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleImportVault}
                  >
                    IMPORT
                  </button>
                  <button
                    className="cv-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const pwd = prompt('Enter a new Master Password for your cipher vault:');
                      if (pwd) handleCreateFreshVault(pwd);
                    }}
                  >
                    CREATE NEW
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* State: Locked */}
        {!isLoading && status?.isInitialized && !status.isUnlocked && (
          <div className="cv-card" style={{ padding: '24px 16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 184, 0, 0.1)',
                  border: '1px solid var(--gold-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  boxShadow: '0 0 16px var(--gold-glow)',
                }}
              >
                <Lock size={22} color="#ffb800" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', fontSize: '14px' }}>
                VAULT LOCKED
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                Zero-knowledge PBKDF2-SHA256 decryption
              </p>
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(204, 34, 0, 0.2)',
                  border: '1px solid #cc2200',
                  color: '#ff8888',
                  fontSize: '11px',
                  marginBottom: '12px',
                }}
              >
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleUnlock}>
              <div className="cv-input-group">
                <label className="cv-label">Master Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    className="cv-input"
                    placeholder="Enter Master Password..."
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showMasterPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {status.hint && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Hint: <span style={{ color: 'var(--gold-primary)' }}>{status.hint}</span>
                </div>
              )}

              <button type="submit" className="cv-btn-primary" disabled={isUnlocking}>
                {isUnlocking ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    DECRYPTING...
                  </>
                ) : (
                  <>
                    <Unlock size={14} />
                    DECRYPT CIPHER VAULT
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* State: Unlocked & Tab: Matching Credentials */}
        {!isLoading && status?.isUnlocked && activeNav === 'matching' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Matching: <strong style={{ color: 'var(--gold-primary)' }}>{activeTab.domain || 'Current Page'}</strong>
              </span>
              <span className="cv-badge">{matchingItems.length} Available</span>
            </div>

            {matchingItems.length === 0 ? (
              <div className="cv-card" style={{ textAlign: 'center', padding: '24px 12px' }}>
                <Key size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
                  No credentials saved for this site.
                </div>
                <button
                  className="cv-btn-secondary"
                  onClick={() => setActiveNav('add')}
                >
                  <PlusCircle size={13} />
                  Add for this domain
                </button>
              </div>
            ) : (
              matchingItems.map((item) => (
                <div key={item.id} className="cv-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--gold-primary)', fontSize: '13px' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.username || 'No username'}
                      </div>
                    </div>

                    <button
                      className="cv-btn-primary"
                      style={{ width: 'auto', padding: '5px 9px', fontSize: '11px' }}
                      onClick={() => handleAutofill(item)}
                      title="Autofill into current page"
                    >
                      <Zap size={12} />
                      {copiedField === `autofill-${item.id}` ? 'FILLED!' : 'AUTOFILL'}
                    </button>
                  </div>

                  {/* Password row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <div
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: 'var(--text-main)',
                      }}
                    >
                      {revealedPasswords[item.id] ? item.password : '••••••••••••'}
                    </div>

                    <button
                      className="cv-btn-secondary"
                      onClick={() => togglePasswordVisibility(item.id)}
                      title={revealedPasswords[item.id] ? 'Hide' : 'Reveal'}
                    >
                      {revealedPasswords[item.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>

                    <button
                      className="cv-btn-secondary"
                      onClick={() => item.password && handleCopy(item.password, `pass-${item.id}`)}
                      title="Copy Password"
                    >
                      {copiedField === `pass-${item.id}` ? <Check size={12} color="#00e5a3" /> : <Copy size={12} />}
                    </button>

                    {item.username && (
                      <button
                        className="cv-btn-secondary"
                        onClick={() => handleCopy(item.username!, `user-${item.id}`)}
                        title="Copy Username"
                      >
                        {copiedField === `user-${item.id}` ? <Check size={12} color="#00e5a3" /> : 'User'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* State: Unlocked & Tab: All Vault */}
        {!isLoading && status?.isUnlocked && activeNav === 'all' && (
          <div>
            <div className="cv-input-group">
              <input
                type="text"
                className="cv-input"
                placeholder="Search encrypted vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {filteredAllItems.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  No matching items found.
                </div>
              ) : (
                filteredAllItems.map((item) => (
                  <div key={item.id} className="cv-card" style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--gold-primary)' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.username}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {item.password && (
                          <button
                            className="cv-btn-secondary"
                            onClick={() => handleCopy(item.password!, `pass-${item.id}`)}
                            title="Copy Password"
                          >
                            {copiedField === `pass-${item.id}` ? <Check size={11} color="#00e5a3" /> : <Key size={11} />}
                          </button>
                        )}
                        <button
                          className="cv-btn-secondary"
                          onClick={() => handleAutofill(item)}
                          title="Autofill"
                        >
                          <Zap size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* State: Unlocked & Tab: Generator */}
        {!isLoading && status?.isUnlocked && activeNav === 'generator' && (
          <div className="cv-card">
            <h3 style={{ color: 'var(--gold-primary)', fontSize: '13px', marginBottom: '10px' }}>
              CYBERNETIC GENERATOR
            </h3>

            {/* Generated Output */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '10px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: 'var(--text-highlight)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{generatedPass}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="cv-btn-secondary"
                  onClick={regeneratePassword}
                  title="Generate New"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  className="cv-btn-secondary"
                  onClick={() => handleCopy(generatedPass, 'gen-pass')}
                  title="Copy to Clipboard"
                >
                  {copiedField === 'gen-pass' ? <Check size={12} color="#00e5a3" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Entropy Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Entropy: <strong style={{ color: entropyData.color }}>{entropyData.entropy} bits</strong>
              </span>
              <span
                className="cv-badge"
                style={{ background: `${entropyData.color}22`, color: entropyData.color }}
              >
                {entropyData.label}
              </span>
            </div>

            {/* Controls */}
            <div className="cv-input-group">
              <label className="cv-label">Length: {genLength}</label>
              <input
                type="range"
                min="8"
                max="64"
                value={genLength}
                onChange={(e) => {
                  setGenLength(parseInt(e.target.value, 10));
                  setTimeout(regeneratePassword, 0);
                }}
                style={{ width: '100%', accentColor: 'var(--gold-primary)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={genUpper}
                  onChange={(e) => {
                    setGenUpper(e.target.checked);
                    setTimeout(regeneratePassword, 0);
                  }}
                />
                Uppercase (A-Z)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={genLower}
                  onChange={(e) => {
                    setGenLower(e.target.checked);
                    setTimeout(regeneratePassword, 0);
                  }}
                />
                Lowercase (a-z)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={genNumbers}
                  onChange={(e) => {
                    setGenNumbers(e.target.checked);
                    setTimeout(regeneratePassword, 0);
                  }}
                />
                Numbers (0-9)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={genSymbols}
                  onChange={(e) => {
                    setGenSymbols(e.target.checked);
                    setTimeout(regeneratePassword, 0);
                  }}
                />
                Symbols (!@#$)
              </label>
            </div>

            <button
              className="cv-btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setGenMode(genMode === 'password' ? 'passphrase' : 'password');
                setTimeout(regeneratePassword, 0);
              }}
            >
              Switch to {genMode === 'password' ? 'Passphrase Mode' : 'Password Mode'}
            </button>
          </div>
        )}

        {/* State: Unlocked & Tab: Add Credential */}
        {!isLoading && status?.isUnlocked && activeNav === 'add' && (
          <form onSubmit={handleCreateNewItem} className="cv-card">
            <h3 style={{ color: 'var(--gold-primary)', fontSize: '13px', marginBottom: '10px' }}>
              NEW CREDENTIAL
            </h3>

            <div className="cv-input-group">
              <label className="cv-label">Title</label>
              <input
                type="text"
                className="cv-input"
                placeholder="e.g. GitHub"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>

            <div className="cv-input-group">
              <label className="cv-label">Username / Email</label>
              <input
                type="text"
                className="cv-input"
                placeholder="user@example.com"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>

            <div className="cv-input-group">
              <label className="cv-label">Password</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  className="cv-input"
                  placeholder="Password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="cv-btn-secondary"
                  onClick={() => setNewPassword(generatePassword({
                    length: 20,
                    useUpper: true,
                    useLower: true,
                    useNumbers: true,
                    useSymbols: true,
                    avoidAmbiguous: true,
                    mode: 'password',
                  }))}
                  title="Generate Password"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="cv-input-group">
              <label className="cv-label">Website URL</label>
              <input
                type="text"
                className="cv-input"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>

            <div className="cv-input-group">
              <label className="cv-label">Notes</label>
              <textarea
                className="cv-input"
                style={{ height: '50px' }}
                placeholder="Optional notes or recovery codes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>

            <button type="submit" className="cv-btn-primary">
              <PlusCircle size={14} />
              ENCRYPT & SAVE TO VAULT
            </button>
          </form>
        )}

        {/* State: Unlocked & Tab: Settings & Sync */}
        {!isLoading && status?.isUnlocked && activeNav === 'settings' && (
          <div className="cv-card">
            <h3 style={{ color: 'var(--gold-primary)', fontSize: '13px', marginBottom: '12px' }}>
              VAULT & SYNC
            </h3>

            {/* Persistent Always Connected Account Pill */}
            <div
              style={{
                background: 'rgba(0, 229, 163, 0.08)',
                border: '1px solid rgba(0, 229, 163, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00e5a3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00e5a3', boxShadow: '0 0 8px #00e5a3' }} />
                  ALWAYS SIGNED IN & CONNECTED
                </span>
                <span className="cv-badge" style={{ background: 'rgba(0, 229, 163, 0.2)', color: '#00e5a3', fontSize: '9px' }}>
                  ACTIVE
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-main)', marginBottom: '4px', wordBreak: 'break-all' }}>
                Account: <strong style={{ color: '#ffb800' }}>{status?.accountEmail || 'Connected Web Account'}</strong>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {status?.lastSyncedAt
                  ? `Last Synced: ${new Date(status.lastSyncedAt).toLocaleDateString()} ${new Date(status.lastSyncedAt).toLocaleTimeString()}`
                  : 'Auto-synced with Web App'}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255, 184, 0, 0.85)', marginTop: '4px' }}>
                ✦ Persistent across browser restarts & background sleep
              </div>
            </div>

            {/* Fast Resync Options */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button
                className="cv-btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '10px', padding: '6px 4px' }}
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                    chrome.tabs.create({ url: 'http://localhost:5173/?connect_extension=true' });
                  } else {
                    window.open('http://localhost:5173/?connect_extension=true', '_blank');
                  }
                }}
              >
                <Zap size={11} color="#ffb800" />
                RESYNC LOCALHOST
              </button>
              <button
                className="cv-btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '10px', padding: '6px 4px' }}
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                    chrome.tabs.create({ url: 'https://password-manager-phi-nine.vercel.app/?connect_extension=true' });
                  } else {
                    window.open('https://password-manager-phi-nine.vercel.app/?connect_extension=true', '_blank');
                  }
                }}
              >
                <Globe size={11} color="#00e5a3" />
                RESYNC VERCEL
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Total Vault Items: <strong style={{ color: 'var(--text-main)' }}>{allItems.length}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="cv-btn-secondary"
                style={{ justifyContent: 'center' }}
                onClick={handleExportVault}
              >
                <Download size={14} />
                EXPORT ENCRYPTED BACKUP (.JSON)
              </button>

              <button
                className="cv-btn-secondary"
                style={{ justifyContent: 'center' }}
                onClick={() => setShowImportArea(!showImportArea)}
              >
                <Upload size={14} />
                IMPORT WEB APP BACKUP
              </button>

              {showImportArea && (
                <div style={{ marginTop: '6px' }}>
                  <textarea
                    className="cv-input"
                    style={{ height: '80px', fontSize: '10px' }}
                    placeholder="Paste encrypted JSON bundle here..."
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                  />
                  <button
                    className="cv-btn-primary"
                    style={{ marginTop: '8px' }}
                    onClick={handleImportVault}
                  >
                    OVERWRITE & IMPORT
                  </button>
                </div>
              )}

              <hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} />

              <button
                className="cv-btn-secondary"
                style={{ justifyContent: 'center', color: '#ff8888', borderColor: 'rgba(204, 34, 0, 0.4)' }}
                onClick={handleDisconnect}
              >
                <Lock size={13} />
                DISCONNECT ACCOUNT & CLEAR CACHE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<PopupApp />);
}
