import { browser } from 'wxt/browser';
import type { TogglePageMessage, TranslateResponse } from '@/lib/types';

const SELECTOR = 'p, li, blockquote, h1, h2, h3, h4';
const ATTR_BLOCK_ID = 'data-myna-block-id';
const ATTR_TRANSLATED = 'data-myna-translated';
const ATTR_ORIGINAL = 'data-myna-original';
const MAX_BLOCKS = 18;

function cleanupTranslations() {
  document.querySelectorAll(`[${ATTR_TRANSLATED}="true"]`).forEach((node) => node.remove());
  document.querySelectorAll(`[${ATTR_ORIGINAL}="true"]`).forEach((node) => {
    node.removeAttribute(ATTR_ORIGINAL);
    node.removeAttribute(ATTR_BLOCK_ID);
  });
}

function collectBlocks() {
  const seen = new Set<string>();
  const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));

  return elements
    .filter((element) => {
      if (element.closest('[data-myna-translated="true"]')) return false;
      const text = element.innerText.trim().replace(/\s+/g, ' ');
      if (text.length < 40 || text.length > 1200) return false;
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, MAX_BLOCKS)
    .map((element, index) => {
      const id = `block-${index + 1}`;
      element.setAttribute(ATTR_BLOCK_ID, id);
      element.setAttribute(ATTR_ORIGINAL, 'true');
      return {
        id,
        originalText: element.innerText.trim(),
      };
    });
}

function createTranslationNode(text: string) {
  const wrapper = document.createElement('div');
  wrapper.setAttribute(ATTR_TRANSLATED, 'true');
  wrapper.className = 'myna-translation-block';

  const badge = document.createElement('div');
  badge.className = 'myna-translation-badge';
  badge.textContent = '译文';

  const body = document.createElement('div');
  body.className = 'myna-translation-text';
  body.textContent = text;

  wrapper.append(badge, body);
  return wrapper;
}

function ensureStyles() {
  if (document.getElementById('myna-translation-style')) return;
  const style = document.createElement('style');
  style.id = 'myna-translation-style';
  style.textContent = `
    .myna-translation-block {
      margin: 10px 0 16px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(99, 102, 241, 0.16);
      background: linear-gradient(180deg, rgba(238, 242, 255, 0.92) 0%, rgba(248, 250, 252, 0.96) 100%);
      color: #312e81;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
    }

    .myna-translation-badge {
      display: inline-flex;
      align-items: center;
      margin-bottom: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.12);
      color: #4338ca;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .myna-translation-text {
      font-size: 0.98em;
      line-height: 1.8;
      white-space: pre-wrap;
    }

    [data-myna-original="true"] {
      position: relative;
      padding-left: 12px;
      border-left: 3px solid rgba(148, 163, 184, 0.3);
      color: inherit;
    }
  `;
  document.head.appendChild(style);
}

async function translatePage() {
  const existing = document.querySelector(`[${ATTR_TRANSLATED}="true"]`);
  if (existing) {
    cleanupTranslations();
    return;
  }

  ensureStyles();
  const blocks = collectBlocks();
  if (!blocks.length) {
    alert('Myna 暂时没找到适合翻译的段落喵。');
    return;
  }

  const translations = (await browser.runtime.sendMessage({
    type: 'TRANSLATE_BLOCKS',
    payload: {
      blocks,
      pageTitle: document.title,
      pageUrl: location.href,
    },
  })) as TranslateResponse[];

  translations.forEach((item) => {
    const original = document.querySelector<HTMLElement>(`[${ATTR_BLOCK_ID}="${item.id}"]`);
    if (!original) return;
    original.insertAdjacentElement('afterend', createTranslationNode(item.translatedText));
  });
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((message: TogglePageMessage) => {
      if (message.type === 'TOGGLE_TRANSLATE_PAGE') {
        return translatePage().then(() => ({ ok: true }));
      }
      return undefined;
    });
  },
});
