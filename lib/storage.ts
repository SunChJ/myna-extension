import { DEFAULT_SETTINGS, STORAGE_KEY, type TranslationSettings } from './types';

export async function getSettings(): Promise<TranslationSettings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(result[STORAGE_KEY] as Partial<TranslationSettings> | undefined),
  };
}

export async function saveSettings(settings: TranslationSettings) {
  await browser.storage.local.set({
    [STORAGE_KEY]: settings,
  });
  return settings;
}
