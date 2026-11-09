import type { AutoFillPayload } from './types/extension';

/**
 * CIPHER//VAULT Content Script
 * Responsible for detecting form inputs and accurately autofilling credentials.
 */

// Helper to determine if an input element is genuinely visible on page
function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  if ((el as HTMLInputElement).disabled) return false;

  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
  } catch {
    // getComputedStyle might fail in detached edge cases
  }

  return true;
}

// Checks if an element is a password field (by type or attributes)
function isPasswordField(el: HTMLInputElement): boolean {
  if (!el) return false;
  if (el.type === 'password') return true;

  const name = (el.name || '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const autocomplete = (el.autocomplete || '').toLowerCase();

  if (
    autocomplete.includes('password') ||
    autocomplete.includes('current-password') ||
    autocomplete.includes('new-password')
  ) {
    return true;
  }

  if (
    name.includes('password') ||
    name.includes('passwd') ||
    id.includes('password') ||
    id.includes('passwd')
  ) {
    return true;
  }

  return false;
}

// Check if an input is a text-like input that could hold a username / email
function isTextLikeInput(el: HTMLInputElement): boolean {
  if (!isElementVisible(el)) return false;
  if (isPasswordField(el)) return false;

  const type = (el.type || 'text').toLowerCase();
  const nonTextTypes = [
    'password',
    'hidden',
    'submit',
    'button',
    'reset',
    'checkbox',
    'radio',
    'file',
    'image',
    'range',
    'color',
    'date',
    'time',
  ];

  return !nonTextTypes.includes(type);
}

// Native value setter helper for React/Vue/Angular synthetic event compatibility
function setNativeInputValue(element: HTMLInputElement, value: string): void {
  if (!element || value === undefined || value === null) return;

  try {
    element.focus();
  } catch {
    // Focus might fail if detached or hidden
  }

  // 1. Use the native HTMLInputElement prototype setter to bypass React 15/16/17/18/19 wrapper
  const prototype = window.HTMLInputElement.prototype;
  const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (nativeValueSetter) {
    nativeValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  // 2. Reset React internal value tracker so React onChange observer detects the update
  try {
    const tracker = (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
    if (tracker) {
      tracker.setValue('__cv_' + Math.random().toString(36).substring(2, 6));
    }
  } catch {
    // Non-React element, ignore
  }

  // 3. Dispatch full set of input/change events with bubbles
  try {
    if (typeof InputEvent === 'function') {
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertReplacementText',
          data: value,
        })
      );
    } else {
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
  } catch {
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  }

  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  // 4. Trigger blur to notify validation watchers
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Scores candidate input elements for how likely they are to be the username/email input
function scoreUsernameCandidate(
  input: HTMLInputElement,
  referencePassword?: HTMLInputElement | null
): number {
  let score = 0;

  const name = (input.name || '').toLowerCase();
  const id = (input.id || '').toLowerCase();
  const placeholder = (input.placeholder || '').toLowerCase();
  const autocomplete = (input.autocomplete || '').toLowerCase();
  const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
  const type = (input.type || 'text').toLowerCase();

  // Instant disqualification
  if (isPasswordField(input)) {
    return -9999;
  }

  // Heavily penalize search bars, search queries, filter boxes
  if (
    type === 'search' ||
    name.includes('search') ||
    id.includes('search') ||
    placeholder.includes('search') ||
    ariaLabel.includes('search')
  ) {
    return -1000;
  }

  // Penalize captcha, otp, 2fa, pin, verification token fields
  if (
    name.includes('captcha') ||
    id.includes('captcha') ||
    name.includes('otp') ||
    id.includes('otp') ||
    name.includes('pin') ||
    id.includes('pin') ||
    name.includes('token') ||
    id.includes('token')
  ) {
    return -500;
  }

  // 1. Gold standard: Standard HTML5 autocomplete attribute
  if (autocomplete === 'username' || autocomplete === 'email') {
    score += 150;
  } else if (autocomplete.includes('username') || autocomplete.includes('email')) {
    score += 100;
  }

  // 2. High priority: Name or ID matches login/user keywords
  const exactKeywords = ['username', 'user_name', 'login', 'email', 'e-mail', 'account', 'identifier', 'handle'];
  for (const kw of exactKeywords) {
    if (name === kw || id === kw) {
      score += 90;
      break;
    } else if (name.includes(kw) || id.includes(kw)) {
      score += 45;
      break;
    }
  }

  // 3. Medium priority: Placeholder or ARIA label
  if (
    placeholder.includes('user') ||
    placeholder.includes('email') ||
    placeholder.includes('login') ||
    placeholder.includes('phone') ||
    placeholder.includes('account')
  ) {
    score += 40;
  }
  if (
    ariaLabel.includes('user') ||
    ariaLabel.includes('email') ||
    ariaLabel.includes('login') ||
    ariaLabel.includes('account')
  ) {
    score += 40;
  }

  // 4. Type is email or tel
  if (type === 'email') {
    score += 45;
  } else if (type === 'tel') {
    score += 25;
  }

  // 5. Positional relationship to the password field
  if (referencePassword) {
    // Bonus for sharing the same form or closest container
    if (input.form && referencePassword.form && input.form === referencePassword.form) {
      score += 60;
    } else if (
      input.closest('form') &&
      referencePassword.closest('form') &&
      input.closest('form') === referencePassword.closest('form')
    ) {
      score += 60;
    }

    // Check DOM position relative to password field
    const pos = input.compareDocumentPosition(referencePassword);
    if ((pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
      // Standard login layout: username input appears BEFORE password input in DOM
      score += 80;
    } else {
      // Input appears AFTER password input: rarely ever a username field
      score -= 250;
    }
  }

  return score;
}

// Find primary username and password inputs on the page
function findAuthInputs(targetPasswordInput?: HTMLInputElement): {
  usernameInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
} {
  // 1. Identify primary password input
  let primaryPasswordInput = targetPasswordInput || null;

  if (!primaryPasswordInput) {
    const passwordInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="password"]')
    ).filter(isElementVisible);

    if (passwordInputs.length > 0) {
      primaryPasswordInput = passwordInputs[0];
    } else {
      // Fallback: check inputs with password-related attributes
      const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(
        isElementVisible
      );
      primaryPasswordInput = allInputs.find(isPasswordField) || null;
    }
  }

  // 2. Identify primary username input
  let usernameInput: HTMLInputElement | null = null;

  // Gather all candidate text-like inputs
  const allCandidates = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(
    (input) => input !== primaryPasswordInput && isTextLikeInput(input)
  );

  if (allCandidates.length > 0) {
    // Score all candidates
    const scoredCandidates = allCandidates
      .map((input) => ({
        input,
        score: scoreUsernameCandidate(input, primaryPasswordInput),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 0) {
      usernameInput = scoredCandidates[0].input;
    }
  }

  // 3. Fallback: If no candidate scored positively, but password field exists in a form,
  // find the closest preceding text input in the same form
  if (!usernameInput && primaryPasswordInput) {
    const form = primaryPasswordInput.closest('form') || primaryPasswordInput.parentElement;
    if (form) {
      const formInputs = Array.from(form.querySelectorAll<HTMLInputElement>('input')).filter(
        (input) => input !== primaryPasswordInput && isTextLikeInput(input)
      );

      const beforeInputs = formInputs.filter((input) => {
        const pos = input.compareDocumentPosition(primaryPasswordInput!);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });

      if (beforeInputs.length > 0) {
        usernameInput = beforeInputs[beforeInputs.length - 1];
      }
    }
  }

  return {
    usernameInput,
    passwordInput: primaryPasswordInput,
  };
}

// Autofill credentials into page inputs
function autofillCredentials(
  credentials: AutoFillPayload,
  targetPasswordInput?: HTMLInputElement
): boolean {
  const { usernameInput, passwordInput } = findAuthInputs(targetPasswordInput);
  let filledAny = false;

  console.log('[CIPHER//VAULT Autofill]', {
    hasUsernameValue: !!credentials.username,
    hasPasswordValue: !!credentials.password,
    detectedUsernameInput: usernameInput
      ? { name: usernameInput.name, id: usernameInput.id, type: usernameInput.type }
      : null,
    detectedPasswordInput: passwordInput
      ? { name: passwordInput.name, id: passwordInput.id, type: passwordInput.type }
      : null,
  });

  if (credentials.username && usernameInput) {
    setNativeInputValue(usernameInput, credentials.username);
    usernameInput.classList.add('cipher-vault-fill-highlight');
    setTimeout(() => usernameInput.classList.remove('cipher-vault-fill-highlight'), 1200);
    filledAny = true;
  }

  if (credentials.password && passwordInput) {
    setNativeInputValue(passwordInput, credentials.password);
    passwordInput.classList.add('cipher-vault-fill-highlight');
    setTimeout(() => passwordInput.classList.remove('cipher-vault-fill-highlight'), 1200);
    filledAny = true;
  }

  return filledAny;
}

// Attach a subtle floating Cyber Lock badge to password fields
function attachAutofillTriggers(): void {
  const passwordInputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="password"]:not([data-cipher-vault-attached])'
  );

  passwordInputs.forEach((input) => {
    // Mark as handled
    input.setAttribute('data-cipher-vault-attached', 'true');

    // Create wrapper if not already wrapped
    const parent = input.parentElement;
    if (!parent) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cipher-vault-autofill-btn';
    btn.title = 'CIPHER//VAULT: Click to autofill credentials';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v3H9V7zm3 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
      </svg>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Ask background to get matching credentials
      chrome.runtime.sendMessage({ type: 'GET_MATCHING_CREDENTIALS', url: window.location.href }, (response) => {
        if (response && response.success && response.data && response.data.length > 0) {
          const firstMatch = response.data[0];
          autofillCredentials(
            {
              username: firstMatch.username,
              password: firstMatch.password,
            },
            input // Pass the exact password input the user clicked!
          );
        } else {
          // If no domain-specific matches, check if there are credentials in vault
          chrome.runtime.sendMessage({ type: 'GET_ALL_CREDENTIALS' }, (allRes) => {
            if (allRes && allRes.success && allRes.data && allRes.data.length > 0) {
              if (allRes.data.length === 1) {
                // If only 1 credential exists in vault, autofill it for convenience
                const singleMatch = allRes.data[0];
                autofillCredentials(
                  { username: singleMatch.username, password: singleMatch.password },
                  input
                );
              } else {
                alert(`CIPHER//VAULT: No credentials saved for ${window.location.hostname}. Please open the extension popup to select or add one.`);
              }
            } else {
              alert('CIPHER//VAULT: Please open the extension popup in your browser toolbar to connect your vault.');
            }
          });
        }
      });
    });

    // Append button next to the input
    if (parent.style.position !== 'absolute' && parent.style.position !== 'relative') {
      parent.style.position = 'relative';
    }
    parent.appendChild(btn);
  });
}

// ==========================================
// Automatic Autofill Engine
// ==========================================
let hasAutoFilledCurrentPage = false;
let autoFillDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function tryAutomaticAutofill(): void {
  if (hasAutoFilledCurrentPage) return;
  const { usernameInput, passwordInput } = findAuthInputs();
  if (!usernameInput && !passwordInput) return;

  try {
    chrome.runtime.sendMessage(
      { type: 'GET_MATCHING_CREDENTIALS', url: window.location.href },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
          const match = response.data[0];
          if (match && (match.username || match.password)) {
            // Re-find fresh inputs in case DOM rendered or updated
            const fresh = findAuthInputs();
            const targetUser = fresh.usernameInput;
            const targetPass = fresh.passwordInput;

            // If fields are already filled with these exact credentials, mark satisfied
            const userSatisfied = !match.username || (targetUser !== null && targetUser.value === match.username);
            const passSatisfied = !match.password || (targetPass !== null && targetPass.value === match.password);

            if (userSatisfied && passSatisfied && (targetUser || targetPass)) {
              hasAutoFilledCurrentPage = true;
              return;
            }

            const didFill = autofillCredentials(
              {
                username: match.username,
                password: match.password,
              },
              targetPass || undefined
            );
            if (didFill) {
              hasAutoFilledCurrentPage = true;
              console.log(
                '[CIPHER//VAULT] Automatically autofilled credentials for:',
                window.location.hostname
              );
            }
          }
        }
      }
    );
  } catch {
    // Context may be invalidated on extension reload
  }
}

function scheduleAutomaticAutofill(delayMs = 150): void {
  if (autoFillDebounceTimer) {
    clearTimeout(autoFillDebounceTimer);
  }
  autoFillDebounceTimer = setTimeout(() => {
    tryAutomaticAutofill();
  }, delayMs);
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FILL_CREDENTIALS') {
    const success = autofillCredentials(message.credentials);
    hasAutoFilledCurrentPage = true;
    sendResponse({ success });
  } else if (message.type === 'VAULT_UNLOCKED_AUTOFILL') {
    hasAutoFilledCurrentPage = false;
    scheduleAutomaticAutofill(50);
    sendResponse({ success: true });
  } else if (message.type === 'DETECT_FIELDS') {
    const { usernameInput, passwordInput } = findAuthInputs();
    sendResponse({
      hasPasswordField: passwordInput !== null,
      usernameFound: usernameInput !== null,
    });
  } else if (message.type === 'REQUEST_VAULT_RESYNC') {
    if (isCipherVaultWebApp) {
      let resolved = false;
      const resyncListener = (event: MessageEvent) => {
        if (event.source !== window || !event.data) return;
        if (event.data.type === 'CIPHER_VAULT_SYNC_PAYLOAD') {
          window.removeEventListener('message', resyncListener);
          resolved = true;
          const { bundle, items, accountEmail } = event.data;
          chrome.runtime.sendMessage(
            { type: 'SYNC_FROM_WEBAPP', bundle, items, accountEmail },
            (bgRes) => {
              sendResponse({
                success: bgRes?.success || false,
                itemCount: bgRes?.data?.itemCount ?? (items ? items.length : 0),
                accountEmail: bgRes?.data?.accountEmail || accountEmail,
              });
            }
          );
        }
      };

      window.addEventListener('message', resyncListener);
      window.postMessage({ type: 'CIPHER_VAULT_TRIGGER_RESYNC' }, '*');

      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('message', resyncListener);
          sendResponse({ success: false, error: 'Web vault tab did not return credentials.' });
        }
      }, 1500);

      return true; // Keep message channel open for async response
    } else {
      sendResponse({ success: false, error: 'Not a CIPHER//VAULT web tab.' });
    }
  }
});

function initAutofillAndTriggers(): void {
  attachAutofillTriggers();
  scheduleAutomaticAutofill(100);
  scheduleAutomaticAutofill(600);
  scheduleAutomaticAutofill(1500);
}

// Run detection on DOM ready & observer for dynamic single-page applications
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAutofillAndTriggers);
} else {
  initAutofillAndTriggers();
}

// Observe dynamic DOM changes (e.g. login modal opening dynamically)
const observer = new MutationObserver(() => {
  attachAutofillTriggers();
  scheduleAutomaticAutofill(250);
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

// ==========================================
// Web App Authentication & Vault Sync Bridge
// ==========================================
const isCipherVaultWebApp =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.vercel.app') ||
  window.location.hostname.includes('password-manager') ||
  document.title.includes('CIPHER//VAULT');

if (isCipherVaultWebApp) {
  // Announce extension presence to the web app
  const announcePresence = () => {
    window.postMessage({ type: 'CIPHER_VAULT_EXTENSION_DETECTED', version: '1.0.0' }, '*');
  };

  announcePresence();
  setTimeout(announcePresence, 500);
  setTimeout(announcePresence, 1500);

  // Listen for sync payload from the web app
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === 'CIPHER_VAULT_CHECK_EXTENSION') {
      announcePresence();
    } else if (event.data.type === 'CIPHER_VAULT_SYNC_PAYLOAD') {
      const { bundle, items, accountEmail } = event.data;
      chrome.runtime.sendMessage(
        { type: 'SYNC_FROM_WEBAPP', bundle, items, accountEmail },
        (res) => {
          window.postMessage(
            {
              type: 'CIPHER_VAULT_SYNC_CONFIRMED',
              success: res?.success || false,
              itemCount: res?.data?.itemCount || 0,
              accountEmail: res?.data?.accountEmail,
              error: res?.error,
            },
            '*'
          );
        }
      );
    }
  });
}
