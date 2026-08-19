import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import zip from 'vite-plugin-zip-pack';
import { resolve } from 'node:path';
import manifestConfig from './manifest.config';

const manifest = manifestConfig as any;

const getManifest = (mode: string) => {
  if (mode !== 'development' || !manifest.content_security_policy?.extension_pages) {
    return manifest;
  }

  const extensionPagesCsp = manifest.content_security_policy.extension_pages;
  const devConnectSources = 'http://localhost:5173 ws://localhost:5173';

  if (extensionPagesCsp.includes('localhost:5173')) {
    return manifest;
  }

  return {
    ...manifest,
    content_security_policy: {
      ...manifest.content_security_policy,
      extension_pages: `${extensionPagesCsp.replace(/;\s*$/, '')} ${devConnectSources};`,
    },
  };
};

const buildEnv = (mode: string) => {
  const buildTime = new Date().toISOString();
  const distName = `tms-${manifest.version}`;

  return {
    distName,
    outputPath: resolve(process.cwd(), 'dist'),
    mode,
    devtool: 'source-map',
    version: manifest.version,
    buildTime,
    FLAG_ENABLE_LOGGER: true,
  };
};

export default defineConfig(({ mode }) => {
  const BUILD_ENV = buildEnv(mode);

  return {
    define: {
      'import.meta.env.BUILD_ENV': JSON.stringify(BUILD_ENV),
      'import.meta.env.BUILD_DIST': JSON.stringify(BUILD_ENV.distName),
      global: 'globalThis',
      'process.env': '{}',
    },
    optimizeDeps: {
      include: [
        'mobx',
        'mobx-state-tree',
        'promise-limit',
        'compare-versions',
        'serialize-error',
        'jszip',
        'deserialize-error',
        'fast-json-patch',
        'content-type',
        'lodash.debounce',
        'lodash.once',
        'lodash.throttle',
        'lodash.escaperegexp',
        'requires-port',
        'json-stringify-pretty-compact',
        'filesize-parser',
      ],
      force: true,
    },
    resolve: {
      alias: {
        'react/jsx-runtime': resolve(process.cwd(), 'src/shims/react-jsx-runtime.js'),
        'react/jsx-dev-runtime': resolve(process.cwd(), 'src/shims/react-jsx-runtime.js'),
      },
    },
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      hmr: {
        host: 'localhost',
        port: 5173,
        clientPort: 5173,
      },
    },
    plugins: [
      react({
        jsxRuntime: 'classic',
        babel: {
          plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties'],
          ],
        },
      }),
      crx({ manifest: getManifest(mode) }),
      zip({
        outDir: 'release',
        outFileName: 'tms.zip',
      }),
    ],
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: false,
      target: 'chrome101',
      commonjsOptions: {
        include: [/src/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          chunkFileNames: 'chunk-[name].js',
        },
      },
    },
  };
});
