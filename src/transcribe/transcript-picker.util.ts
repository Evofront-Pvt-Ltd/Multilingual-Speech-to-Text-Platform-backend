import { isValidTranscript } from './whisper.constants';

/** Pick the longest valid transcript — captures more of what the user actually said. */
export function pickBestTranscript(
  candidates: Array<string | undefined>,
  languageCode: string,
): string | undefined {
  const valid = candidates
    .map((text) => text?.replace(/\s+/g, ' ').trim())
    .filter((text): text is string => Boolean(text))
    .filter((text) => isValidTranscript(text, languageCode));

  if (valid.length === 0) return undefined;

  valid.sort((a, b) => b.length - a.length);
  return valid[0];
}

/** Combine neural + browser capture when each heard different parts. */
export function mergeTranscripts(
  primary: string,
  secondary: string,
  languageCode: string,
): string {
  const left = primary.replace(/\s+/g, ' ').trim();
  const right = secondary.replace(/\s+/g, ' ').trim();
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  if (left.includes(right)) return left;
  if (right.includes(left)) return right;

  const merged = `${left} ${right}`.replace(/\s+/g, ' ').trim();
  if (isValidTranscript(merged, languageCode)) return merged;
  return pickBestTranscript([left, right], languageCode) ?? left;
}

const WHISPER_HALLUCINATION =
  /^(thank you|thanks for watching|please subscribe|subscribe to my channel|\[blank_audio\])\.?$/i;

/** Short generic phrases Whisper often hallucinates on silence/noise. */
export function isLikelyHallucination(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return WHISPER_HALLUCINATION.test(cleaned);
}
