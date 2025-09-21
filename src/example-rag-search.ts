import { mastra } from './mastra';

async function demonstrateRAGSearch() {
  console.log('🔍 Demonstrating RAG Furniture Search\n');

  try {
    const agent = mastra.getAgent('decorationAgent');

    // Example 1: Search for modern sofas
    console.log('📋 Example 1: Searching for modern sofas');
    const response1 = await agent.stream([
      {
        role: 'user',
        content: 'Search for modern sofas under $1500 for a living room. Use the furnitureSearchTool to find options.',
      },
    ]);

    console.log('Agent Response:');
    for await (const chunk of response1.textStream) {
      process.stdout.write(chunk);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Example 2: Search by category
    console.log('📋 Example 2: Searching for coffee tables');
    const response2 = await agent.stream([
      {
        role: 'user',
        content: 'Find coffee tables in modern style for a living room. Use the furnitureSearchTool with category filter.',
      },
    ]);

    console.log('Agent Response:');
    for await (const chunk of response2.textStream) {
      process.stdout.write(chunk);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Example 3: Complex search with multiple criteria
    console.log('📋 Example 3: Complex search with multiple criteria');
    const response3 = await agent.stream([
      {
        role: 'user',
        content: 'I need furniture for a modern bedroom with a budget of $1000. Search for bed frames, dressers, and lighting. Use the furnitureSearchTool to find options that match my style and budget.',
      },
    ]);

    console.log('Agent Response:');
    for await (const chunk of response3.textStream) {
      process.stdout.write(chunk);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Example 4: Kitchen furniture search
    console.log('📋 Example 4: Kitchen furniture search');
    const response4 = await agent.stream([
      {
        role: 'user',
        content: 'Search for kitchen furniture including islands and bar stools. Use the furnitureSearchTool to find modern options.',
      },
    ]);

    console.log('Agent Response:');
    for await (const chunk of response4.textStream) {
      process.stdout.write(chunk);
    }

  } catch (error) {
    console.error('❌ Error demonstrating RAG search:', error);
  }
}

async function demonstrateFurnitureSelection() {
  console.log('\n🏠 Demonstrating Furniture Selection with RAG\n');

  try {
    const agent = mastra.getAgent('decorationAgent');

    // Example: Complete furniture selection process
    console.log('📋 Complete furniture selection for living room');
    const response = await agent.stream([
      {
        role: 'user',
        content: `I have a 16x12 living room with a fireplace. I prefer modern style with a neutral color scheme and have a budget of $2500. My priorities are comfort, entertainment, and aesthetics. Please use the furnitureSelectionTool to help me select appropriate furniture from the dataset.`,
      },
    ]);

    console.log('Agent Response:');
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }

  } catch (error) {
    console.error('❌ Error demonstrating furniture selection:', error);
  }
}

// Run examples
if (require.main === module) {
  demonstrateRAGSearch()
    .then(() => demonstrateFurnitureSelection())
    .catch(console.error);
}

export { demonstrateRAGSearch, demonstrateFurnitureSelection }; 