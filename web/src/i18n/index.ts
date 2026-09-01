import { messages, type MessageTree } from './messages';
import {
  DEFAULT_LOCALE,
  STORAGE_KEY,
  isLocale,
  type Locale,
} from './types';

export type { Locale } from './types';
export { LOCALES, DEFAULT_LOCALE, STORAGE_KEY, isLocale } from './types';
export { messages } from './messages';

function getByPath(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let cur: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (cur == null || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const candidates = [...(navigator.languages ?? []), navigator.language]
    .filter(Boolean)
    .map((l) => l.toLowerCase());

  for (const lang of candidates) {
    const primary = lang.split('-')[0];
    if (primary === 'de') return 'de';
    if (primary === 'en') return 'en';
    if (primary === 'it') return 'it';
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  if (typeof document !== 'undefined') {
    const fromDom = document.documentElement.dataset.locale;
    if (isLocale(fromDom)) return fromDom;
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  }
  return detectBrowserLocale();
}

function resolveMessage(
  key: string,
  locale: Locale,
): string | undefined {
  const value =
    getByPath(messages[locale], key) ??
    getByPath(messages[DEFAULT_LOCALE], key);
  return typeof value === 'string' ? value : undefined;
}

/** Content entry id (filename), not frontmatter slug — matches ratgeber.articles.* keys. */
export function ratgeberArticleKey(entry: { id: string }): string {
  return entry.id.replace(/^ratgeber\//, '').replace(/\.md$/, '');
}

export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: Locale = getLocale(),
): string {
  const raw = resolveMessage(key, locale) ?? key;

  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    raw,
  );
}

export function applyI18n(root: ParentNode = document): void {
  const locale = getLocale();

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const value = resolveMessage(key, locale);
    if (value === undefined) return;
    if (el.childElementCount === 0) {
      el.textContent = value;
    } else {
      // Keep child elements (e.g. icons); replace only text nodes / use first text-bearing span
      const textTarget = el.querySelector('[data-i18n-text]') ?? null;
      if (textTarget) {
        textTarget.textContent = value;
      } else {
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            node.textContent = value;
          }
        });
      }
    }
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    const value = resolveMessage(key, locale);
    if (value === undefined) return;
    el.innerHTML = value;
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    el.setAttribute('placeholder', t(key, undefined, locale));
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (!key) return;
    el.setAttribute('aria-label', t(key, undefined, locale));
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    el.setAttribute('title', t(key, undefined, locale));
  });

  root.querySelectorAll<HTMLElement>('[data-hide-if-locale]').forEach((el) => {
    const hideLocales =
      el.getAttribute('data-hide-if-locale')?.split(',').map((s) => s.trim()) ??
      [];
    const hide = hideLocales.includes(locale);
    el.hidden = hide;
    el.style.display = hide ? 'none' : '';
  });

  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.documentElement.classList.remove('i18n-blocking');
  document.documentElement.classList.add('i18n-ready');
}

export function setLocale(locale: Locale, persist = true): void {
  if (persist && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
  }
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;

  document.querySelectorAll('[data-lang-switcher] .lang-btn').forEach((btn) => {
    const isActive = btn.getAttribute('data-locale') === locale;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  applyI18n(document);
  window.dispatchEvent(
    new CustomEvent('spb:localechange', { detail: { locale } }),
  );
}

export function initI18n(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __spbI18nInit?: boolean }).__spbI18nInit) {
    applyI18n(document);
    return;
  }
  (window as unknown as { __spbI18nInit?: boolean }).__spbI18nInit = true;

  const stored =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null;
  const locale = isLocale(stored) ? stored : detectBrowserLocale();
  setLocale(locale, !isLocale(stored));
}
