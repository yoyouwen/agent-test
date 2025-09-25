import { createMastraConfig } from '@mastra/core';

export default createMastraConfig({
  name: 'weather-decoration-agent',
  logoUrl: '',
  integrations: [],
  workflows: [],
  agents: [],
  db: {
    provider: 'sqlite',
    uri: 'file:../mastra.db'
  },
  systemApis: [],
  systemEvents: []
});
