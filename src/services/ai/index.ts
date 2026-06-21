import { aiOrchestrator } from './ai-orchestrator.service';

// Controllers and domain services depend on this interface, not a vendor SDK.
// The orchestrator automatically fails over across configured providers.
export const aiProvider = aiOrchestrator;
export { aiOrchestrator };

export type { AIProvider } from './ai-provider';
