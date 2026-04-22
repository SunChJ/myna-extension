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
  wrapper.textContent = text;
  return wrapper;
}

function ensureStyles() {
  if (document.getElementById('myna-translation-style')) return;
  const style = document.createElement('style');
  style.id = 'myna-translation-style';
  style.textContent = `
    .myna-translation-block {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(99, 102, 241, 0.18);
      background: rgba(99, 102, 241, 0.07);
      color: #312e81;
      font-size: 0.95em;
      line-height: 1.7;
      white-space: pre-wrap;
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
