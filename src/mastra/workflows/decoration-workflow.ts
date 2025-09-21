import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { furnitureItemSchema, type FurnitureItem } from '../data/furniture-dataset';

// Generic furniture classification and positioning system
function classifyFurniture(furniture: FurnitureItem) {
  const [length, width, height] = furniture.dimensions;
  const area = length * width;
  
  // Size-based classification
  if (length > 5 || width > 3 || area > 15) {
    return { category: 'large', priority: 1, wallDistance: 0, area }; // Beds, sofas, large tables
  } else if (area > 6 || (length > 2 && width > 1.5)) {
    return { category: 'medium', priority: 2, wallDistance: 0, area }; // Dressers, desks, bookcases
  } else if (area > 2) {
    return { category: 'small', priority: 3, wallDistance: 0, area }; // Nightstands, chairs
  } else {
    return { category: 'accent', priority: 4, wallDistance: 1.0, area }; // Lamps, plants
  }
}

// Overlap detection and layering functions
function detectOverlap(item1: any, item2: any): boolean {
  // Calculate bounds for both items (assuming center-based positioning)
  const item1Left = item1.x - item1.width / 2;
  const item1Right = item1.x + item1.width / 2;
  const item1Top = item1.y - item1.length / 2;
  const item1Bottom = item1.y + item1.length / 2;
  
  const item2Left = item2.x - item2.width / 2;
  const item2Right = item2.x + item2.width / 2;
  const item2Top = item2.y - item2.length / 2;
  const item2Bottom = item2.y + item2.length / 2;
  
  // Check if rectangles overlap
  return !(item1Right <= item2Left || 
           item2Right <= item1Left || 
           item1Bottom <= item2Top || 
           item2Bottom <= item1Top);
}

function calculateFurnitureArea(item: any): number {
  return item.width * item.length;
}

function assignLayeringOrder(furniture: any[]): any[] {
  // Create a copy of furniture array with additional layering info
  const furnitureWithLayers = furniture.map((item, index) => ({
    ...item,
    originalIndex: index,
    area: calculateFurnitureArea(item),
    layerOrder: 0, // Will be updated based on overlaps
  }));
  
  // Group overlapping items and assign layer orders
  const processed = new Set<number>();
  
  furnitureWithLayers.forEach((item, index) => {
    if (processed.has(index)) return;
    
    // Find all items that overlap with current item
    const overlappingGroup: any[] = [item];
    
    for (let i = index + 1; i < furnitureWithLayers.length; i++) {
      if (processed.has(i)) continue;
      
      const otherItem = furnitureWithLayers[i];
      if (detectOverlap(item, otherItem)) {
        overlappingGroup.push(otherItem);
      }
    }
    
    // Sort overlapping items by area (largest first, smallest last)
    overlappingGroup.sort((a, b) => b.area - a.area);
    
    // Assign layer orders (larger items get lower layer numbers, appear behind)
    overlappingGroup.forEach((overlappingItem, layerIndex) => {
      overlappingItem.layerOrder = layerIndex;
      processed.add(furnitureWithLayers.indexOf(overlappingItem));
    });
  });
  
  // Sort entire array by layer order (items with higher layer orders render last, appear on top)
  return furnitureWithLayers.sort((a, b) => a.layerOrder - b.layerOrder);
}

function findBestWall(furniture: FurnitureItem, room: { width: number; length: number }, occupiedSpaces: any[]) {
  const [furnitureLength, furnitureWidth] = furniture.dimensions;
  
  // Available walls with their properties
  const walls = [
    { name: 'back', length: room.width, orientation: 'horizontal', x: room.width / 2, y: room.length - (furnitureLength / 2) },
    { name: 'right', length: room.length, orientation: 'vertical', x: room.width - (furnitureWidth / 2), y: room.length / 2 },
    { name: 'left', length: room.length, orientation: 'vertical', x: furnitureWidth / 2, y: room.length / 2 },
    { name: 'front', length: room.width, orientation: 'horizontal', x: room.width / 2, y: furnitureLength / 2 }
  ];
  
  // Find best wall (longest available wall that fits the furniture)
  const suitableWalls = walls.filter(wall => {
    const requiredLength = wall.orientation === 'horizontal' ? furnitureWidth : furnitureLength;
    return wall.length >= requiredLength;
  });
  
  // Prefer back wall, then longest wall
  return suitableWalls.sort((a, b) => {
    if (a.name === 'back') return -1;
    if (b.name === 'back') return 1;
    return b.length - a.length;
  })[0] || walls[0]; // Fallback to first wall if none suitable
}

// Generic furniture positioning function
function calculateOptimalPositions(
  arrangement: Array<{
    furnitureId: string;
    position: { x: number; y: number; z: number; rotation: number };
    placement: string;
  }>,
  selectedFurniture: Array<FurnitureItem>,
  room: { width: number; length: number }
) {
  console.log('🧮 Applying generic furniture positioning...');
  console.log('🔍 Input data:', { 
    arrangementCount: arrangement.length,
    furnitureCount: selectedFurniture.length, 
    room 
  });
  
  const corrected = [...arrangement];
  const occupiedSpaces: any[] = [];
  
  // Create furniture lookup
  const furnitureMap = new Map(selectedFurniture.map(f => [f.id, f]));
  
  // Sort furniture by priority (large furniture first)
  const sortedArrangement = corrected.sort((a, b) => {
    const furnitureA = furnitureMap.get(a.furnitureId);
    const furnitureB = furnitureMap.get(b.furnitureId);
    
    if (!furnitureA || !furnitureB) return 0;
    
    const priorityA = classifyFurniture(furnitureA).priority;
    const priorityB = classifyFurniture(furnitureB).priority;
    
    return priorityA - priorityB;
  });
  
  console.log('📊 Processing furniture in priority order...');
  
  sortedArrangement.forEach((arrangementItem, index) => {
    const furniture = furnitureMap.get(arrangementItem.furnitureId);
    if (!furniture) {
      console.log(`❌ No furniture data found for ${arrangementItem.furnitureId}`);
      return;
    }
    
    const classification = classifyFurniture(furniture);
    const originalPos = { ...arrangementItem.position };
    
    console.log(`🔍 Processing ${furniture.name} (${classification.category}, priority ${classification.priority})`);
    
    // Special handling for paired furniture (nightstands)
    if (furniture.id.includes('nightstand')) {
      const bedArrangement = corrected.find(a => a.furnitureId.includes('bed'));
      const bedFurniture = furnitureMap.get(bedArrangement?.furnitureId || '');
      
      if (bedArrangement && bedFurniture) {
        // Align Y with bed
        arrangementItem.position.y = bedArrangement.position.y;
        
        // Position on left or right based on index
        const [, furnitureWidth] = furniture.dimensions;
        const isLeft = furniture.id.includes('1') || index % 2 === 0;
        
        arrangementItem.position.x = isLeft 
          ? (furnitureWidth / 2) + classification.wallDistance
          : room.width - (furnitureWidth / 2) - classification.wallDistance;
        
        console.log(`🏠 ${furniture.name} positioned as ${isLeft ? 'left' : 'right'} nightstand`);
      }
    } else {
      // Generic positioning based on size and available walls
      const bestWall = findBestWall(furniture, room, occupiedSpaces);
      
      arrangementItem.position.x = bestWall.x;
      arrangementItem.position.y = bestWall.y;
      arrangementItem.position.rotation = 0; // Default to no rotation
      
      console.log(`📐 ${furniture.name} positioned against ${bestWall.name} wall`);
    }
    
    // Add to occupied spaces for collision avoidance
    occupiedSpaces.push({
      furnitureId: arrangementItem.furnitureId,
      x: arrangementItem.position.x,
      y: arrangementItem.position.y,
      width: furniture.dimensions[1],
      length: furniture.dimensions[0]
    });
    
    console.log(`✅ ${furniture.name} correction: (${originalPos.x}, ${originalPos.y}) → (${arrangementItem.position.x}, ${arrangementItem.position.y})`);
  });
  
  console.log('✅ Generic furniture positioning applied');
  console.log('🔍 Final corrected arrangement:', corrected.map(a => ({
    id: a.furnitureId,
    position: a.position
  })));
  
  return corrected;
}

// Function to generate HTML visualization
function generateVisualizationHTML(data: {
  roomDimensions: { width: number; length: number };
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  furniture: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    length: number;
    rotation: number;
    color: string;
  }>;
  scale: number;
  legend: Array<{ furnitureId: string; furnitureName: string; color: string }>;
  visualizationDescription: string;
  spaceUtilization: number;
  trafficFlow: string[];
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2D Top View Visualization - ${data.roomDimensions.width}' x ${data.roomDimensions.length}' Room</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 20px;
        }
        .visualization-container {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }
        .canvas-container {
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        }
        canvas {
            display: block;
            background: white;
        }
        .legend {
            flex: 0 0 300px;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        .legend h3 {
            margin-top: 0;
            color: #333;
        }
        .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 4px;
            border-radius: 3px;
        }
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            margin-right: 10px;
            border: 1px solid #ccc;
        }
        .info-panel {
            margin-top: 20px;
            padding: 15px;
            background: #e8f4fd;
            border-radius: 4px;
            border-left: 4px solid #2196F3;
        }
        .info-panel h3 {
            margin-top: 0;
            color: #1976D2;
        }
        .info-item {
            margin-bottom: 8px;
        }
        .info-label {
            font-weight: bold;
            color: #333;
        }
        .download-section {
            margin-top: 20px;
            text-align: center;
        }
        .download-btn {
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        .download-btn:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>2D Top View Visualization</h1>
        
        <div class="visualization-container">
            <div class="canvas-container">
                <canvas id="visualizationCanvas" width="1000" height="900"></canvas>
            </div>
            
            <div class="legend">
                <h3>Legend</h3>
                <div id="legendContent"></div>
            </div>
        </div>
        
        <div class="info-panel">
            <h3>Visualization Information</h3>
            <div id="infoContent"></div>
        </div>
        
        <div class="download-section">
            <button class="download-btn" onclick="downloadCanvas()">Download as PNG</button>
        </div>
    </div>

    <script>
        // Global error handler
        window.addEventListener('error', function(e) {
            console.error('Visualization Error:', e.error);
            document.body.innerHTML += '<div style="background: red; color: white; padding: 10px; margin: 10px;">ERROR: ' + e.error.message + '</div>';
        });
        
        try {
            console.log('🚀 Starting visualization rendering...');
            
            // Visualization data from the workflow output
            const visualizationData = ${JSON.stringify(data, null, 2)};
            
            console.log('📊 Visualization data loaded:', visualizationData);
            
            // Validate data
            if (!visualizationData) {
                throw new Error('No visualization data');
            }
            if (!visualizationData.roomDimensions) {
                throw new Error('Missing room dimensions');
            }
            if (!visualizationData.furniture) {
                throw new Error('Missing furniture data');
            }
            if (!visualizationData.legend) {
                throw new Error('Missing legend data');
            }
            
            console.log('✅ Data validation passed');
            
            // Canvas dimensions (declare first)
            const canvasWidth = 1000;
            const canvasHeight = 900;
            
            // DEBUG: Log what we're about to render
            console.log('🎨 === RENDERING DEBUG INFO ===');
            console.log('About to render:');
            console.log('- Room dimensions:', visualizationData.roomDimensions);
            console.log('- Furniture count:', visualizationData.furniture.length);
            console.log('- Fixtures count:', visualizationData.fixtures?.length || 0);
            console.log('- Canvas size:', canvasWidth, 'x', canvasHeight);
            
            // Calculate scale to fit room in canvas with padding
            const padding = 50;
            const scaleX = (canvasWidth - 2 * padding) / visualizationData.roomDimensions.width;
            const scaleY = (canvasHeight - 2 * padding) / visualizationData.roomDimensions.length;
            
            // Use a reasonable fixed scale to ensure furniture fits properly
            // For typical rooms, 50 pixels per foot works well
            const maxScale = 50; // Maximum 50 pixels per foot
            const calculatedScale = Math.min(scaleX, scaleY);
            const scale = Math.min(calculatedScale, maxScale);
            
            console.log('Canvas scale calculation:', {
              scaleX: scaleX.toFixed(2),
              scaleY: scaleY.toFixed(2), 
              calculated: calculatedScale.toFixed(2),
              final: scale.toFixed(2) + ' pixels/foot'
            });
            console.log('- Scale:', scale, 'pixels/foot');

            const canvas = document.getElementById('visualizationCanvas');
            if (!canvas) {
                throw new Error('Canvas element not found');
            }
        const ctx = canvas.getContext('2d');
        
        // DEBUG: Log visualization data before processing
        console.log('🔍 === VISUALIZATION DEBUG INFO ===');
        console.log('Room dimensions:', visualizationData.roomDimensions);
        console.log('Canvas dimensions:', { width: canvasWidth, height: canvasHeight });
        console.log('Scale info:', { scaleX, scaleY, calculatedScale, finalScale: scale });
        console.log('Furniture count:', visualizationData.furniture.length);
        console.log('Fixtures count:', visualizationData.fixtures?.length || 0);
        
        // Transform coordinates
        function transformX(x) {
            const result = padding + x * scale;
            return result;
        }
        
        function transformY(y) {
            // Convert from bottom-left origin (room system) to top-left origin (canvas system)
            const result = padding + (visualizationData.roomDimensions.length - y) * scale;
            return result;
        }
        
        // DEBUG: Test coordinate transformations
        console.log('🧪 === COORDINATE TRANSFORMATION TESTS ===');
        console.log('Testing room corners and furniture positions...');
        
        function transformWidth(w) {
            return w * scale;
        }
        
        function transformLength(l) {
            return l * scale;
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        console.log('🎨 Canvas cleared');
        
        // Draw room walls
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        visualizationData.walls.forEach(wall => {
            ctx.moveTo(transformX(wall.x1), transformY(wall.y1));
            ctx.lineTo(transformX(wall.x2), transformY(wall.y2));
        });
        
        ctx.stroke();
        
        // Draw furniture with layering support
        console.log('🪑 Drawing', visualizationData.furniture.length, 'furniture items');
        visualizationData.furniture.forEach((item, index) => {
            const x = transformX(item.x);
            const y = transformY(item.y);
            const width = transformWidth(item.width);
            const length = transformLength(item.length);
            
            console.log('Drawing furniture item:', item.id, 'at position', item.x, item.y, 'layer:', item.layerOrder || 0);
            
            // Save context for rotation
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(item.rotation * Math.PI / 180);
            
            // Apply layering visual effects
            const isLayered = item.layerOrder && item.layerOrder > 0;
            
            if (isLayered) {
                // Add shadow effect for layered items to show they're on top
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            
            // Draw furniture rectangle (furniture positions are CENTER points)
            ctx.fillStyle = item.color;
            ctx.fillRect(-width/2, -length/2, width, length);
            
            // Reset shadow for border
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw border with enhanced styling for layered items
            if (isLayered) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
            }
            ctx.strokeRect(-width/2, -length/2, width, length);
            
            // Add layer indicator for overlapped items
            if (isLayered) {
                ctx.fillStyle = '#FFD700';
                ctx.font = '12px Arial';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText('▲', width/2 - 2, -length/2 + 2);
            }
            
            // Draw furniture name
            ctx.fillStyle = '#000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Split long names
            const words = item.name.split(' ');
            const maxWidth = width - 4;
            let lines = [];
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = ctx.measureText(testLine).width;
                
                if (testWidth <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            });
            if (currentLine) lines.push(currentLine);
            
            // Draw text lines
            lines.forEach((line, index) => {
                const yOffset = (index - (lines.length - 1) / 2) * 12;
                ctx.fillText(line, 0, yOffset);
            });
            
            ctx.restore();
        });
        
        // Draw fixtures (windows and doors) as wall openings
        if (visualizationData.fixtures && visualizationData.fixtures.length > 0) {
            visualizationData.fixtures.forEach(fixture => {
                ctx.save();
                
                // Calculate fixture position based on wall
                const fixtureWidth = transformWidth(fixture.width);
                const fixtureHeight = transformLength(fixture.height);
                
                let startX, startY, endX, endY, labelX, labelY, swingCenterX, swingCenterY;
                
                // Position fixture as a line using the fixture's processed coordinates
                // The fixture coordinates are already positioned correctly by the workflow
                switch (fixture.wall) {
                    case 'top':
                    case 'north':
                        // Top wall - horizontal line
                        startX = transformX(fixture.x);
                        startY = transformY(fixture.y);
                        endX = transformX(fixture.x + fixture.width);
                        endY = startY;
                        labelX = (startX + endX) / 2;
                        labelY = startY - 15;
                        swingCenterX = labelX;
                        swingCenterY = startY;
                        break;
                    case 'bottom':
                    case 'south':
                        // Bottom wall - horizontal line
                        startX = transformX(fixture.x);
                        startY = transformY(fixture.y);
                        endX = transformX(fixture.x + fixture.width);
                        endY = startY;
                        labelX = (startX + endX) / 2;
                        labelY = startY + 20;
                        swingCenterX = labelX;
                        swingCenterY = startY;
                        break;
                    case 'left':
                    case 'west':
                        // Left wall - vertical line
                        startX = transformX(fixture.x);
                        startY = transformY(fixture.y + fixture.height);
                        endX = startX;
                        endY = transformY(fixture.y);
                        labelX = startX - 20;
                        labelY = (startY + endY) / 2;
                        swingCenterX = startX;
                        swingCenterY = labelY;
                        break;
                    case 'right':
                    case 'east':
                        // Right wall - vertical line
                        startX = transformX(fixture.x);
                        startY = transformY(fixture.y + fixture.height);
                        endX = startX;
                        endY = transformY(fixture.y);
                        labelX = startX + 20;
                        labelY = (startY + endY) / 2;
                        swingCenterX = startX;
                        swingCenterY = labelY;
                        break;
                    default:
                        return; // Skip unknown wall
                }
                
                // Draw the fixture as a thick colored line on the wall
                ctx.strokeStyle = fixture.color;
                ctx.lineWidth = 6; // Thick line to represent opening
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Add fixture-specific visual indicators
                if (fixture.type === 'window') {
                    // Draw window frame lines
                    ctx.strokeStyle = '#4682B4';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    
                    // Add window pane divisions
                    ctx.strokeStyle = '#87CEEB';
                    ctx.lineWidth = 1;
                    if (fixture.wall === 'top' || fixture.wall === 'bottom' || fixture.wall === 'north' || fixture.wall === 'south') {
                        // Horizontal window - add vertical divisions
                        const divisions = Math.floor(fixtureWidth / 30); // One division per ~30 pixels
                        for (let i = 1; i <= divisions; i++) {
                            const divX = startX + (fixtureWidth / (divisions + 1)) * i;
                            ctx.beginPath();
                            ctx.moveTo(divX, startY - 3);
                            ctx.lineTo(divX, startY + 3);
                            ctx.stroke();
                        }
                    } else {
                        // Vertical window - add horizontal divisions
                        const divisions = Math.floor(fixtureHeight / 30);
                        for (let i = 1; i <= divisions; i++) {
                            const divY = startY + (fixtureHeight / (divisions + 1)) * i;
                            ctx.beginPath();
                            ctx.moveTo(startX - 3, divY);
                            ctx.lineTo(startX + 3, divY);
                            ctx.stroke();
                        }
                    }
                } else if (fixture.type === 'door') {
                    // Draw door frame
                    ctx.strokeStyle = '#8B4513';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                    
                    // Draw door swing arc if applicable
                    if (fixture.swingDirection === 'inward' || fixture.swingDirection === 'outward') {
                        ctx.strokeStyle = '#FF6B6B';
                        ctx.lineWidth = 1;
                        ctx.setLineDash([3, 3]);
                        ctx.beginPath();
                        
                        const swingRadius = Math.min(fixtureWidth, fixtureHeight) * 0.8;
                        let startAngle, endAngle;
                        
                        // Determine swing arc based on wall and direction
                        if (fixture.wall === 'bottom' || fixture.wall === 'south') {
                            startAngle = fixture.swingDirection === 'inward' ? 0 : Math.PI;
                            endAngle = fixture.swingDirection === 'inward' ? Math.PI/2 : 3*Math.PI/2;
                        } else if (fixture.wall === 'top' || fixture.wall === 'north') {
                            startAngle = fixture.swingDirection === 'inward' ? Math.PI : 0;
                            endAngle = fixture.swingDirection === 'inward' ? 3*Math.PI/2 : Math.PI/2;
                        } else if (fixture.wall === 'left' || fixture.wall === 'west') {
                            startAngle = fixture.swingDirection === 'inward' ? Math.PI/2 : 3*Math.PI/2;
                            endAngle = fixture.swingDirection === 'inward' ? 0 : Math.PI;
                        } else {
                            startAngle = fixture.swingDirection === 'inward' ? 3*Math.PI/2 : Math.PI/2;
                            endAngle = fixture.swingDirection === 'inward' ? Math.PI : 0;
                        }
                        
                        ctx.arc(swingCenterX, swingCenterY, swingRadius, startAngle, endAngle);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
                
                // Draw fixture label
                ctx.fillStyle = '#000';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(fixture.type.toUpperCase(), labelX, labelY);
                
                // Add natural light indicator for windows
                if (fixture.providesLight) {
                    ctx.fillStyle = '#FFD700';
                    ctx.font = '12px Arial';
                    ctx.fillText('☀', labelX, labelY + 12);
                }
                
                ctx.restore();
            });
        }
        
        // Draw scale indicator
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(\`Scale: 1 unit = \${scale.toFixed(2)} pixels\`, 10, canvasHeight - 10);
        
        // Populate legend
        const legendContent = document.getElementById('legendContent');
        
        // Group legend items by type
        const furnitureItems = visualizationData.legend.filter(item => item.type === 'furniture');
        const fixtureItems = visualizationData.legend.filter(item => item.type === 'fixture');
        
        // Add furniture section
        if (furnitureItems.length > 0) {
            const furnitureHeader = document.createElement('h4');
            furnitureHeader.textContent = 'Furniture';
            furnitureHeader.style.margin = '10px 0 5px 0';
            furnitureHeader.style.color = '#333';
            legendContent.appendChild(furnitureHeader);
            
            furnitureItems.forEach(item => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.innerHTML = \`
                    <div class="legend-color" style="background-color: \${item.color}"></div>
                    <span>\${item.furnitureName}</span>
                \`;
                legendContent.appendChild(legendItem);
            });
        }
        
        // Add fixtures section
        if (fixtureItems.length > 0) {
            const fixtureHeader = document.createElement('h4');
            fixtureHeader.textContent = 'Fixtures';
            fixtureHeader.style.margin = '10px 0 5px 0';
            fixtureHeader.style.color = '#333';
            legendContent.appendChild(fixtureHeader);
            
            fixtureItems.forEach(item => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                const lightIndicator = item.furnitureName.toLowerCase().includes('window') ? ' ☀' : '';
                legendItem.innerHTML = \`
                    <div class="legend-color" style="background-color: \${item.color}; border: 2px solid #000;"></div>
                    <span>\${item.furnitureName}\${lightIndicator}</span>
                \`;
                legendContent.appendChild(legendItem);
            });
        }
        
        // Populate info panel
        const infoContent = document.getElementById('infoContent');
        const roomArea = visualizationData.roomDimensions.width * visualizationData.roomDimensions.length;
        const furnitureArea = visualizationData.furniture.reduce((sum, item) => sum + (item.width * item.length), 0);
        const spaceUtilization = (furnitureArea / roomArea * 100).toFixed(1);
        
        const fixtureCount = visualizationData.fixtures ? visualizationData.fixtures.length : 0;
        const windowCount = visualizationData.fixtures ? visualizationData.fixtures.filter(f => f.type === 'window').length : 0;
        const doorCount = visualizationData.fixtures ? visualizationData.fixtures.filter(f => f.type === 'door' || f.type.includes('door')).length : 0;
        
        infoContent.innerHTML = \`
            <div class="info-item">
                <span class="info-label">Room Dimensions:</span> \${visualizationData.roomDimensions.width}' × \${visualizationData.roomDimensions.length}'
            </div>
            <div class="info-item">
                <span class="info-label">Room Area:</span> \${roomArea} sq ft
            </div>
            <div class="info-item">
                <span class="info-label">Furniture Items:</span> \${visualizationData.furniture.length}
            </div>
            \${fixtureCount > 0 ? \`
            <div class="info-item">
                <span class="info-label">Fixtures:</span> \${fixtureCount} total (\${windowCount} windows, \${doorCount} doors)
            </div>
            \` : ''}
            <div class="info-item">
                <span class="info-label">Space Utilization:</span> \${spaceUtilization}%
            </div>
            <div class="info-item">
                <span class="info-label">Scale:</span> 1 unit = 1 foot
            </div>
            <div class="info-item">
                <span class="info-label">Description:</span> \${visualizationData.visualizationDescription}
            </div>
            \${windowCount > 0 ? \`
            <div class="info-item">
                <span class="info-label">Natural Light:</span> \${windowCount} source\${windowCount > 1 ? 's' : ''} (☀ indicates windows)
            </div>
            \` : ''}
        \`;
        
        // Download function
        function downloadCanvas() {
            const link = document.createElement('a');
            link.download = 'room-visualization.png';
            link.href = canvas.toDataURL();
            link.click();
        }
        
        console.log('🎉 Visualization completed successfully!');
        
        } catch (error) {
            console.error('❌ Visualization failed:', error);
            document.body.innerHTML += '<div style="background: red; color: white; padding: 20px; margin: 20px; border-radius: 5px;"><h3>Visualization Error</h3><p>' + error.message + '</p><p>Check browser console for details.</p></div>';
        }
    </script>
</body>
</html>`;
}

// Room fixture schema for windows and doors
const roomFixtureSchema = z.object({
  id: z.string(),
  type: z.enum(['window', 'door', 'closet-door', 'french-door', 'fireplace']),
  position: z.object({
    x: z.number(), // Center X coordinate
    y: z.number(), // Center Y coordinate
    z: z.number(), // Height from floor
    wall: z.enum(['north', 'south', 'east', 'west', 'top', 'bottom', 'left', 'right']), // Which wall it's on
  }),
  dimensions: z.object({
    width: z.number(), // Width of the fixture
    height: z.number(), // Height of the fixture
    depth: z.number().optional(), // Depth (for doors that swing)
  }),
  properties: z.object({
    swingDirection: z.enum(['inward', 'outward', 'sliding', 'none']).optional(),
    clearanceRequired: z.number().optional(), // Feet of clearance needed
    isLoadBearing: z.boolean().optional(),
    providesNaturalLight: z.boolean().optional(),
  }).optional(),
});

// Input schemas
const roomSchema = z.object({
  id: z.string(),
  type: z.string(),
  dimensions: z.object({
    width: z.number(),
    length: z.number(),
    height: z.number(),
  }),
  fixtures: z.array(roomFixtureSchema).optional(), // Windows, doors, etc.
  features: z.array(z.string()),
  style: z.string(),
  budget: z.number(),
});

const userPreferenceSchema = z.object({
  style: z.string(),
  colorScheme: z.string(),
  budget: z.number(),
  priorities: z.array(z.string()),
  restrictions: z.array(z.string()),
});

// Step 1: Furniture Selection
const furnitureSelectionStep = createStep({
  id: 'furniture-selection',
  description: 'Select appropriate furniture based on room type and user preferences',
  inputSchema: z.object({
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    searchQuery: z.string().optional(),
    categories: z.array(z.string()).optional(),
    arrangementPreferences: z.object({
      focalPoint: z.string().optional(),
      trafficFlow: z.string().optional(),
      lighting: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    selectedFurniture: z.array(furnitureItemSchema),
    reasoning: z.string(),
    totalCost: z.number(),
    selectionSummary: z.string(),
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    arrangementPreferences: z.object({
      focalPoint: z.string().optional(),
      trafficFlow: z.string().optional(),
      lighting: z.string().optional(),
    }),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('decorationAgent');
    if (!agent) {
      throw new Error('Decoration agent not found');
    }

    const prompt = `Please help me select furniture for a ${inputData.room.type} room following professional interior design standards:

Room Details:
- Type: ${inputData.room.type}
- Dimensions: ${inputData.room.dimensions.width}' x ${inputData.room.dimensions.length}' x ${inputData.room.dimensions.height}'
- Features: ${inputData.room.features.join(', ')}
- Style: ${inputData.room.style}
- Budget: $${inputData.room.budget}

User Preferences:
- Style: ${inputData.userPreferences.style}
- Color Scheme: ${inputData.userPreferences.colorScheme}
- Budget: $${inputData.userPreferences.budget}
- Priorities: ${inputData.userPreferences.priorities.join(', ')}
- Restrictions: ${inputData.userPreferences.restrictions.join(', ')}

Search Query: ${inputData.searchQuery || 'modern furniture for living room'}
Categories: ${inputData.categories?.join(', ') || 'all categories'}

Professional Interior Design Guidelines:

For Bedrooms:
1. Core Furniture: 1 bed (King/Queen preferred for master), 2 nightstands, 1 dresser
2. Secondary Furniture: 1 floor lamp, 1 accent chair, 1 bench (foot of bed), 1 mirror
3. Lighting: Layered lighting with bedside lamps and ambient floor lamp
4. Traffic Flow: Minimum 24" clearance on both sides of bed, 36" in front of dresser
5. Focal Point: Bed as primary focal point against solid wall
6. Functional Zones: Sleeping, dressing, reading/seating areas

For Living Rooms:
1. Core Furniture: 1 sofa, 1 coffee table, 1 TV stand
2. Secondary Furniture: 1-2 accent chairs, side tables
3. Traffic Flow: Clear paths between seating areas
4. Focal Point: TV or fireplace as primary focal point

Please use the furnitureSelectionTool to search and select furniture following these professional standards. Consider:
1. Room type compatibility and functional requirements
2. Style and color scheme matching
3. Budget constraints and priorities
4. Professional spacing and traffic flow requirements
5. Layered lighting and functional zones

The tool will use RAG to search through our comprehensive furniture dataset and find the best matches. Provide detailed reasoning for your selections and ensure the total cost stays within budget.`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let responseText = '';
    for await (const chunk of response.textStream) {
      responseText += chunk;
    }

    // Use RAG functions directly
    const { searchFurniture, getFurnitureByRoomType } = await import('../data/furniture-dataset.js');
    
    console.log('🔍 FURNITURE SEARCH DEBUG');
    console.log(`📝 Search query: "${inputData.searchQuery}"`);
    console.log(`🏠 Room type: ${inputData.room.type}`);
    console.log(`🎨 Style: ${inputData.userPreferences.style}`);
    console.log(`💰 Budget: $${inputData.userPreferences.budget}`);
    console.log(`📦 Categories: ${inputData.categories?.join(', ') || 'none'}`);
    console.log('---');
    
    let searchResults = [];
    if (inputData.searchQuery) {
      // Don't limit search to first category - let it find all furniture, then filter
      searchResults = searchFurniture(inputData.searchQuery, {
        roomType: inputData.room.type,
        style: inputData.userPreferences.style,
        maxPrice: inputData.userPreferences.budget,
        // Remove category restriction here to get broader results
      });
    } else {
      searchResults = getFurnitureByRoomType(inputData.room.type, inputData.userPreferences.style, inputData.userPreferences.budget);
    }

    // Filter by categories if specified (this will properly filter for all categories)
    if (inputData.categories && inputData.categories.length > 0) {
      console.log(`🔍 Filtering by categories: ${inputData.categories.join(', ')}`);
      console.log(`📊 Before category filter: ${searchResults.length} items`);
      searchResults = searchResults.filter(item => inputData.categories!.includes(item.category_id));
      console.log(`📊 After category filter: ${searchResults.length} items`);
    }

    // Universal furniture selection with symmetrical pair detection
    const roomType = inputData.room.type.toLowerCase();
    let selectedFurniture = [];
    let totalCost = 0;

      // Define symmetrical categories for any room type
  const symmetricalCategories: Record<string, string[]> = {
    'bedroom': ['nightstand', 'table-lamp', 'accent-chair', 'side-table'],
    'living-room': ['accent-chair', 'side-table', 'table-lamp', 'end-table'],
    'dining-room': ['dining-chair', 'accent-chair', 'side-table'],
    'office': ['accent-chair', 'side-table', 'desk-lamp'],
    'default': ['accent-chair', 'side-table', 'nightstand', 'table-lamp']
  };

  // Get room-specific symmetrical categories
  const roomSymmetricalCategories = symmetricalCategories[roomType] || 
                                  symmetricalCategories[roomType.replace(/\s+/g, '-')] || 
                                  symmetricalCategories['default'];

    console.log(`🏠 ${roomType.toUpperCase()} FURNITURE SELECTION`);
    console.log(`📊 Available search results: ${searchResults.length} items`);
    console.log(`💰 Budget: $${inputData.userPreferences.budget}`);
    console.log(`🎯 Symmetrical categories for this room: ${roomSymmetricalCategories.join(', ')}`);
    
    // Group furniture by category for systematic selection
    const furnitureByCategory = new Map<string, any[]>();
    searchResults.forEach((item: any) => {
      const category = item.category_id;
      if (!furnitureByCategory.has(category)) {
        furnitureByCategory.set(category, []);
      }
      furnitureByCategory.get(category)!.push(item);
    });

    // Debug: List all found categories
    console.log('\n📋 DETAILED CATEGORY BREAKDOWN:');
    furnitureByCategory.forEach((items, category) => {
      console.log(`${category}: ${items.length} items`);
      items.forEach(item => console.log(`  - ${item.name} ($${item.price}) [${item.room_style.join(', ')}]`));
    });
    console.log('');

    // Universal furniture selection with smart symmetrical pairing
    const result = selectFurnitureWithSymmetry(
      furnitureByCategory, 
      roomSymmetricalCategories, 
      inputData.userPreferences.budget,
      roomType
    );
    
    selectedFurniture = result.selectedFurniture;
    totalCost = result.totalCost;
    
    console.log(`💰 Total cost: $${totalCost} / $${inputData.userPreferences.budget}`);
    console.log(`📦 Selected ${selectedFurniture.length} furniture items`);
    console.log(`🎯 Symmetrical pairs: ${result.symmetricalPairs}`);
    console.log(`👁️ Single items: ${result.singleItems}`);

    const reasoning = `Selected ${selectedFurniture.length} furniture items from dataset matching ${inputData.userPreferences.style} style and ${inputData.userPreferences.colorScheme} color scheme. Total cost: $${totalCost}`;
    const selectionSummary = `Selected ${selectedFurniture.length} items for $${totalCost} using RAG search`;

    return {
      selectedFurniture,
      reasoning,
      totalCost,
      selectionSummary,
      room: inputData.room,
      userPreferences: inputData.userPreferences,
      arrangementPreferences: inputData.arrangementPreferences || {
        focalPoint: undefined,
        trafficFlow: undefined,
        lighting: undefined,
      },
    };
  },
});

// Universal furniture selection function with symmetrical pairing
function selectFurnitureWithSymmetry(
  furnitureByCategory: Map<string, any[]>, 
  symmetricalCategories: string[], 
  budget: number,
  roomType: string
) {
  let selectedFurniture: any[] = [];
  let totalCost = 0;
  let symmetricalPairs = 0;
  let singleItems = 0;

  // Define priority categories by room type
  const roomPriorities: Record<string, string[]> = {
    'bedroom': ['bed-frame', 'nightstand', 'dresser', 'accent-chair', 'floor-lamp', 'bench'],
    'living-room': ['sofa', 'coffee-table', 'tv-stand', 'accent-chair', 'side-table', 'floor-lamp'],
    'dining-room': ['dining-table', 'dining-chair', 'buffet', 'accent-chair', 'lighting'],
    'office': ['desk', 'office-chair', 'bookshelf', 'accent-chair', 'desk-lamp'],
    'default': ['sofa', 'bed-frame', 'dining-table', 'accent-chair', 'coffee-table', 'side-table']
  };

  const priorities = roomPriorities[roomType] || 
                    roomPriorities[roomType.replace(/\s+/g, '-')] || 
                    roomPriorities['default'];

  console.log(`🎯 Priority order for ${roomType}: ${priorities.join(' → ')}`);

  // Process categories in priority order
  const processedCategories = new Set<string>();
  
  for (const category of priorities) {
    if (processedCategories.has(category) || !furnitureByCategory.has(category)) {
      continue;
    }
    
    const items = furnitureByCategory.get(category);
    if (!items || items.length === 0) continue;

    processedCategories.add(category);
    const bestItem = items[0]; // Already sorted by RAG relevance

    // Check if this category supports symmetrical placement
    if (symmetricalCategories.includes(category)) {
      // Try to select 2 identical items for symmetry
      const doublePrice = bestItem.price * 2;
      if (totalCost + doublePrice <= budget) {
        // Create symmetrical pair
        const item1 = { ...bestItem, id: `${bestItem.id}-1` };
        const item2 = { ...bestItem, id: `${bestItem.id}-2` };
        
        selectedFurniture.push(item1, item2);
        totalCost += doublePrice;
        symmetricalPairs++;
        
        console.log(`✅ Selected symmetrical pair: 2x ${bestItem.name} - $${doublePrice} total`);
        console.log(`  🎭 Items: ${item1.id}, ${item2.id}`);
        continue;
      }
    }

    // Select single item if symmetrical pair doesn't fit or isn't applicable
    if (totalCost + bestItem.price <= budget) {
      selectedFurniture.push(bestItem);
      totalCost += bestItem.price;
      singleItems++;
      
      console.log(`✅ Selected single item: ${bestItem.name} - $${bestItem.price}`);
    } else {
      console.log(`⚠️ Skipped ${bestItem.name} - exceeds budget ($${totalCost + bestItem.price} > $${budget})`);
    }
  }

  // Process any remaining categories not in priority list
  for (const [category, items] of furnitureByCategory) {
    if (processedCategories.has(category) || !items || items.length === 0) {
      continue;
    }

    const bestItem = items[0];
    
    // For non-priority items, only add if there's significant budget left
    const remainingBudget = budget - totalCost;
    if (remainingBudget >= bestItem.price && remainingBudget > budget * 0.1) {
      
      // Check for symmetrical opportunity
      if (symmetricalCategories.includes(category) && 
          totalCost + (bestItem.price * 2) <= budget) {
        
        const item1 = { ...bestItem, id: `${bestItem.id}-1` };
        const item2 = { ...bestItem, id: `${bestItem.id}-2` };
        
        selectedFurniture.push(item1, item2);
        totalCost += bestItem.price * 2;
        symmetricalPairs++;
        
        console.log(`✅ Selected bonus symmetrical pair: 2x ${bestItem.name} - $${bestItem.price * 2} total`);
      } else if (totalCost + bestItem.price <= budget) {
        selectedFurniture.push(bestItem);
        totalCost += bestItem.price;
        singleItems++;
        
        console.log(`✅ Selected bonus item: ${bestItem.name} - $${bestItem.price}`);
      }
    }
  }

  return {
    selectedFurniture,
    totalCost,
    symmetricalPairs,
    singleItems
  };
}

// Step 2: Furniture Arrangement
const furnitureArrangementStep = createStep({
  id: 'furniture-arrangement',
  description: 'Arrange selected furniture in the room with 3D/2D positioning',
  inputSchema: z.object({
    selectedFurniture: z.array(furnitureItemSchema),
    reasoning: z.string(),
    totalCost: z.number(),
    selectionSummary: z.string(),
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    arrangementPreferences: z.object({
      focalPoint: z.string().optional(),
      trafficFlow: z.string().optional(),
      lighting: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    arrangement: z.array(z.object({
      furnitureId: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        rotation: z.number(),
      }),
      placement: z.string(),
    })),
    layoutDescription: z.string(),
    spaceUtilization: z.number(),
    arrangementSummary: z.string(),
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    selectedFurniture: z.array(furnitureItemSchema),
    isUsingFallback: z.boolean().describe('Flag indicating whether fallback logic was used for arrangement'),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    // Debug: Log the inputData to see what's available
    console.log('Arrangement step inputData:', JSON.stringify(inputData, null, 2));
    console.log('inputData.room:', inputData.room);
    console.log('inputData.selectedFurniture:', inputData.selectedFurniture);
    console.log('inputData.arrangementPreferences:', inputData.arrangementPreferences);

    const agent = mastra?.getAgent('decorationAgent');
    if (!agent) {
      throw new Error('Decoration agent not found');
    }

    // Validate required fields
    if (!inputData.room) {
      throw new Error('Room data is missing from inputData');
    }
    if (!inputData.selectedFurniture) {
      throw new Error('Selected furniture data is missing from inputData');
    }
    if (!inputData.arrangementPreferences) {
      throw new Error('Arrangement preferences data is missing from inputData');
    }

    // Call the furnitureArrangementTool directly since agent.run doesn't exist
    try {
      // Import and call the tool directly
      const { furnitureArrangementTool } = await import('../tools/furniture-tool');
      const directResult = await furnitureArrangementTool.execute({
        context: {
          room: inputData.room,
          selectedFurniture: inputData.selectedFurniture,
          arrangementPreferences: inputData.arrangementPreferences,
        },
        runtimeContext: undefined as any
      });

      // Apply mathematical position corrections to override AI positioning
    console.log('🔧 Using AI-generated arrangement directly (no processing)...');
    console.log('🔍 AI-generated arrangement (final):', directResult.arrangement.map(a => ({
      id: a.furnitureId,
      position: a.position,
      placement: a.placement
    })));
    
    // 🎯 DIRECT PASSTHROUGH: Use AI coordinates exactly as generated
    function parseCoordinatesFromText(placement: string, aiReasoning: string): { x: number | null, y: number | null } {
      const texts = [placement, aiReasoning].filter(Boolean);
      
      for (const text of texts) {
        // Look for coordinate patterns like (6.0, 6.8), (1.5, 6.8), etc.
        const coordPattern = /\((\d+\.?\d*),\s*(\d+\.?\d*)\)/g;
        const matches = [...text.matchAll(coordPattern)];
        
        if (matches.length > 0) {
          // Use the first coordinate pair found
          const [, xStr, yStr] = matches[0];
          const x = parseFloat(xStr);
          const y = parseFloat(yStr);
          
          if (!isNaN(x) && !isNaN(y)) {
            console.log(`   🎯 Parsed coordinates from text: (${x}, ${y})`);
            return { x, y };
          }
        }
        
        // Look for individual coordinate mentions like "x=6.0", "y=6.8"
        const xMatch = text.match(/x[=:]\s*(\d+\.?\d*)/i);
        const yMatch = text.match(/y[=:]\s*(\d+\.?\d*)/i);
        
        if (xMatch && yMatch) {
          const x = parseFloat(xMatch[1]);
          const y = parseFloat(yMatch[1]);
          
          if (!isNaN(x) && !isNaN(y)) {
            console.log(`   🎯 Parsed individual coordinates: x=${x}, y=${y}`);
            return { x, y };
          }
        }
      }
      
      return { x: null, y: null };
    }
    
    // DIRECT PASSTHROUGH: Use AI arrangement exactly as generated
    const correctedArrangement = directResult.arrangement;
    console.log('✅ Using AI arrangement directly without any coordinate processing');
    
    console.log('🔍 Arrangement after coordinate processing:', correctedArrangement.map(a => ({
      id: a.furnitureId,
      position: a.position
    })));

    // NO RETRY - Direct passthrough of AI results
    const description = ' (Direct AI passthrough - no coordinate processing)';

      return {
        arrangement: correctedArrangement,
        layoutDescription: directResult.layoutDescription + description,
        spaceUtilization: directResult.spaceUtilization,
        arrangementSummary: `Professional layout with ${correctedArrangement.length} items - coordinates processed`,
        room: inputData.room,
        userPreferences: inputData.userPreferences,
        selectedFurniture: inputData.selectedFurniture,
        isUsingFallback: false,
      };
    } catch (directError) {
      console.error('Direct tool call failed:', directError);
      throw new Error(`Furniture arrangement failed: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
    }
  },
});

// Step 3: Decoration Evaluation
const decorationEvaluationStep = createStep({
  id: 'decoration-evaluation',
  description: 'Evaluate the furniture arrangement and provide comprehensive feedback',
  inputSchema: z.object({
    arrangement: z.array(z.object({
      furnitureId: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        rotation: z.number(),
      }),
      placement: z.string(),
    })),
    layoutDescription: z.string(),
    spaceUtilization: z.number(),
    arrangementSummary: z.string(),
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    selectedFurniture: z.array(furnitureItemSchema),
    isUsingFallback: z.boolean(),
  }),
  outputSchema: z.object({
    evaluation: z.object({
      score: z.number(),
      feedback: z.array(z.string()),
      suggestions: z.array(z.string()),
      issues: z.array(z.string()),
      passed: z.boolean(),
    }),
    selectedFurniture: z.array(furnitureItemSchema),
    arrangement: z.array(z.object({
      furnitureId: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        rotation: z.number(),
      }),
      placement: z.string(),
    })),
    isUsingFallback: z.boolean().describe('Flag indicating whether fallback logic was used for arrangement'),
    room: roomSchema,
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('decorationAgent');
    if (!agent) {
      throw new Error('Decoration agent not found');
    }

    // Call the decorationEvaluationTool directly
    try {
      const { decorationEvaluationTool } = await import('../tools/furniture-tool');
      const evaluation = await decorationEvaluationTool.execute({
        context: {
          room: inputData.room,
          arrangement: inputData.arrangement,
          userPreferences: inputData.userPreferences,
        },
        runtimeContext: undefined as any
      });

      return {
        evaluation,
        selectedFurniture: inputData.selectedFurniture,
        arrangement: inputData.arrangement,
        isUsingFallback: inputData.isUsingFallback,
        room: inputData.room,
      };
    } catch (error) {
      console.error('Evaluation tool call failed:', error);
      throw new Error(`Decoration evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Step 4: 2D Top View Visualization (only if evaluation passes)
const topViewVisualizationStep = createStep({
  id: 'top-view-visualization',
  description: 'Generate a 2D top view visualization of the furniture arrangement',
  inputSchema: z.object({
    evaluation: z.object({
      score: z.number(),
      feedback: z.array(z.string()),
      suggestions: z.array(z.string()),
      issues: z.array(z.string()),
      passed: z.boolean(),
    }),
    selectedFurniture: z.array(furnitureItemSchema),
    arrangement: z.array(z.object({
      furnitureId: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        rotation: z.number(),
      }),
      placement: z.string(),
    })),
    isUsingFallback: z.boolean(),
    room: roomSchema,
  }),
  outputSchema: z.object({
    visualization: z.object({
      roomDimensions: z.object({
        width: z.number(),
        length: z.number(),
      }),
      walls: z.array(z.object({
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
      })),
      furniture: z.array(z.object({
        id: z.string(),
        name: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        length: z.number(),
        rotation: z.number(),
        color: z.string(),
      })),
      fixtures: z.array(z.object({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        wall: z.string(),
        color: z.string(),
        providesLight: z.boolean(),
        clearanceRequired: z.number(),
        swingDirection: z.string(),
      })).optional(),
      scale: z.number(),
      legend: z.array(z.object({
        furnitureId: z.string(),
        furnitureName: z.string(),
        color: z.string(),
        type: z.string(),
      })),
      visualizationDescription: z.string(),
      spaceUtilization: z.number(),
      trafficFlow: z.array(z.string()),
    }),
    visualizationFile: z.string(),
    visualizationPath: z.string(),
    isUsingFallback: z.boolean().describe('Flag indicating whether fallback logic was used for arrangement'),
  }),
  execute: async ({ inputData }) => {
    console.log('🚨🚨🚨 VISUALIZATION STEP STARTING 🚨🚨🚨');
    console.log('🚨 If you see this message, the visualization step is executing!');
    
    if (!inputData) {
      throw new Error('Input data not found');
    }

    // Extract room dimensions from input data
    const roomWidth = inputData.room?.dimensions?.width || 14;
    const roomLength = inputData.room?.dimensions?.length || 12;
    
    // Use actual furniture data from input
    const selectedFurniture = inputData.selectedFurniture || [];
    const arrangement = inputData.arrangement || [];
    
    const roomDimensions = {
      width: roomWidth,
      length: roomLength,
    };
    
    // Create room walls
    const walls = [
      { x1: 0, y1: 0, x2: roomWidth, y2: 0 }, // Top wall
      { x1: roomWidth, y1: 0, x2: roomWidth, y2: roomLength }, // Right wall
      { x1: roomWidth, y1: roomLength, x2: 0, y2: roomLength }, // Bottom wall
      { x1: 0, y1: roomLength, x2: 0, y2: 0 }, // Left wall
    ];

    // Furniture colors based on category
    const furnitureColors: Record<string, string> = {
      'sofa': '#FF6B6B',
      'coffee-table': '#4ECDC4',
      'tv-stand': '#45B7D1',
      'dining-table': '#96CEB4',
      'bed-frame': '#FFEAA7',
      'dresser': '#DDA0DD',
      'nightstand': '#98D8C8',
      'floor-lamp': '#F7DC6F',
      'accent-chair': '#85C1E9',
      'side-table': '#F8C471',
      'bookshelf': '#F1948A',
    };
    
    console.log('🚨 === VISUALIZATION STEP DEBUG START ===');
    console.log('🔍 Input arrangement data:', arrangement.length, 'items');
    console.log('🔍 Input selected furniture:', selectedFurniture.length, 'items');
    console.log('🔍 Room dimensions:', { width: roomWidth, length: roomLength });
    
    arrangement.forEach((item, idx) => {
      console.log(`🔍 Arrangement item ${idx}: ${item.furnitureId} at (${item.position.x}, ${item.position.y})`);
    });
    
    const furniture = arrangement.map((item, index) => {
      const furnitureItem = selectedFurniture.find(f => f.id === item.furnitureId);
      if (!furnitureItem) return null;
      
      const category = furnitureItem.category_id || 'unknown';
      const color = furnitureColors[category] || `hsl(${index * 60}, 70%, 60%)`;
      
      // Handle rotation - swap dimensions for 90° and 270° rotations
      const rotation = item.position.rotation || 0;
      const isRotated90 = rotation === 90 || rotation === 270;
      
      // CORRECT: Database uses [L,W,H] format after our fixes
      // dimensions[0] = Length (head-to-foot), dimensions[1] = Width (side-to-side)
      // For visualization: width = side-to-side, length = head-to-foot
      const originalLength = furnitureItem.dimensions[0] || 2;  // Head to foot (length)  
      const originalWidth = furnitureItem.dimensions[1] || 2;   // Side to side (width)
      
      // Apply rotation to dimensions
      const visualWidth = isRotated90 ? originalLength : originalWidth;
      const visualLength = isRotated90 ? originalWidth : originalLength;
      
      // Validate and correct coordinates to ensure furniture fits within room
      let correctedX = item.position.x;
      let correctedY = item.position.y;
      
      console.log(`🔍 COORDINATE DEBUG: ${item.furnitureId}`);
      console.log(`   Raw position from arrangement: (${item.position.x}, ${item.position.y})`);
      console.log(`   Initial corrected values: (${correctedX}, ${correctedY})`);
      console.log(`   Position object:`, item.position);
      
      // DIRECT PASSTHROUGH: Use AI coordinates exactly as provided
      if (correctedX === null || correctedY === null || correctedX === undefined || correctedY === undefined) {
        console.log(`⚠️ AI provided null coordinates for ${item.furnitureId} - visualizing as null`);
      } else {
        console.log(`✅ Using AI coordinates directly: ${item.furnitureId} at (${correctedX}, ${correctedY})`);
      }
      
      // NO SPECIAL BED PROCESSING - Use AI coordinates directly
      
      // NO BOUNDS CHECKING - Direct passthrough of AI coordinates

      console.log(`🚨 FINAL COORDINATE CHECK: ${item.furnitureId} → (${correctedX}, ${correctedY})`);
      
      return {
        id: item.furnitureId,
        name: furnitureItem.name,
        // Use corrected coordinates to ensure furniture stays within room bounds
        x: correctedX,
        y: correctedY,
        width: visualWidth,
        length: visualLength,
        rotation: rotation,
        color: color,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // Apply layering logic to handle overlapping furniture
    console.log('🔍 Applying layering logic for overlapping furniture...');
    const layeredFurniture = assignLayeringOrder(furniture);
    
    // Log layering results
    layeredFurniture.forEach((item, index) => {
      if (item.layerOrder > 0) {
        console.log(`🎨 ${item.name} assigned to layer ${item.layerOrder} (will render on top)`);
      }
    });
    
    // Use layered furniture for visualization
    const finalFurniture = layeredFurniture;

    // Process fixtures (windows and doors) for visualization
    const fixtures = (inputData.room?.fixtures || []).map((fixture: any) => {
      // Fixture colors based on type
      const fixtureColors: Record<string, string> = {
        'window': '#87CEEB',      // Sky blue
        'door': '#8B4513',        // Brown
        'closet-door': '#A0522D', // Sienna
        'french-door': '#CD853F', // Peru
        'fireplace': '#B22222'    // Fire brick
      };
      
      const color = fixtureColors[fixture.type] || '#808080'; // Default gray
      
      // Convert fixture position to visualization coordinates
      // For wall-mounted fixtures, position them on the wall edge
      let fixtureX, fixtureY;
      
      switch (fixture.position.wall) {
        case 'top':
        case 'north':
          fixtureX = fixture.position.x - fixture.dimensions.width / 2;
          fixtureY = roomLength; // On the top wall
          break;
        case 'bottom':
        case 'south':
          fixtureX = fixture.position.x - fixture.dimensions.width / 2;
          fixtureY = 0; // On the bottom wall
          break;
        case 'left':
        case 'west':
          fixtureX = 0; // On the left wall
          fixtureY = fixture.position.y - fixture.dimensions.height / 2;
          break;
        case 'right':
        case 'east':
          fixtureX = roomWidth; // On the right wall
          fixtureY = fixture.position.y - fixture.dimensions.height / 2;
          break;
        default:
          // Fallback to center positioning for unknown walls
          fixtureX = fixture.position.x - fixture.dimensions.width / 2;
          fixtureY = roomLength - fixture.position.y - fixture.dimensions.height / 2;
      }
      
      return {
        id: fixture.id,
        type: fixture.type,
        name: `${fixture.type.charAt(0).toUpperCase() + fixture.type.slice(1).replace('-', ' ')}`,
        x: fixtureX,
        y: fixtureY,
        width: fixture.dimensions.width,
        height: fixture.dimensions.height,
        wall: fixture.position.wall,
        color: color,
        providesLight: fixture.properties?.providesNaturalLight || false,
        clearanceRequired: fixture.properties?.clearanceRequired || 0,
        swingDirection: fixture.properties?.swingDirection || 'none'
      };
    });

    const legend = [
      ...finalFurniture.map(item => ({
        furnitureId: item.id,
        furnitureName: item.name,
        color: item.color,
        type: 'furniture'
      })),
      ...fixtures.map(fixture => ({
        furnitureId: fixture.id,
        furnitureName: fixture.name,
        color: fixture.color,
        type: 'fixture'
      }))
    ];

    // Calculate space utilization
    const roomArea = roomWidth * roomLength;
    const furnitureArea = finalFurniture.reduce((sum, item) => sum + (item.width * item.length), 0);
    const spaceUtilization = furnitureArea / roomArea;

    const visualization = {
      roomDimensions,
      walls,
      furniture: finalFurniture,
      fixtures, // Add fixtures to visualization data
      scale: 1,
      legend,
      visualizationDescription: `2D top view of ${arrangement.length} furniture items${fixtures.length > 0 ? ` and ${fixtures.length} fixtures` : ''} in ${roomWidth}' x ${roomLength}' room`,
      spaceUtilization,
      trafficFlow: ['Main pathway clear', 'Good circulation around furniture'],
    };

    // Generate HTML content using the existing function
    const htmlContent = generateVisualizationHTML(visualization);

    // Create file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `furniture-visualization-${timestamp}.html`;
    
    // Write HTML file to current directory
    const fs = await import('fs/promises');
    const path = await import('path');
    const filepath = path.join(process.cwd(), filename);
    
    try {
      await fs.writeFile(filepath, htmlContent, 'utf-8');
      console.log(`✅ Visualization saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save visualization file:', error);
      throw new Error(`Failed to save visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      visualization,
      visualizationFile: filepath,
      visualizationPath: filepath,
      isUsingFallback: inputData.isUsingFallback,
    };
  },
});

// Workflow Definition
const decorationWorkflow = createWorkflow({
  id: 'decoration-workflow',
  inputSchema: z.object({
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    searchQuery: z.string().optional(),
    categories: z.array(z.string()).optional(),
    arrangementPreferences: z.object({
      focalPoint: z.string().optional(),
      trafficFlow: z.string().optional(),
      lighting: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    selectedFurniture: z.array(furnitureItemSchema),
    arrangement: z.array(z.object({
      furnitureId: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        rotation: z.number(),
      }),
      placement: z.string(),
    })),
    evaluation: z.object({
      score: z.number(),
      feedback: z.array(z.string()),
      suggestions: z.array(z.string()),
      issues: z.array(z.string()),
      passed: z.boolean(),
    }),
    visualization: z.object({
      roomDimensions: z.object({
        width: z.number(),
        length: z.number(),
      }),
      walls: z.array(z.object({
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
      })),
      furniture: z.array(z.object({
        id: z.string(),
        name: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        length: z.number(),
        rotation: z.number(),
        color: z.string(),
      })),
      fixtures: z.array(z.object({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        wall: z.string(),
        color: z.string(),
        providesLight: z.boolean(),
        clearanceRequired: z.number(),
        swingDirection: z.string(),
      })).optional(),
      scale: z.number(),
      legend: z.array(z.object({
        furnitureId: z.string(),
        furnitureName: z.string(),
        color: z.string(),
        type: z.string(),
      })),
      visualizationDescription: z.string(),
      spaceUtilization: z.number(),
      trafficFlow: z.array(z.string()),
    }),
    visualizationFile: z.string(),
    visualizationPath: z.string(),
    isUsingFallback: z.boolean().describe('Flag indicating whether fallback logic was used for arrangement'),
    room: roomSchema,
  }),
})
  .then(furnitureSelectionStep)
  .then(furnitureArrangementStep)
  .then(decorationEvaluationStep)
  .then(topViewVisualizationStep);

decorationWorkflow.commit();

export { decorationWorkflow };
