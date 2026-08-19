import qs from './query-string';

const parseModuleParams = (params) => {
  if (/^{.+}$/.test(params)) {
    return JSON.parse(params);
  }
  return qs.parse(params);
};

export default parseModuleParams;
