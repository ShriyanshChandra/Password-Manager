import type { ExtensionVaultItem } from '../types/extension';

/**
 * Extracts a normalized hostname/domain from a URL string.
 */
export function extractDomain(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    let urlToParse = rawUrl.trim();
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      urlToParse = 'https://' + urlToParse;
    }
    const parsed = new URL(urlToParse);
    let hostname = parsed.hostname.toLowerCase();

    // Strip common "www." prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    // If not a valid URL, clean manual string
    return rawUrl
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
  }
}

/**
 * Extracts the second-level root domain (e.g. "github.com" from "sub.github.com")
 */
export function getRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const secondLast = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  const twoLevelTLDs = ['co', 'com', 'org', 'net', 'edu', 'gov', 'ac'];
  if (twoLevelTLDs.includes(secondLast) && last.length === 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Filter vault items matching the given tab URL or domain.
 */
export function findMatchingVaultItems(
  items: ExtensionVaultItem[],
  tabUrl: string
): ExtensionVaultItem[] {
  if (!tabUrl || items.length === 0) return [];

  // Special convenience: on the extension's own onboarding sandbox (welcome.html),
  // return the first available credential for interactive testing
  if (tabUrl.includes('welcome.html')) {
    return items.slice(0, 1);
  }

  const tabHost = extractDomain(tabUrl);
  if (!tabHost || tabHost === 'newtab' || tabHost === 'extensions') return [];

  const tabRoot = getRootDomain(tabHost);

  return items.filter(item => {
    if (!item.url && !item.title) return false;

    // 1. Check item URL
    if (item.url) {
      const itemHost = extractDomain(item.url);
      const itemRoot = getRootDomain(itemHost);

      if (itemHost === tabHost || itemRoot === tabRoot) {
        return true;
      }
      if (
        (itemHost && tabHost.includes(itemHost)) ||
        (itemHost && itemHost.includes(tabHost))
      ) {
        return true;
      }
    }

    // 2. Fallback: check item title vs domain name (e.g. title: "GitHub", domain: "github.com")
    if (item.title) {
      const cleanTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanHost = tabHost.split('.')[0].toLowerCase();
      if (
        cleanTitle &&
        cleanHost &&
        (cleanTitle === cleanHost ||
          cleanHost.includes(cleanTitle) ||
          cleanTitle.includes(cleanHost))
      ) {
        return true;
      }
    }

    return false;
  });
}

