import { env } from '../../config/env';
import type {
  CopilotContext,
  CopilotResponse,
  QuestionClassification,
  ScreenAnalysis,
} from '../../types/copilot';
import { AppError } from '../../utils/app-error';
import { normalizeConfidence } from '../../utils/confidence';
import type { AIProvider } from './ai-provider';
import { OpenAICompatibleProvider, type ProviderTask } from './openai-compatible-provider';
import { getProviderErrorMessage, getProviderErrorStatus } from './provider-errors';
import {
  type ProviderHealthStatus,
  type ProviderName,
  validateProviderKey,
} from './provider-config';

interface ProviderDiagnostic {
  provider: ProviderName;
  status?: number;
  message: string;
  timestamp: string;
}

interface ProviderEntry {
  name: ProviderName;
  provider: OpenAICompatibleProvider;
  configured: boolean;
  status: ProviderHealthStatus;
  lastError: string | null;
  requestCount: number;
  successCount: number;
  failureCount: number;
  disabledUntil: number;
  lastCheckedAt: string | null;
}

const providerNames: ProviderName[] = [
  'groq',
  'gemini',
  'openrouter',
  'together',
  'huggingface',
  'openai'
];

export class AIOrchestrator implements AIProvider {
  private readonly providers: ProviderEntry[];
  private readonly diagnostics: ProviderDiagnostic[] = [];

  constructor() {
    const keys = {
       openai: validateProviderKey('openai', env.OPENAI_API_KEY),
      groq: validateProviderKey('groq', env.GROQ_API_KEY),
      gemini: validateProviderKey('gemini', env.GEMINI_API_KEY),
      openrouter: validateProviderKey('openrouter', env.OPENROUTER_API_KEY),
      together: validateProviderKey('together', env.TOGETHER_API_KEY),
      huggingface: validateProviderKey('huggingface', env.HUGGINGFACE_API_KEY),
      
    };


    console.log(
  '[AI Priority]',
  env.AI_PROVIDER_PRIORITIES,
);


    const providers = new Map<ProviderName, OpenAICompatibleProvider>([
      ['openai',new OpenAICompatibleProvider({
        name: 'openai',
        apiKey: env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        defaultModel: env.OPENAI_MODEL,
        codingModel: env.OPENAI_CODING_MODEL,
        debuggingModel: env.OPENAI_DEBUGGING_MODEL,
        theoryModel: env.OPENAI_MODEL,
        visionModel: env.OPENAI_VISION_MODEL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
      })],
      ['groq', new OpenAICompatibleProvider({
        name: 'groq',
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: keys.groq.key,
        defaultModel: env.GROQ_MODEL,
        codingModel: env.GROQ_MODEL,
        debuggingModel: env.GROQ_MODEL,
        theoryModel: env.GROQ_MODEL,
        systemDesignModel: env.GROQ_MODEL,
        visionModel: env.GROQ_VISION_MODEL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        enabled: keys.groq.valid,
      })],
      ['gemini', new OpenAICompatibleProvider({
        name: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: keys.gemini.key,
        defaultModel: env.GEMINI_MODEL,
        codingModel: env.GEMINI_MODEL,
        debuggingModel: env.GEMINI_MODEL,
        theoryModel: env.GEMINI_MODEL,
        systemDesignModel: env.GEMINI_MODEL,
        visionModel: env.GEMINI_MODEL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        enabled: keys.gemini.valid,
      })],
      ['openrouter', new OpenAICompatibleProvider({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: keys.openrouter.key,
        defaultModel: env.OPENROUTER_MODEL,
        codingModel: env.OPENROUTER_MODEL,
        debuggingModel: env.OPENROUTER_MODEL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        headers: { 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'Interview Mate AI' },
        enabled: keys.openrouter.valid,
      })],
      ['together', new OpenAICompatibleProvider({
        name: 'together',
        baseURL: 'https://api.together.xyz/v1',
        apiKey: keys.together.key,
        defaultModel: env.TOGETHER_MODEL,
        codingModel: env.TOGETHER_MODEL,
        debuggingModel: env.TOGETHER_MODEL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        enabled: keys.together.valid,
      })],
      ['huggingface', new OpenAICompatibleProvider({
        name: 'huggingface',
        baseURL: 'https://router.huggingface.co/v1',
        apiKey: keys.huggingface.key,
        defaultModel: env.HUGGINGFACE_MODEL,
        codingModel: env.HUGGINGFACE_MODEL,
        debuggingModel: env.HUGGINGFACE_MODEL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        enabled: keys.huggingface.valid,
      })],
    ]);
    
    const orderedNames = [...env.AI_PROVIDER_PRIORITIES, ...providerNames]
      .filter((name, index, all): name is ProviderName =>
        providerNames.includes(name as ProviderName) && all.indexOf(name) === index,
      );

    this.providers = orderedNames.map((name) => {
      const provider = providers.get(name)!;
      const configured = provider.isConfigured();
      const keyResult = keys[name];
      const initialStatus: ProviderHealthStatus = configured ? 'healthy' : keyResult.key  ? 'invalid_key'  : 'disabled';
      if (!configured) {
        console.warn(`[AI Health] ${name}: ${keyResult.reason}; provider disabled.`);
      }
      return {
        name,
        provider,
        configured,
        status: initialStatus,
        lastError: keyResult.reason ?? null,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        disabledUntil: 0,
        lastCheckedAt: null,
      };
    });

    console.log('Registered AI Providers:', this.providers.map((entry) => entry.name));
    console.table(this.getProviderStatuses());
  }

  getProviderStatuses() {
    const now = Date.now();
    return this.providers.map((entry) => ({
      name: entry.name,
      configured: entry.configured,
      status: entry.status,
      lastError: entry.lastError,
      requestCount: entry.requestCount,
      successCount: entry.successCount,
      failureCount: entry.failureCount,
      lastCheckedAt: entry.lastCheckedAt,
      disabledForMs: Math.max(0, entry.disabledUntil - now),
    }));
  }

  getDiagnostics() {
    return [...this.diagnostics];
  }

  beginExternalRequest(name: ProviderName): boolean {
    const entry = this.providers.find((provider) => provider.name === name);
    if (!entry || !entry.configured || entry.status === 'invalid_key' || Date.now() < entry.disabledUntil) {
      return false;
    }
    entry.requestCount += 1;
    return true;
  }

  recordExternalSuccess(name: ProviderName) {
    const entry = this.providers.find((provider) => provider.name === name);
    if (entry) this.markHealthy(entry);
  }

  recordExternalFailure(name: ProviderName, error: unknown) {
    const entry = this.providers.find((provider) => provider.name === name);
    if (entry) this.markFailure(entry, error);
  }

  async healthCheck() {
    await Promise.allSettled(this.providers.map(async (entry) => {
      if (!entry.configured) return;
      try {
        entry.requestCount += 1;
        await entry.provider.healthCheck();
        this.markHealthy(entry);
      } catch (error) {
        this.markFailure(entry, error);
      }
    }));
    return this.getProviderStatuses();
  }

  async generateInterviewAnswer(question: string) {
    return this.withProviderFallback('answer', (provider) => provider.generateInterviewAnswer(question));
  }

  async generateKeyPoints(question: string) {
    return this.withProviderFallback('answer', (provider) => provider.generateKeyPoints(question));
  }

  async generateConfidence(question: string) {
    const value = await this.withProviderFallback('answer', (provider) => provider.generateConfidence(question));
    return normalizeConfidence(value);
  }

  async classifyQuestion(question: string) {
    const result = await this.withProviderFallback('classify', (provider) => provider.classifyQuestion(question));
    return { ...result, confidence: normalizeConfidence(result.confidence) };
  }

  async generateCopilotResponse(context: CopilotContext, classification: QuestionClassification) {
    if (classification.type === 'DEBUGGING') return this.generateDebugSolution(context, classification);
    if (classification.type === 'CODING' || classification.type === 'CODING_PROMPT' || classification.type === 'SYNTAX' || classification.type === 'SQL') {
      return this.generateCode(context, classification);
    }
    if (classification.type === 'OUTPUT' || context.analysisMode === 'OUTPUT') {
      return this.generateOutputPrediction(context, classification);
    }
    return this.generateAnswer(context, classification);
  }

  generateAnswer(context: CopilotContext, classification: QuestionClassification) {
    return this.generateResponse('answer', context, classification);
  }

  generateCode(context: CopilotContext, classification: QuestionClassification) {
    return this.generateResponse('code', context, classification);
  }

  generateDebugSolution(context: CopilotContext, classification: QuestionClassification) {
    return this.generateResponse('debug', context, classification);
  }

  generateOutputPrediction(context: CopilotContext, classification: QuestionClassification) {
    return this.generateResponse('output', context, classification);
  }

  analyzeScreen(image: Buffer, mimeType: string): Promise<ScreenAnalysis> {
    return this.withProviderFallback('screen', (provider) => provider.analyzeScreen(image, mimeType));
  }

  private async generateResponse(
    task: ProviderTask,
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse> {
    const response = await this.withProviderFallback(task, (provider) =>
      task === 'code' ? provider.generateCode(context, classification)
        : task === 'debug' ? provider.generateDebugSolution(context, classification)
          : task === 'output' ? provider.generateOutputPrediction(context, classification)
            : provider.generateAnswer(context, classification),
    );
    return { ...response, confidence: normalizeConfidence(response.confidence) };
  }

  private async withProviderFallback<T>(
    task: ProviderTask,
    operation: (provider: OpenAICompatibleProvider) => Promise<T>,
  ): Promise<T> {
    for (const entry of this.providers) {
      if (!this.canUse(entry, task)) continue;
      try {
        entry.requestCount += 1;
        const result = await operation(entry.provider);
        this.markHealthy(entry);
        return result;
      } catch (error) {
        this.markFailure(entry, error);

        console.warn(`[AIOrchestrator] ${entry.name} failed; continuing to next provider`, {
          task,
          status: getProviderErrorStatus(error),
          message: getProviderErrorMessage(error),
        });
      }
    }

    throw new AppError(
      503,
      'AI providers are temporarily unavailable. The interview will continue.',
      'AI_ORCHESTRATOR_EXHAUSTED',
    );
  }

  private canUse(entry: ProviderEntry, task: ProviderTask) {
    return entry.configured
      && entry.provider.supports(task)
      && entry.status !== 'invalid_key'
      && Date.now() >= entry.disabledUntil;
  }

  private markHealthy(entry: ProviderEntry) {
    entry.status = 'healthy';
    entry.lastError = null;
    entry.successCount += 1;
    entry.failureCount = 0;
    entry.disabledUntil = 0;
    entry.lastCheckedAt = new Date().toISOString();
  }

  private markFailure(entry: ProviderEntry, error: unknown) {
    const diagnostic: ProviderDiagnostic = {
      provider: entry.name,
      status: getProviderErrorStatus(error),
      message: getProviderErrorMessage(error),
      timestamp: new Date().toISOString(),
    };
    this.diagnostics.push(diagnostic);
    if (this.diagnostics.length > 100) this.diagnostics.shift();
    const status = diagnostic.status;
    entry.status = status === 401 || status === 403
      ? 'invalid_key'
      : status === 429
        ? 'rate_limited'
        : 'offline';
    entry.lastError = diagnostic.message;
    entry.failureCount += 1;
    entry.disabledUntil = entry.status === 'invalid_key'
      ? Number.MAX_SAFE_INTEGER
      : Date.now() + env.AI_PROVIDER_COOLDOWN_MS;
    entry.lastCheckedAt = diagnostic.timestamp;
  }
}

export const aiOrchestrator = new AIOrchestrator();
