import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { UnlockScreen } from './components/UnlockScreen';
import { VaultDashboard } from './components/VaultDashboard';
import { PasswordGeneratorModal } from './components/PasswordGeneratorModal';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { FirebaseModal } from './components/FirebaseModal';
import { ExtensionModal } from './components/ExtensionModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import type { VaultItem, EncryptedVaultBundle } from './types/vault';
import { vaultStorage } from './services/vaultStorage';
import { firebaseService } from './services/firebaseService';
import { performSecurityAudit } from './crypto/passwordUtils';
import { cyberAudio } from './utils/cyberAudio';

const AUTO_LOCK_DEFAULT_SECONDS = 900; // 15 minutes of inactivity

export const App: React.FC = () => {
  // Vault state
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [vaultBundle, setVaultBundle] = useState<EncryptedVaultBundle | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);

  // Auto-lock countdown
  const [autoLockSeconds, setAutoLockSeconds] = useState<number>(AUTO_LOCK_DEFAULT_SECONDS);
  const autoLockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modals
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isFirebaseOpen, setIsFirebaseOpen] = useState(false);
  const [isExtensionOpen, setIsExtensionOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);

  // Preferences & Appearance
  const [crtActive, setCrtActive] = useState<boolean>(true);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Check initial configuration on mount
  useEffect(() => {
    setIsFirebaseConnected(firebaseService.getStatus().isConfigured);
  }, []);

  // Lock Vault Action
  const handleLockVault = useCallback(async () => {
    setMasterKey(null);
    setItems([]);
    setIsLocked(true);
    setAutoLockSeconds(AUTO_LOCK_DEFAULT_SECONDS);
    if (autoLockTimerRef.current) {
      clearInterval(autoLockTimerRef.current);
    }
    // Sign out from Firebase Auth to ensure full lock
    try {
      await firebaseService.signOutUser();
    } catch {
      // Ignored
    }
  }, []);

  // Reset Auto Lock countdown on user activity
  const resetInactivityTimer = useCallback(() => {
    if (!isLocked) {
      setAutoLockSeconds(AUTO_LOCK_DEFAULT_SECONDS);
    }
  }, [isLocked]);

  useEffect(() => {
    if (isLocked) return;

    const handleActivity = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    autoLockTimerRef.current = setInterval(() => {
      setAutoLockSeconds((prev) => {
        if (prev <= 1) {
          cyberAudio.playLockSound();
          handleLockVault();
          return AUTO_LOCK_DEFAULT_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
      }
    };
  }, [isLocked, handleLockVault, resetInactivityTimer]);

  // Sign In with Email & Master Password
  const handleSignIn = async (email: string, masterPassword: string) => {
    // 1. Authenticate with Firebase Email/Password
    await firebaseService.signInWithEmail(email, masterPassword);

    // 2. Fetch encrypted ciphertext bundle from Firestore or LocalStorage
    let bundle = await firebaseService.fetchFromCloud();
    if (!bundle) {
      bundle = await vaultStorage.getBundle();
    }

    if (!bundle) {
      // First sign-in for this user, initialize vault with demo/starter items
      const initResult = await vaultStorage.initializeVault(masterPassword, undefined, true);
      setMasterKey(initResult.masterKey);
      setVaultBundle(initResult.bundle);
      setItems(initResult.items);
      setIsLocked(false);
      return;
    }

    // 3. Unlock with Master Password (verifies authHash and decrypts client-side)
    const { masterKey: key, items: decryptedItems } = await vaultStorage.unlockVault(masterPassword);
    setMasterKey(key);
    setVaultBundle(bundle);
    setItems(decryptedItems);
    setIsLocked(false);
  };

  // Sign Up with Email & Master Password
  const handleSignUp = async (email: string, masterPassword: string, hint?: string) => {
    // 1. Create account in Firebase Auth
    await firebaseService.signUpWithEmail(email, masterPassword);

    // 2. Client-side initialize zero-knowledge vault and save encrypted bundle to Firestore
    const initResult = await vaultStorage.initializeVault(masterPassword, hint, true);
    setMasterKey(initResult.masterKey);
    setVaultBundle(initResult.bundle);
    setItems(initResult.items);
    setIsLocked(false);
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
  };

  // Delete vault item
  const handleDeleteItem = async (id: string) => {
    if (!masterKey || !vaultBundle) return;

    const updatedItems = items.filter((i) => i.id !== id);
    setItems(updatedItems);
    const newBundle = await vaultStorage.saveVault(updatedItems, masterKey, vaultBundle);
    setVaultBundle(newBundle);
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
      {/* CRT Scanline & Grain overlay if active */}
      {crtActive && <div className="crt-overlay crt-active" />}

      {/* Navigation Header */}
      <Header
        isLocked={isLocked}
        onLockVault={handleLockVault}
        onOpenGenerator={() => setIsGeneratorOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        onOpenFirebase={() => setIsFirebaseOpen(true)}
        onOpenExtension={() => setIsExtensionOpen(true)}
        isFirebaseConnected={isFirebaseConnected}
        autoLockSeconds={autoLockSeconds}
        overallScore={auditReport.overallScore}
        crtActive={crtActive}
        onToggleCrt={() => setCrtActive(!crtActive)}
        soundMuted={soundMuted}
        onToggleSound={() => setSoundMuted(!soundMuted)}
      />

      {/* Main Viewport */}
      {isLocked ? (
        <UnlockScreen
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
        />
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
          onOpenGenerator={() => setIsGeneratorOpen(true)}
          onOpenAudit={() => setIsAuditOpen(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />
      )}

      {/* Password Generator Modal */}
      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSelectPassword={(pwd) => {
          if (editingItem) {
            setEditingItem({ ...editingItem, password: pwd });
          }
        }}
      />

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

      {/* Firebase Settings Modal */}
      <FirebaseModal
        isOpen={isFirebaseOpen}
        onClose={() => setIsFirebaseOpen(false)}
        onConfigChanged={() => {
          setIsFirebaseConnected(firebaseService.getStatus().isConfigured);
        }}
      />

      {/* Browser Extension Modal */}
      <ExtensionModal
        isOpen={isExtensionOpen}
        onClose={() => setIsExtensionOpen(false)}
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
        onOpenGenerator={() => setIsGeneratorOpen(true)}
      />
    </div>
  );
};
export default App;
