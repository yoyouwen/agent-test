/**
 * FURNITURE ARRANGEMENT TOOL - PRACTICAL EXAMPLES
 * 
 * This file demonstrates how to use the furniture arrangement tools
 * with real data from room_data_converted.csv
 * 
 * Run examples with: node -r ts-node/register src/examples/furniture-arrangement-examples.ts
 */

import { 
  furnitureSelectionTool,
  furnitureArrangementTool, 
  decorationEvaluationTool,
  EXAMPLE_BEDROOM_DEMO_1,
  EXAMPLE_BEDROOM_DEMO_2,
  EXAMPLE_COMPLETE_WORKFLOW
} from '../mastra/tools/furniture-tool';

/**
 * Example 1: Basic Furniture Arrangement
 * Using data from bedroom-for-demo-1 in CSV
 */
export async function runBasicBedroomExample() {
  console.log('🏠 === EXAMPLE 1: Basic Bedroom Arrangement ===');
  console.log('Using data from bedroom-for-demo-1 in CSV');
  
  try {
    // Step 1: Arrange furniture
    const result = await furnitureArrangementTool.execute({
      context: {
        room: EXAMPLE_BEDROOM_DEMO_1.room,
        selectedFurniture: EXAMPLE_BEDROOM_DEMO_1.selectedFurniture,
        arrangementPreferences: EXAMPLE_BEDROOM_DEMO_1.arrangementPreferences
      }
    });
    
    console.log('\n✅ Arrangement Result:');
    console.log(`- Layout: ${result.layoutDescription}`);
    console.log(`- Space Utilization: ${(result.spaceUtilization * 100).toFixed(1)}%`);
    console.log(`- Items Arranged: ${result.arrangement.length}`);
    console.log(`- Using AI Strategy: ${!result.isUsingFallback}`);
    
    // Display furniture positions
    console.log('\n📍 Furniture Positions:');
    result.arrangement.forEach(item => {
      const furniture = EXAMPLE_BEDROOM_DEMO_1.selectedFurniture.find(f => f.id === item.furnitureId);
      console.log(`  - ${furniture?.name}: (${item.position.x.toFixed(1)}, ${item.position.y.toFixed(1)})`);
      if (item.isSymmetrical) {
        console.log(`    ↳ Symmetrical with: ${item.symmetryPartner}`);
      }
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error in basic bedroom example:', error);
    throw error;
  }
}

/**
 * Example 2: Complete Workflow - Selection → Arrangement → Evaluation
 * Using data from bedroom-3 in CSV
 */
export async function runCompleteWorkflowExample() {
  console.log('\n🏠 === EXAMPLE 2: Complete Workflow ===');
  console.log('Selection → Arrangement → Evaluation');
  
  try {
    // Step 1: Furniture Selection
    console.log('\n🔍 Step 1: Furniture Selection');
    const selectionResult = await furnitureSelectionTool.execute({
      context: EXAMPLE_COMPLETE_WORKFLOW.selectionInput
    });
    
    console.log(`✅ Selected ${selectionResult.selectedFurniture.length} items`);
    console.log(`💰 Total Cost: $${selectionResult.totalCost}`);
    console.log(`🧠 Reasoning: ${selectionResult.reasoning}`);
    
    // Step 2: Furniture Arrangement
    console.log('\n🏗️  Step 2: Furniture Arrangement');
    const arrangementResult = await furnitureArrangementTool.execute({
      context: {
        room: EXAMPLE_COMPLETE_WORKFLOW.arrangementInput.room,
        selectedFurniture: selectionResult.selectedFurniture,
        arrangementPreferences: EXAMPLE_COMPLETE_WORKFLOW.arrangementInput.arrangementPreferences
      }
    });
    
    console.log(`✅ Arranged ${arrangementResult.arrangement.length} items`);
    console.log(`📊 Space Utilization: ${(arrangementResult.spaceUtilization * 100).toFixed(1)}%`);
    console.log(`🤖 AI Strategy: ${arrangementResult.aiStrategy?.strategy || 'Fallback'}`);
    
    // Step 3: Decoration Evaluation
    console.log('\n⭐ Step 3: Decoration Evaluation');
    const evaluationResult = await decorationEvaluationTool.execute({
      context: {
        room: EXAMPLE_COMPLETE_WORKFLOW.evaluationInput.room,
        arrangement: arrangementResult.arrangement,
        userPreferences: EXAMPLE_COMPLETE_WORKFLOW.evaluationInput.userPreferences
      }
    });
    
    console.log(`✅ Final Score: ${evaluationResult.score}/100`);
    console.log(`✅ Passed: ${evaluationResult.passed ? 'Yes' : 'No'}`);
    console.log('📝 Feedback:');
    evaluationResult.feedback.forEach(fb => console.log(`  - ${fb}`));
    
    if (evaluationResult.suggestions.length > 0) {
      console.log('💡 Suggestions:');
      evaluationResult.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
    }
    
    return {
      selection: selectionResult,
      arrangement: arrangementResult,
      evaluation: evaluationResult
    };
    
  } catch (error) {
    console.error('❌ Error in complete workflow example:', error);
    throw error;
  }
}

/**
 * Example 3: CSV Data Integration
 * Shows how to convert CSV coordinates to tool format
 */
export function demonstrateCSVDataConversion() {
  console.log('\n🏠 === EXAMPLE 3: CSV Data Integration ===');
  console.log('Converting CSV coordinates to tool format');
  
  // Sample CSV data from bedroom-for-demo-1
  const csvData = [
    {
      room_id: "bedroom-for-demo-1",
      object: "Master Bedroom King Bed",
      dimensions: "189x225x112", // units
      x_center: 157.5,
      y_center: 508.94,
      z_center: 56
    },
    {
      room_id: "bedroom-for-demo-1", 
      object: "Minimalist Nightstand",
      dimensions: "41x45x49.5",
      x_center: 32.5,
      y_center: 551.94,
      z_center: 24.75
    },
    {
      room_id: "bedroom-for-demo-1",
      object: "Minimalist Nightstand", 
      dimensions: "41x45x49.5",
      x_center: 277.5,
      y_center: 551.94,
      z_center: 24.75
    }
  ];
  
  console.log('\n📊 CSV Data Conversion:');
  
  csvData.forEach((item, index) => {
    // Convert dimensions from "LxWxH" string to [L,W,H] array in feet
    const [length, width, height] = item.dimensions.split('x').map(d => parseFloat(d) / 30.5); // Convert units to feet
    
    // Coordinates are already center-based in CSV
    const position = {
      x: item.x_center / 30.5, // Convert to feet
      y: item.y_center / 30.5, // Convert to feet
      z: item.z_center / 30.5  // Convert to feet
    };
    
    console.log(`\n${index + 1}. ${item.object}:`);
    console.log(`   CSV Dimensions: ${item.dimensions} units`);
    console.log(`   Tool Dimensions: [${length.toFixed(1)}, ${width.toFixed(1)}, ${height.toFixed(1)}] feet`);
    console.log(`   CSV Position: (${item.x_center}, ${item.y_center}) units`);
    console.log(`   Tool Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) feet`);
    
    // Generate furniture item format
    const furnitureItem = {
      id: `${item.object.toLowerCase().replace(/\s+/g, '-')}-${index + 1}`,
      name: item.object,
      category_id: item.object.toLowerCase().includes('bed') ? 'bed-frame' : 
                   item.object.toLowerCase().includes('nightstand') ? 'nightstand' : 'furniture',
      dimensions: [length, width, height],
      style_tags: ["modern", "minimalist"],
      price: 299,
      material: "wood",
      color: "natural"
    };
    
    console.log('   Tool Format:', JSON.stringify(furnitureItem, null, 2));
  });
  
  console.log('\n🔄 Coordinate System Notes:');
  console.log('- CSV uses units (likely cm), convert to feet by dividing by ~30.5');
  console.log('- CSV coordinates are already center-based');
  console.log('- Maintain bottom-left origin (Y↑) coordinate system');
  console.log('- Dimensions: [Length, Width, Height] in feet');
}

/**
 * Example 4: Symmetrical Furniture Detection
 * Shows how the tool identifies and arranges symmetrical pairs
 */
export function demonstrateSymmetricalDetection() {
  console.log('\n🏠 === EXAMPLE 4: Symmetrical Furniture Detection ===');
  
  const furnitureItems = [
    { id: "nightstand-left-1", name: "Minimalist Nightstand", category_id: "nightstand" },
    { id: "nightstand-right-1", name: "Minimalist Nightstand", category_id: "nightstand" },
    { id: "table-lamp-1", name: "Table Lamp", category_id: "table-lamp" },
    { id: "table-lamp-2", name: "Table Lamp", category_id: "table-lamp" },
    { id: "accent-chair-1", name: "Accent Chair", category_id: "accent-chair" },
    { id: "accent-chair-2", name: "Accent Chair", category_id: "accent-chair" }
  ];
  
  console.log('\n🔍 Symmetry Detection Rules:');
  
  furnitureItems.forEach(item => {
    const shouldBeSymmetrical = 
      item.category_id === 'nightstand' ||
      item.category_id === 'table-lamp' ||
      item.category_id === 'side-table';
      
    const isAccentChair = item.category_id === 'accent-chair';
    
    console.log(`\n📍 ${item.name} (${item.id}):`);
    console.log(`   Category: ${item.category_id}`);
    console.log(`   Should be symmetrical: ${shouldBeSymmetrical ? '✅ YES' : '❌ NO'}`);
    
    if (shouldBeSymmetrical) {
      // Find symmetry partner
      const baseId = item.id.replace(/-[12]|-left|-right$/, '');
      const partnerId = item.id.includes('-1') || item.id.includes('-left') ? 
        item.id.replace('-1', '-2').replace('-left', '-right') :
        item.id.replace('-2', '-1').replace('-right', '-left');
      
      console.log(`   Base ID: ${baseId}`);
      console.log(`   Symmetry Partner: ${partnerId}`);
      console.log(`   Placement: Same Y coordinate, mirrored X positions`);
    } else if (isAccentChair) {
      console.log(`   Placement: Functional positioning (not symmetrical)`);
      console.log(`   Reasoning: Chairs placed for conversation/function, not matching`);
    } else {
      console.log(`   Placement: Individual positioning based on function`);
    }
  });
  
  console.log('\n📏 Symmetrical Placement Rules:');
  console.log('1. Nightstands: Always symmetrical beside bed');
  console.log('2. Table lamps: Always symmetrical on nightstands/side tables'); 
  console.log('3. Side tables: Usually symmetrical beside sofa');
  console.log('4. Accent chairs: NOT symmetrical (functional placement)');
  console.log('5. Symmetrical pairs: Same Y coordinate, mirrored X positions');
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 === FURNITURE ARRANGEMENT TOOL EXAMPLES ===\n');
  
  try {
    // Example 1: Basic arrangement
    await runBasicBedroomExample();
    
    // Example 2: Complete workflow
    await runCompleteWorkflowExample();
    
    // Example 3: CSV data conversion
    demonstrateCSVDataConversion();
    
    // Example 4: Symmetrical detection
    demonstrateSymmetricalDetection();
    
    console.log('\n✅ === ALL EXAMPLES COMPLETED SUCCESSFULLY ===');
    
  } catch (error) {
    console.error('\n❌ === EXAMPLES FAILED ===');
    console.error('Error:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}
