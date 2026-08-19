import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  minimum_chrome_version: '101',
  action: {
    default_icon: {
      19: 'assets/icons/icon_19.png',
      38: 'assets/icons/icon_38.png',
    },
    default_title: 'Torrents MultiSearch',
    default_popup: 'popup.html',
  },
  icons: {
    128: 'assets/icons/icon_128.png',
    48: 'assets/icons/icon_48.png',
    16: 'assets/icons/icon_16.png',
  },
  options_ui: {
    page: 'index.html#/options',
    open_in_tab: true,
  },
  optional_permissions: ['tabs'],
  permissions: ['storage', 'contextMenus', 'unlimitedStorage', 'scripting', 'declarativeNetRequestWithHostAccess', 'proxy'],
  host_permissions: ['http://*/*', 'https://*/*'],
  omnibox: {
    keyword: 'tms',
  },
  background: {
    service_worker: 'src/background/index.js',
  },
  sandbox: {
    pages: ['sandbox.html'],
  },
  web_accessible_resources: [
    {
      resources: ['src/tabFetch.js', 'src/trackers/**/*.js', 'src/explorerModules/**/*.js'],
      matches: ['<all_urls>'],
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://* http://*;",
    sandbox: 'sandbox allow-scripts',
  },
  name: '__MSG_extName__',
  description: '__MSG_extDesc__',
  default_locale: 'en',
  version: '3.1.2',
});
