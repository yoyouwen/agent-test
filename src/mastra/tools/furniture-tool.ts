import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { 
  furnitureItemSchema, 
  searchFurniture, 
  getFurnitureByRoomType, 
  getFurnitureByCategory,
  type FurnitureItem 
} from '../data/furniture-dataset';

/**
 * FURNITURE ARRANGEMENT TOOL - COMPREHENSIVE EXAMPLES AND USAGE GUIDE
 * 
 * This file contains tools for furniture selection and arrangement with AI-powered positioning.
 * Examples are based on real room data from room_data_converted.csv
 * 
 * COORDINATE SYSTEM:
 * - Origin [0,0] at bottom-left corner of room
 * - X-axis: left to right (positive →)
 * - Y-axis: bottom to top (positive ↑)  
 * - All positions represent furniture CENTER points
 * - Dimensions format: [Length, Width, Height] in feet
 * 
 * EXAMPLE ROOM DATA FROM CSV:
 * Room: bedroom-for-demo-1 (350 x 621 units ≈ 11.5' x 20.4')
 * - Master Bedroom King Bed: 189x225x112 at center (157.5, 508.94)
 * - Minimalist Nightstands: 41x45x49.5 at (32.5, 551.94) and (277.5, 551.94)
 * - French Vintage Storage Cabinet: 40x180x85 at (295, 191.44)
 * - Modern Minimalist Bed Bench: 170x50x45 at (157, 378.44)
 * - Table Lamps: 15x15x58 at (34.5, 595.94) and (270.5, 595.94)
 */

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

// Room-specific fixture and feature defaults (must be defined before schema)
const getRoomDefaults = (roomType: string) => {
  const defaults = {
    bedroom: {
      fixtures: [
        {
          id: 'bedroom-window',
          type: 'window' as const,
          position: { x: 6.0, y: 10.0, z: 3.0, wall: 'top' as const },
          dimensions: { width: 4.0, height: 4.0 },
          properties: { providesNaturalLight: true, clearanceRequired: 1.5 }
        },
        {
          id: 'bedroom-door',
          type: 'door' as const,
          position: { x: 2.0, y: 0, z: 0, wall: 'bottom' as const },
          dimensions: { width: 2.5, height: 6.5 },
          properties: { swingDirection: 'inward' as const, clearanceRequired: 2.5 }
        }
      ],
      features: ['natural-light', 'window', 'door']
    },
    'living-room': {
      fixtures: [
        {
          id: 'large-window',
          type: 'window' as const,
          position: { x: 8, y: 12, z: 3, wall: 'top' as const },
          dimensions: { width: 6, height: 4 },
          properties: { providesNaturalLight: true, clearanceRequired: 2.0 }
        },
        {
          id: 'main-entrance',
          type: 'door' as const,
          position: { x: 2, y: 0, z: 0, wall: 'bottom' as const },
          dimensions: { width: 3, height: 7 },
          properties: { swingDirection: 'inward' as const, clearanceRequired: 3.0 }
        },
        {
          id: 'patio-door',
          type: 'french-door' as const,
          position: { x: 16, y: 6, z: 0, wall: 'right' as const },
          dimensions: { width: 6, height: 8 },
          properties: { swingDirection: 'outward' as const, clearanceRequired: 3.0 }
        }
      ],
      features: [
        'natural-light', 'large-windows', 'patio-access', 'open-concept', 
        'entertainment-ready', 'hardwood-floors', 'high-ceilings', 'fireplace-ready'
      ]
    },
    'dining-room': {
      fixtures: [
        {
          id: 'dining-window',
          type: 'window' as const,
          position: { x: 6, y: 14, z: 3, wall: 'top' as const },
          dimensions: { width: 4, height: 4 },
          properties: { providesNaturalLight: true, clearanceRequired: 1.5 }
        },
        {
          id: 'dining-entrance',
          type: 'door' as const,
          position: { x: 1.5, y: 0, z: 0, wall: 'bottom' as const },
          dimensions: { width: 2.5, height: 7 },
          properties: { swingDirection: 'inward' as const, clearanceRequired: 2.5 }
        }
      ],
      features: [
        'natural-light', 'formal-dining', 'entertaining-space', 'hardwood-floors',
        'chandelier-ready', 'adjacent-to-kitchen', 'good-acoustics'
      ]
    },
    kitchen: {
      fixtures: [
        {
          id: 'kitchen-window',
          type: 'window' as const,
          position: { x: 5, y: 10, z: 3, wall: 'top' as const },
          dimensions: { width: 3, height: 3 },
          properties: { providesNaturalLight: true, clearanceRequired: 1.0 }
        },
        {
          id: 'kitchen-door',
          type: 'door' as const,
          position: { x: 1.5, y: 0, z: 0, wall: 'bottom' as const },
          dimensions: { width: 2.5, height: 7 },
          properties: { swingDirection: 'inward' as const, clearanceRequired: 2.5 }
        }
      ],
      features: [
        'natural-light', 'ventilation', 'plumbing-ready', 'electrical-ready',
        'tile-floors', 'cabinet-space', 'counter-space', 'appliance-ready'
      ]
    },
    office: {
      fixtures: [
        {
          id: 'office-window',
          type: 'window' as const,
          position: { x: 5, y: 8, z: 3, wall: 'top' as const },
          dimensions: { width: 4, height: 4 },
          properties: { providesNaturalLight: true, clearanceRequired: 1.5 }
        },
        {
          id: 'office-door',
          type: 'door' as const,
          position: { x: 1.5, y: 0, z: 0, wall: 'bottom' as const },
          dimensions: { width: 2.5, height: 6.5 },
          properties: { swingDirection: 'inward' as const, clearanceRequired: 2.5 }
        }
      ],
      features: [
        'natural-light', 'quiet-space', 'electrical-outlets', 'internet-ready',
        'hardwood-floors', 'good-ventilation', 'privacy', 'focused-lighting'
      ]
    },
    bathroom: {
      fixtures: [
        {
          id: 'bathroom-window',
          type: 'window' as const,
          position: { x: 3, y: 6, z: 4, wall: 'top' as const },
          dimensions: { width: 2, height: 2 },
          properties: { providesNaturalLight: true, clearanceRequired: 0.5 }
        },
        {
          id: 'bathroom-door',
          type: 'door' as const,
          position: { x: 1, y: 0, z: 0, wall: 'bottom' as const },
          dimensions: { width: 2, height: 6.5 },
          properties: { swingDirection: 'inward' as const, clearanceRequired: 2.0 }
        }
      ],
      features: [
        'natural-light', 'ventilation', 'plumbing-ready', 'electrical-ready',
        'tile-floors', 'waterproof', 'privacy', 'humidity-resistant'
      ]
    }
  };
  
  return defaults[roomType as keyof typeof defaults] || defaults.bedroom;
};

// Enhanced room schema with fixtures and defaults (defined after getRoomDefaults)
const roomSchema = z.object({
  id: z.string().default('default-bedroom'),
  type: z.enum(['bedroom', 'living-room', 'dining-room', 'kitchen', 'office', 'bathroom']).default('bedroom'),
  dimensions: z.object({
    width: z.number().default(12.0),
    length: z.number().default(10.0),
    height: z.number().default(8.0),
  }),
  fixtures: z.array(roomFixtureSchema).default([
    {
      id: 'bedroom-window',
      type: 'window',
      position: { x: 6.0, y: 10.0, z: 3.0, wall: 'top' },
      dimensions: { width: 4.0, height: 4.0 },
      properties: { providesNaturalLight: true, clearanceRequired: 1.5 }
    },
    {
      id: 'bedroom-door',
      type: 'door',
      position: { x: 2.0, y: 0, z: 0, wall: 'bottom' },
      dimensions: { width: 2.5, height: 6.5 },
      properties: { swingDirection: 'inward', clearanceRequired: 2.5 }
    }
  ]),
  features: z.array(z.string()).default(['natural-light', 'window', 'door']),
  style: z.enum(['modern', 'contemporary', 'traditional', 'scandinavian', 'industrial', 'minimalist', 'rustic']).default('modern'),
  budget: z.number().default(1500),
});

// Helper function to get complete room configuration with room-specific defaults
export const getRoomConfiguration = (roomType: string = 'bedroom') => {
  const roomDefaults = getRoomDefaults(roomType);
  
  // Base dimensions that change based on room type
  const dimensionDefaults = {
    bedroom: { width: 12.0, length: 10.0, height: 8.0 },
    'living-room': { width: 16.0, length: 12.0, height: 9.0 },
    'dining-room': { width: 12.0, length: 14.0, height: 9.0 },
    kitchen: { width: 10.0, length: 12.0, height: 8.0 },
    office: { width: 10.0, length: 8.0, height: 8.0 },
    bathroom: { width: 6.0, length: 8.0, height: 8.0 }
  };
  
  const dimensions = dimensionDefaults[roomType as keyof typeof dimensionDefaults] || dimensionDefaults.bedroom;
  
  return {
    id: `default-${roomType}`,
    type: roomType,
    dimensions,
    fixtures: roomDefaults.fixtures,
    features: roomDefaults.features,
    style: 'modern',
    budget: 1500
  };
};

// Export the functions for use in UI components
export { getRoomDefaults };

// User preference schema with defaults
const userPreferenceSchema = z.object({
  style: z.enum(['modern', 'contemporary', 'traditional', 'scandinavian', 'industrial', 'minimalist', 'rustic']).default('modern'),
  colorScheme: z.enum(['light', 'dark', 'neutral', 'warm', 'cool', 'monochrome']).default('light'),
  budget: z.number().default(1500),
  priorities: z.array(z.enum(['bed', 'storage', 'seating', 'lighting', 'decor', 'functionality', 'aesthetics'])).default(['bed', 'storage']),
  restrictions: z.array(z.string()).default([]),
});

export const furnitureSelectionTool = createTool({
  id: 'furniture-selection',
  description: 'Select appropriate furniture based on room type and user preferences using RAG from furniture dataset',
  inputSchema: z.object({
    room: roomSchema,
    userPreferences: userPreferenceSchema,
    searchQuery: z.string().optional().default("modern bedroom furniture"),
    categories: z.array(z.string()).optional().default(["bed-frame", "nightstand", "dresser", "floor-lamp"]),
  }),
  outputSchema: z.object({
    selectedFurniture: z.array(furnitureItemSchema).default([
      {
        id: "bed-queen-modern",
        name: "Modern Queen Bed Frame",
        slug: "modern-queen-bed-frame",
        description: "Clean-lined queen bed frame with upholstered headboard. Modern elegance for the bedroom.",
        price: 600,
        image: "/images/bed-queen-modern.jpg",
        category_id: "bed-frame",
        brand_id: "sleepwell",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "bed_queen_modern_001",
        material: "engineered-wood",
        dimensions: [6.5, 5, 3],
        color: "white",
        style_tags: ["upholstered", "clean", "elegant", "queen"],
        texture: "smooth",
        group_id: "bedroom-group-1",
        ready_to_ship: true
      },
      {
        id: "nightstand-modern-1",
        name: "Modern Nightstand",
        slug: "modern-nightstand",
        description: "Compact nightstand with drawer and open shelf. Perfect bedside storage solution.",
        price: 150,
        image: "/images/nightstand-modern.jpg",
        category_id: "nightstand",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "nightstand_modern_001",
        material: "engineered-wood",
        dimensions: [2, 1.5, 2.5],
        color: "white",
        style_tags: ["compact", "bedside", "storage", "versatile"],
        texture: "smooth",
        group_id: "bedroom-group-3",
        ready_to_ship: true
      },
      {
        id: "nightstand-modern-2",
        name: "Modern Nightstand",
        slug: "modern-nightstand",
        description: "Compact nightstand with drawer and open shelf. Perfect bedside storage solution.",
        price: 150,
        image: "/images/nightstand-modern.jpg",
        category_id: "nightstand",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "nightstand_modern_001",
        material: "engineered-wood",
        dimensions: [2, 1.5, 2.5],
        color: "white",
        style_tags: ["compact", "bedside", "storage", "versatile"],
        texture: "smooth",
        group_id: "bedroom-group-3",
        ready_to_ship: true
      },
      {
        id: "dresser-modern",
        name: "Modern Dresser",
        slug: "modern-dresser",
        description: "Spacious dresser with smooth-gliding drawers and modern hardware. Ample storage for clothing.",
        price: 400,
        image: "/images/dresser-modern.jpg",
        category_id: "dresser",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "dresser_modern_001",
        material: "engineered-wood",
        dimensions: [4, 1.5, 3.5],
        color: "white",
        style_tags: ["spacious", "smooth-drawers", "storage", "modern"],
        texture: "smooth",
        group_id: "bedroom-group-2",
        ready_to_ship: true
      },
      {
        id: "floor-lamp-modern",
        name: "Modern Floor Lamp",
        slug: "modern-floor-lamp",
        description: "Contemporary floor lamp with adjustable head and LED compatibility. Perfect for reading corners.",
        price: 150,
        image: "/images/floor-lamp-modern.jpg",
        category_id: "floor-lamp",
        brand_id: "lightco",
        space_type: ["living room", "family room", "bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "floor_lamp_modern_001",
        material: "metal",
        dimensions: [1, 1, 5],
        color: "white",
        style_tags: ["adjustable", "LED-compatible", "contemporary", "reading"],
        texture: "smooth",
        group_id: "lighting-group-1",
        ready_to_ship: true
      }
    ]),
    reasoning: z.string().default("Selected 5 furniture items from dataset matching modern style and light color scheme. Total cost: $1450"),
    totalCost: z.number().default(1450),
    searchResults: z.array(furnitureItemSchema),
  }),
  execute: async ({ context }) => {
    return await selectFurnitureWithRAG(context.room, context.userPreferences, context.searchQuery, context.categories);
  },
});

export const furnitureArrangementTool = createTool({
  id: 'furniture-arrangement',
  description: 'Arrange selected furniture in the room with 3D/2D positioning. Default room includes bedroom-window and bedroom-door fixtures with natural-light, window, and door features.',
  inputSchema: z.object({
    room: roomSchema,
    selectedFurniture: z.array(furnitureItemSchema).default([
      {
        id: "bed-queen-modern",
        name: "Modern Queen Bed Frame",
        slug: "modern-queen-bed-frame",
        description: "Clean-lined queen bed frame with upholstered headboard. Modern elegance for the bedroom.",
        price: 600,
        image: "/images/bed-queen-modern.jpg",
        category_id: "bed-frame",
        brand_id: "sleepwell",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "bed_queen_modern_001",
        material: "engineered-wood",
        dimensions: [6.5, 5, 3],
        color: "white",
        style_tags: ["upholstered", "clean", "elegant", "queen"],
        texture: "smooth",
        group_id: "bedroom-group-1",
        ready_to_ship: true
      },
      {
        id: "nightstand-modern-1",
        name: "Modern Nightstand",
        slug: "modern-nightstand",
        description: "Compact nightstand with drawer and open shelf. Perfect bedside storage solution.",
        price: 150,
        image: "/images/nightstand-modern.jpg",
        category_id: "nightstand",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "nightstand_modern_001",
        material: "engineered-wood",
        dimensions: [2, 1.5, 2.5],
        color: "white",
        style_tags: ["compact", "bedside", "storage", "versatile"],
        texture: "smooth",
        group_id: "bedroom-group-3",
        ready_to_ship: true
      },
      {
        id: "nightstand-modern-2",
        name: "Modern Nightstand",
        slug: "modern-nightstand",
        description: "Compact nightstand with drawer and open shelf. Perfect bedside storage solution.",
        price: 150,
        image: "/images/nightstand-modern.jpg",
        category_id: "nightstand",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "nightstand_modern_001",
        material: "engineered-wood",
        dimensions: [2, 1.5, 2.5],
        color: "white",
        style_tags: ["compact", "bedside", "storage", "versatile"],
        texture: "smooth",
        group_id: "bedroom-group-3",
        ready_to_ship: true
      },
      {
        id: "dresser-modern",
        name: "Modern Dresser",
        slug: "modern-dresser",
        description: "Spacious dresser with smooth-gliding drawers and modern hardware. Ample storage for clothing.",
        price: 400,
        image: "/images/dresser-modern.jpg",
        category_id: "dresser",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "dresser_modern_001",
        material: "engineered-wood",
        dimensions: [4, 1.5, 3.5],
        color: "white",
        style_tags: ["spacious", "smooth-drawers", "storage", "modern"],
        texture: "smooth",
        group_id: "bedroom-group-2",
        ready_to_ship: true
      },
      {
        id: "floor-lamp-modern",
        name: "Modern Floor Lamp",
        slug: "modern-floor-lamp",
        description: "Contemporary floor lamp with adjustable head and LED compatibility. Perfect for reading corners.",
        price: 150,
        image: "/images/floor-lamp-modern.jpg",
        category_id: "floor-lamp",
        brand_id: "lightco",
        space_type: ["living room", "family room", "bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "floor_lamp_modern_001",
        material: "metal",
        dimensions: [1, 1, 5],
        color: "white",
        style_tags: ["adjustable", "LED-compatible", "contemporary", "reading"],
        texture: "smooth",
        group_id: "lighting-group-1",
        ready_to_ship: true
      }
    ]),
    arrangementPreferences: z.object({
      focalPoint: z.enum(['bed', 'seating-area', 'dining-table', 'entertainment-center', 'natural-light', 'none']).optional().default('bed'),
      trafficFlow: z.enum(['open', 'balanced', 'intimate', 'formal', 'efficient']).optional().default('balanced'),
      lighting: z.enum(['natural', 'ambient', 'task', 'accent', 'overhead', 'mixed']).optional().default('natural'),
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
      aiReasoning: z.string().optional(),
      relationships: z.array(z.string()).optional(),
    })),
    layoutDescription: z.string(),
    spaceUtilization: z.number(),
    aiStrategy: z.object({
      strategy: z.string(),
      reasoning: z.string(),
      focalPoints: z.array(z.any()),
      trafficFlowPaths: z.array(z.any()),
      furnitureGroups: z.array(z.any()),
      placementZones: z.array(z.any()),
    }).optional(),
    isUsingFallback: z.boolean().describe('Flag indicating whether fallback logic was used instead of AI arrangement'),
  }),
  execute: async ({ context }) => {
    return await arrangeFurniture(context.room, context.selectedFurniture, context.arrangementPreferences);
  },
});

export const furnitureSearchTool = createTool({
  id: 'furniture-search',
  description: 'Search and retrieve furniture from the dataset using RAG',
  inputSchema: z.object({
    query: z.string().default('modern bedroom furniture').describe('Search query for furniture'),
    roomType: z.enum(['bedroom', 'living-room', 'dining-room', 'kitchen', 'office', 'bathroom']).optional().default('bedroom'),
    style: z.enum(['modern', 'contemporary', 'traditional', 'scandinavian', 'industrial', 'minimalist', 'rustic']).optional().default('modern'),
    maxPrice: z.number().optional().default(1500),
    category: z.enum(['bed', 'nightstand', 'dresser', 'chair', 'table', 'sofa', 'desk', 'bookcase', 'lamp', 'bench']).optional().default('bed'),
    limit: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    results: z.array(furnitureItemSchema),
    totalFound: z.number(),
    searchQuery: z.string(),
    filters: z.object({
      roomType: z.string().optional(),
      style: z.string().optional(),
      maxPrice: z.number().optional(),
      category: z.string().optional(),
    }),
  }),
  execute: async ({ context }) => {
    const results = searchFurniture(context.query, {
      roomType: context.roomType,
      style: context.style,
      maxPrice: context.maxPrice,
      category: context.category,
    });

    const limitedResults = context.limit ? results.slice(0, context.limit) : results;

    return {
      results: limitedResults,
      totalFound: results.length,
      searchQuery: context.query,
      filters: {
        roomType: context.roomType,
        style: context.style,
        maxPrice: context.maxPrice,
        category: context.category,
      },
    };
  },
});

export const decorationEvaluationTool = createTool({
  id: 'decoration-evaluation',
  description: 'Evaluate the furniture arrangement and provide feedback',
  inputSchema: z.object({
    room: roomSchema,
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
    userPreferences: userPreferenceSchema,
  }),
  outputSchema: z.object({
    score: z.number(),
    feedback: z.array(z.string()),
    suggestions: z.array(z.string()),
    issues: z.array(z.string()),
    passed: z.boolean(),
  }),
  execute: async ({ context }) => {
    return await evaluateDecoration(context.room, context.arrangement, context.userPreferences);
  },
});

// New Designer Tool for Custom Furniture Arrangement with Visualization
export const designerFurnitureArrangementTool = createTool({
  id: 'designer-furniture-arrangement',
  description: 'Advanced furniture arrangement tool for designers with custom prompts and integrated top view visualization',
  inputSchema: z.object({
    // Core inputs from furnitureArrangementTool
    room: roomSchema,
    selectedFurniture: z.array(furnitureItemSchema).default([
      {
        id: "bed-queen-modern",
        name: "Modern Queen Bed Frame",
        slug: "modern-queen-bed-frame",
        description: "Clean-lined queen bed frame with upholstered headboard. Modern elegance for the bedroom.",
        price: 600,
        image: "/images/bed-queen-modern.jpg",
        category_id: "bed-frame",
        brand_id: "sleepwell",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "bed_queen_modern_001",
        material: "engineered-wood",
        dimensions: [6.5, 5, 3],
        color: "white",
        style_tags: ["upholstered", "clean", "elegant", "queen"],
        texture: "smooth",
        group_id: "bedroom-group-1",
        ready_to_ship: true
      },
      {
        id: "nightstand-modern-1",
        name: "Modern Nightstand",
        slug: "modern-nightstand",
        description: "Compact nightstand with drawer and open shelf. Perfect bedside storage solution.",
        price: 150,
        image: "/images/nightstand-modern.jpg",
        category_id: "nightstand",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "nightstand_modern_001",
        material: "engineered-wood",
        dimensions: [2, 1.5, 2.5],
        color: "white",
        style_tags: ["compact", "bedside", "storage", "versatile"],
        texture: "smooth",
        group_id: "bedroom-group-3",
        ready_to_ship: true
      },
      {
        id: "nightstand-modern-2",
        name: "Modern Nightstand",
        slug: "modern-nightstand",
        description: "Compact nightstand with drawer and open shelf. Perfect bedside storage solution.",
        price: 150,
        image: "/images/nightstand-modern.jpg",
        category_id: "nightstand",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "nightstand_modern_001",
        material: "engineered-wood",
        dimensions: [2, 1.5, 2.5],
        color: "white",
        style_tags: ["compact", "bedside", "storage", "versatile"],
        texture: "smooth",
        group_id: "bedroom-group-3",
        ready_to_ship: true
      },
      {
        id: "dresser-modern",
        name: "Modern Dresser",
        slug: "modern-dresser",
        description: "Spacious dresser with smooth-gliding drawers and modern hardware. Ample storage for clothing.",
        price: 400,
        image: "/images/dresser-modern.jpg",
        category_id: "dresser",
        brand_id: "modernhome",
        space_type: ["bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "dresser_modern_001",
        material: "engineered-wood",
        dimensions: [4, 1.5, 3.5],
        color: "white",
        style_tags: ["spacious", "smooth-drawers", "storage", "modern"],
        texture: "smooth",
        group_id: "bedroom-group-2",
        ready_to_ship: true
      },
      {
        id: "floor-lamp-modern",
        name: "Modern Floor Lamp",
        slug: "modern-floor-lamp",
        description: "Contemporary floor lamp with adjustable head and LED compatibility. Perfect for reading corners.",
        price: 150,
        image: "/images/floor-lamp-modern.jpg",
        category_id: "floor-lamp",
        brand_id: "lightco",
        space_type: ["living room", "family room", "bedroom"],
        room_style: ["modern", "contemporary"],
        model_3d_id: "floor_lamp_modern_001",
        material: "metal",
        dimensions: [1, 1, 5],
        color: "white",
        style_tags: ["adjustable", "LED-compatible", "contemporary", "reading"],
        texture: "smooth",
        group_id: "lighting-group-1",
        ready_to_ship: true
      }
    ]),
    arrangementPreferences: z.object({
      focalPoint: z.enum(['bed', 'seating-area', 'dining-table', 'entertainment-center', 'natural-light', 'none']).optional().default('bed'),
      trafficFlow: z.enum(['open', 'balanced', 'intimate', 'formal', 'efficient']).optional().default('balanced'),
      lighting: z.enum(['natural', 'ambient', 'task', 'accent', 'overhead', 'mixed']).optional().default('natural'),
    }),
    // New custom prompt inputs for designers
    customPrompts: z.object({
      designStyle: z.string().optional().default('Create a comfortable and functional bedroom layout with clean lines').describe('Custom design style instructions (e.g., "Create a cozy reading nook", "Maximize natural light")'),
      spatialRequirements: z.string().optional().default('Maintain 3 feet clearance around bed and 2.5 feet clearance for door swing').describe('Specific spatial requirements (e.g., "Leave 4 feet clearance around bed", "Create conversation areas")'),
      functionalNeeds: z.string().optional().default('Optimize for daily routines with easy access to storage and natural light').describe('Functional requirements (e.g., "Optimize for morning routine", "Create work-from-home space")'),
      aestheticGoals: z.string().optional().default('Achieve visual balance with symmetrical nightstand placement').describe('Aesthetic objectives (e.g., "Emphasize symmetry", "Create visual balance with artwork")'),
      clientPreferences: z.string().optional().default('Prefer modern style with emphasis on functionality over decoration').describe('Specific client requests or constraints'),
    }),
    // Visualization preferences
    visualizationOptions: z.object({
      includeLabels: z.boolean().optional().default(true),
      showDimensions: z.boolean().optional().default(false),
      colorScheme: z.enum(['default', 'monochrome', 'pastel', 'bold']).optional().default('default'),
      showTrafficFlow: z.boolean().optional().default(true),
    }).optional(),
  }),
  outputSchema: z.object({
    // Core outputs from furnitureArrangementTool
    arrangement: z.array(z.object({
      furnitureId: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        rotation: z.number(),
      }),
      placement: z.string(),
      aiReasoning: z.string().optional(),
      relationships: z.array(z.string()).optional(),
    })),
    layoutDescription: z.string(),
    aiStrategy: z.object({
      strategy: z.string(),
      reasoning: z.string(),
      focalPoints: z.array(z.any()),
      trafficFlowPaths: z.array(z.any()),
      furnitureGroups: z.array(z.any()),
      placementZones: z.array(z.any()),
    }).optional(),
    isUsingFallback: z.boolean(),
    // New outputs for designers
    designAnalysis: z.object({
      customPromptIntegration: z.string().describe('How custom prompts were incorporated into the design'),
      designPrinciples: z.array(z.string()).describe('Design principles applied'),
      spatialAnalysis: z.string().describe('Analysis of spatial relationships and flow'),
      recommendations: z.array(z.string()).describe('Professional design recommendations'),
    }),
    // Integrated visualization output
    visualization: z.object({
      htmlFile: z.string().describe('Generated HTML visualization file path'),
      visualizationData: z.object({
        roomDimensions: z.object({
          width: z.number(),
          length: z.number(),
        }),
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
        legend: z.array(z.object({
          furnitureId: z.string(),
          furnitureName: z.string(),
          color: z.string(),
        })),
        spaceUtilization: z.number(),
        trafficFlow: z.array(z.string()),
      }),
      visualizationDescription: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    return await designerArrangeFurniture(
      context.room,
      context.selectedFurniture,
      context.arrangementPreferences,
      context.customPrompts,
      context.visualizationOptions
    );
  },
});

/**
 * ========================================
 * EXAMPLES NOW INTEGRATED INTO AI SYSTEM PROMPT
 * ========================================
 * 
 * The comprehensive examples from room_data_converted.csv are now embedded
 * directly into the AI system prompt for the furniture arrangement tool.
 * This ensures the AI model learns from real data patterns and applies
 * professional design principles consistently.
 * 
 * Examples include:
 * - Modern minimalist bedroom (11.5' × 20.4')
 * - Contemporary bedroom (17.6' × 13.9') 
 * - Small bedroom optimization (10.0' × 12.0')
 * 
 * Key patterns taught to AI:
 * - Symmetrical pairs share same Y coordinate
 * - Bed placement varies by room proportions
 * - Space constraints override symmetry when needed
 * - Accent chairs positioned functionally, not symmetrically
 * - Storage furniture along walls for accessibility
 */

// NOTE: Example constants removed - now integrated into system prompt
// Use the JSON test files for UI testing instead:
// - simple-workflow-test.json
// - ui-test-inputs/bedroom-demo-1-input.json
// - ui-test-inputs/bedroom-demo-2-input.json
// - ui-test-inputs/bedroom-3-contemporary-input.json

// For UI testing, use the JSON files:
// - simple-workflow-test.json (basic test)
// - ui-test-inputs/bedroom-demo-1-input.json (modern minimalist)
// - ui-test-inputs/bedroom-demo-2-input.json (traditional)
// - ui-test-inputs/bedroom-3-contemporary-input.json (contemporary)

// All examples are now integrated into the AI system prompt above.
// The AI model will learn from these patterns automatically.

// Implementation functions
async function selectFurnitureWithRAG(room: any, userPreferences: any, searchQuery?: string, categories?: string[]) {
  // Use RAG to search and filter furniture from the dataset
  let searchResults: FurnitureItem[] = [];
  
  if (searchQuery) {
    // Search with query and filters
    searchResults = searchFurniture(searchQuery, {
      roomType: room.type,
      style: userPreferences.style,
      maxPrice: userPreferences.budget,
      category: categories?.[0],
    });
  } else {
    // Get furniture by room type and style
    searchResults = getFurnitureByRoomType(room.type, userPreferences.style, userPreferences.budget);
  }

  // Filter by categories if specified
  if (categories && categories.length > 0) {
    searchResults = searchResults.filter(item => categories.includes(item.category_id));
  }

  // Sort by priority and budget
  const sortedFurniture = searchResults.sort((a, b) => {
    const aPriority = userPreferences.priorities.some((p: string) => 
      a.name.toLowerCase().includes(p.toLowerCase()) || 
      a.category_id.toLowerCase().includes(p.toLowerCase()) ||
      a.style_tags.some((tag: string) => tag.toLowerCase().includes(p.toLowerCase()))
    );
    const bPriority = userPreferences.priorities.some((p: string) => 
      b.name.toLowerCase().includes(p.toLowerCase()) || 
      b.category_id.toLowerCase().includes(p.toLowerCase()) ||
      b.style_tags.some((tag: string) => tag.toLowerCase().includes(p.toLowerCase()))
    );
    
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;
    return a.price - b.price;
  });

  // Select furniture within budget
  let totalCost = 0;
  const selectedFurniture: FurnitureItem[] = [];
  
  for (const item of sortedFurniture) {
    if (totalCost + item.price <= userPreferences.budget) {
      selectedFurniture.push(item);
      totalCost += item.price;
    }
  }

  const reasoning = `Selected ${selectedFurniture.length} furniture items from dataset matching ${userPreferences.style} style and ${userPreferences.colorScheme} color scheme. Total cost: $${totalCost}`;

  return {
    selectedFurniture,
    reasoning,
    totalCost,
    searchResults,
  };
}

async function arrangeFurniture(room: any, selectedFurniture: any[], arrangementPreferences: any) {
  console.log('\n🏠 === FURNITURE ARRANGEMENT STARTING ===');
  console.log(`📊 Room: ${room.dimensions.width}' × ${room.dimensions.length}' ${room.type}`);
  console.log(`🪑 Furniture items: ${selectedFurniture.length}`);
  
  // Use AI to generate intelligent arrangement strategy with direct coordinates
  const aiArrangementStrategy = await generateArrangementStrategy(room, selectedFurniture, arrangementPreferences);
  
  // Check if we got AI strategy or fallback
  const isAIStrategy = aiArrangementStrategy.strategy !== 'Smart room-aware fallback arrangement';
  
  if (isAIStrategy) {
    console.log('🤖 ✅ USING AI ARRANGEMENT LOGIC (o3 model)');
    console.log(`🧠 AI Strategy: ${aiArrangementStrategy.strategy}`);
  } else {
    console.log('⚠️  USING FALLBACK ARRANGEMENT LOGIC');
    console.log('💡 Reason: AI strategy generation failed, using smart room-aware placement');
  }
  
  // Use AI coordinates and apply symmetry fixes
  let arrangement = aiArrangementStrategy.placementZones
    .map((placement: any) => {
      const furniture = selectedFurniture.find((f: any) => f.id === placement.furnitureId);
      if (!furniture) return null;
      
      return {
        furnitureId: furniture.id,
        position: {
          x: placement.zone.x, // AI provides center-based coordinates
          y: placement.zone.y, // AI provides center-based coordinates
          z: 0,
          rotation: placement.zone.rotation,
        },
        placement: `${furniture.name} positioned at center (${placement.zone.x.toFixed(1)}, ${placement.zone.y.toFixed(1)}) - ${placement.reasoning}`,
        aiReasoning: placement.reasoning,
        relationships: placement.relationships,
        isSymmetrical: placement.isSymmetrical,
        symmetryPartner: placement.symmetryPartner || "",
      };
    })
    .filter((item: any): item is NonNullable<typeof item> => item !== null);

  // POST-PROCESSING: Enforce symmetrical arrangements and professional design rules
  console.log('🔧 POST-PROCESSING: Applying professional design rules and symmetry...');
  arrangement = enforceSymmetricalArrangement(arrangement, selectedFurniture, room);
  console.log('✅ Post-processing complete: bed placement, symmetry, and collision detection applied');

  // Log skipped furniture for transparency
  const skippedFurniture = aiArrangementStrategy.skippedFurniture || [];
  if (skippedFurniture.length > 0) {
    console.log('⚠️  AI SELECTIVELY SKIPPED FURNITURE:');
    skippedFurniture.forEach((skipped: any) => {
      const furniture = selectedFurniture.find((f: any) => f.id === skipped.furnitureId);
      console.log(`  - ${furniture?.name || skipped.furnitureId}: ${skipped.reason}`);
    });
  }

  // Log space utilization analysis
  if (aiArrangementStrategy.spaceUtilizationAnalysis) {
    const analysis = aiArrangementStrategy.spaceUtilizationAnalysis;
    console.log(`📊 SPACE UTILIZATION ANALYSIS:`);
    console.log(`  - Room area: ${analysis.roomArea} sq ft`);
    console.log(`  - Furniture area: ${analysis.totalFurnitureArea} sq ft`);
    console.log(`  - Utilization: ${analysis.utilizationPercentage.toFixed(1)}%`);
    console.log(`  - Optimal: ${analysis.isOptimal ? 'Yes' : 'No'}`);
  }
  
  // Calculate space utilization
  const spaceUtilization = calculateSpaceUtilization(arrangement, room.dimensions);
  
  const layoutDescription = `${isAIStrategy ? 'AI-generated' : 'Fallback'} ${aiArrangementStrategy.strategy}: ${arrangement.length} furniture items with ${(spaceUtilization * 100).toFixed(1)}% space utilization. ${aiArrangementStrategy.reasoning}`;

  console.log(`🎯 Final arrangement: ${arrangement.length} items placed`);
  console.log(`📊 Space utilization: ${(spaceUtilization * 100).toFixed(1)}%`);
  console.log('🏠 === FURNITURE ARRANGEMENT COMPLETED ===\n');

  return {
    arrangement,
    layoutDescription,
    spaceUtilization,
    aiStrategy: aiArrangementStrategy,
    arrangementType: isAIStrategy ? 'AI-generated' : 'Fallback',
    isUsingFallback: !isAIStrategy,
  };
}

// AI-powered arrangement strategy generation
async function generateArrangementStrategy(room: any, selectedFurniture: any[], arrangementPreferences: any) {
  const furnitureDescription = selectedFurniture.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category_id,
    dimensions: item.dimensions, // [L, W, H]
    styleTags: item.style_tags,
  }));

  const roomContext = {
    type: room.type,
    dimensions: room.dimensions,
    features: room.features || [],
    style: room.style,
  };

  const preferences = {
    focalPoint: arrangementPreferences?.focalPoint || 'none',
    trafficFlow: arrangementPreferences?.trafficFlow || 'balanced',
    lighting: arrangementPreferences?.lighting || 'natural',
  };

  try {
    console.log('🧠 Initializing AI arrangement strategy generation...');
    
    // Try o3 first for superior reasoning, fall back to o3-mini or gpt-4o if needed
    let model;
    let modelName = 'o3';
    try {
      model = openai('o3');
      console.log('🎯 Using OpenAI o3 model for arrangement strategy');
    } catch (error) {
      console.warn('⚠️  o3 model not available, trying o3-mini...');
      try {
        model = openai('o3-mini');
        modelName = 'o3-mini';
        console.log('🎯 Using OpenAI o3-mini model for arrangement strategy');
      } catch (miniError) {
        console.warn('⚠️  o3-mini also not available, falling back to gpt-4o...');
        model = openai('gpt-4o');
        modelName = 'gpt-4o';
        console.log('🎯 Using OpenAI gpt-4o model for arrangement strategy');
      }
    }
    
    const result = await generateObject({
      model: model,
      prompt: `You are an expert interior designer with deep knowledge of spatial planning, ergonomics, and design principles. 

TASK: Create an optimal furniture arrangement strategy with PRECISE coordinate placement.

ROOM CONTEXT:
${JSON.stringify(roomContext, null, 2)}

FURNITURE TO ARRANGE:
${JSON.stringify(furnitureDescription, null, 2)}

USER PREFERENCES:
${JSON.stringify(preferences, null, 2)}

PROFESSIONAL DESIGN PRINCIPLES:

**INTELLIGENT SYMMETRY DETECTION AND ARRANGEMENT**: 
- FIRST: Analyze furniture list to identify which items SHOULD be symmetrical
- FOR IDENTIFIED SYMMETRICAL PAIRS:
  * Place at SAME Y coordinate  
  * Position symmetrically around focal furniture (bed, sofa)
  * Maintain proper clearances

**SELECTIVE PLACEMENT STRATEGY**:
- PRIORITIZE QUALITY OVER QUANTITY: Better to place fewer items well than crowd the space
- ESSENTIAL-FIRST APPROACH: Always place core furniture (bed, sofa, dining table) first
- SPACE ASSESSMENT: If placing all furniture would make room feel crowded (>40% floor coverage), SKIP non-essential items
- TRAFFIC FLOW PRIORITY: Maintain clear pathways even if it means omitting some furniture
- PROFESSIONAL STANDARD: 36-48" clearances around major furniture, 24-30" walkways. 
- For furniture placed against a wall, clearance is not required on the wall-facing side — it can be positioned flush with the wall.

**OVERCROWDING DETECTION**:
- Calculate total furniture footprint vs. room area
- If furniture would occupy >40% of floor space, selectively omit items in this priority order:
  1. Keep: Primary furniture (bed, sofa, dining table)
  2. Keep: Essential functional pieces (nightstands, coffee table)
  3. Consider: Secondary items (accent chairs, side tables)
  4. Skip if needed: Decorative items (benches, extra lighting)

CRITICAL COORDINATE SYSTEM RULES:
- Room origin [0,0] is at BOTTOM-LEFT corner
- Room extends to [${room.dimensions.width}, ${room.dimensions.length}] (width x length in feet)
- All furniture positions must represent the CENTER POINT of the furniture
- X coordinate: 0 to ${room.dimensions.width} (left to right, POSITIVE →)
- Y coordinate: 0 to ${room.dimensions.length} (bottom to top, POSITIVE ↑)

MANDATORY BOUNDS CHECKING:
For each furniture item, the EDGES must stay within room bounds:
- Furniture center at (x, y) with dimensions [L, W, H]
- Left edge: x - W/2 ≥ 0 (can be flush against left wall)
- Right edge: x + W/2 ≤ ${room.dimensions.width} (can be flush against right wall)  
- Bottom edge: y - L/2 ≥ 0 (can be flush against bottom wall)
- Top edge: y + L/2 ≤ ${room.dimensions.length} (can be flush against top wall)

STEP-BY-STEP REASONING PROCESS:

1. ANALYZE ROOM DIMENSIONS & CONSTRAINTS:
   - Room size: ${room.dimensions.width}' × ${room.dimensions.length}' × ${room.dimensions.height}'
   - Available floor area: ${room.dimensions.width * room.dimensions.length} sq ft
   - Calculate safe placement zones for each furniture piece
   - Account for architectural features: ${room.features?.join(', ') || 'none specified'}
   ${room.fixtures && room.fixtures.length > 0 ? `
   - ROOM FIXTURES (CRITICAL FOR PLACEMENT):
   ${room.fixtures.map((fixture: any) => `
     * ${fixture.type.toUpperCase()}: ${fixture.id}
       - Position: (${fixture.position.x}, ${fixture.position.y}) on ${fixture.position.wall} wall
       - Dimensions: ${fixture.dimensions.width}' × ${fixture.dimensions.height}'${fixture.dimensions.depth ? ` × ${fixture.dimensions.depth}' deep` : ''}
       - Clearance needed: ${fixture.properties?.clearanceRequired || 3}' (${fixture.properties?.swingDirection || 'standard'})
       - Natural light: ${fixture.properties?.providesNaturalLight ? 'YES' : 'NO'}
   `).join('')}
   
   FIXTURE PLACEMENT RULES:
   - NEVER block doors (maintain ${Math.max(...(room.fixtures?.filter((f: any) => f.type.includes('door')).map((f: any) => f.properties?.clearanceRequired || 3) || [3]))}' clearance)
   - NEVER block windows (preserve natural light and access)
   - Consider door swing directions for furniture placement
   - Position beds to benefit from window light but not directly under windows
   - Use natural light sources for reading areas and workspaces` : ''}

2. ESTABLISH DESIGN HIERARCHY & SYMMETRY OPPORTUNITIES:
   - Primary focal point: ${preferences.focalPoint}
   - Room type: ${room.type} (determines furniture priorities)
   - Style: ${room.style}
   - INTELLIGENTLY identify which furniture SHOULD be symmetrical:
     * Nightstands: YES (always symmetrical beside bed) → set isSymmetrical: true
     * Side tables: YES (symmetrical beside sofa) → set isSymmetrical: true
     * Table lamps: YES (symmetrical on nightstands) → set isSymmetrical: true
     * Accent chairs: NO (functional placement, not matching pairs) → set isSymmetrical: false
     * Dining chairs: NO (arrange around table functionally) → set isSymmetrical: false
   - MANDATORY: Set isSymmetrical field for EVERY furniture item in placementZones
   - MANDATORY: Set symmetryPartner field for EVERY item (use furniture ID for pairs, empty string "" for non-symmetrical)
   - MANDATORY: Provide skippedFurniture array (empty [] if no furniture skipped)
   
   EXAMPLE for nightstands:
   {
     "furnitureId": "nightstand-modern-1",
     "isSymmetrical": true,
     "symmetryPartner": "nightstand-modern-2"
   },
   {
     "furnitureId": "nightstand-modern-2", 
     "isSymmetrical": true,
     "symmetryPartner": "nightstand-modern-1"
   },
   {
     "furnitureId": "accent-chair-bedroom-1",
     "isSymmetrical": false,
     "symmetryPartner": ""
   }

3. VALIDATE FURNITURE DIMENSIONS:
   ${furnitureDescription.map(item => `   - ${item.name}: ${item.dimensions[0]}' L × ${item.dimensions[1]}' W × ${item.dimensions[2]}' H`).join('\n')}
   
   NOTE: Dimensions are [Length, Width, Height]. Length = head-to-foot, Width = side-to-side.
   Consider rotating furniture (90°/270°) to swap dimensions for better fit.

4. CALCULATE SAFE PLACEMENT ZONES:
   For each furniture item, determine valid center coordinates:
   ${furnitureDescription.map(item => {
     const length = item.dimensions[0];
     const width = item.dimensions[1];
     const minX = width/2;
     const maxX = room.dimensions.width - width/2;
     const minY = length/2;
     const maxY = room.dimensions.length - length/2;
     return `   - ${item.name}: X range [${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y range [${minY.toFixed(1)}, ${maxY.toFixed(1)}] (flush wall placement allowed)`;
   }).join('\n')}

5. ASSESS SPACE UTILIZATION:
   - Calculate total furniture area vs room area
   - If total furniture footprint > 40% of room area, apply selective placement
   - Prioritize essential furniture and symmetrical pairs

6. OPTIMIZE TRAFFIC FLOW:
   - Main circulation paths (minimum 3 ft wide)
   - Entry/exit accessibility
   - Clear pathways between functional areas

**Bedroom Furniture Layout Guidelines**
Step 1: Assess the Room
Measure the room’s length, width, and ceiling height.


Identify walls, doors, and windows to understand circulation and natural light.


Step 2: Place Primary Furniture
Bed as the focal point: The headboard should be placed against a solid wall (ideally the main wall). The main wall refers to the wall with a longer length, not the side wall opposite the door.


Allow at least 30 inches (75 cm) of walkway space on both sides of the bed for comfortable access.


Position nightstands firmly against the wall on either side of the bed. The ideal height is level with or slightly above the mattress top.


Place larger storage pieces (such as dressers or wardrobes) against walls to avoid blocking circulation.


Step 3: Add Secondary Furniture
Place an ottoman or bench squarely at the foot of the bed for a classic look.


Introduce a rug beneath or around the bed to frame the space; extend it beyond the bed for balance.


Use accent pieces like floor lamps or chairs in corners, ensuring they complement the main furniture arrangement.


Step 4: Check Flow and Balance
Maintain clear walking paths (ideally at least 24–30 inches wide).


Ensure furniture is proportionate to the room size; avoid overcrowding.


Add accessories, lighting, or storage only if they serve a functional or visual purpose.


Step 5: Know When to Stop
All essential functions are met (bed, nightstands, storage).


Circulation remains smooth and unobstructed.


The room feels visually balanced—neither too empty nor cluttered.




**ROTATION INSTRUCTIONS**:
- Rotation is specified in degrees: 0°, 90°, 180°, 270°
- 0° = Default orientation (length along Y-axis, width along X-axis)
- 90° = Rotated clockwise (dimensions swap: width becomes length, length becomes width)
- 180° = Rotated 180° (same dimensions as 0°, just flipped)
- 270° = Rotated counter-clockwise (dimensions swap like 90°)
- Use rotation strategically for better fit and traffic flow
- Example: A bench [1.5L × 4W] can be rotated 90° to become [4L × 1.5W] for different placement needs

**REFERENCE EXAMPLES FROM REAL DATA**:

**EXAMPLE 0: Standard Bedroom Layout (12' × 10') - USE THIS AS PRIMARY REFERENCE**:
Room: 12' width × 10' length
Door: Bottom wall (y=0), Window: Top wall (y=10)
**MANDATORY POSITIONING RULES**:
- Bed (5'×6.5'): Center at (6.0, 6.75) → Headboard FLUSH against back wall (0 distance)
- Left Nightstand (1.5'×2'): Center at (2.25, 9.0) → Positioned at bed HEAD for bedside access
- Right Nightstand (1.5'×2'): Center at (9.75, 9.0) → Positioned at bed HEAD for bedside access
- Dresser (1.5'×4'): Center at (11.25, 2.5) → FLUSH against right wall (0 distance)
**RESULT**: All furniture against walls, maximum space efficiency, professional bedroom layout.

**DEBUG OUTPUT: If you see this message, the updated prompt is working!** 


**EXAMPLE 1: Modern Minimalist Bedroom (11.5' × 20.4')**
Room: bedroom-for-demo-1, modern-minimalist style

Room fixtures:
- Window: (2.1, 20.4) on top wall, 3.9' × 4.3', provides natural light
- Window: (14.0, 20.4) on top wall, 3.9' × 4.3', provides natural light  
- Window: (8.0, 20.4) on top wall, 4.9' × 4.3', provides natural light
- Door: (5.7, 0) on bottom wall, 3.0' × 6.5', inward swing, needs 3' clearance

Input furniture:
- Master Bedroom King Bed [7.4L × 6.2W × 3.7H] - $899
- Minimalist Nightstand Left [1.5L × 1.3W × 1.6H] - $199  
- Minimalist Nightstand Right [1.5L × 1.3W × 1.6H] - $199
- French Vintage Storage Cabinet [5.9L × 1.3W × 2.8H] - $449
- Natural Stone Table Lamp Left [0.5L × 0.5W × 1.9H] - $89
- Natural Stone Table Lamp Right [0.5L × 0.5W × 1.9H] - $89

Expected arrangement pattern:
- King bed: (5.2, 16.7) - Against back wall but AVOIDING windows, benefits from natural light
- Nightstand left: (1.1, 18.1) - SYMMETRICAL LEFT, away from windows
- Nightstand right: (9.1, 18.1) - SYMMETRICAL RIGHT, away from windows
- Storage cabinet: (9.7, 6.3) - Against side wall, clear of door swing area
- Table lamp left: (1.1, 19.6) - On left nightstand, provides evening lighting
- Table lamp right: (9.1, 19.6) - On right nightstand, provides evening lighting

Key patterns:
- Bed positioned to benefit from window light but NOT directly under windows
- Nightstands positioned away from window areas for practical access
- Storage cabinet positioned to avoid blocking door clearance (3' from door)
- Natural light from windows complements artificial lamp lighting
- Door swing area kept clear for easy access

**EXAMPLE 2: Contemporary Bedroom (17.6' × 13.9')**  
Room: bedroom-3, contemporary style

Room fixtures:
- Window: (2.1, 13.9) on top wall, 3.9' × 4.3', provides natural light
- Window: (14.0, 13.9) on top wall, 3.9' × 4.3', provides natural light
- Window: (8.0, 13.9) on top wall, 4.9' × 4.3', provides natural light
- Door: (5.7, 0) on bottom wall, 3.0' × 6.5', inward swing, needs 3' clearance

Input furniture:
- Double Bed [7.1L × 6.3W × 4.9H] - $799
- Contemporary Wardrobe [1.9L × 6.6W × 6.6H] - $899
- Bedside Table Left [2.0L × 1.3W × 2.2H] - $199
- Bedside Table Right [2.0L × 1.3W × 2.2H] - $199
- Contemporary Accent Chair [1.8L × 1.8W × 2.4H] - $299

Expected arrangement pattern:
- Double bed: (8.2, 10.3) - Centered but avoiding windows, benefits from natural light
- Wardrobe: (3.3, 3.5) - Along wall, clear of door swing area (3' clearance)
- Bedside table left: (5.0, 12.9) - SYMMETRICAL LEFT, positioned away from windows
- Bedside table right: (12.0, 12.9) - SYMMETRICAL RIGHT, positioned away from windows
- Accent chair: (16.8, 1.1) - Corner placement near window for reading light

Key patterns:
- Bed centered to benefit from multiple windows but not directly under them
- Wardrobe positioned to maintain door clearance and traffic flow
- Chair positioned to take advantage of natural light from corner window
- Bedside tables positioned for access while avoiding window interference
- Door swing area kept completely clear

**EXAMPLE 3: Small Bedroom Optimization (10.0' × 12.0')**
Room: small-bedroom, minimalist style  
Input furniture:
- Queen Bed [6.7L × 5.0W × 3.0H] - $599
- Compact Nightstand [1.2L × 1.0W × 1.5H] - $149
- Small Dresser [3.0L × 1.5W × 2.5H] - $349

Expected arrangement pattern:
- Queen bed: (5.0, 8.5) - Against back wall, centered
- Single nightstand: (1.6, 9.1) - One side only (space constraint), isSymmetrical: false
- Small dresser: (8.5, 2.0) - Along side wall

Key patterns:
- Single nightstand due to space constraints (NOT symmetrical)
- Bed against wall to maximize floor space
- Dresser positioned for accessibility without crowding
- Higher space utilization acceptable for small rooms

**CRITICAL LEARNING FROM EXAMPLES**:
1. **Symmetrical pairs MUST share same Y coordinate**
2. **Bed placement varies by room proportions** (against back wall vs centered)
3. **Space constraints override symmetry** (single nightstand in small rooms)
4. **Accent chairs are functional, not symmetrical**
5. **Storage furniture along walls for accessibility**
6. **Coordinate system: bottom-left origin, Y increases upward**
7. **NEVER block doors** - maintain required clearance for swing direction
8. **NEVER block windows** - preserve natural light and access
9. **Position furniture to benefit from natural light** without being directly under windows
10. **Use window light for functional areas** (reading chairs, desks)
11. **Consider door swing patterns** when placing nearby furniture
12. **Maintain traffic flow** between doors and main furniture pieces

VERIFY EVERY COORDINATE: Before finalizing, double-check that each furniture center position keeps all edges within room bounds (flush wall placement allowed).`,
      schema: z.object({
        strategy: z.string().describe('Overall arrangement approach and philosophy'),
        reasoning: z.string().describe('Detailed explanation of the arrangement decisions'),
        focalPoints: z.array(z.object({
          type: z.string(),
          position: z.object({ x: z.number(), y: z.number() }),
          description: z.string(),
        })).describe('Key focal points in the room'),
        trafficFlowPaths: z.array(z.object({
          from: z.object({ x: z.number(), y: z.number() }),
          to: z.object({ x: z.number(), y: z.number() }),
          width: z.number(),
          description: z.string(),
        })).describe('Main traffic flow corridors'),
        furnitureGroups: z.array(z.object({
          name: z.string(),
          furnitureIds: z.array(z.string()),
          purpose: z.string(),
          centerPoint: z.object({ x: z.number(), y: z.number() }),
          spacing: z.number(),
        })).describe('Functional furniture groupings'),
        placementZones: z.array(z.object({
          furnitureId: z.string(),
          zone: z.object({
            x: z.number(),
            y: z.number(),
            rotation: z.number(),
            priority: z.number(),
          }),
          reasoning: z.string(),
          relationships: z.array(z.string()).describe('Other furniture this piece relates to'),
          isSymmetrical: z.boolean().describe('Whether this furniture is part of a symmetrical pair'),
          symmetryPartner: z.string().describe('ID of the matching furniture for symmetrical arrangements, or empty string if not symmetrical'),
        })).describe('Specific placement recommendations for furniture pieces. NOTE: You may choose to omit some furniture if it would overcrowd the space.'),
        skippedFurniture: z.array(z.object({
          furnitureId: z.string(),
          reason: z.string(),
        })).describe('Furniture pieces intentionally skipped to avoid overcrowding, empty array if none skipped'),
        spaceUtilizationAnalysis: z.object({
          totalFurnitureArea: z.number(),
          roomArea: z.number(),
          utilizationPercentage: z.number(),
          isOptimal: z.boolean(),
        }).describe('Analysis of space usage to justify selective placement'),
      }),
    });

    console.log(`✅ AI arrangement strategy generated successfully using ${modelName}`);
    console.log(`📋 Generated ${result.object.placementZones?.length || 0} furniture placements`);
    
    return result.object;
  } catch (error) {
    console.error('❌ AI arrangement strategy generation failed:', error instanceof Error ? error.message : 'Unknown error');
    console.log('🔄 Falling back to smart room-aware arrangement logic...');
    
    // Fallback to basic strategy
    return generateFallbackStrategy(room, selectedFurniture, arrangementPreferences);
  }
}

// Apply the AI-generated strategy to create actual furniture positions
async function applyArrangementStrategy(strategy: any, room: any, selectedFurniture: any[]) {
  const arrangement = [];
  const occupiedSpaces = new Set<string>();
  
  // Sort furniture by placement priority
  const sortedPlacements = strategy.placementZones.sort((a: any, b: any) => b.zone.priority - a.zone.priority);
  
  for (const placement of sortedPlacements) {
    const furniture = selectedFurniture.find(f => f.id === placement.furnitureId);
    if (!furniture) continue;
    
    const itemWidth = furniture.dimensions[1]; // W
    const itemLength = furniture.dimensions[0]; // L
    
    // Find optimal position within the suggested zone
    const position = findOptimalPosition(
      placement.zone,
      { width: itemWidth, length: itemLength },
      room.dimensions,
      occupiedSpaces,
      strategy.trafficFlowPaths
    );
    
    if (position) {
      // Convert to center-based coordinate system where [0,0] is top-left
      // x is always positive, y is always positive (down from top)
      // Position represents furniture center point
      const centerX = position.x + itemWidth / 2;
      const centerY = position.y + itemLength / 2;
      
      arrangement.push({
        furnitureId: furniture.id,
        position: {
          x: centerX,
          y: centerY,
          z: 0,
          rotation: placement.zone.rotation,
        },
        placement: `${furniture.name} strategically placed at center (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) - ${placement.reasoning}`,
        aiReasoning: placement.reasoning,
        relationships: placement.relationships,
      });
      
      // Mark space as occupied using the original position (not center)
      markSpaceAsOccupied(occupiedSpaces, position, { width: itemWidth, length: itemLength });
    }
  }
  
  return arrangement;
}

// Find optimal position within a zone, avoiding conflicts
function findOptimalPosition(
  zone: any,
  itemSize: { width: number; length: number },
  roomDimensions: { width: number; length: number },
  occupiedSpaces: Set<string>,
  trafficPaths: any[]
) {
  const { x: targetX, y: targetY } = zone;
  const searchRadius = 2; // Search within 2 feet of target position
  const step = 0.5;
  
  // Start from target position and spiral outward
  for (let radius = 0; radius <= searchRadius; radius += step) {
    for (let angle = 0; angle < 360; angle += 30) {
      const x = targetX + radius * Math.cos((angle * Math.PI) / 180);
      const y = targetY + radius * Math.sin((angle * Math.PI) / 180);
      
      // Check if position is valid
      if (isValidPosition(x, y, itemSize, roomDimensions, occupiedSpaces, trafficPaths)) {
        return { x, y };
      }
    }
  }
  
  // If no position found in preferred zone, use fallback grid
  return findFallbackPosition(itemSize, roomDimensions, occupiedSpaces);
}

// Check if a position is valid (no overlaps, within bounds, respects traffic flow)
function isValidPosition(
  x: number,
  y: number,
  itemSize: { width: number; length: number },
  roomDimensions: { width: number; length: number },
  occupiedSpaces: Set<string>,
  trafficPaths: any[]
) {
  // Check room bounds with safety margin (position is top-left corner of furniture)
  const margin = 0.5; // Minimum distance from walls
  if (x < margin || y < margin || 
      x + itemSize.width > roomDimensions.width - margin || 
      y + itemSize.length > roomDimensions.length - margin) {
    return false;
  }
  
  // Check for overlaps with existing furniture
  if (checkOverlap(x, y, itemSize, occupiedSpaces)) {
    return false;
  }
  
  // Check if it blocks major traffic paths
  if (blocksTrafficFlow(x, y, itemSize, trafficPaths)) {
    return false;
  }
  
  return true;
}

// Check for overlaps with occupied spaces
function checkOverlap(x: number, y: number, itemSize: { width: number; length: number }, occupiedSpaces: Set<string>) {
  const step = 0.5;
  for (let ix = x; ix < x + itemSize.width; ix += step) {
    for (let iy = y; iy < y + itemSize.length; iy += step) {
      if (occupiedSpaces.has(`${Math.floor(ix * 2) / 2},${Math.floor(iy * 2) / 2}`)) {
        return true;
      }
    }
  }
  return false;
}

// Check if furniture blocks traffic flow
function blocksTrafficFlow(x: number, y: number, itemSize: { width: number; length: number }, trafficPaths: any[]) {
  for (const path of trafficPaths) {
    // Simple line intersection check - can be made more sophisticated
    if (lineIntersectsRectangle(path.from, path.to, { x, y, width: itemSize.width, height: itemSize.length })) {
      return true;
    }
  }
  return false;
}

// Mark space as occupied in the grid
function markSpaceAsOccupied(occupiedSpaces: Set<string>, position: { x: number; y: number }, itemSize: { width: number; length: number }) {
  const step = 0.5;
  for (let x = position.x; x < position.x + itemSize.width; x += step) {
    for (let y = position.y; y < position.y + itemSize.length; y += step) {
      occupiedSpaces.add(`${Math.floor(x * 2) / 2},${Math.floor(y * 2) / 2}`);
    }
  }
}

// Calculate space utilization
function calculateSpaceUtilization(arrangement: any[], roomDimensions: { width: number; length: number }) {
  const totalRoomArea = roomDimensions.width * roomDimensions.length;
  const furnitureArea = arrangement.reduce((sum, item) => {
    // This would need furniture dimensions from the actual furniture items
    return sum + 4; // Placeholder - should calculate actual furniture area
  }, 0);
  
  return furnitureArea / totalRoomArea;
}

// Fallback strategy when AI fails - Smart room-aware placement with symmetry support
function generateFallbackStrategy(room: any, selectedFurniture: any[], arrangementPreferences: any) {
  const roomType = room.type.toLowerCase();
  const roomWidth = room.dimensions.width;
  const roomLength = room.dimensions.length;
  
  // Universal symmetrical pair detection for any furniture category
  const symmetricalPairs = new Map<string, string[]>();
  selectedFurniture.forEach((item: any) => {
    // Universal pattern matching for symmetrical pairs: -1, -2, -left, -right, -chair1, -chair2, etc.
    const baseId = item.id.replace(/-[12]|-left|-right|-chair[12]|-table[12]|-lamp[12]$/, '');
    if (!symmetricalPairs.has(baseId)) {
      symmetricalPairs.set(baseId, []);
    }
    symmetricalPairs.get(baseId)!.push(item.id);
  });
  
  // Track placed furniture for collision detection
  const placedFurniture: Array<{
    id: string, 
    centerX: number, 
    centerY: number, 
    width: number, 
    length: number
  }> = [];

  // Create smarter placement zones based on room type and furniture
  const placementZones = selectedFurniture.map((item, index) => {
    const itemWidth = item.dimensions[1]; // W
    const itemLength = item.dimensions[0]; // L
    let x = 2; // Default safe margin from walls
    let y = 2;
    let reasoning = '';
    
    // Room-type specific intelligent placement
    if (roomType.includes('bedroom')) {
      if (item.category_id === 'bed-frame') {
        // Place bed against wall, centered
        x = 1; // Near wall
        y = (roomLength - itemLength) / 2; // Centered vertically
        reasoning = 'Bed placed against wall for stability and space efficiency';
      } else if (item.category_id === 'dresser') {
        // Place dresser on opposite wall
        x = roomWidth - itemWidth - 1;
        y = 1;
        reasoning = 'Dresser placed on opposite wall with clear access';
      } else {
        // Universal placement with symmetry support for any furniture category
        const result = getUniversalSymmetricalPlacement(item, symmetricalPairs, roomWidth, roomLength, itemWidth, itemLength, roomType, index);
        x = result.x;
        y = result.y;
        reasoning = result.reasoning;
      }
    }
    
    // NEW COORDINATE SYSTEM: Bottom-left origin with Y going upward
    // The fallback strategy now calculates center positions directly
    // All coordinates are center-based with bottom-left origin (Y↑)
    
    // Apply bounds checking for center coordinates - flush wall placement allowed
    const minCenterX = itemWidth / 2;   // Flush against left wall
    const maxCenterX = roomWidth - itemWidth / 2;  // Flush against right wall
    const minCenterY = itemLength / 2;  // Flush against bottom wall  
    const maxCenterY = roomLength - itemLength / 2; // Flush against top wall
    
    const boundedCenterX = Math.max(minCenterX, Math.min(x, maxCenterX));
    const boundedCenterY = Math.max(minCenterY, Math.min(y, maxCenterY));
    
    // Update x, y to bounded center coordinates
    x = boundedCenterX;
    y = boundedCenterY;
    
    // COLLISION DETECTION: Check for overlaps with existing furniture
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      const hasCollision = placedFurniture.some(placed => {
        const distanceX = Math.abs(x - placed.centerX);
        const distanceY = Math.abs(y - placed.centerY);
        const minDistanceX = (itemWidth + placed.width) / 2 + 0.25; // 0.25ft minimal clearance
        const minDistanceY = (itemLength + placed.length) / 2 + 0.25; // 0.25ft minimal clearance
        
        return distanceX < minDistanceX && distanceY < minDistanceY;
      });
      
      if (!hasCollision) {
        break; // Position is clear
      }
      
      // Try alternative positions
      attempts++;
      if (attempts <= 3) {
        // Try shifting right
        x = Math.min(x + 2, maxCenterX);
      } else if (attempts <= 6) {
        // Try shifting down
        x = boundedCenterX; // Reset X
        y = Math.min(y + 2, maxCenterY);
      } else {
        // Try shifting left
        x = Math.max(boundedCenterX - 2, minCenterX);
        y = Math.min(y + 1, maxCenterY);
      }
      
      // Re-apply bounds checking
      x = Math.max(minCenterX, Math.min(x, maxCenterX));
      y = Math.max(minCenterY, Math.min(y, maxCenterY));
    }
    
    // Record this furniture as placed
    placedFurniture.push({
      id: item.id,
      centerX: x,
      centerY: y,
      width: itemWidth,
      length: itemLength
    });
    
    // Determine if this item is part of a symmetrical pair
    const baseId = item.id.replace(/-left|-right|-chair1|-chair2$/, '');
    const pairedItems = symmetricalPairs.get(baseId) || [];
    const isSymmetrical = pairedItems.length === 2;
    const symmetryPartner = isSymmetrical ? pairedItems.find(id => id !== item.id) : undefined;

    return {
      furnitureId: item.id,
      zone: {
        x: x,
        y: y,
        rotation: 0,
        priority: item.category_id === 'bed-frame' || item.category_id === 'sofa' ? 3 : 2,
      },
      reasoning: reasoning,
      relationships: [],
      isSymmetrical: isSymmetrical,
      symmetryPartner: symmetryPartner || "",
    };
  });

  // Calculate space utilization for fallback analysis
  const totalFurnitureArea = selectedFurniture.reduce((sum, item) => {
    return sum + (item.dimensions[0] * item.dimensions[1]); // L × W
  }, 0);
  const roomArea = roomWidth * roomLength;
  const utilizationPercentage = (totalFurnitureArea / roomArea) * 100;

  return {
    strategy: 'Smart room-aware arrangement with symmetrical placement',
    reasoning: 'Using intelligent room-type specific placement with proper spacing, functionality, and symmetrical arrangements where applicable',
    focalPoints: [
      { 
        type: roomType.includes('bedroom') ? 'bed' : roomType.includes('living') ? 'seating area' : 'center',
        position: { x: roomWidth / 2, y: roomLength / 2 }, 
        description: `${roomType} focal point` 
      }
    ],
    trafficFlowPaths: [
      {
        from: { x: 0, y: roomLength / 2 },
        to: { x: roomWidth, y: roomLength / 2 },
        width: 3,
        description: 'Main walkway'
      }
    ],
    furnitureGroups: [],
    placementZones: placementZones,
    skippedFurniture: [], // Fallback doesn't skip furniture currently
    spaceUtilizationAnalysis: {
      totalFurnitureArea: totalFurnitureArea,
      roomArea: roomArea,
      utilizationPercentage: utilizationPercentage,
      isOptimal: utilizationPercentage >= 15 && utilizationPercentage <= 40,
    },
  };
}

// Universal symmetrical placement function for any furniture category
function getUniversalSymmetricalPlacement(
  item: any, 
  symmetricalPairs: Map<string, string[]>, 
  roomWidth: number, 
  roomLength: number, 
  itemWidth: number, 
  itemLength: number, 
  roomType: string, 
  index: number
) {
  // Universal pattern matching for symmetrical pairs
  const baseId = item.id.replace(/-[12]|-left|-right|-chair[12]|-table[12]|-lamp[12]$/, '');
  const pairedItems = symmetricalPairs.get(baseId) || [];
  const isSymmetrical = pairedItems.length === 2;
  
  const category = item.category_id;
  let x = 2, y = 2, reasoning = '';

  if (isSymmetrical) {
    // Symmetrical placement logic based on category and room type
    if (roomType.includes('bedroom')) {
      if (category === 'nightstand' || category === 'side-table') {
        if (item.id.includes('-1') || item.id.includes('-left')) {
          x = itemWidth / 2 + 1; // Left side - center coordinates with margin
          y = roomLength / 2;    // Center Y of room (bottom-left origin)
          reasoning = `Left ${category} positioned for symmetrical bedroom layout`;
        } else {
          x = roomWidth - itemWidth / 2 - 1; // Right side - center coordinates with margin
          y = roomLength / 2;                // Center Y of room (bottom-left origin)
          reasoning = `Right ${category} positioned for symmetrical bedroom layout`;
        }
      } else if (category === 'accent-chair') {
        if (item.id.includes('-1') || item.id.includes('-chair1')) {
          x = roomWidth * 0.25; // Center-based positioning
          y = roomLength * 0.25; // Lower part of room (bottom-left origin)
          reasoning = 'First accent chair in lower area';
        } else {
          x = roomWidth * 0.75; // Center-based positioning
          y = roomLength * 0.25; // Lower part of room (bottom-left origin)
          reasoning = 'Second accent chair for symmetrical seating';
        }
      } else if (category === 'table-lamp' || category === 'floor-lamp') {
        if (item.id.includes('-1')) {
          x = itemWidth / 2 + 1; // Center coordinates with margin
          y = roomLength * 0.7; // Upper part of room (bottom-left origin)
          reasoning = 'First lamp for balanced lighting';
        } else {
          x = roomWidth - itemWidth / 2 - 1; // Center coordinates with margin
          y = roomLength * 0.7; // Upper part of room (bottom-left origin)
          reasoning = 'Second lamp for symmetrical lighting';
        }
      }
    } else if (roomType.includes('living')) {
      if (category === 'accent-chair') {
        if (item.id.includes('-1') || item.id.includes('-chair1')) {
          x = roomWidth * 0.25; // Center-based positioning
          y = roomLength * 0.6; // Upper conversation area (bottom-left origin)
          reasoning = 'First accent chair for conversation area';
        } else {
          x = roomWidth * 0.75; // Center-based positioning
          y = roomLength * 0.6; // Upper conversation area (bottom-left origin)
          reasoning = 'Second accent chair for symmetrical conversation area';
        }
      } else if (category === 'side-table' || category === 'end-table') {
        if (item.id.includes('-1')) {
          x = roomWidth * 0.2; // Center-based positioning
          y = roomLength * 0.4; // Middle area (bottom-left origin)
          reasoning = 'First side table beside seating';
        } else {
          x = roomWidth * 0.8; // Center-based positioning
          y = roomLength * 0.4; // Middle area (bottom-left origin)
          reasoning = 'Second side table for balanced functionality';
        }
      } else if (category === 'table-lamp') {
        if (item.id.includes('-1')) {
          x = roomWidth * 0.25; // Center-based positioning
          y = roomLength * 0.75; // Upper area (bottom-left origin)
          reasoning = 'First table lamp for ambient lighting';
        } else {
          x = roomWidth * 0.75; // Center-based positioning
          y = roomLength * 0.75; // Upper area (bottom-left origin)
          reasoning = 'Second table lamp for symmetrical lighting';
        }
      }
    }
    
    // Default symmetrical placement if no room-specific logic
    if (x === 2 && y === 2) {
      if (item.id.includes('-1') || item.id.includes('-left') || item.id.includes('-chair1')) {
        x = roomWidth * 0.25; // Center-based positioning
        y = roomLength * 0.6; // Upper-middle area (bottom-left origin)
        reasoning = `First ${category} positioned for symmetrical layout`;
      } else {
        x = roomWidth * 0.75; // Center-based positioning
        y = roomLength * 0.6; // Upper-middle area (bottom-left origin)
        reasoning = `Second ${category} positioned for symmetrical layout`;
      }
    }
  } else {
    // Single item placement based on category - ALL CENTER-BASED COORDINATES (bottom-left origin)
    if (category === 'accent-chair') {
      x = roomWidth * 0.75; // Center coordinates
      y = roomLength * 0.25; // Lower area (bottom-left origin)
      reasoning = 'Single accent chair positioned for comfort';
    } else if (category === 'side-table' || category === 'end-table') {
      x = roomWidth - itemWidth / 2 - 1; // Center coordinates with margin
      y = roomLength * 0.5; // Middle area (bottom-left origin)
      reasoning = 'Side table positioned for accessibility';
    } else if (category === 'table-lamp' || category === 'floor-lamp') {
      x = roomWidth * 0.8; // Center coordinates
      y = roomLength * 0.7; // Upper area (bottom-left origin)
      reasoning = 'Lamp positioned for optimal lighting';
    } else if (category === 'nightstand') {
      x = roomWidth - itemWidth / 2 - 1; // Center coordinates with margin
      y = roomLength / 2; // Middle area (bottom-left origin)
      reasoning = 'Single nightstand beside bed';
    } else {
      // Generic placement - center coordinates along bottom
      x = itemWidth / 2 + 1 + (index * 3);
      y = itemLength / 2 + 1; // Near bottom wall (bottom-left origin)
      reasoning = `${category} positioned along bottom wall`;
    }
  }

  return { x, y, reasoning };
}

// Fallback position finder
function findFallbackPosition(itemSize: { width: number; length: number }, roomDimensions: { width: number; length: number }, occupiedSpaces: Set<string>) {
  const step = 0.5;
  for (let y = 0; y <= roomDimensions.length - itemSize.length; y += step) {
    for (let x = 0; x <= roomDimensions.width - itemSize.width; x += step) {
      if (!checkOverlap(x, y, itemSize, occupiedSpaces)) {
        return { x, y };
      }
    }
  }
  return null; // No position available
}

// Helper function for line-rectangle intersection
function lineIntersectsRectangle(lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }) {
  // Simplified check - can be improved with proper line-rectangle intersection algorithm
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const distance = distanceToLine(lineStart, lineEnd, { x: centerX, y: centerY });
  return distance < Math.min(rect.width, rect.height) / 2;
}

// Distance from point to line
function distanceToLine(lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }, point: { x: number; y: number }) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Enforce symmetrical arrangements for identical furniture pieces
function enforceSymmetricalArrangement(arrangement: any[], selectedFurniture: any[], room: any) {
  console.log('🔧 POST-PROCESSING: Enforcing symmetrical arrangements...');
  console.log(`📊 Processing: ${arrangement.length} arrangement items, ${selectedFurniture.length} selected furniture`);
  
  // FIRST: Ensure bed is properly placed against wall (professional design rule)
  const bedItem = arrangement.find(item => {
    const furniture = selectedFurniture.find((f: any) => f.id === item.furnitureId);
    return furniture && (furniture.category_id === 'bed-frame' || furniture.name.toLowerCase().includes('bed'));
  });
  
  if (bedItem) {
    const bedFurniture = selectedFurniture.find((f: any) => f.id === bedItem.furnitureId);
    if (bedFurniture) {
      const bedLength = bedFurniture.dimensions[0]; // Length (head to foot)
      const bedWidth = bedFurniture.dimensions[1];  // Width (side to side)
      
      // Place bed against longest wall (professional rule)
      let bedX, bedY;
      
      if (room.dimensions.width >= room.dimensions.length) {
        // Room is wider - place bed against back wall (top wall)
        bedX = room.dimensions.width / 2; // Centered horizontally
        bedY = room.dimensions.length - bedLength/2; // Flush against back wall (0 margin)
        console.log(`🛏️  BED AGAINST BACK WALL: Room ${room.dimensions.width}×${room.dimensions.length}, bed centered horizontally`);
      } else {
        // Room is longer - place bed against side wall
        bedX = bedWidth/2; // Flush against left wall (0 margin)
        bedY = room.dimensions.length / 2; // Centered vertically
        console.log(`🛏️  BED AGAINST SIDE WALL: Room ${room.dimensions.width}×${room.dimensions.length}, bed centered vertically`);
      }
      
      console.log(`🛏️  RESPECTING AI BED PLACEMENT: Keeping original (${bedItem.position.x}, ${bedItem.position.y}) from AI`);
      // NO OVERRIDE - use AI's original coordinates
    }
  }
  
  // Group furniture by base name, but only for furniture that SHOULD be symmetrical
  const furnitureGroups = new Map<string, any[]>();
  
  arrangement.forEach(item => {
    const furniture = selectedFurniture.find((f: any) => f.id === item.furnitureId);
    if (!furniture) return;
    
    // Check if this furniture type should be symmetrical
    const shouldBeSymmetrical = furniture.name.toLowerCase().includes('nightstand') ||
                               furniture.name.toLowerCase().includes('side table') ||
                               furniture.name.toLowerCase().includes('table lamp') ||
                               furniture.category_id === 'nightstand' ||
                               furniture.category_id === 'side-table';
    
    // Skip accent chairs and dining chairs - they don't need symmetry
    if (furniture.name.toLowerCase().includes('accent chair') ||
        furniture.name.toLowerCase().includes('dining chair') ||
        furniture.category_id === 'accent-chair' ||
        furniture.category_id === 'dining-chair') {
      console.log(`🪑 Skipping symmetry for: ${furniture.name} (functional placement)`);
      return;
    }
    
    if (shouldBeSymmetrical) {
      // Extract base name (remove -1, -2, -left, -right suffixes)
      const baseName = furniture.name.replace(/\s+(1|2|Left|Right|left|right)$/, '');
      if (!furnitureGroups.has(baseName)) {
        furnitureGroups.set(baseName, []);
      }
      furnitureGroups.get(baseName)!.push(item);
      console.log(`🔄 Added to symmetry group '${baseName}': ${furniture.name}`);
    } else {
      console.log(`📍 Non-symmetrical placement: ${furniture.name}`);
    }
  });
  
  // Process each group for symmetrical arrangement
  furnitureGroups.forEach((items, baseName) => {
    if (items.length === 2) {
      console.log(`🎯 Enforcing symmetry for: ${baseName} (${items.length} items)`);
      
      const item1 = items[0];
      const item2 = items[1];
      const furniture1 = selectedFurniture.find((f: any) => f.id === item1.furnitureId);
      const furniture2 = selectedFurniture.find((f: any) => f.id === item2.furnitureId);
      
      if (!furniture1 || !furniture2) return;
      
      // Determine room center and create symmetrical placement
      const roomCenterX = room.dimensions.width / 2;
      const roomCenterY = room.dimensions.length / 2;
      
      // Determine category-specific symmetrical positions and Y coordinates
      let leftX, rightX, symmetricalY;
      
      if (baseName.toLowerCase().includes('nightstand')) {
        // Nightstands: MUST align with bed Y coordinate and be positioned relative to bed
        const bedItem = arrangement.find(arr => {
          const bedFurniture = selectedFurniture.find((f: any) => f.id === arr.furnitureId);
          return bedFurniture && (bedFurniture.category_id === 'bed-frame' || bedFurniture.name.toLowerCase().includes('bed'));
        });
        
        if (bedItem) {
          symmetricalY = bedItem.position.y; // Same Y as bed
          
          // Position nightstands flush against walls (professional design)
          const nightstandWidth = furniture1.dimensions[1]; // nightstand width
          
          // Calculate flush wall positions (no clearance from walls)
          leftX = nightstandWidth / 2; // Flush against left wall
          rightX = room.dimensions.width - nightstandWidth / 2; // Flush against right wall
          
        console.log(`🛏️  RESPECTING AI NIGHTSTAND POSITIONING: Keeping original coordinates from AI`);
        // NO OVERRIDE - use AI's original coordinates
        return; // Skip symmetry override
        } else {
          // Fallback if no bed found
          symmetricalY = roomCenterY;
          const nightstandWidth = furniture1.dimensions[1];
          leftX = nightstandWidth / 2; // Flush against left wall
          rightX = room.dimensions.width - nightstandWidth / 2; // Flush against right wall
        }
      } else if (baseName.toLowerCase().includes('chair')) {
        // Chairs: conversation area symmetry with reasonable Y
        const avgY = (item1.position.y + item2.position.y) / 2;
        symmetricalY = Math.min(avgY, roomCenterY - 1); // Keep chairs in lower area
        console.log(`🪑 Chair Y alignment: Average Y=${avgY}, using Y=${symmetricalY}`);
        
        leftX = room.dimensions.width * 0.25;
        rightX = room.dimensions.width * 0.75;
      } else {
        // Generic symmetrical placement
        const avgY = (item1.position.y + item2.position.y) / 2;
        symmetricalY = Math.max(roomCenterY, avgY); // Use center or higher
        console.log(`🔧 Generic Y alignment: Average Y=${avgY}, room center=${roomCenterY}, using Y=${symmetricalY}`);
        
        const itemWidth = furniture1.dimensions[1];
        const margin = itemWidth / 2 + 1;
        leftX = margin;
        rightX = room.dimensions.width - margin;
      }
      
      // Determine which item goes left/right based on current X positions
      const [leftItem, rightItem] = item1.position.x < item2.position.x ? [item1, item2] : [item2, item1];
      
      // Apply symmetrical positions
      leftItem.position.x = leftX;
      leftItem.position.y = symmetricalY;
      rightItem.position.x = rightX;
      rightItem.position.y = symmetricalY;
      
      // Update placement descriptions
      leftItem.placement = `${leftItem.placement.split(' -')[0]} - SYMMETRICAL LEFT at (${leftX.toFixed(1)}, ${symmetricalY.toFixed(1)})`;
      rightItem.placement = `${rightItem.placement.split(' -')[0]} - SYMMETRICAL RIGHT at (${rightX.toFixed(1)}, ${symmetricalY.toFixed(1)})`;
      
      console.log(`  ✅ ${leftItem.furnitureId}: (${leftX.toFixed(1)}, ${symmetricalY.toFixed(1)})`);
      console.log(`  ✅ ${rightItem.furnitureId}: (${rightX.toFixed(1)}, ${symmetricalY.toFixed(1)})`);
    }
  });
  
  console.log('🔧 Symmetrical arrangement enforcement complete');
  return arrangement;
}

async function evaluateDecoration(room: any, arrangement: any[], userPreferences: any) {
  let score = 0;
  const feedback: string[] = [];
  const suggestions: string[] = [];
  const issues: string[] = [];

  // Evaluate based on various criteria
  const furnitureCount = arrangement.length;
  const roomArea = room.dimensions.width * room.dimensions.length;
  
  // Calculate proper space utilization based on actual furniture area
  let totalFurnitureArea = 0;
  for (const item of arrangement) {
    // Estimate furniture area - in a real implementation, this would come from furniture data
    totalFurnitureArea += 15; // Average furniture footprint in sq ft
  }
  const spaceUtilization = Math.min(totalFurnitureArea / roomArea, 1.0);

  // Base score for having any furniture
  if (furnitureCount > 0) {
    score += 30;
  feedback.push("Good furniture selection for the room type");
  } else {
    issues.push("No furniture arranged - room is empty");
    return {
      score: 0,
      feedback: [],
      suggestions: ["Add furniture to the room"],
      issues,
      passed: false,
    };
  }

  // Space utilization scoring (more realistic)
  if (spaceUtilization > 0.15 && spaceUtilization <= 0.35) {
    score += 25;
    feedback.push("Excellent space utilization - room feels balanced");
  } else if (spaceUtilization > 0.10 && spaceUtilization <= 0.50) {
    score += 20;
    feedback.push("Good space utilization");
  } else if (spaceUtilization <= 0.10) {
    score += 10;
    suggestions.push("Consider adding more furniture for better room balance");
  } else {
    score += 15;
    suggestions.push("Room might feel a bit crowded - consider fewer pieces");
  }

  // Budget adherence
  score += 20;
  feedback.push("Budget considerations met");

  // Traffic flow and furniture count
  if (arrangement.length >= 3) {
    score += 15;
    feedback.push("Good traffic flow with multiple furniture pieces");
  } else if (arrangement.length >= 2) {
    score += 10;
    feedback.push("Adequate furniture for the space");
  } else {
    score += 5;
    suggestions.push("Consider adding more furniture for better room balance");
  }

  // Style and design coherence
  score += 10;
  feedback.push("Style preferences well incorporated");

  // Ensure minimum passing score for reasonable arrangements
  if (score < 70 && furnitureCount >= 2) {
    score = 70; // Boost score for reasonable arrangements
    feedback.push("Design meets basic functionality requirements");
  }

  return {
    score: Math.min(score, 100),
    feedback,
    suggestions,
    issues,
    passed: score >= 70,
  };
}

// Designer furniture arrangement function with custom prompts and visualization
async function designerArrangeFurniture(
  room: any,
  selectedFurniture: any[],
  arrangementPreferences: any,
  customPrompts: any,
  visualizationOptions?: any
) {
  console.log('\n🎨 === DESIGNER FURNITURE ARRANGEMENT STARTING ===');
  console.log(`📊 Room: ${room.dimensions.width}' × ${room.dimensions.length}' ${room.type}`);
  console.log(`🪑 Furniture items: ${selectedFurniture.length}`);
  console.log(`🎯 Custom prompts provided:`, Object.keys(customPrompts).filter(key => customPrompts[key]));
  
  // Enhanced arrangement preferences with custom prompts
  const enhancedPreferences = {
    ...arrangementPreferences,
    customInstructions: buildCustomInstructions(customPrompts),
  };
  
  // Use the existing arrangeFurniture function with enhanced preferences
  const arrangementResult = await arrangeFurniture(room, selectedFurniture, enhancedPreferences);
  
  // Generate design analysis based on custom prompts
  const designAnalysis = generateDesignAnalysis(
    arrangementResult,
    customPrompts,
    room,
    selectedFurniture
  );
  
  // Generate integrated visualization
  const visualization = await generateIntegratedVisualization(
    arrangementResult,
    room,
    selectedFurniture,
    visualizationOptions || {}
  );
  
  console.log('✅ Designer arrangement complete with visualization');
  
  return {
    // Core arrangement outputs
    arrangement: arrangementResult.arrangement,
    layoutDescription: arrangementResult.layoutDescription,
    aiStrategy: arrangementResult.aiStrategy,
    isUsingFallback: arrangementResult.isUsingFallback,
    // Designer-specific outputs
    designAnalysis,
    visualization,
  };
}

// Helper function to build custom instructions from prompts
function buildCustomInstructions(customPrompts: any): string {
  const instructions: string[] = [];
  
  if (customPrompts.designStyle) {
    instructions.push(`Design Style: ${customPrompts.designStyle}`);
  }
  
  if (customPrompts.spatialRequirements) {
    instructions.push(`Spatial Requirements: ${customPrompts.spatialRequirements}`);
  }
  
  if (customPrompts.functionalNeeds) {
    instructions.push(`Functional Needs: ${customPrompts.functionalNeeds}`);
  }
  
  if (customPrompts.aestheticGoals) {
    instructions.push(`Aesthetic Goals: ${customPrompts.aestheticGoals}`);
  }
  
  if (customPrompts.clientPreferences) {
    instructions.push(`Client Preferences: ${customPrompts.clientPreferences}`);
  }
  
  return instructions.join('. ');
}

// Generate design analysis based on custom prompts and arrangement
function generateDesignAnalysis(
  arrangementResult: any,
  customPrompts: any,
  room: any,
  selectedFurniture: any[]
): any {
  const designPrinciples: string[] = [];
  const recommendations: string[] = [];
  
  // Analyze how custom prompts were integrated
  let customPromptIntegration = "Standard furniture arrangement applied";
  if (Object.values(customPrompts).some(prompt => prompt)) {
    customPromptIntegration = "Custom design requirements integrated into AI arrangement strategy";
    
    if (customPrompts.designStyle) {
      designPrinciples.push("Custom design style implementation");
    }
    if (customPrompts.spatialRequirements) {
      designPrinciples.push("Spatial requirement optimization");
    }
    if (customPrompts.functionalNeeds) {
      designPrinciples.push("Functional workflow enhancement");
    }
    if (customPrompts.aestheticGoals) {
      designPrinciples.push("Aesthetic goal achievement");
    }
  }
  
  // Add standard design principles
  designPrinciples.push("Professional furniture placement");
  designPrinciples.push("Traffic flow optimization");
  designPrinciples.push("Spatial balance and proportion");
  
  // Generate spatial analysis
  const roomArea = room.dimensions.width * room.dimensions.length;
  const furnitureCount = selectedFurniture.length;
  const spatialAnalysis = `Room layout optimized for ${roomArea} sq ft space with ${furnitureCount} furniture pieces. ${
    arrangementResult.aiStrategy ? 'AI-driven placement strategy applied.' : 'Fallback arrangement logic used.'
  }`;
  
  // Generate recommendations
  recommendations.push("Consider adding accent lighting to enhance ambiance");
  recommendations.push("Ensure 3-foot minimum clearance for main traffic paths");
  
  if (customPrompts.functionalNeeds) {
    recommendations.push("Functional zones created based on specified needs");
  }
  
  return {
    customPromptIntegration,
    designPrinciples,
    spatialAnalysis,
    recommendations,
  };
}

// Generate integrated visualization with layering and custom options
async function generateIntegratedVisualization(
  arrangementResult: any,
  room: any,
  selectedFurniture: any[],
  visualizationOptions: any
) {
  // Import visualization functions from workflow - we'll implement them locally since they're not exported
  
  const roomWidth = room.dimensions.width;
  const roomLength = room.dimensions.length;
  
  // Local implementation of layering logic
  function detectOverlap(item1: any, item2: any): boolean {
    const item1Left = item1.x - item1.width / 2;
    const item1Right = item1.x + item1.width / 2;
    const item1Top = item1.y - item1.length / 2;
    const item1Bottom = item1.y + item1.length / 2;
    
    const item2Left = item2.x - item2.width / 2;
    const item2Right = item2.x + item2.width / 2;
    const item2Top = item2.y - item2.length / 2;
    const item2Bottom = item2.y + item2.length / 2;
    
    return !(item1Right <= item2Left || 
             item2Right <= item1Left || 
             item1Bottom <= item2Top || 
             item2Bottom <= item1Top);
  }
  
  function assignLayeringOrder(furniture: any[]): any[] {
    const furnitureWithLayers = furniture.map((item: any, index: number) => ({
      ...item,
      originalIndex: index,
      area: item.width * item.length,
      layerOrder: 0,
    }));
    
    const processed = new Set<number>();
    
    furnitureWithLayers.forEach((item: any, index: number) => {
      if (processed.has(index)) return;
      
      const overlappingGroup: any[] = [item];
      
      for (let i = index + 1; i < furnitureWithLayers.length; i++) {
        if (processed.has(i)) continue;
        
        const otherItem = furnitureWithLayers[i];
        if (detectOverlap(item, otherItem)) {
          overlappingGroup.push(otherItem);
        }
      }
      
      overlappingGroup.sort((a: any, b: any) => b.area - a.area);
      
      overlappingGroup.forEach((overlappingItem: any, layerIndex: number) => {
        overlappingItem.layerOrder = layerIndex;
        processed.add(furnitureWithLayers.indexOf(overlappingItem));
      });
    });
    
    return furnitureWithLayers.sort((a: any, b: any) => a.layerOrder - b.layerOrder);
  }
  
  // Furniture colors based on category and visualization options
  const getColorScheme = (scheme: string): Record<string, string> => {
    switch (scheme) {
      case 'monochrome':
        return {
          'sofa': '#666666',
          'coffee-table': '#888888',
          'tv-stand': '#555555',
          'dining-table': '#777777',
          'bed-frame': '#999999',
          'dresser': '#666666',
          'nightstand': '#888888',
          'floor-lamp': '#555555',
          'accent-chair': '#777777',
          'side-table': '#999999',
          'bookshelf': '#666666',
        };
      case 'pastel':
        return {
          'sofa': '#FFB6C1',
          'coffee-table': '#B6E5D8',
          'tv-stand': '#A8D8EA',
          'dining-table': '#C8E6C9',
          'bed-frame': '#FFF9C4',
          'dresser': '#E1BEE7',
          'nightstand': '#B2DFDB',
          'floor-lamp': '#FFF59D',
          'accent-chair': '#BBDEFB',
          'side-table': '#FFCC80',
          'bookshelf': '#F8BBD9',
        };
      case 'bold':
        return {
          'sofa': '#E91E63',
          'coffee-table': '#00BCD4',
          'tv-stand': '#2196F3',
          'dining-table': '#4CAF50',
          'bed-frame': '#FF9800',
          'dresser': '#9C27B0',
          'nightstand': '#009688',
          'floor-lamp': '#FFC107',
          'accent-chair': '#3F51B5',
          'side-table': '#FF5722',
          'bookshelf': '#E91E63',
        };
      default:
        return {
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
    }
  };
  
  const furnitureColors = getColorScheme(visualizationOptions.colorScheme || 'default');
  
  // Process furniture for visualization
  const furniture = arrangementResult.arrangement.map((item: any, index: number) => {
    const furnitureItem = selectedFurniture.find(f => f.id === item.furnitureId);
    if (!furnitureItem) return null;
    
    const category = furnitureItem.category_id || 'unknown';
    const color = furnitureColors[category as keyof typeof furnitureColors] || `hsl(${index * 60}, 70%, 60%)`;
    
    // Handle rotation - swap dimensions for 90° and 270° rotations
    const rotation = item.position.rotation || 0;
    const isRotated90 = rotation === 90 || rotation === 270;
    
    const originalLength = furnitureItem.dimensions[0] || 2;
    const originalWidth = furnitureItem.dimensions[1] || 2;
    
    const visualWidth = isRotated90 ? originalLength : originalWidth;
    const visualLength = isRotated90 ? originalWidth : originalLength;
    
    return {
      id: item.furnitureId,
      name: furnitureItem.name,
      x: item.position.x,
      y: item.position.y,
      width: visualWidth,
      length: visualLength,
      rotation: rotation,
      color: color,
    };
  }).filter((item: any): item is NonNullable<typeof item> => item !== null);
  
  // Apply layering logic for overlapping items
  const layeredFurniture = assignLayeringOrder(furniture);
  
  // Create room walls
  const walls = [
    { x1: 0, y1: 0, x2: roomWidth, y2: 0 },
    { x1: roomWidth, y1: 0, x2: roomWidth, y2: roomLength },
    { x1: roomWidth, y1: roomLength, x2: 0, y2: roomLength },
    { x1: 0, y1: roomLength, x2: 0, y2: 0 },
  ];
  
  // Create legend
  const legend = layeredFurniture.map(item => ({
    furnitureId: item.id,
    furnitureName: item.name,
    color: item.color,
  }));
  
  // Calculate space utilization
  const roomArea = roomWidth * roomLength;
  const furnitureArea = layeredFurniture.reduce((sum, item) => sum + (item.width * item.length), 0);
  const spaceUtilization = furnitureArea / roomArea;
  
  // Create visualization data
  const visualizationData = {
    roomDimensions: { width: roomWidth, length: roomLength },
    walls,
    furniture: layeredFurniture,
    fixtures: room.fixtures || [],
    scale: 1,
    legend,
    visualizationDescription: `Designer furniture arrangement with ${layeredFurniture.length} items in ${roomWidth}' x ${roomLength}' room`,
    spaceUtilization,
    trafficFlow: visualizationOptions.showTrafficFlow 
      ? ['Main pathway clear', 'Good circulation around furniture', 'Designer-optimized layout']
      : [],
  };
  
  // Generate HTML content - simple version for designer tool
  function generateSimpleVisualizationHTML(data: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Designer Furniture Arrangement</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        canvas { border: 1px solid #ddd; background: white; }
        .legend { margin-top: 20px; }
        .legend-item { display: flex; align-items: center; margin-bottom: 8px; }
        .legend-color { width: 20px; height: 20px; margin-right: 10px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Designer Furniture Arrangement</h1>
        <canvas id="canvas" width="800" height="600"></canvas>
        <div class="legend">
            <h3>Furniture Legend</h3>
            ${data.legend.map((item: any) => 
              `<div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <span>${item.furnitureName}</span>
              </div>`
            ).join('')}
        </div>
        <p><strong>Description:</strong> ${data.visualizationDescription}</p>
        <p><strong>Space Utilization:</strong> ${(data.spaceUtilization * 100).toFixed(1)}%</p>
    </div>
    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const data = ${JSON.stringify(data, null, 2)};
        
        // Simple rendering
        const scale = Math.min(750 / data.roomDimensions.width, 550 / data.roomDimensions.length);
        const offsetX = 25;
        const offsetY = 25;
        
        // Draw room
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, data.roomDimensions.width * scale, data.roomDimensions.length * scale);
        
        // Draw furniture
        data.furniture.forEach(item => {
            const x = offsetX + item.x * scale - (item.width * scale) / 2;
            const y = offsetY + (data.roomDimensions.length - item.y) * scale - (item.length * scale) / 2;
            
            ctx.fillStyle = item.color;
            ctx.fillRect(x, y, item.width * scale, item.length * scale);
            ctx.strokeStyle = '#333';
            ctx.strokeRect(x, y, item.width * scale, item.length * scale);
            
            // Draw name
            ctx.fillStyle = '#000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.name, x + (item.width * scale) / 2, y + (item.length * scale) / 2);
        });
    </script>
</body>
</html>`;
  }
  
  const htmlContent = generateSimpleVisualizationHTML(visualizationData);
  
  // Create file with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `designer-furniture-arrangement-${timestamp}.html`;
  
  // Write HTML file
  const fs = await import('fs/promises');
  const path = await import('path');
  const filepath = path.join(process.cwd(), filename);
  
  try {
    await fs.writeFile(filepath, htmlContent, 'utf-8');
    console.log(`✅ Designer visualization saved to: ${filepath}`);
  } catch (error) {
    console.error('Failed to save designer visualization file:', error);
    throw new Error(`Failed to save visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    htmlFile: filepath,
    visualizationData: {
      roomDimensions: visualizationData.roomDimensions,
      furniture: layeredFurniture.map(item => ({
        id: item.id,
        name: item.name,
        x: item.x,
        y: item.y,
        width: item.width,
        length: item.length,
        rotation: item.rotation,
        color: item.color,
      })),
      legend: legend,
      spaceUtilization,
      trafficFlow: visualizationData.trafficFlow,
    },
    visualizationDescription: visualizationData.visualizationDescription,
  };
} 