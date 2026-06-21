import { prisma } from '../config/db';
import {
  containsCode,
  detectLanguage,
  detectLanguageDetails,
  extractCode,
} from '../utils/code-detection';
import { aiProvider } from './ai';
import { getSessionById } from './session.service';
import { extractTextFromImage } from './ocr.service';
import { extractCodingPrompt } from '../utils/coding-prompt';

const extractQuestion = (content: string): string => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^interviewer:\s*/i, '').trim())
    .filter(Boolean);
  const codingPrompt = extractCodingPrompt(content);
  const explicitQuestion = lines.find((line) => line.endsWith('?'));
  const instruction = lines.find((line) =>
    /^(how|what|why|can|could|given|task|problem|explain|fix|find|implement|solve|optimi[sz]e|write|create|map|reverse|sort|flatten|predict)\b/i.test(line),
  );

  return codingPrompt || explicitQuestion || instruction || '';
};

export class ScreenContextService {
  async analyzeScreenshot(
    userId: string,
    sessionId: string,
    image: Buffer,
    mimeType: string,
  ) {
    const session = await getSessionById(userId, sessionId);
    console.info(
      `[ScreenCapture] screenshot received (${image.byteLength} bytes, ${mimeType})`,
    );
    const [visionResult, ocrResult] = await Promise.allSettled([
      aiProvider.analyzeScreen(image, mimeType),
      extractTextFromImage(image),
    ]);
    const analysis =
      visionResult.status === 'fulfilled'
        ? visionResult.value
        : {
            content: '',
            code: '',
            language: '',
            terminalOutput: '',
            errors: '',
            detectedQuestion: '',
            codeDetected: false,
          };
    const rawOcrText =
      ocrResult.status === 'fulfilled' ? ocrResult.value.text : '';
    const ocrConfidence =
      ocrResult.status === 'fulfilled' ? ocrResult.value.confidence : 0;
    const ocrStatus = ocrResult.status === 'fulfilled' ? 'working' : 'failed';
    if (ocrResult.status === 'rejected') {
      console.error('[ScreenOCR] failed', ocrResult.reason);
    } else {
      console.info(
        `[ScreenOCR] completed (${rawOcrText.length} chars, ${Math.round(ocrConfidence * 100)}% confidence)`,
      );
    }
    const combinedContent = [
      analysis.content,
      analysis.code,
      analysis.terminalOutput,
      analysis.errors,
      rawOcrText,
    ]
      .filter(Boolean)
      .join('\n\n');
    const visionCode = extractCode(analysis.code);
    const ocrCode = extractCode(rawOcrText);
    // The vision model reads punctuation in source code more reliably than
    // general-purpose OCR. Preserve raw OCR for diagnostics, but prefer the
    // structured vision extraction whenever it contains code.
    const code = visionCode || ocrCode || extractCode(combinedContent);
    const codeDetected = Boolean(code) || analysis.codeDetected || containsCode(combinedContent);
    const languageDetection = detectLanguageDetails(code || combinedContent);
    const visionLanguage = analysis.language.trim().toLowerCase() === 'react'
      ? 'react'
      : analysis.language;
    const language = languageDetection.language || visionLanguage;
    const terminalOutput =
      analysis.terminalOutput ||
      rawOcrText
        .split(/\r?\n/)
        .filter((line) => /(^\$ |terminal:|npm ERR|at \w+.*:\d+)/i.test(line))
        .join('\n');
    const errors =
      analysis.errors ||
      rawOcrText
        .split(/\r?\n/)
        .filter((line) => /(error|exception|failed|undefined|null reference)/i.test(line))
        .join('\n');
    const detectedQuestion =
      extractCodingPrompt(rawOcrText) || analysis.detectedQuestion || extractQuestion(rawOcrText);
    const content = [analysis.content, rawOcrText]
      .filter(Boolean)
      .filter((item, index, values) => values.indexOf(item) === index)
      .join('\n\n');

    console.info('[ScreenAnalysis] pipeline', {
      screenshotBytes: image.byteLength,
      ocrCharacterCount: rawOcrText.length,
      codeDetected,
      languageDetected: language || 'unknown',
      languageConfidence: languageDetection.confidence,
    });

    const previous = await prisma.screenContext.findFirst({
      where: { sessionId, source: 'screen' },
      orderBy: { createdAt: 'desc' },
    });

    if (
      previous &&
      previous.code === code &&
      previous.rawOcrText === rawOcrText &&
      previous.terminalOutput === terminalOutput &&
      previous.errors === errors &&
      previous.detectedQuestion === detectedQuestion
    ) {
      const refreshed = await prisma.screenContext.update({
        where: { id: previous.id },
        data: {
          createdAt: new Date(),
          screenshotBytes: image.byteLength,
          ocrCharacterCount: rawOcrText.length,
          ocrConfidence,
          languageConfidence: languageDetection.confidence,
          captureStatus: 'working',
          ocrStatus,
        },
      });
      return {
        context: refreshed,
        detectedQuestion: '',
        changed: false,
        intelligenceChanged: false,
      };
    }

    const intelligenceChanged =
      !previous ||
      previous.code !== code ||
      previous.terminalOutput !== terminalOutput ||
      previous.errors !== errors ||
      previous.detectedQuestion !== detectedQuestion;

    const context = await prisma.screenContext.create({
      data: {
        session: { connect: { id: session.id } },
        source: 'screen',
        content,
        rawOcrText,
        ocrConfidence,
        captureStatus: 'working',
        ocrStatus,
        code,
        language,
        terminalOutput,
        errors,
        detectedQuestion,
        codeDetected,
        screenshotBytes: image.byteLength,
        ocrCharacterCount: rawOcrText.length,
        languageConfidence: languageDetection.confidence,
      },
    });

    return { context, detectedQuestion, changed: true, intelligenceChanged };
  }

  async storeTextContext(
    userId: string,
    sessionId: string,
    source: 'editor' | 'clipboard',
    content: string,
  ) {
    const session = await getSessionById(userId, sessionId);
    const codeDetected = containsCode(content);
    return prisma.screenContext.create({
      data: {
        session: { connect: { id: session.id } },
        source,
        content,
        rawOcrText: content,
        ocrConfidence: 1,
        captureStatus: 'working',
        ocrStatus: 'working',
        code: codeDetected ? content : '',
        language: codeDetected ? detectLanguage(content) : '',
        terminalOutput: /(\$ |npm ERR|error:|warning:|at \w+.*:\d+)/i.test(content)
          ? content
          : '',
        errors: /(error|exception|failed|undefined|null reference|stack trace)/i.test(content)
          ? content
          : '',
        codeDetected,
        screenshotBytes: 0,
        ocrCharacterCount: content.length,
        languageConfidence: codeDetected ? detectLanguageDetails(content).confidence : 0,
      },
    });
  }
}

export const screenContextService = new ScreenContextService();
