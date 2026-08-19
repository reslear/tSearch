import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { cp, rm, copyFile } from 'node:fs/promises';
import manifest from './manifest.config';

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

  const ensureManifestAssets = {
    name: 'sync-crx-manifest-assets',
    apply: 'build',
    enforce: 'pre',
    async config() {
      const projectRoot = process.cwd();
      const assetsRoot = resolve(projectRoot, 'assets');
      const localesRoot = resolve(projectRoot, '_locales');

      await rm(assetsRoot, { recursive: true, force: true });
      await rm(localesRoot, { recursive: true, force: true });
      await cp(resolve(projectRoot, 'src', 'assets'), assetsRoot, { recursive: true });
      await cp(resolve(projectRoot, 'src', '_locales'), localesRoot, { recursive: true });
      await rm(resolve(projectRoot, 'tabFetch.js'), { force: true });
      await copyFile(resolve(projectRoot, 'src', 'tabFetch.js'), resolve(projectRoot, 'tabFetch.js'));
    },
  };

  return {
    define: {
      'import.meta.env.BUILD_ENV': JSON.stringify(BUILD_ENV),
      'import.meta.env.BUILD_DIST': JSON.stringify(BUILD_ENV.distName),
      global: 'globalThis',
      'process.env': '{}',
    },
    resolve: {
      alias: {
        'react/jsx-runtime': resolve(process.cwd(), 'src/shims/react-jsx-runtime.js'),
        'react/jsx-dev-runtime': resolve(process.cwd(), 'src/shims/react-jsx-runtime.js'),
      },
    },
    plugins: [
      ensureManifestAssets,
      react({
        jsxRuntime: 'classic',
        babel: {
          plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties'],
          ],
        },
      }),
      crx({ manifest }),
      viteStaticCopy({
        targets: [
          {src: 'src/assets', dest: '.'},
          {src: 'src/_locales', dest: '.'},
          {src: 'src/trackers', dest: '.'},
          {src: 'src/explorerModules', dest: '.'},
        ],
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
        input: {
          index: resolve(process.cwd(), 'index.html'),
          popup: resolve(process.cwd(), 'popup.html'),
          sandbox: resolve(process.cwd(), 'sandbox.html'),
          bg: resolve(process.cwd(), 'bg.js'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunk-[name].js',
        },
      },
    },
  };
});
