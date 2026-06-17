import * as fs from 'fs';

type WaveFileInstance = {
  toBitDepth: (depth: string) => void;
  toSampleRate: (rate: number) => void;
  getSamples: () => Float32Array | Float64Array | Float32Array[] | Float64Array[];
};

/** Read a 16 kHz WAV file into Float32Array for Whisper (Node.js — no AudioContext). */
export function readWavAsFloat32(wavPath: string): Float32Array {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WaveFile } = require('wavefile') as {
    WaveFile: new (buffer: Buffer) => WaveFileInstance;
  };

  const buffer = fs.readFileSync(wavPath);
  const wav = new WaveFile(buffer);
  wav.toBitDepth('32f');
  wav.toSampleRate(16000);

  let samples = wav.getSamples();

  if (Array.isArray(samples)) {
    if (samples.length > 1) {
      const left = samples[0];
      const right = samples[1];
      const scaling = Math.sqrt(2);
      for (let i = 0; i < left.length; i++) {
        left[i] = (scaling * (left[i] + right[i])) / 2;
      }
    }
    samples = samples[0];
  }

  if (!samples || samples.length === 0) {
    throw new Error('Could not decode audio — recording may be empty or corrupt.');
  }

  if (samples instanceof Float32Array) {
    return samples;
  }

  return Float32Array.from(samples as ArrayLike<number>);
}
