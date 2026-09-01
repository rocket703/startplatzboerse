export type Locale = 'de' | 'en' | 'it';

export const LOCALES: Locale[] = ['de', 'en', 'it'];
export const DEFAULT_LOCALE: Locale = 'de';
export const STORAGE_KEY = 'spb_locale';

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as string[]).includes(value);
}
