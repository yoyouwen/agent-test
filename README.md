# Weather & Decoration Agent

This is a comprehensive multi-purpose AI agent built with the Mastra framework that combines weather information services with advanced home decoration capabilities. The agent can provide weather forecasts and help users design and arrange furniture for their rooms using RAG (Retrieval-Augmented Generation) and sophisticated 3D positioning algorithms.

## Overview

This project showcases how to:

### Weather Capabilities
- Create an AI-powered weather agent using Mastra framework
- Implement weather-related workflows with activity suggestions
- Handle user queries about weather conditions
- Integrate with OpenAI's API for natural language processing

### Home Decoration Capabilities
- **Furniture Selection**: RAG-based search through a comprehensive furniture dataset (1400+ items)
- **3D Furniture Arrangement**: AI-powered positioning with collision detection and traffic flow optimization
- **Design Evaluation**: Comprehensive scoring system for interior design quality
- **2D Visualization**: Generate interactive HTML visualizations of room layouts
- **Professional Design Standards**: Implements real-world interior design principles
- **Symmetrical Furniture Pairing**: Automatically creates matching pairs (nightstands, lamps)
- **Room Fixture Integration**: Supports windows, doors, and architectural elements

## Features

### Agents
- **Weather Agent**: Provides weather information and activity suggestions
- **Decoration Agent**: Expert home decoration assistant with 3-step process:
  1. Furniture Selection (using RAG)
  2. Furniture Arrangement (3D positioning)
  3. Design Evaluation (comprehensive feedback)

### Workflows
- **Weather Workflow**: Fetch weather → suggest activities
- **Decoration Workflow**: Select furniture → arrange → evaluate → visualize

### Tools
- **Weather Tool**: Fetches current weather data from Open-Meteo API
- **Furniture Search Tool**: RAG-based search through furniture dataset
- **Furniture Selection Tool**: AI-powered selection based on room and preferences
- **Furniture Arrangement Tool**: 3D positioning with mathematical corrections
- **Decoration Evaluation Tool**: Professional design quality assessment

### Dataset
- **Furniture Database**: 1400+ furniture items with detailed specifications
- **Room Types**: Bedroom, Living Room, Dining Room, Kitchen, Office
- **Styles**: Modern, Contemporary, Traditional, Industrial, Scandinavian
- **Categories**: Sofas, Tables, Beds, Lighting, Storage, and more

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys.
2. Install dependencies: `npm install`
3. Run the project: `npm run dev`
4. Build for production: `npm run build`

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key. [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Usage Examples

### Weather Agent
```javascript
const agent = mastra.getAgent('weatherAgent');
const response = await agent.stream([{
  role: 'user',
  content: 'What\'s the weather like in New York?'
}]);
```

### Decoration Agent
```javascript
const agent = mastra.getAgent('decorationAgent');
const response = await agent.stream([{
  role: 'user',
  content: 'Help me design a modern 16x12 living room with a $2500 budget'
}]);
```

### Running Workflows
```javascript
// Weather workflow
const weatherResult = await mastra.runWorkflow('weatherWorkflow', {
  city: 'New York'
});

// Decoration workflow
const decorationResult = await mastra.runWorkflow('decorationWorkflow', {
  room: {
    id: 'living-room-1',
    type: 'living room',
    dimensions: { width: 16, length: 12, height: 9 },
    features: ['fireplace', 'large windows'],
    style: 'modern',
    budget: 2500
  },
  userPreferences: {
    style: 'modern',
    colorScheme: 'neutral',
    budget: 2500,
    priorities: ['comfort', 'entertainment'],
    restrictions: []
  },
  searchQuery: 'modern living room furniture',
  categories: ['sofa', 'coffee-table', 'tv-stand'],
  arrangementPreferences: {
    focalPoint: 'fireplace',
    trafficFlow: 'open',
    lighting: 'natural'
  }
});
```

## Example Files

- `src/example-decoration.ts`: Complete decoration workflow example
- `src/example-rag-search.ts`: RAG furniture search examples
- `src/examples/furniture-arrangement-examples.ts`: Detailed arrangement examples
- `simple-test.ts`: Integration test script

## Testing

Run the integration test to verify all components are working:
```bash
npm run test-integration
# or
npx tsx simple-test.ts
```

## Architecture

The project uses a modular architecture with:
- **Agents**: AI-powered conversational interfaces
- **Tools**: Specific functionality (weather, furniture operations)
- **Workflows**: Multi-step processes with data flow
- **Dataset**: Comprehensive furniture database with RAG capabilities
- **Visualization**: HTML5 Canvas-based room layout generation
