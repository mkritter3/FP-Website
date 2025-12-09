# Fresh Produce Website - 3D Scene Architecture

## Overview

This project is a cinematic 3D intro for Fresh Produce Media, built with Three.js. The experience features a retro TV displaying static, a scroll-driven camera dolly that passes through the screen, and a DNA helix spiral carousel of content cards.

## 3D Coordinate System

Understanding the coordinate system is crucial for positioning elements:

```
        +Y (up)
         |
         |
         |_______ +X (right)
        /
       /
      +Z (toward camera)
```

### Key Reference Points

| Element | Position | Notes |
|---------|----------|-------|
| **Camera (start)** | (0, -130, 950) | One-point perspective, centered on TV |
| **Camera (end)** | (0, -130, -650) | Past the screen plane |
| **TV Group** | (0, -130, -600) | Center of the TV |
| **Screen Plane** | z = -557 | World position where transition triggers |
| **Floor** | y = -180 | Horizontal plane |
| **Wall** | z = -900 | Backdrop behind TV |
| **Text** | (-centerOffset, -170, 555) | 10 units above floor, between TV and camera |

### Positioning Guidelines

- **Moving toward camera**: Increase Z value
- **Moving away from camera**: Decrease Z value
- **Moving up**: Increase Y value
- **Moving down**: Decrease Y value
- **Floor level**: y = -180
- **Camera eye level**: y = -130

## Scene Components

### 1. Environment (`createEnvironment()`)

**Floor**
- 5000x5000 PlaneGeometry rotated to horizontal
- Dark concrete texture, tiled 8x8
- Position: y = -180

**Wall**
- 5000x2500 PlaneGeometry
- Same texture, tiled 3x2
- Position: z = -900 (behind TV)

### 2. TV Group (`createProceduralTV()`)

The TV is a `THREE.Group` containing multiple meshes, positioned at (0, -130, -600).

**Components (relative to tvGroup):**
- **Body**: RoundedBoxGeometry 140x100x80, dark plastic material
- **Bezel**: RoundedBoxGeometry 130x90x5 at z=40
- **Screen**: PlaneGeometry 110x80 at z=42.5, with CRT static shader
- **Knobs**: Two cylinders on the right side
- **Antennas**: V-shaped metal rods on top

**Lighting (attached to tvGroup):**
- **Screen Glow**: PointLight at (0, 0, 45), intensity 30, range 300
- **Forward Light**: SpotLight at (0, -20, 50), intensity 60, range 800
  - Cone angle: 30 degrees (Math.PI / 6)
  - Aims at (0, -100, 400) - forward and down
  - Creates the visible light cone on the floor

### 3. Text (`create3DText()`)

3D extruded text using `THREE.TextGeometry`:
- Font: Helvetiker Bold (loaded from Three.js CDN)
- Size: 12, Height: 0.5 (thin extrusion)
- Material: MeshBasicMaterial (white, ignores lighting)
- Position: (-centerOffset, -170, 555)
- Added to `scene` (not tvGroup) for independent positioning

**Why MeshBasicMaterial?** It doesn't respond to scene lighting, so the text appears bright/self-luminous even in dark areas.

### 4. Post-Processing (`setupPostProcessing()`)

Three passes in the EffectComposer:
1. **RenderPass**: Base render
2. **UnrealBloomPass**: Strength 0.25, Radius 0.35, Threshold 0.88
3. **FilmPass**: Noise 0.08, Scanlines 0.015

## Scroll-Driven Camera Dolly

### How It Works

The camera dollies from z=950 to z=-650 based on scroll input.

```javascript
// Scroll state
let scrollZ = 0;              // Current scroll position (0 to maxZ)
const maxZ = 2500;            // Total scroll distance
const screenPlaneZ = -557;    // Transition trigger point

// In onScroll():
const progress = scrollZ / maxZ;  // 0 to 1

// Ease-in-out curve for cinematic feel
const easeProgress = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

// Map to camera Z position
const startZ = 950;
const endZ = -650;
camera.position.z = startZ + (endZ - startZ) * easeProgress;
```

### Transition Flow

1. **Forward Scroll**: Camera moves toward TV
2. **Screen Fill**: Static fills viewport as camera approaches
3. **Pass Through**: Camera crosses screenPlaneZ (-557)
4. **Black Frame**: 80ms pure black beat
5. **Spiral Entry**: DNA helix cards scroll up from below

### Reverse Transition

Stores `transitionScrollZ` when forward transition triggers, uses same value for symmetrical reverse.

## Manipulating the 3D Space

### Moving Objects

```javascript
// World space positioning (independent of other objects)
mesh.position.set(x, y, z);

// Relative to parent group
tvGroup.add(childMesh);
childMesh.position.set(x, y, z);  // Relative to tvGroup
```

### 2D Screen Position vs 3D World Position

To keep the same 2D screen position while changing 3D position:
- Moving **closer to camera** (higher Z) makes objects appear **larger and lower**
- To compensate: **raise Y** when **increasing Z**

Example: Text at (0, -175, 500) vs (0, -150, 700) can appear at similar screen positions.

### Light Cone Boundaries

The TV spotlight creates a visible light cone:
- Origin: z ≈ -550 (TV position + light offset)
- Range: 800 units
- Effective falloff: around z = 200-300
- Objects beyond this appear in darkness

## Key Functions Reference

| Function | Purpose |
|----------|---------|
| `init()` | Scene setup, renderer, events |
| `createEnvironment()` | Floor and wall |
| `createProceduralTV()` | TV mesh group with lighting |
| `create3DText()` | 3D "FRESH PRODUCE" text |
| `onScroll()` | Camera dolly / spiral scroll |
| `triggerBlackFrameTransition()` | Forward transition to spiral |
| `triggerReverseTransition()` | Back to TV scene |
| `initSpiral()` | DNA helix card layout |
| `handleSpiralScroll()` | Spiral rotation and translation |
| `animate()` | Render loop |

## Common Tasks

### Repositioning Text
```javascript
// In create3DText() callback:
textMesh.position.set(-centerOffset, y, z);
// y: -180 = on floor, higher = above floor
// z: 555 = current, higher = closer to camera
```

### Adjusting Light Cone
```javascript
// In createProceduralTV():
const forwardLight = new THREE.SpotLight(color, intensity, range, angle, penumbra, decay);
forwardLight.position.set(x, y, z);
forwardLight.target.position.set(tx, ty, tz);
```

### Changing Transition Timing
```javascript
// In triggerBlackFrameTransition():
setTimeout(() => { ... }, 80);  // 80ms black frame duration
```

### Modifying Camera Path
```javascript
// In onScroll():
const startZ = 950;   // Camera start position
const endZ = -650;    // Camera end position (past screen)
```

## Files Structure

```
/
├── index.html          # Main HTML with canvas container
├── style.css           # Spiral view and UI styles
├── script.js           # All 3D scene logic
└── assets/
    └── floor-texture-map-no-light.png
```

## Dependencies

- Three.js (r128+)
- Three.js examples: EffectComposer, RenderPass, UnrealBloomPass, FilmPass
- Three.js examples: RoundedBoxGeometry, FontLoader, TextGeometry
