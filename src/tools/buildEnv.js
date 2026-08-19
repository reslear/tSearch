export const BUILD_ENV = import.meta.env.BUILD_ENV || {
  distName: import.meta.env.VITE_BUILD_DIST || 'tms',
  version: '',
  buildTime: '',
  mode: 'production',
  FLAG_ENABLE_LOGGER: false,
};

export const BUILD_DIST = import.meta.env.BUILD_DIST || BUILD_ENV.distName;
