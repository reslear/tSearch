const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : global);

if (typeof globalScope.setImmediate !== 'function') {
  globalScope.setImmediate = (callback, ...args) => globalScope.setTimeout(() => {
    callback(...args);
  }, 0);
}

if (typeof globalScope.clearImmediate !== 'function') {
  globalScope.clearImmediate = (id) => globalScope.clearTimeout(id);
}
