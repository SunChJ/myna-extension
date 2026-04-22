import { browser } from 'wxt/browser';
import {
  DEFAULT_SETTINGS,
  LOG_STORAGE_KEY,
  MAX_LOG_ENTRIES,
  STORAGE_KEY,
  type TranslationLogEntry,
  type TranslationSettings,
} from './types';

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

export async function getTranslationLogs(): Promise<TranslationLogEntry[]> {
  const result = await browser.storage.local.get(LOG_STORAGE_KEY);
  return (result[LOG_STORAGE_KEY] as TranslationLogEntry[] | undefined) ?? [];
}

export async function appendTranslationLog(entry: TranslationLogEntry) {
  const current = await getTranslationLogs();
  const next = [entry, ...current].slice(0, MAX_LOG_ENTRIES);
  await browser.storage.local.set({
    [LOG_STORAGE_KEY]: next,
  });
  return next;
}

export async function clearTranslationLogs() {
  await browser.storage.local.set({
    [LOG_STORAGE_KEY]: [],
  });
}
