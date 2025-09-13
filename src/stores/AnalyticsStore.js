import {flow, isAlive, types} from "mobx-state-tree";
import getLogger from "../tools/getLogger";
import tracker from "../tools/tracker";

window.ga = window.ga || function() {
  (window.ga.q = window.ga.q || []).push(arguments);
};

const logger = getLogger('AnalyticsStore');

/**
 * @typedef {{}} AnalyticsStore
 * @property {string} [state]
 * @property {function:Promise} init
 */
const AnalyticsStore = types.model('AnalyticsStore', {
  state: types.optional(types.enumeration(['idle', 'pending', 'done', 'error']), 'idle'),
}).actions(self => {
  return {
    init: flow(function* () {
      if (self.state !== 'idle') return;

      self.state = 'pending';
      try {
        initGaShim();
        if (isAlive(self)) {
          self.state = 'done';
        }
      } catch (err) {
        logger.error('init error', err);
        if (isAlive(self)) {
          self.state = 'error';
        }
      }
    }),
  };
});

const initGaShim = () => {
  // Provide a minimal GA shim that forwards to background via Measurement Protocol
  window.GoogleAnalyticsObject = 'ga';
  const ga = function (...args) {
    try {
      if (!args || args.length === 0) return;
      if (args[0] === 'send') {
        // pageview: ga('send', 'pageview', {page, title})
        if (args[1] === 'pageview') {
          const payload = args[2] || {};
          const dp = payload.page || (location.pathname + (location.hash || ''));
          const dt = payload.title || document.title;
          tracker.track({t: 'pageview', dp, dt});
          return;
        }
        // event: ga('send', 'event', category, action, label)
        if (args[1] === 'event') {
          const ec = args[2];
          const ea = args[3];
          const el = args[4];
          tracker.track({t: 'event', ec, ea, el});
          return;
        }
      }
    } catch (err) {
      logger.warn('ga shim error', err);
    }
  };
  window.ga = ga;
};

export default AnalyticsStore;
