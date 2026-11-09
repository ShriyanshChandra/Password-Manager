import type {
  ExtensionVaultItem,
  EncryptedVaultBundle,
  ExtensionMessage,
  ExtensionResponse,
  VaultStatus,
  ActiveTabInfo,
} from './types/extension';
import {
  deriveAuthHash,
  deriveKey,
  decryptVault,
  encryptVault,
} from './crypto/extensionCrypto';
import { ExtensionStorageService } from './services/extensionStorage';
import { extractDomain, findMatchingVaultItems } from './services/urlMatcher';

// In-memory volatile session cache (cleared on lock or worker termination)
let sessionMasterKey: CryptoKey | null = null;
let sessionSalt: string | null = null;
let sessionAuthHash: string | null = null;
let sessionHint: string | undefined = undefined;
let decryptedVaultItems: ExtensionVaultItem[] | null = null;
let lastActiveTimestamp: number = Date.now();

const AUTO_LOCK_ALARM = 'CIPHER_VAULT_AUTO_LOCK_CHECK';

// Update extension icon badge for active tab
async function updateTabBadge(tab?: chrome.tabs.Tab): Promise<void> {
  try {
    let currentTab = tab;
    if (!currentTab || !currentTab.url) {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = active;
    }

    if (!currentTab || !currentTab.url || !decryptedVaultItems) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    const matches = findMatchingVaultItems(decryptedVaultItems, currentTab.url);
    if (matches.length > 0) {
      await chrome.action.setBadgeText({ text: matches.length.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#ffb800' }); // Sunset Gold
      if (chrome.action.setBadgeTextColor) {
        await chrome.action.setBadgeTextColor({ color: '#0d0520' }); // Void Indigo
      }
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.warn('Failed to update tab badge:', err);
  }
}

// Get current active tab info
async function getActiveTabInfo(): Promise<ActiveTabInfo> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      return {
        id: tab.id,
        url: tab.url,
        domain: extractDomain(tab.url),
        title: tab.title || '',
      };
    }
  } catch (err) {
    console.warn('Error querying active tab:', err);
  }
  return { url: '', domain: '', title: '' };
}

// Lock vault and purge all decrypted data
async function lockSession(manualUserAction = false): Promise<void> {
  sessionMasterKey = null;
  sessionSalt = null;
  sessionAuthHash = null;
  sessionHint = undefined;

  // Only purge persistent decrypted cache if the user explicitly clicked "Lock Vault" or disconnected
  if (manualUserAction) {
    decryptedVaultItems = null;
    if (chrome.storage?.session) {
      await chrome.storage.session.remove('session_decrypted_items').catch(() => {});
    }
    await ExtensionStorageService.clearPersistentItems();
    await ExtensionStorageService.saveConnectedAccount({ email: '', lastSync: 0 });
  }
  chrome.action.setBadgeText({ text: '' }).catch(() => {});
}

// Restore decrypted items: checks memory -> storage.session -> storage.local (Always Signed In)
async function ensureSessionItems(): Promise<ExtensionVaultItem[] | null> {
  if (decryptedVaultItems !== null) {
    return decryptedVaultItems;
  }

  // 1. Check storage.session (if worker briefly restarted)
  if (chrome.storage?.session) {
    try {
      const sess = await chrome.storage.session.get('session_decrypted_items');
      if (sess && Array.isArray(sess.session_decrypted_items)) {
        decryptedVaultItems = sess.session_decrypted_items;
        return decryptedVaultItems;
      }
    } catch {
      // Ignore
    }
  }

  // 2. Check persistent storage so extension stays ALWAYS signed in across browser restarts/close
  try {
    const persistentItems = await ExtensionStorageService.loadPersistentItems();
    if (persistentItems !== null && Array.isArray(persistentItems)) {
      decryptedVaultItems = persistentItems;
      // Mirror to storage.session as well
      if (chrome.storage?.session) {
        await chrome.storage.session.set({ session_decrypted_items: persistentItems }).catch(() => {});
      }
      return decryptedVaultItems;
    }
  } catch (err) {
    console.warn('Failed to load persistent items:', err);
  }

  return null;
}

// Save in-memory session items to volatile storage.session and persistent storage
async function setSessionItems(items: ExtensionVaultItem[]): Promise<void> {
  decryptedVaultItems = items;
  if (chrome.storage?.session) {
    try {
      await chrome.storage.session.set({ session_decrypted_items: items });
    } catch {
      // Ignore
    }
  }
  // Persist to local storage so extension stays ALWAYS signed in & connected
  await ExtensionStorageService.savePersistentItems(items);
}

// Broadcast vault unlocked event to active tab so it can immediately auto-fill
async function notifyActiveTabVaultUnlocked(): Promise<void> {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'VAULT_UNLOCKED_AUTOFILL' });
    }
  } catch {
    // Content script might not be injected or tab is restricted
  }
}

// Check auto-lock timeout
async function checkAutoLock(): Promise<void> {
  const settings = await ExtensionStorageService.loadSettings();
  if (settings.alwaysSignedIn || !settings.autoLockMinutes || settings.autoLockMinutes <= 0) {
    return; // Never auto-lock when Always Signed In is active
  }

  const elapsedMs = Date.now() - lastActiveTimestamp;
  const timeoutMs = settings.autoLockMinutes * 60 * 1000;

  if (elapsedMs >= timeoutMs) {
    console.log('[CIPHER//VAULT] Auto-lock triggered due to inactivity');
    await lockSession(true);
  }
}

// Initialize alarm for auto-lock checking every 1 minute
chrome.alarms.create(AUTO_LOCK_ALARM, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    checkAutoLock().catch(() => {});
  }
});

// Initialize session and restore persistent items on service worker wake
ensureSessionItems().then((items) => {
  if (items && items.length > 0) {
    console.log(`[CIPHER//VAULT] Always-Connected: Loaded ${items.length} credentials into active session.`);
    updateTabBadge().catch(() => {});
  }
});

// Browser startup listener
if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    const items = await ensureSessionItems();
    if (items && items.length > 0) {
      await updateTabBadge();
    }
  });
}

// On first install, automatically launch the Extension Webpage
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const welcomeUrl = chrome.runtime.getURL('welcome.html');
    chrome.tabs.create({ url: welcomeUrl });
  }
});

// Tab listeners to dynamically update badge
chrome.tabs.onActivated.addListener(async () => {
  lastActiveTimestamp = Date.now();
  await updateTabBadge();
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await updateTabBadge(tab);
  }
});

// Central message dispatcher
chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as ExtensionMessage;
  lastActiveTimestamp = Date.now();

  (async () => {
    switch (message.type) {
      case 'GET_VAULT_STATUS': {
        const items = await ensureSessionItems();
        const bundle = await ExtensionStorageService.loadBundle();
        const activeTab = await getActiveTabInfo();
        const connectedAccount = await ExtensionStorageService.loadConnectedAccount();
        const isUnlocked = items !== null;
        let matchingCount = 0;

        if (isUnlocked && items && activeTab.url) {
          matchingCount = findMatchingVaultItems(items, activeTab.url).length;
        }

        const status: VaultStatus = {
          isInitialized: bundle !== null || items !== null,
          isUnlocked,
          isAlwaysConnected: !!(connectedAccount?.email || items !== null),
          accountEmail: connectedAccount?.email,
          lastSyncedAt: connectedAccount?.lastSync || bundle?.updatedAt,
          itemCount: items ? items.length : 0,
          matchingCount,
          hint: bundle?.hint,
          activeDomain: activeTab.domain,
        };

        return { success: true, data: { status, activeTab } };
      }

      case 'UNLOCK_VAULT': {
        try {
          const bundle = await ExtensionStorageService.loadBundle();
          if (!bundle) {
            return { success: false, error: 'Vault has not been initialized yet.' };
          }

          // Verify auth hash
          const computedAuthHash = await deriveAuthHash(message.masterPassword, bundle.salt);
          if (computedAuthHash !== bundle.authHash) {
            return { success: false, error: 'Invalid master cipher key.' };
          }

          // Derive AES-GCM key and decrypt items
          const key = await deriveKey(message.masterPassword, bundle.salt);
          const items = await decryptVault(bundle, key);

          sessionMasterKey = key;
          sessionSalt = bundle.salt;
          sessionAuthHash = bundle.authHash;
          sessionHint = bundle.hint;
          await setSessionItems(items);
          lastActiveTimestamp = Date.now();

          await updateTabBadge();
          notifyActiveTabVaultUnlocked().catch(() => {});
          return { success: true, data: { count: items.length } };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Decryption failure: ${errMsg}` };
        }
      }

      case 'LOCK_VAULT': {
        await lockSession(true);
        return { success: true };
      }

      case 'DISCONNECT_ACCOUNT': {
        await lockSession(true);
        if (chrome.storage?.local) {
          await chrome.storage.local.remove([
            'cipher_vault_persistent_items',
            'cipher_vault_connected_account',
            'cipher_vault_encrypted_bundle',
          ]).catch(() => {});
        }
        return { success: true };
      }

      case 'GET_MATCHING_CREDENTIALS': {
        const items = await ensureSessionItems();
        if (!items) {
          return { success: false, error: 'Vault is locked.' };
        }
        let targetUrl = message.url || _sender.tab?.url || _sender.url;
        if (!targetUrl) {
          const activeTab = await getActiveTabInfo();
          targetUrl = activeTab.url;
        }
        const matches = findMatchingVaultItems(items, targetUrl);
        return { success: true, data: matches };
      }

      case 'GET_ALL_CREDENTIALS': {
        const items = await ensureSessionItems();
        if (!items) {
          return { success: false, error: 'Vault is locked.' };
        }
        return { success: true, data: items };
      }

      case 'SAVE_CREDENTIAL': {
        if (!sessionMasterKey || !decryptedVaultItems || !sessionSalt || !sessionAuthHash) {
          return { success: false, error: 'Cannot save: Vault is locked.' };
        }

        const item = message.item;
        const existingIdx = decryptedVaultItems.findIndex(i => i.id === item.id);
        if (existingIdx >= 0) {
          decryptedVaultItems[existingIdx] = item;
        } else {
          decryptedVaultItems.push(item);
        }

        // Re-encrypt bundle and persist
        const newBundle = await encryptVault(
          decryptedVaultItems,
          sessionMasterKey,
          sessionSalt,
          sessionAuthHash,
          sessionHint
        );
        await ExtensionStorageService.saveBundle(newBundle);
        await updateTabBadge();

        return { success: true, data: item };
      }

      case 'UPDATE_VAULT_BUNDLE': {
        const bundle: EncryptedVaultBundle = message.bundle;
        await ExtensionStorageService.saveBundle(bundle);
        lockSession(); // Require re-authentication with new bundle
        return { success: true };
      }

      case 'OPEN_CONNECT_TAB': {
        const localPort = (message as { port?: number | string }).port || '5174';
        const targetUrl = message.target === 'prod'
          ? 'https://password-manager-phi-nine.vercel.app/?connect_extension=true'
          : `http://localhost:${localPort}/?connect_extension=true`;
        const createdTab = await chrome.tabs.create({ url: targetUrl });
        return { success: true, data: { tabId: createdTab.id, url: targetUrl } };
      }

      case 'RESYNC_VAULT': {
        const target = (message as { target?: string }).target;

        let urlFilters = ['*://localhost/*', '*://127.0.0.1/*', 'https://*.vercel.app/*'];
        if (target === 'localhost') {
          urlFilters = ['*://localhost/*', '*://127.0.0.1/*'];
        } else if (target === 'vercel') {
          urlFilters = ['https://*.vercel.app/*'];
        }

        let syncedItemsCount: number | null = null;
        let syncedEmail: string | undefined = undefined;

        try {
          const candidateTabs = await chrome.tabs.query({ url: urlFilters });
          if (candidateTabs && candidateTabs.length > 0) {
            for (const tab of candidateTabs) {
              if (tab.id) {
                try {
                  const res = await new Promise<{ success: boolean; itemCount?: number; accountEmail?: string } | null>((resolve) => {
                    chrome.tabs.sendMessage(tab.id!, { type: 'REQUEST_VAULT_RESYNC' }, (resp) => {
                      if (chrome.runtime.lastError || !resp) {
                        resolve(null);
                      } else {
                        resolve(resp);
                      }
                    });
                  });

                  if (res && res.success) {
                    syncedItemsCount = res.itemCount ?? 0;
                    syncedEmail = res.accountEmail;
                    break;
                  }
                } catch {
                  // Tab not reachable
                }
              }
            }
          }
        } catch (err) {
          console.warn('Error querying tabs during RESYNC_VAULT:', err);
        }

        // 2. If no tab supplied new items, refresh from persistent storage
        if (syncedItemsCount === null) {
          const persistent = await ExtensionStorageService.loadPersistentItems();
          if (persistent !== null) {
            await setSessionItems(persistent);
            syncedItemsCount = persistent.length;
            const account = await ExtensionStorageService.loadConnectedAccount();
            syncedEmail = account?.email;
          } else {
            syncedItemsCount = decryptedVaultItems ? decryptedVaultItems.length : 0;
          }
        }

        // Update connected account sync time and refresh badge
        const currentAccount = await ExtensionStorageService.loadConnectedAccount();
        const updatedEmail = syncedEmail || currentAccount?.email || 'Connected Account';
        await ExtensionStorageService.saveConnectedAccount({
          email: updatedEmail,
          lastSync: Date.now(),
        });
        await updateTabBadge();
        notifyActiveTabVaultUnlocked().catch(() => {});

        return {
          success: true,
          data: {
            itemCount: syncedItemsCount,
            lastSyncedAt: Date.now(),
            accountEmail: updatedEmail,
          },
        };
      }

      case 'SYNC_FROM_WEBAPP': {
        const { bundle, items, accountEmail } = message;
        if (!bundle || !bundle.salt || !bundle.authHash) {
          return { success: false, error: 'Invalid bundle structure from web application.' };
        }
        await ExtensionStorageService.saveBundle(bundle);

        if (items && Array.isArray(items)) {
          await setSessionItems(items);
          sessionSalt = bundle.salt;
          sessionAuthHash = bundle.authHash;
          sessionHint = bundle.hint;
        }

        const email = accountEmail || (bundle.hint && bundle.hint.includes('@') ? bundle.hint : 'Connected Account');
        await ExtensionStorageService.saveConnectedAccount({
          email,
          lastSync: Date.now(),
        });

        // Ensure settings are set to alwaysSignedIn = true and autoLockMinutes = 0
        const currentSettings = await ExtensionStorageService.loadSettings();
        await ExtensionStorageService.saveSettings({
          ...currentSettings,
          alwaysSignedIn: true,
          autoLockMinutes: 0,
        });

        lastActiveTimestamp = Date.now();
        await updateTabBadge();
        notifyActiveTabVaultUnlocked().catch(() => {});

        return {
          success: true,
          data: {
            itemCount: items?.length || 0,
            updatedAt: bundle.updatedAt,
            accountEmail: email,
          },
        };
      }

      case 'AUTOFILL_TAB': {
        const tabInfo = await getActiveTabInfo();
        const tabId = message.tabId || tabInfo.id;
        if (!tabId) {
          return { success: false, error: 'No active tab found to autofill.' };
        }

        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'FILL_CREDENTIALS',
            credentials: message.credentials,
          });
          return { success: true };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Content script autofill failed: ${errMsg}` };
        }
      }

      default:
        return { success: false, error: 'Unknown message type.' };
    }
  })()
    .then((res: ExtensionResponse) => sendResponse(res))
    .catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ success: false, error: errMsg });
    });

  return true; // Keep channel open for async sendResponse
});

// External message listener for direct web app communication (via externally_connectable)
if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((rawMessage, _sender, sendResponse) => {
    const message = rawMessage as {
      type: string;
      bundle?: EncryptedVaultBundle;
      items?: ExtensionVaultItem[];
      accountEmail?: string;
    };
    if (message.type === 'CIPHER_VAULT_SYNC_PAYLOAD' && message.bundle) {
      (async () => {
        await ExtensionStorageService.saveBundle(message.bundle!);
        if (message.items) {
          await setSessionItems(message.items);
          sessionSalt = message.bundle!.salt;
          sessionAuthHash = message.bundle!.authHash;
          sessionHint = message.bundle!.hint;
        }
        if (message.accountEmail) {
          await ExtensionStorageService.saveConnectedAccount({
            email: message.accountEmail,
            lastSync: Date.now(),
          });
        }
        await updateTabBadge();
        return { success: true, count: message.items?.length || 0 };
      })()
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ success: false, error: String(err) }));
      return true;
    }
  });
}


