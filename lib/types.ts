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

export type BackgroundMessage =
  | TranslateRequest
  | TogglePageMessage
  | GetSettingsMessage
  | SaveSettingsMessage;

export const DEFAULT_SETTINGS: TranslationSettings = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash-preview',
  sourceLanguage: 'Auto',
  targetLanguage: '简体中文',
  provider: 'openrouter',
};

export const STORAGE_KEY = 'myna:settings';
