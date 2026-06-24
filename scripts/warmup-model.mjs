/**
 * Pre-download Whisper models during Docker build so runtime does not need
 * HuggingFace egress. Loads the same models used at runtime (base + tiny).
 */
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = true;
env.useBrowserCache = false;

const MODELS = ["Xenova/whisper-base", "Xenova/whisper-tiny"];

for (const modelId of MODELS) {
  console.log(`Warming up ${modelId}…`);
  await pipeline("automatic-speech-recognition", modelId, { quantized: true });
  console.log(`Ready: ${modelId}`);
}

console.log("All Whisper models cached.");
