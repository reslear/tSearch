import {ErrorWithCode, StatusCodeError} from './errors';
import {fetch} from 'whatwg-fetch';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import getLogger from "./getLogger";
import base64ToArrayBuffer from "./base64ToArrayBuffer";

const deserializeError = require('deserialize-error');
const contentType = require('content-type');

const logger = getLogger('exKitRequest');

/***
 * @typedef {{}} ExKitRequestOptions
 * @property {string} method
 * @property {string} url
 * @property {[string,string][]|{}<string,string>} headers
 * @property {string} charset
 * @property {string} body
 */

/**
 * @param tracker
 * @param {ExKitRequestOptions} options
 * @return {Promise}
 */
const exKitRequest = (tracker, options) => {
  if (typeof options !== 'object') {
    throw new ErrorWithCode('Options is not set', 'OPTIONS_IS_EMPTY');
  }

  const {url, charset, originUrl, ...fetchOptions} = options;

  if (typeof url !== 'string') {
    throw new ErrorWithCode('Incorrect request, url is not string', 'INCORRECT_REQUEST');
  }

  const {origin} = new URL(url);
  if (!tracker.connectRe || !tracker.connectRe.test(origin)) {
    throw new ErrorWithCode(`Connection is not allowed! ${origin} Add url patter in @connect!`, 'ORIGIN_IS_NOT_AVAILABLE');
  }

  const request = requestWithFallback(tracker, origin, originUrl, url, fetchOptions);

  tracker.requests.push(request);

  return request.then(({response, arrayBuffer}) => {
    let responseCharset = null;
    if (response.headers.has('Content-Type')) {
      try {
        const obj = contentType.parse(response.headers.get('Content-Type'));
        responseCharset = obj.parameters.charset;
      } catch (err) {
        logger.warn('contentType.parse error', err);
      }
    }

    const decoder = new TextDecoder(charset || responseCharset || 'utf-8');
    const body = decoder.decode(arrayBuffer);

    return {
      url: response.url,
      statusCode: response.status,
      statusText: response.statusText,
      body,
      headers: Array.from(response.headers.entries()).reduce((result, [key, value]) => {
        result[key] = value;
        return result;
      }, {}),
    };
  }).then(result => {
    tracker.requests.splice(tracker.requests.indexOf(request), 1);
    return result;
  }, err => {
    tracker.requests.splice(tracker.requests.indexOf(request), 1);
    throw err;
  });
};

/**
 * Status codes used by anti-bot protection when a direct request is rejected.
 * Used as a fallback when the response carries no explicit challenge marker.
 * @type {number[]}
 */
const CHALLENGE_STATUS_CODES = [429, 503];

/**
 * Cloudflare marks a challenge page with `cf-mitigated: challenge`, see
 * https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/
 * Such a request can be repeated through a real tab, where the challenge
 * can be solved and the clearance cookie is stored.
 */
const isChallengeError = (err) => {
  if (!err || err.name !== 'StatusCodeError') {
    return false;
  }

  const response = err.response;
  if (response && response.headers && response.headers.get('cf-mitigated') === 'challenge') {
    return true;
  }

  return CHALLENGE_STATUS_CODES.indexOf(err.statusCode) !== -1;
};

/**
 * Performs a direct request and, if it is blocked by anti-bot protection,
 * retries it through a real tab (tabFetch), where the site cookies and
 * challenge cookies are available.
 */
const requestWithFallback = (tracker, origin, originUrl, url, fetchOptions) => {
  if (tracker.profileOptions.enableProxy) {
    return tabFetchRequest(originUrl || origin, url, fetchOptions);
  }

  let aborted = false;
  let activeRequest = fetchRequest(url, fetchOptions);

  const request = activeRequest.catch((err) => {
    if (aborted || !isChallengeError(err)) {
      throw err;
    }

    logger.warn('Direct request is blocked, retry through tab', url, err.statusCode);

    activeRequest = tabFetchRequest(originUrl || origin, url, fetchOptions);
    return activeRequest.catch((proxyErr) => {
      throw new ErrorWithCode(
        `Request is blocked by ${origin} (${err.statusCode}). ` +
        `Open ${origin} in a tab, pass the check, or enable proxy in the profile options. ` +
        `(${proxyErr.message})`,
        'REQUEST_IS_BLOCKED'
      );
    });
  });

  request.abort = () => {
    aborted = true;
    if (activeRequest && activeRequest.abort) {
      activeRequest.abort();
    }
  };

  return request;
};

const tabFetchRequest = (origin, url, fetchOptions) => {
  let aborted = false;

  const deserializeResult = (result) => {
    if (result.error) {
      throw deserializeError(result.error);
    } else {
      return result.result;
    }
  };

  const request = new Promise((resolve) => {
    const params = {
      origin: origin,
      fetchUrl: url,
      fetchOptions: {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      },
    };
    logger.debug('request', params.fetchUrl, params);
    chrome.runtime.sendMessage(Object.assign({
      action: 'search',
    }, params), resolve);
  }).then(deserializeResult).then((id) => {
    request.id = id;
    if (aborted) {
      request.abort();
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'initSearch',
        id: request.id,
      }, resolve);
    }).then(deserializeResult).then(({response, base64}) => {
      const arrayBuffer = base64ToArrayBuffer(base64);

      response.headers = new Headers(response.headers);

      return {response, arrayBuffer};
    });
  });

  request.abort = () => {
    aborted = true;
    chrome.runtime.sendMessage({
      action: 'abortSearch',
      id: request.id,
    });
  };

  return request;
};

const fetchRequest = (url, fetchOptions) => {
  const controller = new AbortController();

  const request = fetch(url, {
    method: fetchOptions.method,
    headers: fetchOptions.headers,
    body: fetchOptions.body,
    // Send tracker cookies (session, cf_clearance), otherwise every request is anonymous
    credentials: 'include',
    signal: controller.signal
  }).then(response => {
    if (!response.ok) {
      throw new StatusCodeError(response.status, null, null, response);
    }

    return response.arrayBuffer().then(arrayBuffer => {
      return {response, arrayBuffer};
    });
  });

  request.abort = () => {
    controller.abort();
  };

  return request;
};

export default exKitRequest;