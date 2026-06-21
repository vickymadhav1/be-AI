import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import type { AIProvider } from './ai-provider';
import {
  questionTypes,
  type CopilotContext,
  type CopilotResponse,
  type QuestionClassification,
  type ScreenAnalysis,
} from '../../types/copilot';
import { confidenceSchema } from '../../utils/confidence';

const groqResponseSchema = z.object({
  answer: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).min(1).max(7),
  confidence: confidenceSchema,
});

type GroqResult = z.infer<typeof groqResponseSchema>;

const modelString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => `${key}: ${String(item)}`)
        .join(', ');
    }
    return value;
  },
  z.string(),
);

const classificationSchema = z.object({
  type: z.enum(questionTypes),
  confidence: confidenceSchema,
});

const copilotResponseSchema = z.object({
  answer: modelString,
  code: modelString,
  output: modelString,
  language: modelString,
  complexity: modelString,
  rootCause: modelString,
  fix: modelString,
  keyPoints: z.array(z.string()).default([]),
  confidence: confidenceSchema,
});

const screenAnalysisSchema = z.object({
  content: modelString,
  code: modelString,
  language: modelString,
  terminalOutput: modelString,
  errors: modelString,
  detectedQuestion: modelString,
  codeDetected: z.preprocess(
    (value) => value === true || value === 'true',
    z.boolean(),
  ).default(false),
});

const compactJsonOutput = (output: string): string => {
  const trimmed = output.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return output;
  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    return output;
  }
};

export class GroqService implements AIProvider {
  private readonly client: OpenAI | null;
  private readonly pending = new Map<string, Promise<GroqResult>>();

  constructor() {
    this.client = env.GROQ_API_KEY
      ? new OpenAI({
          apiKey: env.GROQ_API_KEY,
          baseURL: 'https://api.groq.com/openai/v1',
        })
      : null;
  }

  async generateInterviewAnswer(question: string): Promise<string> {
    return (await this.generate(question)).answer;
  }

  async generateKeyPoints(question: string): Promise<string[]> {
    return (await this.generate(question)).keyPoints;
  }

  async generateConfidence(question: string): Promise<number> {
    return (await this.generate(question)).confidence;
  }

  async classifyQuestion(question: string): Promise<QuestionClassification> {
    const content = await this.jsonCompletion(
      'Classify the interview question. Imperative coding tasks are CODING_PROMPT. Return only JSON with type and confidence. Valid types: THEORY, CODING, CODING_PROMPT, SYNTAX, DEBUGGING, SYSTEM_DESIGN, SQL, BEHAVIORAL, OUTPUT, OPTIMIZATION.',
      question,
      120,
    );
    return classificationSchema.parse(content);
  }

  async generateCopilotResponse(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    const prompt = [
      `Question type: ${classification.type}`,
      `Current question: ${context.question}`,
      `Latest transcript: ${context.latestTranscript}`,
      `Previous transcript history:\n${context.transcriptHistory.join('\n') || 'None'}`,
      `Visible screen/editor/clipboard context:\n${context.screenContext || 'None'}`,
      `Visible code (${context.screenLanguage || 'unknown language'}):\n${context.screenCode || 'None'}`,
      `Visible terminal output:\n${context.terminalOutput || 'None'}`,
      `Visible errors:\n${context.screenErrors || 'None'}`,
      `Required analysis mode: ${context.analysisMode}`,
      '',
      'Generate an interview-ready response using BOTH the transcript and visible screen context.',
      'VISIBLE CODE IS THE PRIMARY SOURCE OF TRUTH. The transcript is secondary context.',
      'When visible code exists, analyze that exact code first and never return a generic theory answer.',
      'References such as this code, this function, this snippet, or this query always mean the visible code.',
      'For OUTPUT, calculate the actual output by tracing execution and put only the resulting output in output. In answer, explain the execution and explicitly name the important functions or language features, such as map(), closure behavior, coercion, or loop scope.',
      'When analysis is triggered autonomously from visible code, also include potential bugs, useful optimizations, and likely interview follow-up questions in keyPoints.',
      'For BUG_FIX, identify the root cause and provide corrected code.',
      'For OPTIMIZATION, compare current and improved complexity and provide optimized code.',
      'For LINE_BY_LINE, explain the visible code in execution order with line references in the answer.',
      'For CODING, SYNTAX, SQL, or DEBUGGING, code must be complete and runnable when applicable.',
      'For CODING_PROMPT, always provide working code, explanation, example output, and time and space complexity. Never respond with code incomplete.',
      'For DEBUGGING, include rootCause, fix, and corrected code in code.',
      'For coding responses, complexity must include time and space complexity.',
      'For non-coding theory or behavioral answers, code and complexity should be empty strings.',
      'Return only JSON: answer, code, output, language, complexity, rootCause, fix, keyPoints, confidence.',
    ].join('\n\n');

    const content = await this.jsonCompletion(
      'You are an expert real-time interview copilot. Be concise, accurate, and practical. Never invent personal experience.',
      prompt,
      1400,
    );
    const parsed = copilotResponseSchema.parse(content);

    return {
      provider: 'groq',
      type: classification.type,
      question: context.question,
      analysisMode: context.analysisMode,
      promptDebug: prompt,
      ...parsed,
      output:
        context.analysisMode === 'OUTPUT'
          ? compactJsonOutput(parsed.output)
          : parsed.output,
    };
  }

  async generateAnswer(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateCopilotResponse(context, classification);
  }

  async generateCode(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateCopilotResponse(context, classification);
  }

  async generateDebugSolution(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateCopilotResponse(context, classification);
  }

  async generateOutputPrediction(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateCopilotResponse(context, classification);
  }

  async analyzeScreen(image: Buffer, mimeType: string): Promise<ScreenAnalysis> {
    if (!this.client) {
      throw new AppError(503, 'Groq is not configured.', 'GROQ_NOT_CONFIGURED');
    }

    const completion = await this.client.chat.completions.create({
      model: env.GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Perform OCR on this shared-screen image. Extract visible code exactly with formatting, infer the programming language, extract terminal output, stack traces or browser console errors, and any displayed interview question. Return only JSON with content, code, language, terminalOutput, errors, detectedQuestion, and codeDetected. codeDetected is true only when programming code or SQL is visible.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${image.toString('base64')}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 1400,
    });

    return screenAnalysisSchema.parse(
      JSON.parse(completion.choices[0]?.message.content || '{}'),
    );
  }

  private generate(question: string): Promise<GroqResult> {
    const normalizedQuestion = question.trim();
    const existing = this.pending.get(normalizedQuestion);

    if (existing) {
      return existing;
    }

    const request = this.requestCompletion(normalizedQuestion).finally(() => {
      this.pending.delete(normalizedQuestion);
    });

    this.pending.set(normalizedQuestion, request);
    return request;
  }

  private async requestCompletion(question: string): Promise<GroqResult> {
    if (!this.client) {
      throw new AppError(
        503,
        'Groq is not configured. Set GROQ_API_KEY on the backend.',
        'GROQ_NOT_CONFIGURED',
      );
    }

    const completion = await this.client.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a real-time interview copilot. Return JSON only with answer, keyPoints, and confidence. The answer must be professional, concise, first-person, and easy for a candidate to adapt naturally. Include 3 to 5 short key points. Confidence must be a number from 0 to 1. Never invent personal experience.',
        },
        {
          role: 'user',
          content: question,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 700,
    });

    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new AppError(502, 'Groq returned an empty response', 'GROQ_EMPTY_RESPONSE');
    }

    try {
      return groqResponseSchema.parse(JSON.parse(content));
    } catch (error) {
      throw new AppError(
        502,
        'Groq returned an invalid structured response',
        'GROQ_INVALID_RESPONSE',
        error,
      );
    }
  }

  private async jsonCompletion(
    system: string,
    user: string,
    maxTokens: number,
  ): Promise<unknown> {
    if (!this.client) {
      throw new AppError(
        503,
        'Groq is not configured. Set GROQ_API_KEY on the backend.',
        'GROQ_NOT_CONFIGURED',
      );
    }

    const completion = await this.client.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new AppError(502, 'Groq returned an empty response', 'GROQ_EMPTY_RESPONSE');
    }

    return JSON.parse(content);
  }
}
