import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '@/lib/storage';
import type {
  BackgroundMessage,
  TranslateResponse,
  TranslationSettings,
} from '@/lib/types';

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

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
      'HTTP-Referer': 'https://github.com/SunChJ/myna-extension',
      'X-Title': 'Myna',
    },
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter 请求失败：${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter 返回内容为空。');
  }

  const parsed = JSON.parse(content) as { translations?: TranslateResponse[] };
  if (!Array.isArray(parsed.translations)) {
    throw new Error('OpenRouter 返回的 JSON 结构不符合预期。');
  }

  return parsed.translations;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: BackgroundMessage) => {
    switch (message.type) {
      case 'GET_SETTINGS':
        return getSettings();
      case 'SAVE_SETTINGS':
        return saveSettings(message.payload);
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
