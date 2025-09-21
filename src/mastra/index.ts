import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/index';
import { decorationWorkflow } from './workflows/decoration-workflow';
import { weatherAgent } from './agents/index';
import { decorationAgent } from './agents/decoration-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, decorationWorkflow },
  agents: { weatherAgent, decorationAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
