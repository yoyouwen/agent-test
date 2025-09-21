import { mastra } from './mastra';

// Example room
const livingRoom = {
  id: 'living-room-1',
  type: 'living room',
  dimensions: { width: 16, length: 12, height: 9 },
  features: ['fireplace', 'large windows', 'hardwood floors'],
  style: 'modern',
  budget: 2500,
};

// Example user preferences
const userPreferences = {
  style: 'modern',
  colorScheme: 'neutral',
  budget: 2500,
  priorities: ['comfort', 'entertainment', 'aesthetics'],
  restrictions: ['no pets', 'minimal maintenance'],
};

// Example arrangement preferences
const arrangementPreferences = {
  focalPoint: 'fireplace',
  trafficFlow: 'open',
  lighting: 'natural',
};

async function runDecorationExample() {
  console.log('🏠 Starting Home Decoration Agent Example\n');

  try {
    // Run the complete decoration workflow
    console.log('Step 1: Furniture Selection');
    console.log('Step 2: Furniture Arrangement');
    console.log('Step 3: Design Evaluation\n');

    const result = await mastra.runWorkflow('decoration-workflow', {
      room: livingRoom,
      userPreferences,
      searchQuery: 'modern living room furniture comfortable seating',
      categories: ['sofa', 'coffee-table', 'tv-stand', 'lighting', 'rug'],
      arrangementPreferences,
    });

    console.log('🎉 Decoration Workflow Complete!\n');
    console.log('📋 Results:');
    console.log('Selected Furniture:', result.selectedFurniture.length, 'items');
    console.log('Total Cost: $', result.selectedFurniture.reduce((sum, item) => sum + item.price, 0));
    console.log('Space Utilization:', (result.arrangement.length / result.selectedFurniture.length * 100).toFixed(1) + '%');
    console.log('Design Score:', result.evaluation.score + '/100');
    
    console.log('\n📝 Feedback:');
    result.evaluation.feedback.forEach(feedback => console.log('✅', feedback));
    
    if (result.evaluation.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      result.evaluation.suggestions.forEach(suggestion => console.log('💡', suggestion));
    }
    
    if (result.evaluation.issues.length > 0) {
      console.log('\n⚠️ Issues:');
      result.evaluation.issues.forEach(issue => console.log('⚠️', issue));
    }

    console.log('\n🏠 Furniture Arrangement:');
    result.arrangement.forEach(item => {
      console.log(`📍 ${item.placement}`);
    });

  } catch (error) {
    console.error('❌ Error running decoration workflow:', error);
  }
}

// Example of using the decoration agent directly
async function runDecorationAgentExample() {
  console.log('\n🤖 Testing Decoration Agent Directly\n');

  try {
    const agent = mastra.getAgent('decorationAgent');
    
    const response = await agent.stream([
      {
        role: 'user',
        content: `I have a ${livingRoom.type} that's ${livingRoom.dimensions.width}' x ${livingRoom.dimensions.length}' with a ${livingRoom.features.join(', ')}. I prefer ${userPreferences.style} style with a ${userPreferences.colorScheme} color scheme and have a budget of $${userPreferences.budget}. My priorities are ${userPreferences.priorities.join(', ')}. Can you help me design this room?`,
      },
    ]);

    console.log('Agent Response:');
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }

  } catch (error) {
    console.error('❌ Error running decoration agent:', error);
  }
}

// Run examples
if (require.main === module) {
  runDecorationExample()
    .then(() => runDecorationAgentExample())
    .catch(console.error);
}

export { runDecorationExample, runDecorationAgentExample }; 