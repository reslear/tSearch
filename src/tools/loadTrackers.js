import getLogger from "./getLogger.js";
import getTrackerCodeMeta from "./getTrackerCodeMeta.js";

const debug = getLogger('loadTrackers');

const loadTrackers = () => {
  return Promise.all([
    'bitsnoop', 'booktracker', 'freeTorrents', 'hdclub', 'kinozal',
    'mininova', 'nnmclub',
    'piratebit', 'rgfootball', 'rutor',
    'rutracker', 'tapochek', 'thepiratebay'
  ].map(id => {
    return fetch(chrome.runtime.getURL('src/trackers/' + id + '.js')).then(response => {
      return response.text();
    }).then(response => {
      return {
        id: id,
        meta: getTrackerCodeMeta(response),
        info: {
          lastUpdate: 0,
          disableAutoUpdate: false,
        },
        code: response,
      }
    }).catch(function (err) {
      debug('Load tracker error', err);
    });
  }));
};

export default loadTrackers;
