const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const processEnv = typeof process !== 'undefined' && process.env ? process.env : {};

export const BUILD_ENV = metaEnv.BUILD_ENV || {
  distName: metaEnv.VITE_BUILD_DIST || processEnv.VITE_BUILD_DIST || 'tms',
  version: '',
  buildTime: '',
  mode: 'production',
  FLAG_ENABLE_LOGGER: false,
};

export const BUILD_DIST = metaEnv.BUILD_DIST || processEnv.BUILD_DIST || BUILD_ENV.distName;
