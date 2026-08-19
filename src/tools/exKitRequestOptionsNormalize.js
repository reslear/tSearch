import qs from './query-string.js';

/**
 * Trackers may leave headers unset (null), pass a plain object, or use the
 * legacy [{name, value}] form. `new Headers(null)` throws a TypeError in
 * Chrome, so normalize everything to a valid HeadersInit first.
 */
const toHeadersInit = (rawHeaders) => {
  if (!rawHeaders) {
    return undefined;
  }

  if (Array.isArray(rawHeaders)) {
    return rawHeaders.reduce((result, item) => {
      if (Array.isArray(item)) {
        result.push([item[0], item[1]]);
      } else if (item && typeof item === 'object' && 'name' in item) {
        result.push([item.name, item.value]);
      }
      return result;
    }, []);
  }

  if (typeof rawHeaders !== 'object') {
    return undefined;
  }

  return rawHeaders;
};

const exKitRequestOptionsNormalize = options => {
  if (typeof options !== 'object') {
    options = {url: options};
  }

  if (options.type) {
    options.method = options.type;
    delete options.type;
  }
  if (!options.method) {
    options.method = 'GET';
  }
  options.method = options.method.toUpperCase();

  if (options.data) {
    if (options.method === 'POST') {
      options.body = options.data;
    } else {
      options.query = options.data;
    }
    delete options.data;
  }

  // Trackers always pass a body string, empty for GET searches. `fetch` rejects
  // any non-null body on GET/HEAD, so strip it before the request is built.
  if (!options.body || options.method === 'GET' || options.method === 'HEAD') {
    delete options.body;
  }

  const headers = new Headers(toHeadersInit(options.headers));

  if (options.body) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    }

    if (typeof options.body !== 'string') {
      if (/^application\/x-www-form-urlencoded/.test(headers.get('Content-Type'))) {
        options.body = qs.stringify(options.body);
      } else
      if (/^application\/json/.test(headers.get('Content-Type'))) {
        options.body = JSON.stringify(options.body);
      }
    }
  }

  if (options.query) {
    if (typeof options.query !== 'string') {
      options.query = qs.stringify(options.query);
    }
    options.url += (/\?/.test(options.url) ? '&' : '?') + options.query;

    delete options.query;
  }

  const toJson = options.json;
  delete options.json;

  options.headers = Array.from(headers.entries()).reduce((result, entry) => {
    result.push(entry);
    return result;
  }, []);

  return {options, toJson};
};

export default exKitRequestOptionsNormalize;
