const REPETITION_PATTERNS = [
  /(\b\w+(?:\s+\w+){1,3}\b)(?:\s*,?\s*\1){4,}/gi,
];

export function sanitizeWhisperText(text: string): string {
  let cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;

  for (const pattern of REPETITION_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(cleaned);
    if (match?.[1]) {
      const phrase = match[1].trim();
      const first = cleaned.toLowerCase().indexOf(phrase.toLowerCase());
      const second = cleaned.toLowerCase().indexOf(
        phrase.toLowerCase(),
        first + phrase.length,
      );
      if (second > first) {
        cleaned = cleaned.slice(0, second).replace(/[,\s]+$/, '').trim();
      }
    }
  }

  const words = cleaned.split(/\s+/);
  if (words.length >= 12) {
    const head = words.slice(0, 3).join(' ').toLowerCase();
    let repeats = 0;
    for (let i = 3; i < words.length; i += 3) {
      if (words.slice(i, i + 3).join(' ').toLowerCase() === head) {
        repeats += 1;
      }
    }
    if (repeats >= 3) {
      cleaned = words.slice(0, 6).join(' ');
    }
  }

  return cleaned.trim();
}
