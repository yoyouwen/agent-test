import { mastra } from './.mastra/output/index.mjs';

async function testIntegration() {
  console.log('🧪 Testing Integration of Weather and Decoration Agents\n');

  try {
    // Test 1: Check that both agents are available
    console.log('📋 Test 1: Checking agent availability');
    const weatherAgent = mastra.getAgent('weatherAgent');
    const decorationAgent = mastra.getAgent('decorationAgent');
    
    if (weatherAgent) {
      console.log('✅ Weather Agent loaded successfully');
    } else {
      console.log('❌ Weather Agent not found');
    }
    
    if (decorationAgent) {
      console.log('✅ Decoration Agent loaded successfully');
    } else {
      console.log('❌ Decoration Agent not found');
    }

    // Test 2: Check that workflows are available
    console.log('\n📋 Test 2: Checking workflow availability');
    const workflows = mastra.getWorkflows();
    
    if (workflows.weatherWorkflow) {
      console.log('✅ Weather Workflow loaded successfully');
    } else {
      console.log('❌ Weather Workflow not found');
    }
    
    if (workflows.decorationWorkflow) {
      console.log('✅ Decoration Workflow loaded successfully');
    } else {
      console.log('❌ Decoration Workflow not found');
    }

    // Test 3: Check furniture dataset
    console.log('\n📋 Test 3: Checking furniture dataset');
    try {
      const { furnitureDataset, searchFurniture } = await import('./.mastra/output/data/furniture-dataset.mjs');
      console.log(`✅ Furniture dataset loaded with ${furnitureDataset.length} items`);
      
      // Test search functionality
      const searchResults = searchFurniture('modern sofa');
      console.log(`✅ Furniture search working - found ${searchResults.length} modern sofas`);
      
      if (searchResults.length > 0) {
        console.log(`   Example: ${searchResults[0].name} - $${searchResults[0].price}`);
      }
    } catch (error) {
      console.log('❌ Furniture dataset error:', error.message);
    }

    // Test 4: Test weather agent tools
    console.log('\n📋 Test 4: Checking weather agent tools');
    const weatherTools = weatherAgent.tools;
    if (weatherTools && weatherTools.weatherTool) {
      console.log('✅ Weather tools loaded successfully');
    } else {
      console.log('❌ Weather tools not found');
    }

    // Test 5: Test decoration agent tools
    console.log('\n📋 Test 5: Checking decoration agent tools');
    const decorationTools = decorationAgent.tools;
    const expectedTools = ['furnitureSearchTool', 'furnitureSelectionTool', 'furnitureArrangementTool', 'decorationEvaluationTool'];
    
    expectedTools.forEach(toolName => {
      if (decorationTools && decorationTools[toolName]) {
        console.log(`✅ ${toolName} loaded successfully`);
      } else {
        console.log(`❌ ${toolName} not found`);
      }
    });

    console.log('\n🎉 Integration test completed!');
    console.log('\n📖 Usage Examples:');
    console.log('1. Weather: Ask the weatherAgent about weather in any city');
    console.log('2. Decoration: Ask the decorationAgent to help design a room');
    console.log('3. Workflows: Run weatherWorkflow or decorationWorkflow programmatically');
    console.log('\n💡 Try running the example files:');
    console.log('   - src/example-decoration.ts');
    console.log('   - src/example-rag-search.ts');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

testIntegration().catch(console.error);
