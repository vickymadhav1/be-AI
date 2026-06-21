import { createWorker, PSM, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

export interface OcrResult {
  text: string;
  confidence: number;
}

const getWorker = (): Promise<Worker> => {
  workerPromise ??= createWorker('eng').then(async (worker) => {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });
    return worker;
  });
  return workerPromise;
};

export const extractTextFromImage = async (image: Buffer): Promise<OcrResult> => {
  const worker = await getWorker();
  const result = await worker.recognize(image);
  return {
    text: result.data.text.trim(),
    confidence: Number.isFinite(result.data.confidence)
      ? result.data.confidence / 100
      : 0,
  };
};

export const shutdownOcr = async (): Promise<void> => {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
};
