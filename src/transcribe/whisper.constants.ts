/** Whisper language names (preferred for @xenova/transformers). */
export const WHISPER_LANGUAGE_NAMES: Record<string, string> = {
  en: 'english',
  hi: 'hindi',
  kn: 'kannada',
  ta: 'tamil',
  te: 'telugu',
  ml: 'malayalam',
  mr: 'marathi',
  bn: 'bengali',
  gu: 'gujarati',
  pa: 'punjabi',
};

export const NATIVE_SCRIPT_LANGUAGES = new Set([
  'hi',
  'kn',
  'ta',
  'te',
  'ml',
  'mr',
  'bn',
  'gu',
  'pa',
]);

const NATIVE_SCRIPT_PATTERNS: Record<string, RegExp> = {
  hi: /[\u0900-\u097F]/,
  mr: /[\u0900-\u097F]/,
  kn: /[\u0C80-\u0CFF]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  ml: /[\u0D00-\u0D7F]/,
  bn: /[\u0980-\u09FF]/,
  gu: /[\u0A80-\u0AFF]/,
  pa: /[\u0A00-\u0A7F]/,
};

function countNativeChars(text: string, languageCode: string): number {
  const pattern = NATIVE_SCRIPT_PATTERNS[languageCode];
  if (!pattern) return 0;
  return (text.match(new RegExp(pattern.source, 'g')) ?? []).length;
}

export const DEFAULT_WHISPER_MODEL =
  process.env.WHISPER_MODEL ?? 'Xenova/whisper-base';

export const INDIC_WHISPER_MODEL =
  process.env.WHISPER_INDIC_MODEL ?? 'Xenova/whisper-tiny';

export function modelsForLanguage(languageCode: string): string[] {
  if (languageCode === 'en') {
    return [DEFAULT_WHISPER_MODEL];
  }
  if (INDIC_WHISPER_MODEL === DEFAULT_WHISPER_MODEL) {
    return [DEFAULT_WHISPER_MODEL];
  }
  return [INDIC_WHISPER_MODEL, DEFAULT_WHISPER_MODEL];
}

export function languageStrategies(languageCode: string): Array<string | null> {
  const name = WHISPER_LANGUAGE_NAMES[languageCode];
  const strategies: Array<string | null> = [];
  if (name) strategies.push(name);
  strategies.push(languageCode);
  if (NATIVE_SCRIPT_LANGUAGES.has(languageCode)) {
    strategies.push(null);
  }
  return [...new Set(strategies)];
}

/** Reject punctuation-only garbage like "। । ।" or "| | |". */
export function isValidTranscript(
  text: string,
  languageCode: string,
): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length < 2) return false;

  const meaningful = cleaned.replace(/[^\p{L}\p{N}]/gu, '');
  if (meaningful.length < 2) return false;

  if (/^[।|.|\-–—,:;!?]+$/u.test(cleaned.replace(/\s/g, ''))) {
    return false;
  }

  if (NATIVE_SCRIPT_LANGUAGES.has(languageCode)) {
    const pattern = NATIVE_SCRIPT_PATTERNS[languageCode];
    if (!pattern) return false;
    const nativeCount = countNativeChars(cleaned, languageCode);
    if (nativeCount < 2) return false;

    // Reject Latin-only transliteration when native script is required.
    const latinLetters = cleaned.match(/[A-Za-z]/g) ?? [];
    const nativeLetters = cleaned.match(/\p{L}/gu) ?? [];
    if (
      latinLetters.length >= 3 &&
      nativeCount < nativeLetters.length * 0.5
    ) {
      return false;
    }
  }

  return true;
}

/** Accept browser live capture for instant save (slightly lenient for Indian languages). */
export function acceptBrowserTranscript(
  text: string,
  languageCode: string,
): boolean {
  if (isValidTranscript(text, languageCode)) return true;
  if (!NATIVE_SCRIPT_LANGUAGES.has(languageCode)) return false;

  const cleaned = text.replace(/\s+/g, ' ').trim();
  return countNativeChars(cleaned, languageCode) >= 4;
}
