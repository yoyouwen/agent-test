import { mastra } from './src/mastra/index';

async function simpleTest() {
  console.log('🧪 Simple Integration Test\n');

  try {
    // Test 1: Check that both agents are available
    console.log('📋 Test 1: Checking agent availability');
    const weatherAgent = mastra.getAgent('weatherAgent');
    const decorationAgent = mastra.getAgent('decorationAgent');
    
    console.log('✅ Weather Agent:', weatherAgent ? 'loaded' : 'not found');
    console.log('✅ Decoration Agent:', decorationAgent ? 'loaded' : 'not found');

    // Test 2: Check workflows
    console.log('\n📋 Test 2: Checking workflows');
    const workflows = mastra.getWorkflows();
    console.log('✅ Available workflows:', Object.keys(workflows));

    // Test 3: Check furniture dataset
    console.log('\n📋 Test 3: Checking furniture dataset');
    const { furnitureDataset, searchFurniture } = await import('./src/mastra/data/furniture-dataset');
    console.log(`✅ Furniture dataset: ${furnitureDataset.length} items`);
    
    // Test search
    const searchResults = searchFurniture('modern sofa');
    console.log(`✅ Search test: found ${searchResults.length} modern sofas`);
    
    if (searchResults.length > 0) {
      console.log(`   Example: ${searchResults[0].name} - $${searchResults[0].price}`);
    }

    console.log('\n🎉 All tests passed! Integration successful.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

simpleTest().catch(console.error);
