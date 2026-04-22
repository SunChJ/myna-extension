export type TranslationProvider = 'openrouter';

export interface TranslationSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: TranslationProvider;
}

export interface TranslateBlock {
  id: string;
  originalText: string;
}

export interface TranslateRequest {
  type: 'TRANSLATE_BLOCKS';
  payload: {
    blocks: TranslateBlock[];
    pageTitle: string;
    pageUrl: string;
  };
}

export interface TranslateResponse {
  id: string;
  translatedText: string;
}

export interface TogglePageMessage {
  type: 'TOGGLE_TRANSLATE_PAGE';
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage {
  type: 'SAVE_SETTINGS';
  payload: TranslationSettings;
}

export interface TranslationLogEntry {
  id: string;
  createdAt: string;
  status: 'success' | 'error';
  pageTitle: string;
  pageUrl: string;
  model: string;
  provider: TranslationProvider;
  request: {
    endpoint: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response?: {
    status: number;
    body: unknown;
  };
  error?: string;
}

export interface GetLogsMessage {
  type: 'GET_TRANSLATION_LOGS';
}

export interface ClearLogsMessage {
  type: 'CLEAR_TRANSLATION_LOGS';
}

export type BackgroundMessage =
  | TranslateRequest
  | TogglePageMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | GetLogsMessage
  | ClearLogsMessage;

export const DEFAULT_SETTINGS: TranslationSettings = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash-preview',
  sourceLanguage: 'Auto',
  targetLanguage: '简体中文',
  provider: 'openrouter',
};

export const STORAGE_KEY = 'myna:settings';
export const LOG_STORAGE_KEY = 'myna:translation-logs';
export const MAX_LOG_ENTRIES = 120;
