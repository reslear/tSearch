import getLogger from "../tools/getLogger";
import storageGet from "../tools/storageGet";
import storageSet from "../tools/storageSet";

const logger = getLogger('trackerProxy');

/**
 * Some trackers cannot be reached by a plain request: rutracker.org is behind a
 * Cloudflare JS challenge that `fetch` cannot solve, others are blocked by ISPs.
 * Both official add-ons solve it the same way — a PAC script that routes only the
 * tracker's own hosts through the tracker's proxy, everything else stays DIRECT.
 *
 * Add a tracker by appending an entry here, nothing else has to change.
 *
 * @typedef {object} TrackerProxy
 * @property {string} id
 * @property {string[]} proxies PAC proxy strings, tried in order
 * @property {string[]} domains exact hosts, `*.example.com` also matches subdomains
 * @property {string} [healthUrl] probed through the proxy, see checkHealth
 * @property {boolean} [healthExpectsOk] treat an HTTP error as a dead proxy too
 *
 * @type {TrackerProxy[]}
 */
const TRACKERS = [
  {
    // Values taken from the official RuTracker add-on
    // (bundle/background.js, config module: `proxies` / `proxiedDomains`).
    id: 'rutracker',
    proxies: ['HTTPS ps1.blockme.site:443'],
    domains: [
      'rutracker.org',
      'rutracker.wiki',
      'api.rutracker.cc',
      'rep.rutracker.cc',
      'static.rutracker.cc',
    ],
    // No healthcheck endpoint, so only a failed connection counts as dead — the
    // forum itself may answer 403 for reasons that have nothing to do with the proxy.
    healthUrl: 'https://rutracker.org/forum/index.php',
  },
  {
    // Values taken from the official PiratBit add-on (pbit_ru 2.0.5, background.js:
    // `server` / `proxyHosts`). That add-on can also pull a fresh proxy from its
    // config endpoint, but the call is commented out there — the hardcoded server
    // below is what actually runs.
    id: 'piratbit',
    proxies: ['HTTPS xuyvamebanyerkn.woman-beauty.top:443'],
    domains: [
      'pb.wtf',
      '*.pb.wtf',
      'piratbit.org',
      '*.piratbit.org',
    ],
    healthUrl: 'https://pb.wtf/healthz',
    healthExpectsOk: true,
  },
];

/**
 * Local mirror of the `proxyEnabled` option. The option itself lives in synced storage
 * and is not readable until the options store has loaded, while the PAC has to be
 * applied as early as possible — background/index.js keeps the two in sync.
 */
const ENABLED_KEY = 'trackerProxyEnabled';
const DEAD_KEY = 'trackerProxyDead';
const PAC_KEY = 'trackerProxyPac';

/** A dead proxy is retried after this long, same as in the PiratBit add-on. */
const DEAD_TTL = 60 * 60 * 1000;
const HEALTH_ALARM = 'trackerProxyHealth';
const HEALTH_PERIOD_MINUTES = 25;
const HEALTH_TIMEOUT = 10 * 1000;

const isSupported = () => Boolean(chrome.proxy && chrome.proxy.settings);

/**
 * Builds the PAC script. Hosts are matched exactly, like in the original add-ons;
 * a `*.example.com` entry additionally matches any subdomain. Everything that is not
 * listed stays DIRECT — we must not route unrelated traffic through tracker proxies.
 * @param {TrackerProxy[]} trackers
 * @return {string}
 */
const buildPacScript = (trackers) => {
  const exactHosts = {};
  const suffixHosts = [];

  trackers.forEach(({domains, proxies}) => {
    const proxy = proxies.join('; ');
    domains.forEach((domain) => {
      if (domain.startsWith('*.')) {
        suffixHosts.push([domain.slice(1), proxy]);
      } else {
        exactHosts[domain] = proxy;
      }
    });
  });

  return [
    `const exactHosts = ${JSON.stringify(exactHosts)};`,
    `const suffixHosts = ${JSON.stringify(suffixHosts)};`,
    'function FindProxyForURL(url, host) {',
    '  if (Object.prototype.hasOwnProperty.call(exactHosts, host)) return exactHosts[host];',
    '  for (let i = 0; i < suffixHosts.length; i++) {',
    '    const suffix = suffixHosts[i][0];',
    '    if (host.length > suffix.length && host.slice(-suffix.length) === suffix) {',
    '      return suffixHosts[i][1];',
    '    }',
    '  }',
    '  return "DIRECT";',
    '}',
  ].join('\n');
};

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

/**
 * Proxies that failed their last healthcheck, `{[trackerId]: timestamp}`.
 * Expired entries are dropped on read, so a dead proxy is retried after DEAD_TTL.
 * @return {Promise<Object<string, number>>}
 */
const getDeadProxies = async () => {
  const storage = await storageGet({[DEAD_KEY]: {}});
  const dead = storage[DEAD_KEY] || {};
  const now = Date.now();

  const alive = {};
  Object.keys(dead).forEach((id) => {
    if (now - dead[id] < DEAD_TTL) {
      alive[id] = dead[id];
    }
  });

  if (Object.keys(alive).length !== Object.keys(dead).length) {
    await storageSet({[DEAD_KEY]: alive});
  }

  return alive;
};

const markProxyDead = async (id) => {
  const dead = await getDeadProxies();
  dead[id] = Date.now();
  await storageSet({[DEAD_KEY]: dead});
  logger.warn('proxy of %s is dead, its hosts go direct for the next hour', id);
};

const markProxyAlive = async (id) => {
  const dead = await getDeadProxies();
  if (!dead[id]) return false;

  delete dead[id];
  await storageSet({[DEAD_KEY]: dead});
  logger.info('proxy of %s is back', id);
  return true;
};

/**
 * Trackers whose proxy is currently used. A dead proxy is worse than no proxy — it
 * breaks the host for the whole browser — so those are left out of the PAC.
 * @return {Promise<TrackerProxy[]>}
 */
const getActiveTrackers = async () => {
  const dead = await getDeadProxies();
  return TRACKERS.filter(({id}) => !dead[id]);
};

/**
 * A stale ISP block page or an error page cached before the proxy was applied would
 * survive the switch, so the affected origins are dropped from cache and their tabs
 * are reloaded — the official add-on does the same.
 * @param {TrackerProxy[]} trackers
 */
const resetTrackerPages = async (trackers) => {
  const origins = [];
  const tabUrls = [];

  trackers.forEach(({domains}) => {
    domains.forEach((domain) => {
      tabUrls.push(`*://${domain}/*`);
      if (!domain.startsWith('*.')) {
        origins.push(`https://${domain}`, `http://${domain}`);
      }
    });
  });

  if (chrome.browsingData && origins.length) {
    try {
      await chrome.browsingData.removeCache({origins});
    } catch (err) {
      logger.warn('cache of %o is not cleared: %s', origins, err.message);
    }
  }

  if (!tabUrls.length) return;

  try {
    const tabs = await chrome.tabs.query({url: tabUrls});
    tabs.forEach(({id}) => chrome.tabs.reload(id));
    if (tabs.length) {
      logger.info('%d tracker tab(s) reloaded', tabs.length);
    }
  } catch (err) {
    logger.warn('tracker tabs are not reloaded: %s', err.message);
  }
};

const registerProxy = async () => {
  const {levelOfControl} = await getProxySettings();
  if (!canControl(levelOfControl)) {
    logger.warn('proxy settings are not controllable (%s), tracker requests stay direct', levelOfControl);
    return false;
  }

  const trackers = await getActiveTrackers();
  if (!trackers.length) {
    return unregisterProxy();
  }

  const pacScript = buildPacScript(trackers);
  const {[PAC_KEY]: appliedPac} = await storageGet({[PAC_KEY]: null});
  if (appliedPac === pacScript && levelOfControl === 'controlled_by_this_extension') {
    return true;
  }

  await setProxySettings({
    mode: 'pac_script',
    pacScript: {data: pacScript},
  });
  await storageSet({[PAC_KEY]: pacScript});

  logger.info('proxy enabled for %o', trackers.map(({id}) => id));
  await resetTrackerPages(trackers);
  return true;
};

const unregisterProxy = async () => {
  await storageSet({[PAC_KEY]: null});

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
  const storage = await storageGet({[ENABLED_KEY]: true});
  return storage[ENABLED_KEY] !== false;
};

/**
 * @param {boolean} enabled
 * @return {Promise<boolean>} whether the browser accepted the change
 */
export const setProxyEnabled = async (enabled) => {
  if (await isProxyEnabled() !== enabled) {
    await storageSet({[ENABLED_KEY]: enabled});
  }
  return syncProxy();
};

/**
 * Applies the stored on/off state to the browser. Safe to call repeatedly, the PAC is
 * only written when it actually changes.
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
 * Probes every proxy in use. The request goes through the PAC, so a proxy that stopped
 * answering shows up as a failed connection — such a proxy is parked for an hour and
 * its hosts fall back to DIRECT instead of breaking completely.
 * @return {Promise<void>}
 */
export const checkHealth = async () => {
  if (!isSupported() || !await isProxyEnabled()) return;

  // getActiveTrackers() also drops proxies whose hour of quarantine is over, so they
  // get another chance here and are put back into the PAC by the final syncProxy().
  const trackers = (await getActiveTrackers()).filter(({healthUrl}) => healthUrl);

  await Promise.all(trackers.map(async ({id, healthUrl, healthExpectsOk}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);

    try {
      const response = await fetch(healthUrl, {
        method: healthExpectsOk ? 'GET' : 'HEAD',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal,
      });

      if (healthExpectsOk && !response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await markProxyAlive(id);
    } catch (err) {
      logger.warn('healthcheck of %s failed: %s', id, err.message);
      await markProxyDead(id);
    } finally {
      clearTimeout(timeout);
    }
  }));

  // Cheap when nothing changed — the PAC is only written if it actually differs.
  await syncProxy();
};

/**
 * Re-applies our PAC when something else resets the browser proxy settings or when the
 * on/off flag changes, keeps the healthcheck running and logs PAC failures (an
 * unreachable proxy shows up here and nowhere else).
 */
const listenChanges = () => {
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
    if (areaName !== 'local' || !changes[ENABLED_KEY]) return;
    syncProxy();
  });

  if (!chrome.alarms) {
    logger.warn('chrome.alarms is not available, proxy healthcheck is disabled');
    return;
  }

  chrome.alarms.onAlarm.addListener(({name}) => {
    if (name !== HEALTH_ALARM) return;
    checkHealth();
  });
  chrome.alarms.create(HEALTH_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: HEALTH_PERIOD_MINUTES,
  });
};

/**
 * Called once on service worker startup.
 * @return {Promise<boolean>}
 */
const initTrackerProxy = async () => {
  if (!isSupported()) {
    logger.warn('chrome.proxy is not available, "proxy" permission is missing');
    return false;
  }

  listenChanges();
  return syncProxy();
};

export default initTrackerProxy;
