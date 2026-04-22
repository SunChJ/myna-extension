import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Myna',
    description: 'Immersive AI translation for the web, starting with OpenRouter.',
    permissions: ['storage', 'activeTab', 'tabs'],
    host_permissions: ['<all_urls>', 'https://openrouter.ai/*'],
    action: {
      default_title: 'Myna',
    },
  },
});
