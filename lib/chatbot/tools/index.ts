import 'server-only';

// Side-effecting imports — each module registers its own tools on load.
import './leads';
import './universities';
import './finance';
import './exports';
import './messaging';

export { getTool, allToolSchemas } from './registry';
export type { ToolDefinition, ToolContext, ToolExecutionResult } from './registry';
