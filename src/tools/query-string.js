const parse = (input = '') => {
  const result = {};
  const params = new URLSearchParams(input.replace(/^\?/, ''));

  params.forEach((value, key) => {
    const prev = result[key];
    if (typeof prev === 'undefined') {
      result[key] = value;
    } else {
      result[key] = ([]).concat(prev, value);
    }
  });

  return result;
};

const stringify = (value = {}) => {
  const params = new URLSearchParams();

  Object.entries(value).forEach(([key, rawValue]) => {
    if (rawValue === null || typeof rawValue === 'undefined') {
      return;
    }
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    values.forEach(item => {
      params.append(key, '' + item);
    });
  });

  return params.toString();
};

export default {parse, stringify};
