/** Whisper expects full language names for the multilingual models. */
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

export const DEFAULT_WHISPER_MODEL =
  process.env.WHISPER_MODEL ?? 'Xenova/whisper-base';
