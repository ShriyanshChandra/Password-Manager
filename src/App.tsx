import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { AppleLiquidGlass3D } from './components/AppleLiquidGlass3D';
import { UnlockScreen } from './components/UnlockScreen';
import { VaultDashboard } from './components/VaultDashboard';
import { PasswordGeneratorModal } from './components/PasswordGeneratorModal';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { ExtensionModal } from './components/ExtensionModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import type { VaultItem, EncryptedVaultBundle } from './types/vault';
import { vaultStorage } from './services/vaultStorage';
import { firebaseService } from './services/firebaseService';
import { performSecurityAudit } from './crypto/passwordUtils';
import { cyberAudio } from './utils/cyberAudio';

export const App: React.FC = () => {
  // Vault state
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [vaultBundle, setVaultBundle] = useState<EncryptedVaultBundle | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);

  // Modals
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatorTargetCallback, setGeneratorTargetCallback] = useState<((pwd: string) => void) | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isExtensionOpen, setIsExtensionOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);

  // Preferences & Appearance
  const [crtActive, setCrtActive] = useState<boolean>(true);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(() => firebaseService.getStatus().isConfigured);
  const [extensionSyncNotification, setExtensionSyncNotification] = useState<string | null>(null);

  const masterKeyRef = useRef<CryptoKey | null>(null);
  const vaultBundleRef = useRef<EncryptedVaultBundle | null>(null);
  const itemsRef = useRef<VaultItem[]>([]);

  useEffect(() => {
    masterKeyRef.current = masterKey;
    vaultBundleRef.current = vaultBundle;
    itemsRef.current = items;
  }, [masterKey, vaultBundle, items]);

  // Check initial configuration on mount, restore active tab session if available, & listen for extension events
  useEffect(() => {
    const unsub = firebaseService.onAuthChange((user) => {
      setIsFirebaseConnected(!!user && firebaseService.getStatus().isConfigured);
    });

    // Silently restore session within the same browser session so refreshes/resyncs never ask for login again
    try {
      const cached = sessionStorage.getItem('cipher_active_unlocked_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.bundle && Array.isArray(parsed.items)) {
          setVaultBundle(parsed.bundle);
          setItems(parsed.items);
          setIsLocked(false);
          // Broadcast presence & payload to extension
          window.postMessage(
            {
              type: 'CIPHER_VAULT_SYNC_PAYLOAD',
              bundle: parsed.bundle,
              items: parsed.items,
              accountEmail: parsed.email || firebaseService.getCurrentUser()?.email || undefined,
            },
            '*'
          );
        }
      }
    } catch {
      // Ignore
    }

    const handleExtensionMsg = (event: MessageEvent) => {
      if (event.data?.type === 'CIPHER_VAULT_SYNC_CONFIRMED' && event.data?.success) {
        const count = event.data.itemCount || 0;
        const email = event.data.accountEmail ? ` (${event.data.accountEmail})` : '';
        setExtensionSyncNotification(`Extension Connected! Synced ${count} credentials${email}.`);
        cyberAudio.playCopySound();
        setTimeout(() => setExtensionSyncNotification(null), 5000);
      } else if (event.data?.type === 'CIPHER_VAULT_EXTENSION_DETECTED') {
        // Proactively push credentials to extension if already unlocked
        if (vaultBundleRef.current) {
          window.postMessage(
            {
              type: 'CIPHER_VAULT_SYNC_PAYLOAD',
              bundle: vaultBundleRef.current,
              items: itemsRef.current,
              accountEmail: firebaseService.getCurrentUser()?.email || undefined,
            },
            '*'
          );
        }
      } else if (event.data?.type === 'CIPHER_VAULT_TRIGGER_RESYNC') {
        // Respond immediately to extension resync requests without asking user to log in
        if (vaultBundleRef.current) {
          window.postMessage(
            {
              type: 'CIPHER_VAULT_SYNC_PAYLOAD',
              bundle: vaultBundleRef.current,
              items: itemsRef.current,
              accountEmail: firebaseService.getCurrentUser()?.email || undefined,
            },
            '*'
          );
        } else {
          // Check cached session
          try {
            const cached = sessionStorage.getItem('cipher_active_unlocked_session');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.bundle) {
                window.postMessage(
                  {
                    type: 'CIPHER_VAULT_SYNC_PAYLOAD',
                    bundle: parsed.bundle,
                    items: parsed.items || [],
                    accountEmail: parsed.email || firebaseService.getCurrentUser()?.email || undefined,
                  },
                  '*'
                );
              }
            }
          } catch {
            // Ignore
          }
        }
      }
    };
    window.addEventListener('message', handleExtensionMsg);
    return () => {
      unsub();
      window.removeEventListener('message', handleExtensionMsg);
    };
  }, []);

  // Lock Vault Action
  const handleLockVault = useCallback(async () => {
    cyberAudio.playLockSound();
    setMasterKey(null);
    setItems([]);
    setIsLocked(true);
    try {
      sessionStorage.removeItem('cipher_active_unlocked_session');
    } catch {
      // Ignore
    }
    // Sign out from Firebase Auth to ensure full lock
    try {
      await firebaseService.signOutUser();
    } catch {
      // Ignored
    }
  }, []);

  // Unlock Success Handler (called after credentials + TOTP 2FA are verified)
  const handleUnlockSuccess = (key: CryptoKey, bundle: EncryptedVaultBundle, unlockedItems: VaultItem[]) => {
    setMasterKey(key);
    setVaultBundle(bundle);
    setItems(unlockedItems);
    setIsLocked(false);

    try {
      sessionStorage.setItem(
        'cipher_active_unlocked_session',
        JSON.stringify({
          bundle,
          items: unlockedItems,
          email: firebaseService.getCurrentUser()?.email || '',
        })
      );
    } catch {
      // Ignore
    }

    // Auto-sync to browser extension if installed
    try {
      window.postMessage(
        {
          type: 'CIPHER_VAULT_SYNC_PAYLOAD',
          bundle,
          items: unlockedItems,
          accountEmail: firebaseService.getCurrentUser()?.email || undefined,
        },
        '*'
      );
    } catch {
      // Ignored
    }
  };

  // Save vault item (add or update)
  const handleSaveItem = async (itemToSave: VaultItem) => {
    if (!masterKey || !vaultBundle) return;

    const existingIndex = items.findIndex((i) => i.id === itemToSave.id);
    let updatedItems: VaultItem[];

    if (existingIndex >= 0) {
      updatedItems = [...items];
      updatedItems[existingIndex] = itemToSave;
    } else {
      updatedItems = [itemToSave, ...items];
    }

    setItems(updatedItems);
    const newBundle = await vaultStorage.saveVault(updatedItems, masterKey, vaultBundle);
    setVaultBundle(newBundle);

    try {
      sessionStorage.setItem(
        'cipher_active_unlocked_session',
        JSON.stringify({
          bundle: newBundle,
          items: updatedItems,
          email: firebaseService.getCurrentUser()?.email || '',
        })
      );
    } catch {
      // Ignore
    }

    // Auto-sync updated vault to browser extension
    try {
      window.postMessage(
        {
          type: 'CIPHER_VAULT_SYNC_PAYLOAD',
          bundle: newBundle,
          items: updatedItems,
          accountEmail: firebaseService.getCurrentUser()?.email || undefined,
        },
        '*'
      );
    } catch {
      // Ignored
    }

    // Save individual credential to Firestore users/{userId}/credentials/{credentialId}
    await firebaseService.saveAccountCredential(itemToSave, masterKey);
  };

  // Delete vault item
  const handleDeleteItem = async (id: string) => {
    if (!masterKey || !vaultBundle) return;

    const updatedItems = items.filter((i) => i.id !== id);
    setItems(updatedItems);
    const newBundle = await vaultStorage.saveVault(updatedItems, masterKey, vaultBundle);
    setVaultBundle(newBundle);

    try {
      sessionStorage.setItem(
        'cipher_active_unlocked_session',
        JSON.stringify({
          bundle: newBundle,
          items: updatedItems,
          email: firebaseService.getCurrentUser()?.email || '',
        })
      );
    } catch {
      // Ignore
    }

    // Auto-sync updated vault to browser extension
    try {
      window.postMessage(
        {
          type: 'CIPHER_VAULT_SYNC_PAYLOAD',
          bundle: newBundle,
          items: updatedItems,
          accountEmail: firebaseService.getCurrentUser()?.email || undefined,
        },
        '*'
      );
    } catch {
      // Ignored
    }

    // Delete individual credential from Firestore users/{userId}/credentials/{credentialId}
    await firebaseService.deleteAccountCredential(id);
  };

  // Export encrypted JSON backup
  const handleExportBackup = async () => {
    try {
      const json = await vaultStorage.exportEncryptedJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cipher-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      cyberAudio.playCopySound();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      alert(msg);
    }
  };

  // Import encrypted backup
  const handleImportBackup = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        await vaultStorage.importEncryptedJson(text);
        alert('Encrypted backup imported successfully! Please authenticate with your master password.');
        handleLockVault();
      };
      reader.readAsText(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      alert(msg);
    }
  };

  // Calculate audit score for header badge
  const auditReport = performSecurityAudit(items);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      {/* Persistent Apple Liquid Glass Three.js Optical Canvas */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <AppleLiquidGlass3D />
      </div>

      {/* Subtle Sunlight Haze overlay if active */}
      {crtActive && <div className="crt-overlay crt-active" />}

      {/* Navigation Header */}
      <Header
        isLocked={isLocked}
        onLockVault={handleLockVault}
        onOpenGenerator={() => {
          setGeneratorTargetCallback(null);
          setIsGeneratorOpen(true);
        }}
        onOpenAudit={() => setIsAuditOpen(true)}
        onOpenExtension={() => setIsExtensionOpen(true)}
        isFirebaseConnected={isFirebaseConnected}
        overallScore={auditReport.overallScore}
        crtActive={crtActive}
        onToggleCrt={() => setCrtActive(!crtActive)}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
      />

      {/* Main Viewport */}
      {isLocked ? (
        <UnlockScreen onUnlockSuccess={handleUnlockSuccess} />
      ) : (
        <VaultDashboard
          items={items}
          onSaveItem={handleSaveItem}
          onDeleteItem={handleDeleteItem}
          onOpenNewItemModal={() => {
            setEditingItem(null);
            setIsItemEditorOpen(true);
          }}
          onOpenEditItemModal={(item) => {
            setEditingItem(item);
            setIsItemEditorOpen(true);
          }}
          onOpenGenerator={() => {
            setGeneratorTargetCallback(null);
            setIsGeneratorOpen(true);
          }}
          onOpenAudit={() => setIsAuditOpen(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />
      )}

      {/* Security Health Audit Modal */}
      <SecurityAuditModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        items={items}
        onSelectItem={(item) => {
          setEditingItem(item);
          setIsItemEditorOpen(true);
        }}
      />

      {/* Extension Sync Ephemeral Notification */}
      {extensionSyncNotification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 18px',
            background: 'rgba(16, 8, 37, 0.95)',
            border: '1px solid #ffb800',
            borderRadius: '10px',
            color: '#ffb800',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 8px 30px rgba(255, 184, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>{extensionSyncNotification}</span>
        </div>
      )}

      {/* Browser Extension Modal */}
      <ExtensionModal
        isOpen={isExtensionOpen}
        onClose={() => setIsExtensionOpen(false)}
        vaultBundle={vaultBundle}
        items={items}
      />

      {/* Item Editor Modal */}
      <ItemEditorModal
        isOpen={isItemEditorOpen}
        onClose={() => {
          setIsItemEditorOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onOpenGenerator={(onSelect) => {
          setGeneratorTargetCallback(() => onSelect || null);
          setIsGeneratorOpen(true);
        }}
      />

      {/* Password Generator Modal - Rendered with zIndex: 1200 on top of ItemEditorModal */}
      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        zIndex={1200}
        onClose={() => {
          setIsGeneratorOpen(false);
          setGeneratorTargetCallback(null);
        }}
        onSelectPassword={
          generatorTargetCallback
            ? (pwd) => {
              generatorTargetCallback(pwd);
              setIsGeneratorOpen(false);
              setGeneratorTargetCallback(null);
            }
            : undefined
        }
      />
    </div>
  );
};
export default App;
