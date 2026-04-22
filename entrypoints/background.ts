import { browser } from 'wxt/browser';
import {
  appendTranslationLog,
  clearTranslationLogs,
  getSettings,
  getTranslationLogs,
  saveSettings,
} from '@/lib/storage';
import type {
  BackgroundMessage,
  TranslateResponse,
  TranslationLogEntry,
  TranslationSettings,
} from '@/lib/types';

function sanitizeHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: apiKey ? `Bearer ${apiKey.slice(0, 8)}...` : '',
    'HTTP-Referer': 'https://github.com/SunChJ/myna-extension',
    'X-Title': 'Myna',
  };
}

async function translateWithOpenRouter(
  blocks: Array<{ id: string; originalText: string }>,
  settings: TranslationSettings,
  pageTitle: string,
  pageUrl: string,
): Promise<TranslateResponse[]> {
  if (!settings.apiKey.trim()) {
    throw new Error('请先在 Myna 中填写 OpenRouter API Key。');
  }

  const prompt = [
    `You are an immersive translation engine for browser content.`,
    `Translate each block from ${settings.sourceLanguage} to ${settings.targetLanguage}.`,
    `Return JSON only in the shape: {"translations":[{"id":"...","translatedText":"..."}]}.`,
    `Keep block ids unchanged.`,
    `Preserve meaning, links, numbers, lists, and code identifiers.`,
    `Do not omit content. Do not add commentary.`,
    `Page title: ${pageTitle}`,
    `Page url: ${pageUrl}`,
  ].join('\n');

  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const requestBody = {
    model: settings.model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: JSON.stringify({ blocks }),
      },
    ],
  };

  const baseLog: Omit<TranslationLogEntry, 'id' | 'createdAt' | 'status'> = {
    pageTitle,
    pageUrl,
    model: settings.model,
    provider: settings.provider,
    request: {
      endpoint,
      headers: sanitizeHeaders(settings.apiKey),
      body: requestBody,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://github.com/SunChJ/myna-extension',
        'X-Title': 'Myna',
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    let rawJson: unknown = rawText;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      // keep raw text
    }

    if (!response.ok) {
      await appendTranslationLog({
        ...baseLog,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'error',
        response: {
          status: response.status,
          body: rawJson,
        },
        error: `OpenRouter 请求失败：${response.status}`,
      });
      throw new Error(`OpenRouter 请求失败：${response.status} ${rawText}`);
    }

    const data = rawJson as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      await appendTranslationLog({
        ...baseLog,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'error',
        response: {
          status: response.status,
          body: rawJson,
        },
        error: 'OpenRouter 返回内容为空。',
      });
      throw new Error('OpenRouter 返回内容为空。');
    }

    const parsed = JSON.parse(content) as { translations?: TranslateResponse[] };
    if (!Array.isArray(parsed.translations)) {
      await appendTranslationLog({
        ...baseLog,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'error',
        response: {
          status: response.status,
          body: rawJson,
        },
        error: 'OpenRouter 返回的 JSON 结构不符合预期。',
      });
      throw new Error('OpenRouter 返回的 JSON 结构不符合预期。');
    }

    await appendTranslationLog({
      ...baseLog,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'success',
      response: {
        status: response.status,
        body: rawJson,
      },
    });

    return parsed.translations;
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('OpenRouter')) {
      await appendTranslationLog({
        ...baseLog,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'error',
        error: error.message,
      });
    }
    throw error;
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: BackgroundMessage) => {
    switch (message.type) {
      case 'GET_SETTINGS':
        return getSettings();
      case 'SAVE_SETTINGS':
        return saveSettings(message.payload);
      case 'GET_TRANSLATION_LOGS':
        return getTranslationLogs();
      case 'CLEAR_TRANSLATION_LOGS':
        return clearTranslationLogs();
      case 'TRANSLATE_BLOCKS':
        return getSettings().then((settings) =>
          translateWithOpenRouter(
            message.payload.blocks,
            settings,
            message.payload.pageTitle,
            message.payload.pageUrl,
          ),
        );
      case 'TOGGLE_TRANSLATE_PAGE':
        return Promise.resolve({ ok: true });
      default:
        return Promise.resolve(null);
    }
  });

  console.log('Myna background ready', { id: browser.runtime.id });
});
