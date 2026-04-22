import { browser } from 'wxt/browser';
import type { TogglePageMessage, TranslateResponse } from '@/lib/types';

const SELECTOR = 'p, li, blockquote, h1, h2, h3, h4';
const ATTR_BLOCK_ID = 'data-myna-block-id';
const ATTR_TRANSLATED = 'data-myna-translated';
const ATTR_ORIGINAL = 'data-myna-original';
const FLOATING_BUTTON_ID = 'myna-floating-trigger';
const MAX_BLOCKS = 10;
const EDGE_GAP = 14;
const PREFETCH_VIEWPORT_MULTIPLIER = 1.6;

let isTranslating = false;
let autoModeEnabled = false;
let autoTranslateTimer: number | null = null;
let floatingPosition = { x: 0, y: 0 };
let hasManualPosition = false;

const pageTranslationCache = new Map<string, string>();
const inFlightTextKeys = new Set<string>();

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `t${(hash >>> 0).toString(36)}`;
}

function hasTranslations() {
  return Boolean(document.querySelector(`[${ATTR_TRANSLATED}="true"]`));
}

function cleanupTranslations() {
  document.querySelectorAll(`[${ATTR_TRANSLATED}="true"]`).forEach((node) => node.remove());
  document.querySelectorAll(`[${ATTR_ORIGINAL}="true"]`).forEach((node) => {
    node.removeAttribute(ATTR_ORIGINAL);
    node.removeAttribute(ATTR_BLOCK_ID);
    node.removeAttribute('data-myna-text-key');
  });
  inFlightTextKeys.clear();
}

function isNearViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const expandedTop = -viewportHeight * 0.2;
  const expandedBottom = viewportHeight * PREFETCH_VIEWPORT_MULTIPLIER;
  return rect.bottom > expandedTop && rect.top < expandedBottom;
}

function isAlreadyTranslated(element: HTMLElement) {
  return element.hasAttribute(ATTR_ORIGINAL) && !!element.nextElementSibling?.hasAttribute(ATTR_TRANSLATED);
}

function normalizeText(element: HTMLElement) {
  return element.innerText.trim().replace(/\s+/g, ' ');
}

function collectBlocks() {
  const seen = new Set<string>();
  const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  const nearViewport = elements.filter(isNearViewport);
  const candidates = nearViewport.length ? nearViewport : elements;

  return candidates
    .filter((element) => {
      if (element.closest('[data-myna-translated="true"]')) return false;
      if (isAlreadyTranslated(element)) return false;

      const text = normalizeText(element);
      if (text.length < 36 || text.length > 1200) return false;
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, MAX_BLOCKS)
    .map((element, index) => {
      const originalText = normalizeText(element);
      const textKey = hashText(originalText);
      const id = `block-${Date.now()}-${index + 1}`;
      element.setAttribute(ATTR_BLOCK_ID, id);
      element.setAttribute(ATTR_ORIGINAL, 'true');
      element.setAttribute('data-myna-text-key', textKey);
      return {
        id,
        originalText,
        textKey,
        element,
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

function insertTranslation(element: HTMLElement, text: string) {
  const existing = element.nextElementSibling as HTMLElement | null;
  if (existing?.hasAttribute(ATTR_TRANSLATED)) {
    existing.textContent = '';
    existing.append(createTranslationNode(text).firstElementChild!);
    return;
  }

  element.insertAdjacentElement('afterend', createTranslationNode(text));
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
      left: ${EDGE_GAP}px;
      top: 96px;
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.92);
      color: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(12px);
      cursor: grab;
      transition: transform 140ms ease, opacity 140ms ease, background 140ms ease, box-shadow 140ms ease;
      user-select: none;
      touch-action: none;
      padding: 0;
    }

    #${FLOATING_BUTTON_ID}:hover {
      transform: translateY(-1px);
    }

    #${FLOATING_BUTTON_ID}[data-state='on'] {
      background: rgba(67, 56, 202, 0.96);
      box-shadow: 0 12px 30px rgba(79, 70, 229, 0.28);
    }

    #${FLOATING_BUTTON_ID}[data-state='loading'] {
      cursor: wait;
      opacity: 0.92;
    }

    #${FLOATING_BUTTON_ID}[data-dragging='true'] {
      cursor: grabbing;
      transition: none;
    }

    #${FLOATING_BUTTON_ID} .myna-floating-core {
      position: relative;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    #${FLOATING_BUTTON_ID} .myna-floating-core::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.88);
      transform: scale(0.82);
      transition: transform 140ms ease, opacity 140ms ease;
    }

    #${FLOATING_BUTTON_ID}[data-state='on'] .myna-floating-core::before {
      transform: scale(1);
    }

    #${FLOATING_BUTTON_ID}[data-state='loading'] .myna-floating-core::before {
      animation: myna-pulse 1.05s ease-in-out infinite;
    }

    @keyframes myna-pulse {
      0%, 100% { opacity: 0.45; transform: scale(0.72); }
      50% { opacity: 1; transform: scale(1.08); }
    }
  `;
  document.head.appendChild(style);
}

function getFloatingButton() {
  return document.getElementById(FLOATING_BUTTON_ID) as HTMLButtonElement | null;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function getDefaultFloatingPosition() {
  const x = window.innerWidth - EDGE_GAP - 44;
  const y = clamp(window.innerHeight * 0.68, EDGE_GAP, window.innerHeight - 44 - EDGE_GAP);
  return { x, y };
}

function applyFloatingPosition() {
  const button = getFloatingButton();
  if (!button) return;
  button.style.left = `${Math.round(floatingPosition.x)}px`;
  button.style.top = `${Math.round(floatingPosition.y)}px`;
}

function snapFloatingButtonToEdge() {
  const button = getFloatingButton();
  if (!button) return;

  const width = button.offsetWidth || 44;
  const height = button.offsetHeight || 44;
  const midX = floatingPosition.x + width / 2;
  const shouldStickRight = midX > window.innerWidth / 2;
  floatingPosition.x = shouldStickRight
    ? window.innerWidth - width - EDGE_GAP
    : EDGE_GAP;
  floatingPosition.y = clamp(floatingPosition.y, EDGE_GAP, window.innerHeight - height - EDGE_GAP);
  applyFloatingPosition();
}

function updateFloatingButton() {
  const button = getFloatingButton();
  if (!button) return;

  if (isTranslating) {
    button.dataset.state = 'loading';
    button.setAttribute('aria-label', 'Myna 自动翻译中');
    return;
  }

  button.dataset.state = autoModeEnabled ? 'on' : 'off';
  button.setAttribute('aria-label', autoModeEnabled ? '关闭自动翻译' : '开启自动翻译');
}

function applyCachedTranslations(blocks: ReturnType<typeof collectBlocks>) {
  const pending: typeof blocks = [];

  blocks.forEach((block) => {
    const cached = pageTranslationCache.get(block.textKey);
    if (cached) {
      insertTranslation(block.element, cached);
      inFlightTextKeys.delete(block.textKey);
      return;
    }

    if (inFlightTextKeys.has(block.textKey)) return;
    pending.push(block);
  });

  return pending;
}

async function translateVisibleBlocks() {
  if (isTranslating) return;

  const blocks = collectBlocks();
  if (!blocks.length) return;

  const pendingBlocks = applyCachedTranslations(blocks) ?? [];
  if (!pendingBlocks.length) return;

  pendingBlocks.forEach((block) => inFlightTextKeys.add(block.textKey));

  isTranslating = true;
  updateFloatingButton();

  try {
    const translations = (await browser.runtime.sendMessage({
      type: 'TRANSLATE_BLOCKS',
      payload: {
        blocks: pendingBlocks.map(({ id, originalText }) => ({ id, originalText })),
        pageTitle: document.title,
        pageUrl: location.href,
      },
    })) as TranslateResponse[];

    const translationMap = new Map(translations.map((item) => [item.id, item.translatedText]));

    pendingBlocks.forEach((block) => {
      const translatedText = translationMap.get(block.id);
      inFlightTextKeys.delete(block.textKey);
      if (!translatedText) return;
      pageTranslationCache.set(block.textKey, translatedText);
      insertTranslation(block.element, translatedText);
    });
  } finally {
    pendingBlocks.forEach((block) => inFlightTextKeys.delete(block.textKey));
    isTranslating = false;
    updateFloatingButton();
  }
}

function scheduleAutoTranslate(delay = 180) {
  if (!autoModeEnabled) return;
  if (autoTranslateTimer !== null) {
    window.clearTimeout(autoTranslateTimer);
  }
  autoTranslateTimer = window.setTimeout(() => {
    autoTranslateTimer = null;
    void translateVisibleBlocks();
  }, delay);
}

function startProactiveWarmup() {
  if (!autoModeEnabled) return;
  let remaining = 4;

  const step = () => {
    if (!autoModeEnabled || remaining <= 0) return;
    remaining -= 1;
    void translateVisibleBlocks().finally(() => {
      window.setTimeout(step, 260);
    });
  };

  window.setTimeout(step, 120);
}

function setAutoMode(enabled: boolean) {
  autoModeEnabled = enabled;
  updateFloatingButton();
  if (!enabled) {
    if (autoTranslateTimer !== null) {
      window.clearTimeout(autoTranslateTimer);
      autoTranslateTimer = null;
    }
    cleanupTranslations();
    return;
  }
  startProactiveWarmup();
}

function bindFloatingInteractions(button: HTMLButtonElement) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let moved = false;

  const onPointerMove = (event: PointerEvent) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;

    const width = button.offsetWidth || 44;
    const height = button.offsetHeight || 44;
    floatingPosition.x = clamp(originX + dx, EDGE_GAP, window.innerWidth - width - EDGE_GAP);
    floatingPosition.y = clamp(originY + dy, EDGE_GAP, window.innerHeight - height - EDGE_GAP);
    applyFloatingPosition();
  };

  const onPointerUp = () => {
    button.dataset.dragging = 'false';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    hasManualPosition = true;

    if (moved) {
      snapFloatingButtonToEdge();
      return;
    }

    setAutoMode(!autoModeEnabled);
  };

  button.addEventListener('pointerdown', (event) => {
    if (isTranslating) return;
    startX = event.clientX;
    startY = event.clientY;
    originX = floatingPosition.x;
    originY = floatingPosition.y;
    moved = false;
    button.dataset.dragging = 'true';
    button.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  });
}

function ensureFloatingButton() {
  if (getFloatingButton()) return;

  const button = document.createElement('button');
  button.id = FLOATING_BUTTON_ID;
  button.type = 'button';
  button.innerHTML = `<span class="myna-floating-core"></span>`;
  button.setAttribute('aria-label', '开启自动翻译');

  document.documentElement.appendChild(button);

  floatingPosition = getDefaultFloatingPosition();
  applyFloatingPosition();
  bindFloatingInteractions(button);
  updateFloatingButton();
}

function handleViewportChange() {
  if (!hasManualPosition) {
    floatingPosition = getDefaultFloatingPosition();
  }
  snapFloatingButtonToEdge();
  scheduleAutoTranslate(120);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    ensureStyles();
    ensureFloatingButton();

    window.addEventListener('scroll', () => scheduleAutoTranslate(90), { passive: true });
    window.addEventListener('resize', handleViewportChange, { passive: true });

    const observer = new MutationObserver(() => {
      scheduleAutoTranslate(90);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    browser.runtime.onMessage.addListener((message: TogglePageMessage) => {
      if (message.type === 'TOGGLE_TRANSLATE_PAGE') {
        setAutoMode(!autoModeEnabled);
        return Promise.resolve({ ok: true });
      }
      return undefined;
    });
  },
});
