import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function resolveFfmpegBinary(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegStatic = require('ffmpeg-static') as string | null;
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    return ffmpegStatic;
  }

  const envPath = process.env.FFMPEG_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  throw new Error(
    'ffmpeg is required to decode browser audio. Run npm install in the backend folder (installs ffmpeg-static automatically).',
  );
}

export async function convertAudioToWav(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const ffmpeg = resolveFfmpegBinary();
  await execFileAsync(
    ffmpeg,
    ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', outputPath],
    { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
  );

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 44) {
    throw new Error('Audio conversion failed — recording may be empty or corrupt.');
  }
}

export function tempWavPath(audioPath: string): string {
  return path.join(
    path.dirname(audioPath),
    `${path.basename(audioPath, path.extname(audioPath))}.wav`,
  );
}

export function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup errors
  }
}
