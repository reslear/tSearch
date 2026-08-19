import {autorun} from "mobx";
import OptionsStore from "../stores/OptionsStore";
import getLogger from "../tools/getLogger";
import TrackerStore, {TrackerOptionsStore} from "../stores/TrackerStore";
import getTrackerCodeMeta from "../tools/getTrackerCodeMeta";
import {destroy} from "mobx-state-tree";
import {ErrorWithCode} from "../tools/errors";
import getNow from "../tools/getNow";
import ExplorerModuleStore from "../stores/Explorer/ExplorerModuleStore";
import getExploreModuleCodeMeta from "../tools/getExploreModuleCodeMeta";
import storageGet from "../tools/storageGet";
import storageSet from "../tools/storageSet";
import TabFetchBg from "./tabFetchBg";
import initTrackerProxy, {setProxyEnabled} from "./trackerProxy";
import migrate from "../tools/migrate";
import jsonCodeToUserscript from "../tools/jsonCodeToUserscript";
import setCodeMeta from "../tools/setCodeMeta";
import {BUILD_ENV} from "../tools/buildEnv";
import qs from '../tools/query-string';
import promiseLimit from 'promise-limit';
import compareVersions from 'compare-versions';
import serializeError from 'serialize-error';
import '../shims/setImmediate';

// Do not bind global error handlers in service worker context

const logger = getLogger('background');
const oneLimit = promiseLimit(1);
const runtimeRoot = (chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('') : 'runtime unavailable';
logger.info(`[tms] build v${BUILD_ENV.version} / ${BUILD_ENV.buildTime} / ${runtimeRoot}`);

migrate();

let tabFetchBg = null;

/**@type OptionsStore*/
const optionsStore = OptionsStore.create();

optionsStore.fetchOptions().then(() => {
  autorun(() => {
    updateIcon(optionsStore.options.invertIcon);
  });

  autorun(() => {
    setContextMenu(optionsStore.options.contextMenu);
  });

  autorun(() => {
    setPopupMenu(optionsStore.options.disablePopup);
  });

  autorun(() => {
    setProxyEnabled(optionsStore.options.proxyEnabled);
  });
});

/**
 * Requests initiated by the extension carry `Origin: chrome-extension://<id>` and
 * `Sec-Fetch-Site: none`, which anti-bot protection (Cloudflare & co) treats as a bot.
 * Session rules strip those headers for our own requests only.
 * @type {number}
 */
const EXTENSION_HEADERS_RULE_ID = 1;

const syncExtensionHeaderRules = () => {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateSessionRules) {
    logger.warn('declarativeNetRequest is not available, request headers are not modified');
    return Promise.resolve();
  }

  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [EXTENSION_HEADERS_RULE_ID],
    addRules: [{
      id: EXTENSION_HEADERS_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          {header: 'origin', operation: 'remove'},
          {header: 'sec-fetch-site', operation: 'set', value: 'same-origin'},
          {header: 'sec-fetch-mode', operation: 'set', value: 'navigate'},
          {header: 'sec-fetch-dest', operation: 'set', value: 'document'},
        ],
      },
      condition: {
        initiatorDomains: [chrome.runtime.id],
        resourceTypes: ['xmlhttprequest', 'other'],
      },
    }],
  }).catch((err) => {
    logger.error('syncExtensionHeaderRules error', err);
  });
};

syncExtensionHeaderRules();

/**
 * Some trackers are unreachable directly (Cloudflare JS challenge on rutracker.org,
 * ISP blocks elsewhere). Routing just their hosts through the official add-on proxies
 * is the only working bypass, see ./trackerProxy.
 */
initTrackerProxy();

chrome.omnibox.onInputEntered.addListener((query) => {
  openSearchPage(query);
});

chrome.runtime.onMessage.addListener(function (message, sender, response) {
  if (!message) return;

  let promise = null;
  switch (message.action) {
    case 'downloadTracker': {
      promise = downloadTracker(message.id, message.updateURL, message.downloadURL);
      break;
    }
    case 'updateTracker': {
      promise = updateTracker(message.id);
      break;
    }
    case 'updateExplorerModule': {
      promise = updateExplorerModule(message.id);
      break;
    }
    case 'update': {
      promise = update();
      break;
    }
    case 'search': {
      if (!tabFetchBg) {
        tabFetchBg = new TabFetchBg();
      }
      promise = tabFetchBg.request(sender.tab.id, message.origin, message.fetchUrl, message.fetchOptions);
      break;
    }
    case 'initSearch': {
      promise = Promise.resolve().then(() => {
        if (tabFetchBg) {
          return tabFetchBg.initRequest(message.id);
        } else {
          throw new Error('TabFetchBg is not exists');
        }
      });
      break;
    }
    case 'abortSearch': {
      if (tabFetchBg) {
        tabFetchBg.abortRequest(message.id);
      }
      break;
    }
    case 'tabFetchResponse': {
      if (tabFetchBg) {
        tabFetchBg.handleResponse(message.id, message.result);
      }
      break;
    }
  }

  if (promise) {
    promise.then(result => {
      response({result});
    }, err => {
      response({error: serializeError(err)});
    }).catch((err) => {
      logger.error('Send response error', err);
    });
    return true;
  }
});

const updateIcon = (invertIcon) => {
  if (invertIcon) {
    chrome.action.setIcon({
      path: {
        19: 'assets/icons/icon_19_i.png',
        38: 'assets/icons/icon_38_i.png'
      }
    });
  } else {
    chrome.action.setIcon({
      path: {
        19: 'assets/icons/icon_19.png',
        38: 'assets/icons/icon_38.png'
      }
    });
  }
};

const setContextMenu = (contextMenu) => {
  chrome.contextMenus.removeAll(function () {
    if (contextMenu) {
      chrome.contextMenus.create({
        type: "normal",
        id: "tms",
        title: chrome.i18n.getMessage('contextMenuTitle'),
        contexts: ["selection"]
      });
    }
  });
};

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'tms') {
    openSearchPage(info.selectionText);
  }
});

const setPopupMenu = (disablePopup) => {
  if (disablePopup) {
    chrome.action.setPopup({
      popup: ''
    });
  } else {
    chrome.action.setPopup({
      popup: 'popup.html'
    });
  }
};

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: 'index.html'
  });
});

const openSearchPage = (query) => {
  let url = 'index.html';
  if (query) {
    url += '#/search?' + qs.stringify({
      query: query
    });
  }
  chrome.tabs.create({
    url: url,
    selected: true
  });
};

const update = () => {
  return storageGet({
    trackers: {},
    explorerModules: {},
  }).then(storage => {
    const trackerIds = [];
    Object.entries(storage.trackers).forEach(([id, tracker]) => {
      try {
        const trackerOptionsStore = TrackerOptionsStore.create(tracker.options || {});
        if (trackerOptionsStore.autoUpdate) {
          trackerIds.push(id);
        }
      } catch (err) {
        logger.error(`Create TrackerMetaStore error`, tracker.id);
      }
    });

    const explorerModuleIds = [];
    Object.entries(storage.explorerModules).forEach(([id, module]) => {
      try {
        const trackerOptionsStore = TrackerOptionsStore.create(module.options || {});
        if (trackerOptionsStore.autoUpdate) {
          explorerModuleIds.push(id);
        }
      } catch (err) {
        logger.error(`Create ExplorerModuleMetaStore error`, module.id);
      }
    });

    return Promise.all([
      Promise.all(trackerIds.map(id => updateTracker(id).then(result => {
        return {id, result};
      }, err => {
        if (['DOWNLOAD_URL_IS_EMPTY', 'NEW_VERSION_IS_NOT_FOUND'].indexOf(err.code) === -1) {
          logger.error(`updateTracker ${id} error`, err);
        }
        return {id, error: serializeError(err)};
      }))),
      Promise.all(explorerModuleIds.map(id => updateExplorerModule(id).then(result => {
        return {id, result};
      }, err => {
        if (['DOWNLOAD_URL_IS_EMPTY', 'NEW_VERSION_IS_NOT_FOUND'].indexOf(err.code) === -1) {
          logger.error(`updateExplorerModule ${id} error`, err);
        }
        return {id, error: serializeError(err)};
      })))
    ]).then(([trackers, explorerModules]) => {
      return {trackers, explorerModules};
    });
  });
};

const downloadTracker = (id, updateURL, downloadURL) => {
  return oneLimit(() => {
    return Promise.resolve().then(() => {
      if (updateURL) {
        return getCodeAndMetaFromUrl(updateURL, 'tracker').then(({meta}) => {
          return meta.downloadURL || downloadURL;
        }).catch((err) => {
          logger.error('getDownloadUrlFromUpdateUrl error', updateURL, err);
          return downloadURL;
        });
      } else {
        return downloadURL;
      }
    }).then((downloadURL) => {
      if (!downloadURL) {
        throw new ErrorWithCode('downloadURL is empty', 'DOWNLOAD_URL_IS_EMPTY');
      }

      return fetch(downloadURL).then(response => {
        if (!response.ok) {
          throw new ErrorWithCode('bad response', 'BAD_RESPONSE');
        }
        return response.text();
      }).then(code => transformJsonToCode(code)).then((code) => {
        const meta = getTrackerCodeMeta(code);
        if (!meta.downloadURL) {
          meta.downloadURL = downloadURL;
          code = setCodeMeta(code, meta);
        }
        return {meta, code};
      });
    }).then(({code, meta}) => {
      const trackerStore = TrackerStore.create({
        id: id,
        meta: meta,
        code: code,
      });
      const tracker = trackerStore.getSnapshot();
      destroy(trackerStore);

      tracker.options.lastUpdate = getNow();

      return storageGet({trackers: {}}).then(storage => {
        storage.trackers[id] = tracker;
        return storageSet(storage);
      });
    }).then(() => true);
  });
};

const updateTracker = (id) => {
  return oneLimit(() => {
    return storageGet({trackers: {}}).then(storage => {
      const localTracker = storage.trackers[id];
      const {updateURL, downloadURL, version} = localTracker.meta;

      return getNewCodeByUpdateAndDownloadUrl(updateURL, downloadURL, version, 'tracker').then((code) => {
        const trackerStore = TrackerStore.create({
          id: id,
          meta: getTrackerCodeMeta(code),
          code: code,
          options: localTracker.options,
        });
        const tracker = trackerStore.getSnapshot();
        destroy(trackerStore);

        const isNewVersion = compareVersions(tracker.meta.version, version) > 0;
        if (!isNewVersion) {
          throw new ErrorWithCode('New version is not found', 'NEW_VERSION_IS_NOT_FOUND');
        }

        tracker.options.lastUpdate = getNow();

        return storageGet({trackers: {}}).then(storage => {
          storage.trackers[id] = tracker;
          return storageSet(storage);
        });
      });
    }).then(() => true);
  });
};

const updateExplorerModule = (id) => {
  return oneLimit(() => {
    return storageGet({explorerModules: {}}).then(storage => {
      const localModule = storage.explorerModules[id];
      const {updateURL, downloadURL, version} = localModule.meta;

      return getNewCodeByUpdateAndDownloadUrl(updateURL, downloadURL, version, 'explorerModule').then((code) => {
        const explorerModuleStore = ExplorerModuleStore.create({
          id: id,
          meta: getExploreModuleCodeMeta(code),
          code: code,
          options: localModule.options,
        });
        const explorerModule = explorerModuleStore.getSnapshot();
        destroy(explorerModuleStore);

        const isNewVersion = compareVersions(explorerModule.meta.version, version) > 0;
        if (!isNewVersion) {
          throw new ErrorWithCode('New version is not found', 'NEW_VERSION_IS_NOT_FOUND');
        }

        explorerModule.options.lastUpdate = getNow();

        return storageGet({explorerModules: {}}).then(storage => {
          storage.explorerModules[id] = explorerModule;
          return storageSet(storage);
        });
      });
    }).then(() => true);
  });
};

const getNewCodeByUpdateAndDownloadUrl = async (updateURL, downloadURL, version, type) => {
  let meta = null;
  let code = null;

  if (updateURL) {
    try {
      const result = await getCodeAndMetaFromUrl(updateURL, type);
      meta = result.meta;
    } catch (err) {
      logger.error('getCodeAndMetaFromUrl from updateURL error', updateURL, err);
    }
  }

  if (!meta) {
    if (!downloadURL) {
      throw new ErrorWithCode('downloadURL is empty', 'DOWNLOAD_URL_IS_EMPTY');
    }

    const result = await getCodeAndMetaFromUrl(downloadURL, type);
    meta = result.meta;
    code = result.code;
  }

  const isNewVersion = compareVersions(meta.version, version) > 0;
  if (!isNewVersion) {
    throw new ErrorWithCode('New version is not found in meta', 'NEW_VERSION_IS_NOT_FOUND');
  }

  if (!code) {
    const url = meta.downloadURL || downloadURL;
    if (!url) {
      throw new ErrorWithCode('downloadURL is empty', 'DOWNLOAD_URL_IS_EMPTY');
    }

    const result = await getCodeAndMetaFromUrl(url, type);
    code = result.code;
  }

  return code;
};

const getCodeAndMetaFromUrl = (url, type = 'tracker') => {
  return fetch(url).then(response => {
    if (!response.ok) {
      throw new ErrorWithCode('bad response', 'BAD_RESPONSE');
    }
    return response.text();
  }).then(code => transformJsonToCode(code)).then((code) => {
    let meta = null;
    if (type === 'tracker') {
      meta = getTrackerCodeMeta(code);
    } else
    if (type === 'explorerModule') {
      meta = getExploreModuleCodeMeta(code);
    }
    if (!meta.downloadURL) {
      meta.downloadURL = url;
      code = setCodeMeta(code, meta);
    }
    return {meta, code};
  });
};

const transformJsonToCode = (data) => {
  let result = data;
  if (/^\s*{/.test(data)) {
    try {
      result = jsonCodeToUserscript(data);
    } catch (err) {
      logger.error('jsonCodeToUserscript error', err);
    }
  }
  return result;
};
