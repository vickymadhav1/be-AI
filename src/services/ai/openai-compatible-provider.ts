import OpenAI from 'openai';
import { z } from 'zod';
import type {
  CopilotContext,
  CopilotResponse,
  QuestionClassification,
  QuestionType,
  ScreenAnalysis,
} from '../../types/copilot';
import { questionTypes } from '../../types/copilot';
import type { AIProvider } from './ai-provider';
import { providerUnavailableError } from './provider-errors';
import { confidenceSchema } from '../../utils/confidence';

const textField = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  },
  z.string(),
);

const legacyAnswerSchema = z.object({
  answer: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).min(1).max(7),
  confidence: confidenceSchema,
});

const classificationSchema = z.object({
  type: z.enum(questionTypes),
  confidence: confidenceSchema,
});

const copilotResponseSchema = z.object({
  answer: textField,
  code: textField,
  output: textField,
  language: textField,
  complexity: textField,
  rootCause: textField,
  fix: textField,
  keyPoints: z.array(z.string()).default([]),
  confidence: confidenceSchema,
});

const screenAnalysisSchema = z.object({
  content: textField,
  code: textField,
  language: textField,
  terminalOutput: textField,
  errors: textField,
  detectedQuestion: textField,
  codeDetected: z.preprocess(
    (value) => value === true || value === 'true',
    z.boolean(),
  ).default(false),
});

export type ProviderTask = 'answer' | 'code' | 'debug' | 'output' | 'classify' | 'screen';

export interface OpenAICompatibleProviderConfig {
  name: string;
  baseURL: string;
  apiKey?: string;
  defaultModel: string;
  codingModel?: string;
  debuggingModel?: string;
  theoryModel?: string;
  systemDesignModel?: string;
  visionModel?: string;
  timeoutMs: number;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  private readonly client: OpenAI | null;
  private readonly config: OpenAICompatibleProviderConfig;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.name = config.name;
    this.config = config;
    this.client = config.enabled === false
      ? null
      : new OpenAI({
          apiKey: config.apiKey || 'not-configured',
          baseURL: config.baseURL,
          timeout: config.timeoutMs,
          defaultHeaders: config.headers,
        });
  }

  isConfigured() {
    return Boolean(this.client);
  }

  supports(task: ProviderTask) {
    return Boolean(this.client) && (task !== 'screen' || Boolean(this.config.visionModel));
  }

  async healthCheck(): Promise<void> {
    if (!this.client) throw providerUnavailableError(`${this.name} is not configured.`);

    await this.client.chat.completions.create({
      model: this.config.defaultModel,
      messages: [{ role: 'user', content: 'Return only: ok' }],
      temperature: 0,
      max_tokens: 5,
    });
  }

  async generateInterviewAnswer(question: string): Promise<string> {
    return (await this.generateLegacyAnswer(question)).answer;
  }

  async generateKeyPoints(question: string): Promise<string[]> {
    return (await this.generateLegacyAnswer(question)).keyPoints;
  }

  async generateConfidence(question: string): Promise<number> {
    return (await this.generateLegacyAnswer(question)).confidence;
  }

  async classifyQuestion(question: string): Promise<QuestionClassification> {
    const content = await this.jsonCompletion(
      'Classify the interview question. Imperative coding tasks such as map the data, reverse string, find duplicates, sort array, flatten array, implement, create function, write code, or predict output are CODING_PROMPT. Return only JSON with type and confidence. Valid types: THEORY, CODING, CODING_PROMPT, SYNTAX, DEBUGGING, SYSTEM_DESIGN, SQL, BEHAVIORAL, OUTPUT, OPTIMIZATION.',
      question,
      'classify',
      120,
    );
    return classificationSchema.parse(content);
  }

  async generateCopilotResponse(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateStructuredResponse(context, classification, this.taskForType(classification.type));
  }

  async generateAnswer(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateStructuredResponse(context, classification, 'answer');
  }

  async generateCode(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateStructuredResponse(context, classification, 'code');
  }

  async generateDebugSolution(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateStructuredResponse(context, classification, 'debug');
  }

  async generateOutputPrediction(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    return this.generateStructuredResponse(context, classification, 'output');
  }

  async analyzeScreen(image: Buffer, mimeType: string): Promise<ScreenAnalysis> {
    if (!this.client || !this.config.visionModel) {
      throw providerUnavailableError(`${this.name} vision analysis is not configured.`);
    }

    const completion = await this.client.chat.completions.create({
      model: this.config.visionModel,
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

  private async generateLegacyAnswer(question: string) {
    const content = await this.jsonCompletion(
      'You are a real-time interview copilot. Return JSON only with answer, keyPoints, and confidence. The answer must be professional, concise, first-person, and easy for a candidate to adapt naturally. Include 3 to 5 short key points. Confidence must be a number from 0 to 1. Never invent personal experience.',
      question,
      'answer',
      700,
    );

    return legacyAnswerSchema.parse(content);
  }

  private async generateStructuredResponse(
    context: CopilotContext,
    classification: QuestionClassification,
    task: ProviderTask,
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
      'You are an expert real-time interview copilot. Use transcript and visible screen context together.',
      'Visible code is the primary source of truth. The transcript is secondary context.',
      'When visible code exists, analyze that exact code first and never return a generic theory answer.',
      'References such as this code, this function, this snippet, or this query always mean the visible code.',
      'For OUTPUT, calculate the actual output by tracing execution and put only the resulting output in output. In answer, explain the execution and name important language features.',
      'For BUG_FIX, identify the root cause and provide corrected code.',
      'For OPTIMIZATION, compare current and improved complexity and provide optimized code.',
      'For CODING, SYNTAX, SQL, or DEBUGGING, code must be complete and runnable when applicable.',
      'For CODING_PROMPT, always provide a complete working solution in code, explain the approach in answer, include an example or predicted result in output, and include time and space complexity. Never respond with code incomplete.',
      'For coding responses, complexity must include time and space complexity.',
      'For non-coding theory or behavioral answers, code and complexity should be empty strings.',
      'Return only JSON: answer, code, output, language, complexity, rootCause, fix, keyPoints, confidence.',
    ].join('\n\n');

    const parsed = copilotResponseSchema.parse(
      await this.jsonCompletion(
        'Be concise, accurate, practical, and return valid JSON only.',
        prompt,
        task,
        1400,
        classification.type,
      ),
    );

    return {
      provider: this.name,
      type: classification.type,
      question: context.question,
      analysisMode: context.analysisMode,
      promptDebug: `${this.name}:${this.modelForTask(task, classification.type)}\n\n${prompt}`,
      ...parsed,
    };
  }

  private async jsonCompletion(
    system: string,
    user: string,
    task: ProviderTask,
    maxTokens: number,
    questionType: QuestionType = 'THEORY',
  ): Promise<unknown> {
    if (!this.client) throw providerUnavailableError(`${this.name} is not configured.`);

    const completion = await this.client.chat.completions.create({
      model: this.modelForTask(task, questionType),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message.content;
    if (!content) throw providerUnavailableError(`${this.name} returned an empty response.`);
    return JSON.parse(content);
  }

  private taskForType(type: QuestionType): ProviderTask {
    if (type === 'CODING' || type === 'CODING_PROMPT' || type === 'SYNTAX' || type === 'SQL') return 'code';
    if (type === 'DEBUGGING') return 'debug';
    if (type === 'OUTPUT') return 'output';
    return 'answer';
  }

  private modelForTask(task: ProviderTask, type: QuestionType): string {
    if (task === 'code' || type === 'CODING' || type === 'CODING_PROMPT' || type === 'SYNTAX' || type === 'SQL') {
      return this.config.codingModel ?? this.config.defaultModel;
    }
    if (task === 'debug' || type === 'DEBUGGING') {
      return this.config.debuggingModel ?? this.config.codingModel ?? this.config.defaultModel;
    }
    if (type === 'SYSTEM_DESIGN') {
      return this.config.systemDesignModel ?? this.config.theoryModel ?? this.config.defaultModel;
    }
    if (type === 'THEORY' || type === 'BEHAVIORAL') {
      return this.config.theoryModel ?? this.config.defaultModel;
    }
    return this.config.defaultModel;
  }
}
