#!/usr/bin/env python3
"""Fallback translation using deep-translator (open source).

Install: pip install deep-translator
Usage: python translate.py <source_lang> <target_lang>
       (text read from stdin)
"""

import sys


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: translate.py <source_lang> <target_lang>", file=sys.stderr)
        sys.exit(1)

    source = sys.argv[1]
    target = sys.argv[2]
    text = sys.stdin.read().strip()

    if not text:
        print("Empty input text", file=sys.stderr)
        sys.exit(1)

    try:
        from deep_translator import GoogleTranslator
    except ImportError as exc:
        print(
            "deep-translator not installed. Run: pip install deep-translator",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    translator = GoogleTranslator(source=source, target=target)
    result = translator.translate(text)
    if not result or not result.strip():
        print("Translation returned empty result", file=sys.stderr)
        sys.exit(1)
    print(result.strip())


if __name__ == "__main__":
    main()
