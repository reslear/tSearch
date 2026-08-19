import getLogger from "../tools/getLogger";
import storageGet from "../tools/storageGet";
import storageSet from "../tools/storageSet";

const logger = getLogger('rutrackerProxy');

/**
 * RuTracker sits behind Cloudflare and answers extension-initiated requests with a
 * JS challenge ("Just a moment...", HTTP 403). `fetch` cannot solve that challenge,
 * no amount of header spoofing helps.
 *
 * The official RuTracker add-on solves it by routing the tracker domains through its
 * own proxy with a PAC script. Values below are taken from that add-on
 * (bundle/background.js, config module: `proxies` / `proxiedDomains`).
 *
 * @type {string[]}
 */
const PROXIES = ['HTTPS ps1.blockme.site:443'];

/**
 * Hosts are matched exactly, like in the original add-on — subdomains and other
 * traffic must stay DIRECT.
 * @type {string[]}
 */
const PROXIED_DOMAINS = [
  'rutracker.org',
  'rutracker.wiki',
  'api.rutracker.cc',
  'rep.rutracker.cc',
  'static.rutracker.cc',
];

const STORAGE_KEY = 'rutrackerProxyEnabled';

const isSupported = () => Boolean(chrome.proxy && chrome.proxy.settings);

const buildPacScript = () => [
  `const proxiedDomains = ${JSON.stringify(PROXIED_DOMAINS)};`,
  `const proxies = ${JSON.stringify(PROXIES.join('; '))};`,
  'function FindProxyForURL(url, host) {',
  '  return proxiedDomains.includes(host) ? proxies : "DIRECT";',
  '}',
].join('\n');

const getProxySettings = () => new Promise((resolve, reject) => {
  chrome.proxy.settings.get({incognito: false}, (details) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
    } else {
      resolve(details);
    }
  });
});

const setProxySettings = (value) => new Promise((resolve, reject) => {
  chrome.proxy.settings.set({value, scope: 'regular'}, () => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
    } else {
      resolve();
    }
  });
});

const clearProxySettings = () => new Promise((resolve, reject) => {
  chrome.proxy.settings.clear({scope: 'regular'}, () => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
    } else {
      resolve();
    }
  });
});

/**
 * Another extension (or a policy) may own the proxy settings — in that case we must
 * not fight for them, Chrome would reject the write anyway.
 * @param {string} levelOfControl
 * @return {boolean}
 */
const canControl = (levelOfControl) => [
  'controllable_by_this_extension',
  'controlled_by_this_extension',
].includes(levelOfControl);

const registerProxy = async () => {
  const {levelOfControl} = await getProxySettings();
  if (!canControl(levelOfControl)) {
    logger.warn('proxy settings are not controllable (%s), rutracker requests stay direct', levelOfControl);
    return false;
  }

  await setProxySettings({
    mode: 'pac_script',
    pacScript: {data: buildPacScript()},
  });

  logger.info('proxy enabled for %o via %o', PROXIED_DOMAINS, PROXIES);
  return true;
};

const unregisterProxy = async () => {
  const {levelOfControl} = await getProxySettings();
  if (levelOfControl !== 'controlled_by_this_extension') return false;

  await clearProxySettings();
  logger.info('proxy disabled');
  return true;
};

/**
 * @return {Promise<boolean>}
 */
export const isProxyEnabled = async () => {
  const storage = await storageGet({[STORAGE_KEY]: true});
  return storage[STORAGE_KEY] !== false;
};

/**
 * @param {boolean} enabled
 * @return {Promise<boolean>} whether the browser accepted the change
 */
export const setProxyEnabled = async (enabled) => {
  await storageSet({[STORAGE_KEY]: enabled});
  return syncProxy();
};

/**
 * Applies the stored on/off state to the browser. Safe to call repeatedly.
 * @return {Promise<boolean>}
 */
export const syncProxy = async () => {
  if (!isSupported()) {
    logger.warn('chrome.proxy is not available, "proxy" permission is missing');
    return false;
  }

  try {
    return await isProxyEnabled() ? await registerProxy() : await unregisterProxy();
  } catch (err) {
    logger.error('syncProxy error', err);
    return false;
  }
};

/**
 * Re-applies our PAC when something else resets the browser proxy settings or when the
 * on/off flag changes, and logs PAC failures (an unreachable proxy shows up here and
 * nowhere else).
 */
const listenExternalChanges = () => {
  if (chrome.proxy.settings.onChange) {
    chrome.proxy.settings.onChange.addListener(({levelOfControl}) => {
      if (levelOfControl === 'controlled_by_this_extension') return;
      logger.info('proxy settings changed externally (%s), resyncing', levelOfControl);
      syncProxy();
    });
  }

  if (chrome.proxy.onProxyError) {
    chrome.proxy.onProxyError.addListener(({error, details}) => {
      logger.error('proxy error %s %s', error, details);
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
    syncProxy();
  });
};

/**
 * Called once on service worker startup.
 * @return {Promise<boolean>}
 */
const initProxy = async () => {
  if (!isSupported()) {
    logger.warn('chrome.proxy is not available, "proxy" permission is missing');
    return false;
  }

  listenExternalChanges();
  return syncProxy();
};

export default initProxy;
