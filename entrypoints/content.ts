import { browser } from 'wxt/browser';
import type { TogglePageMessage, TranslateResponse } from '@/lib/types';

const SELECTOR = 'p, li, blockquote, h1, h2, h3, h4';
const ATTR_BLOCK_ID = 'data-myna-block-id';
const ATTR_TRANSLATED = 'data-myna-translated';
const ATTR_ORIGINAL = 'data-myna-original';
const FLOATING_BUTTON_ID = 'myna-floating-trigger';
const MAX_BLOCKS = 14;

let isTranslating = false;

function hasTranslations() {
  return Boolean(document.querySelector(`[${ATTR_TRANSLATED}="true"]`));
}

function cleanupTranslations() {
  document.querySelectorAll(`[${ATTR_TRANSLATED}="true"]`).forEach((node) => node.remove());
  document.querySelectorAll(`[${ATTR_ORIGINAL}="true"]`).forEach((node) => {
    node.removeAttribute(ATTR_ORIGINAL);
    node.removeAttribute(ATTR_BLOCK_ID);
  });
  updateFloatingButton();
}

function isInViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return rect.bottom > 48 && rect.top < viewportHeight - 48;
}

function collectBlocks() {
  const seen = new Set<string>();
  const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));

  const visibleFirst = elements.filter(isInViewport);
  const candidates = visibleFirst.length ? visibleFirst : elements;

  return candidates
    .filter((element) => {
      if (element.closest('[data-myna-translated="true"]')) return false;
      const text = element.innerText.trim().replace(/\s+/g, ' ');
      if (text.length < 36 || text.length > 1200) return false;
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

  const body = document.createElement('div');
  body.className = 'myna-translation-text';
  body.textContent = text;

  wrapper.append(body);
  return wrapper;
}

function ensureStyles() {
  if (document.getElementById('myna-translation-style')) return;
  const style = document.createElement('style');
  style.id = 'myna-translation-style';
  style.textContent = `
    .myna-translation-block {
      margin: 6px 0 14px;
      padding: 0 0 0 12px;
      border-left: 2px solid rgba(99, 102, 241, 0.18);
      background: transparent;
      color: #64748b;
    }

    .myna-translation-text {
      font-size: 0.94em;
      line-height: 1.78;
      white-space: pre-wrap;
      letter-spacing: 0.01em;
    }

    [data-myna-original="true"] {
      position: relative;
      color: inherit;
    }

    #${FLOATING_BUTTON_ID} {
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: min(68vw, 240px);
      padding: 10px 14px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      color: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(12px);
      cursor: pointer;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
      line-height: 1;
      transition: transform 140ms ease, opacity 140ms ease, background 140ms ease;
      user-select: none;
    }

    #${FLOATING_BUTTON_ID}:hover {
      transform: translateY(-1px);
      background: rgba(30, 41, 59, 0.96);
    }

    #${FLOATING_BUTTON_ID}[data-state="loading"] {
      cursor: wait;
      opacity: 0.9;
    }

    #${FLOATING_BUTTON_ID} .myna-floating-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: linear-gradient(180deg, #c4b5fd 0%, #818cf8 100%);
      flex: 0 0 auto;
    }

    #${FLOATING_BUTTON_ID} .myna-floating-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.96;
    }

    @media (max-width: 720px) {
      #${FLOATING_BUTTON_ID} {
        right: 14px;
        bottom: 18px;
        padding: 10px 12px;
      }
    }
  `;
  document.head.appendChild(style);
}

function getFloatingButton() {
  return document.getElementById(FLOATING_BUTTON_ID) as HTMLButtonElement | null;
}

function updateFloatingButton() {
  const button = getFloatingButton();
  if (!button) return;

  const text = button.querySelector('.myna-floating-text');
  if (!text) return;

  if (isTranslating) {
    button.dataset.state = 'loading';
    text.textContent = 'Myna 正在翻译可见内容…';
    return;
  }

  button.dataset.state = hasTranslations() ? 'translated' : 'idle';
  text.textContent = hasTranslations() ? '清除当前页译文' : '翻译当前可见区域';
}

function ensureFloatingButton() {
  if (getFloatingButton()) return;

  const button = document.createElement('button');
  button.id = FLOATING_BUTTON_ID;
  button.type = 'button';
  button.innerHTML = `
    <span class="myna-floating-dot"></span>
    <span class="myna-floating-text">翻译当前可见区域</span>
  `;
  button.addEventListener('click', () => {
    void translatePage();
  });

  document.documentElement.appendChild(button);
  updateFloatingButton();
}

async function translatePage() {
  if (isTranslating) return;

  if (hasTranslations()) {
    cleanupTranslations();
    return;
  }

  ensureStyles();
  isTranslating = true;
  updateFloatingButton();

  try {
    const blocks = collectBlocks();
    if (!blocks.length) {
      alert('Myna 暂时没找到适合翻译的可见段落喵。');
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
  } finally {
    isTranslating = false;
    updateFloatingButton();
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    ensureStyles();
    ensureFloatingButton();

    browser.runtime.onMessage.addListener((message: TogglePageMessage) => {
      if (message.type === 'TOGGLE_TRANSLATE_PAGE') {
        return translatePage().then(() => ({ ok: true }));
      }
      return undefined;
    });
  },
});
