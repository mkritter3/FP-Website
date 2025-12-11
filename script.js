// Fresh Produce Media - Full 3D Cinematic Scene
// Procedural 3D TV & Spiral Transition

// --- Global Variables ---
let scene, camera, renderer, composer;
let tvGroup, screenMesh, textMesh;
let tvScreenGlow, tvForwardLight;  // TV lights (to turn off in spiral mode)
let bloomPass = null;  // For adjusting bloom during transitions
let clock = new THREE.Clock();
let mouseX = 0, mouseY = 0;
const MAX_ANISOTROPY = 8;
const ENABLE_SMOKE = false;

// Spiral Variables
let carouselContainer, carouselTrack;
let rotation = 0;
const radius = 1000;

// Scroll State
let scrollZ = 0;
const maxZ = 2500;           // Extended dolly distance
const screenPlaneZ = -557;   // Z position of screen in world space
let inIntro = true;
let transitioning = false;   // For black frame beat
let transitionScrollZ = 0;   // Store exact scrollZ at transition for symmetrical reverse

// Spiral focus tracking for zero-gravity carousel
let focusProgress = 0;        // Current interpolated focus position
let targetFocusProgress = 0;  // Target focus position from scroll
let carouselAnimating = false;

// 3D Spiral Cards (Three.js)
let spiralGroup;
let card3DArray = [];
let inSpiral3D = false;  // Track if we're in 3D spiral mode
let loadedFont = null;   // Cached font for card text
let floorMesh = null;    // Global for hiding in spiral mode
let wallMesh = null;     // Global for hiding in spiral mode

// Volumetric beam particles - multi-layer fog system
let dustParticles = null;      // Layer 1: Large soft haze
let dustParticles2 = null;     // Layer 2: Smaller dust motes
const dustParticleCount = 3000;      // More haze particles for density
const dustParticleCount2 = 1500;      // More dust mote particles

// === BACKLIT PROJECTOR CONFIGURATION ===
// Light comes from BEHIND the cards, pointing toward camera (one-point perspective)
const backLightZ = -900;      // Light source position (far behind spiral at -600)
const cameraZ = -580;         // Camera position
const spiralCenterZ = -600;   // Spiral center
const beamLength = 320;       // Distance from light to camera area
const beamConeRadius = 25;    // Wider cone for dramatic effect

// === GOD RAYS POST-PROCESS ===
// Proper volumetric light scattering (GPU Gems 3 technique)
let godRaysEnabled = false;
let occlusionRenderTarget = null;
let occlusionComposer = null;
let godRaysPass = null;
let lightSourceMesh = null;
let godRaysMaterial = null;
let beamSpotlight = null;  // Global for projector flicker animation

// God rays parameters (tunable)
const godRaysParams = {
    exposure: 0.25,
    decay: 0.96,
    density: 0.8,
    weight: 0.6,
    samples: 80,
    lightColor: new THREE.Color(0xffcc88)
};

// Reusable black material for occlusion pass (created once, not every frame)
let occlusionBlackMaterial = null;

// Soft particle texture for fog motes
let fogParticleTexture = null;

// Create procedural soft particle texture (extremely subtle dust mote)
function createSoftParticleTexture(size = 64, softness = 0.6) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;

    // Soft Gaussian-like falloff - visible but diffuse
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);

    // Subtle but visible - soft center fading smoothly
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.35)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.01)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// God Rays Shader - Radial blur toward light source
const GodRaysShader = {
    uniforms: {
        tDiffuse: { value: null },           // Main scene
        tOcclusion: { value: null },         // Occlusion pass (light source + black silhouettes)
        lightPositionOnScreen: { value: new THREE.Vector2(0.5, 0.5) },
        exposure: { value: godRaysParams.exposure },
        decay: { value: godRaysParams.decay },
        density: { value: godRaysParams.density },
        weight: { value: godRaysParams.weight },
        samples: { value: godRaysParams.samples }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tOcclusion;
        uniform vec2 lightPositionOnScreen;
        uniform float exposure;
        uniform float decay;
        uniform float density;
        uniform float weight;
        uniform int samples;

        varying vec2 vUv;

        // HSV to RGB conversion for prismatic rainbow effect
        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            // Scene color
            vec4 sceneColor = texture2D(tDiffuse, vUv);

            // Early out if light is off-screen
            if (lightPositionOnScreen.x < -0.5 || lightPositionOnScreen.x > 1.5 ||
                lightPositionOnScreen.y < -0.5 || lightPositionOnScreen.y > 1.5) {
                gl_FragColor = sceneColor;
                return;
            }

            // Calculate angle from light for prismatic color
            vec2 toPixel = vUv - lightPositionOnScreen;
            float angle = atan(toPixel.y, toPixel.x);
            // Convert angle (-PI to PI) to hue (0 to 1)
            float hue = (angle + 3.14159) / 6.28318;
            // Create vivid rainbow color with maximum saturation
            vec3 rainbowColor = hsv2rgb(vec3(hue, 1.0, 1.0));

            // Calculate vector from pixel to light
            vec2 deltaTexCoord = toPixel;
            deltaTexCoord *= 1.0 / float(samples) * density;

            // Current sample position
            vec2 texCoord = vUv;

            // Accumulate illumination
            float godRaysIntensity = 0.0;
            float illuminationDecay = 1.0;

            for(int i = 0; i < 100; i++) {
                if(i >= samples) break;

                // Step toward light
                texCoord -= deltaTexCoord;

                // Clamp to valid texture coordinates
                vec2 clampedCoord = clamp(texCoord, 0.0, 1.0);

                // Sample occlusion texture (grayscale intensity)
                float sampleIntensity = texture2D(tOcclusion, clampedCoord).r;

                // Apply decay and weight
                sampleIntensity *= illuminationDecay * weight;
                godRaysIntensity += sampleIntensity;

                // Exponential decay
                illuminationDecay *= decay;
            }

            // Apply exposure
            godRaysIntensity *= exposure;

            // Create prismatic god rays color
            vec3 prismaticRays = rainbowColor * godRaysIntensity;

            // Additive blend with scene
            gl_FragColor = vec4(sceneColor.rgb + prismaticRays, 1.0);
        }
    `
};

// Static Shader Uniforms
const staticUniforms = {
    time: { value: 0 },
    resolution: { value: new THREE.Vector2() }
};

// Smoke Shader Uniforms
const smokeUniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0, 0) }
};

// Spiral Data
const carouselData = [
    { title: "The Big Fix S2", color: "#FF3366", image: "assets/placeholder1.jpg" },
    { title: "Blood Hound", color: "#33CCFF", image: "assets/placeholder2.jpg" },
    { title: "The Signal", color: "#FFCC33", image: "assets/placeholder3.jpg" },
    { title: "Hit Singles", color: "#33FF99", image: "assets/placeholder4.jpg" },
    { title: "The Boar's Nest", color: "#CC33FF", image: "assets/placeholder5.jpg" },
    { title: "Coming Soon", color: "#FF6633", image: "assets/placeholder6.jpg" },
    { title: "Coming Soon", color: "#3366FF", image: "assets/placeholder7.jpg" },
    { title: "Coming Soon", color: "#FF33CC", image: "assets/placeholder8.jpg" }
];

// --- Initialization ---
init();

function init() {
    try {
        const container = document.getElementById('canvas-container');

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505);
        scene.fog = new THREE.FogExp2(0x050505, 0.00045); // Light haze for depth, not blur

        // Camera - One-point perspective, centered on TV
        camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 4000);
        camera.position.set(0, -130, 950); // Same height as TV center for one-point perspective
        camera.lookAt(0, -130, -600);      // Look straight at TV

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
        renderer.toneMappingExposure = 0.8; // Balanced exposure
        container.appendChild(renderer.domElement);

        // Post-processing
        setupPostProcessing();

        // God rays post-process system
        setupGodRays();

        // Lighting
        createLighting();

        // Create Environment (Floor)
        createEnvironment();

        // Create Procedural 3D TV
        createProceduralTV();

        // Create Smoke Shader (disabled by default for a clean plate)
        if (ENABLE_SMOKE) createSmokeShader();

        // Hide loader
        setTimeout(() => {
            const loader = document.getElementById('loading');
            if (loader) loader.classList.add('hidden');
        }, 1000);

        // Events
        window.addEventListener('resize', onWindowResize);
        document.addEventListener('mousemove', onMouseMove);
        window.addEventListener('wheel', onScroll, { passive: false });

        // Initialize Spiral (Hidden initially)
        initSpiral();      // Legacy HTML version (fallback)
        // initSpiral3D() is now called after font loads in create3DText()

        // Start Loop
        animate();

    } catch (e) {
        console.error(e);
        const debugLog = document.getElementById('debug-log');
        if (debugLog) debugLog.innerHTML = `ERROR: ${e.message}<br>${e.stack}`;
    }
}

function setupPostProcessing() {
    try {
        if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.FilmPass) {
            composer = new THREE.EffectComposer(renderer);
            const renderPass = new THREE.RenderPass(scene, camera);
            composer.addPass(renderPass);

            bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.25, 0.35, 0.88 // Strength, Radius, Threshold tuned for subtle screen glow
            );
            composer.addPass(bloomPass);

            // Film Grain for "Gritty" look
            const filmPass = new THREE.FilmPass(
                0.08,   // noise intensity
                0.015,  // scanline intensity
                648,    // scanline count
                false   // grayscale
            );
            composer.addPass(filmPass);
        } else {
            composer = null;
        }
    } catch (e) {
        console.warn('Post-processing setup failed:', e);
        composer = null;
    }
}

// === GOD RAYS SETUP ===
// Creates occlusion render target and god rays shader pass
function setupGodRays() {
    // Create occlusion render target (half resolution for performance)
    const rtWidth = Math.floor(window.innerWidth / 2);
    const rtHeight = Math.floor(window.innerHeight / 2);

    occlusionRenderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
    });

    // Create reusable black material for occlusion pass
    occlusionBlackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Create soft particle texture for fog motes
    fogParticleTexture = createSoftParticleTexture();

    // Create light source mesh - bright glowing sphere at top of spiral
    // Larger light source for more dramatic god rays
    const lightGeom = new THREE.SphereGeometry(18, 32, 32);
    const lightMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,  // Pure white for maximum brightness in occlusion pass
        transparent: false
    });
    lightSourceMesh = new THREE.Mesh(lightGeom, lightMat);
    // Backlit position: behind the spiral, pointing toward camera
    // Relative to spiralGroup at (0, -130, -600), so z=-300 puts it at world z=-900
    lightSourceMesh.position.set(0, 0, backLightZ - spiralCenterZ);
    lightSourceMesh.visible = false; // Only visible in spiral mode

    // Create god rays shader material
    godRaysMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(GodRaysShader.uniforms),
        vertexShader: GodRaysShader.vertexShader,
        fragmentShader: GodRaysShader.fragmentShader
    });

    // Create god rays pass and add to composer
    if (THREE.ShaderPass && composer) {
        godRaysPass = new THREE.ShaderPass(godRaysMaterial);
        godRaysPass.needsSwap = true;
        godRaysPass.enabled = false; // Disabled until spiral mode

        // Insert god rays pass after RenderPass (index 0) but before BloomPass (index 1)
        // We need to rebuild the passes array
        const passes = composer.passes.slice(); // Copy existing passes
        composer.passes = [];

        // Re-add passes with god rays in correct position
        passes.forEach((pass, index) => {
            composer.addPass(pass);
            // Add god rays after the first pass (RenderPass)
            if (index === 0) {
                composer.addPass(godRaysPass);
            }
        });
    }

    console.log('God rays system initialized');
}

// Render the occlusion pass - light source bright, everything else black
function renderOcclusionPass() {
    if (!occlusionRenderTarget || !lightSourceMesh || !inSpiral3D || !occlusionBlackMaterial) return;

    // Store original states
    const originalBackground = scene.background;
    const originalFog = scene.fog;
    const originalMaterials = new Map();
    const originalTVVisible = tvGroup ? tvGroup.visible : false;

    // Set black background for occlusion
    scene.background = new THREE.Color(0x000000);
    scene.fog = null;

    // Hide TV during occlusion pass
    if (tvGroup) tvGroup.visible = false;

    // Make spiral group objects black (except light source and particles)
    if (spiralGroup) {
        spiralGroup.traverse((child) => {
            if (child.isMesh && child !== lightSourceMesh) {
                originalMaterials.set(child, child.material);
                child.material = occlusionBlackMaterial;
            }
            // Hide particles during occlusion pass
            if (child.isPoints) {
                child.visible = false;
            }
        });
    }

    // Make light source visible and bright for occlusion
    lightSourceMesh.visible = true;

    // Store original clear color
    const originalClearColor = renderer.getClearColor(new THREE.Color());
    const originalClearAlpha = renderer.getClearAlpha();

    // Render to occlusion target with explicit clear
    renderer.setRenderTarget(occlusionRenderTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // Restore original clear color
    renderer.setClearColor(originalClearColor, originalClearAlpha);

    // Restore original materials
    originalMaterials.forEach((material, mesh) => {
        mesh.material = material;
    });

    // Restore particles visibility
    if (spiralGroup) {
        spiralGroup.traverse((child) => {
            if (child.isPoints) {
                child.visible = true;
            }
        });
    }

    // Hide light source for main scene render
    lightSourceMesh.visible = false;

    // Restore TV visibility
    if (tvGroup) tvGroup.visible = originalTVVisible;

    // Restore scene state
    scene.background = originalBackground;
    scene.fog = originalFog;

    // Update god rays uniform with occlusion texture
    if (godRaysMaterial) {
        godRaysMaterial.uniforms.tOcclusion.value = occlusionRenderTarget.texture;
    }
}

// Update light position in screen space for god rays shader
function updateLightScreenPosition() {
    if (!lightSourceMesh || !godRaysMaterial || !inSpiral3D) return;

    // Get light world position (relative to spiral group)
    const lightWorldPos = new THREE.Vector3();
    lightSourceMesh.getWorldPosition(lightWorldPos);

    // Project to screen space
    const screenPos = lightWorldPos.clone().project(camera);

    // Convert from NDC [-1,1] to UV [0,1]
    const screenX = (screenPos.x + 1) / 2;
    const screenY = (screenPos.y + 1) / 2;

    // Update shader uniform
    godRaysMaterial.uniforms.lightPositionOnScreen.value.set(screenX, screenY);
}

function createLighting() {
    // Ambient light - low for moody look
    const ambient = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(ambient);

    // Hemisphere - dark from above, darker from below
    const bounce = new THREE.HemisphereLight(0x222233, 0x000000, 0.15);
    scene.add(bounce);
}

function createEnvironment() {
    const textureLoader = new THREE.TextureLoader();

    // Load floor texture (tiled)
    const floorTexture = textureLoader.load('assets/floor-texture-map-no-light.png');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(8, 8);
    floorTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), MAX_ANISOTROPY);
    floorTexture.encoding = THREE.sRGBEncoding;

    // Floor plane - dark concrete
    const floorGeometry = new THREE.PlaneGeometry(5000, 5000);
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: 0x333333,    // Tint the texture darker
        roughness: 0.9,
        metalness: 0.0
    });
    floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -180;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Wall using flat texture (no pre-baked lighting)
    const wallTexture = textureLoader.load('assets/floor-texture-map-no-light.png');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(3, 2);
    wallTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), MAX_ANISOTROPY);
    wallTexture.encoding = THREE.sRGBEncoding;

    const wallGeometry = new THREE.PlaneGeometry(5000, 2500);
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        roughness: 0.9,
        metalness: 0.02,
        color: 0x151515   // Dark wall
    });
    wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.position.set(0, 300, -900);
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);
}

function createGrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill with base grey
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    // Add noise
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 40; // Intensity
        data[i] += noise;
        data[i + 1] += noise;
        data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createProceduralTV() {
    tvGroup = new THREE.Group();
    tvGroup.position.set(0, -130, -600); // Raised to sit on floor (body height 100, floor at y=-180)

    // Generate Grain Texture for realism
    const grainTexture = createGrainTexture();
    grainTexture.repeat.set(2, 2);

    // High-Quality Plastic Material with Texture
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x181818, // Darker plastic
        roughness: 0.78,
        roughnessMap: grainTexture,
        bumpMap: grainTexture,
        bumpScale: 0.25,
        metalness: 0.12,
        clearcoat: 0.08,
        clearcoatRoughness: 0.45
    });

    const bezelMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a0a,
        roughness: 0.5,
        roughnessMap: grainTexture,
        bumpMap: grainTexture,
        bumpScale: 0.12,
        metalness: 0.25,
        clearcoat: 0.2,
        clearcoatRoughness: 0.25
    });

    // 1. Main Body (Rounded Box)
    // Requires RoundedBoxGeometry from examples
    let bodyGeom;
    if (THREE.RoundedBoxGeometry) {
        bodyGeom = new THREE.RoundedBoxGeometry(140, 100, 80, 4, 2); // w, h, d, segments, radius
    } else {
        bodyGeom = new THREE.BoxGeometry(140, 100, 80);
    }
    const body = new THREE.Mesh(bodyGeom, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    tvGroup.add(body);

    // 2. Screen Bezel (Rounded Box)
    let bezelGeom;
    if (THREE.RoundedBoxGeometry) {
        bezelGeom = new THREE.RoundedBoxGeometry(130, 90, 5, 4, 1);
    } else {
        bezelGeom = new THREE.BoxGeometry(130, 90, 5);
    }
    const bezel = new THREE.Mesh(bezelGeom, bezelMaterial);
    bezel.position.z = 40;
    bezel.castShadow = true;
    bezel.receiveShadow = true;
    tvGroup.add(bezel);

    // 3. Screen (Plane with Static Shader)
    // Screen dimensions: 110 x 80
    const screenWidth = 110;
    const screenHeight = 80;

    const staticMaterial = new THREE.ShaderMaterial({
        uniforms: staticUniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            void main() {
                vec2 uv = vUv;
                
                // Curvature distortion (CRT effect)
                vec2 d = uv - 0.5;
                float r = dot(d, d);
                uv = uv + d * (r * 0.1); // Bulge

                if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    return;
                }

                float noise = random(uv * 500.0 + time * 50.0);
                float scanline = sin(uv.y * 200.0 + time * 10.0) * 0.05;
                vec3 color = vec3(noise * 1.3 + scanline + 0.1); // Brighter screen
                
                // Vignette
                vec2 v = uv * 2.0 - 1.0;
                float vig = 1.0 - dot(v, v) * 0.5;
                color *= vig;

                gl_FragColor = vec4(color, 1.0);
            }
        `
    });

    const screenGeom = new THREE.PlaneGeometry(screenWidth, screenHeight, 32, 32);
    // Curve the screen geometry slightly
    const positions = screenGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        // Bulge Z based on distance from center
        const dist = Math.sqrt(x * x + y * y);
        const z = Math.max(0, 5 - dist * 0.05);
        positions.setZ(i, z);
    }
    positions.needsUpdate = true;

    screenMesh = new THREE.Mesh(screenGeom, staticMaterial);
    screenMesh.position.z = 42.5; // Slightly in front of bezel
    tvGroup.add(screenMesh);

    // Screen glow - ambient light from TV screen
    tvScreenGlow = new THREE.PointLight(0xeeeeff, 30, 300, 2);
    tvScreenGlow.position.set(0, 0, 45); // At screen surface
    tvGroup.add(tvScreenGlow);

    // Forward light path - SpotLight casting towards viewer
    tvForwardLight = new THREE.SpotLight(0xddeeff, 60, 800, Math.PI / 6, 0.6, 2);
    tvForwardLight.position.set(0, -20, 50); // Bottom of screen, facing forward
    tvForwardLight.target.position.set(0, -100, 400); // Aim forward and down
    tvGroup.add(tvForwardLight);
    tvGroup.add(tvForwardLight.target);

    // 4. Knobs/Dials (Side Panel)
    const knobGeom = new THREE.CylinderGeometry(4, 4, 5, 32);
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });

    const knob1 = new THREE.Mesh(knobGeom, knobMat);
    knob1.rotation.x = Math.PI / 2;
    knob1.position.set(55, 20, 42);
    tvGroup.add(knob1);

    const knob2 = new THREE.Mesh(knobGeom, knobMat);
    knob2.rotation.x = Math.PI / 2;
    knob2.position.set(55, 0, 42);
    tvGroup.add(knob2);

    // 5. Antennas
    createAntenna(tvGroup);

    // 6. Text "FRESH PRODUCE"
    create3DText();

    scene.add(tvGroup);
}

// NOTE: createLighting() is defined earlier in the file (line 144)

function create3DText() {
    const loader = new THREE.FontLoader();

    // Load a font and create 3D text geometry
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', function(font) {
        // Cache the font globally for card text
        loadedFont = font;

        const textGeometry = new THREE.TextGeometry('FRESH PRODUCE', {
            font: font,
            size: 12,           // Smaller text
            height: 0.5,        // Thin extrusion for subtle 3D
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.05,
            bevelSegments: 3
        });

        // Center the text geometry
        textGeometry.computeBoundingBox();
        const centerOffset = (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) / 2;

        // Bright solid white material (not ghostly)
        const textMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff
        });

        textMesh = new THREE.Mesh(textGeometry, textMaterial);
        // Position 10 units above floor, closer to camera
        textMesh.position.set(-centerOffset, -170, 555);

        scene.add(textMesh);

        // Now that font is loaded, initialize the 3D spiral cards
        initSpiral3D();
    });
}

function createAntenna(parentGroup) {
    const antennaGroup = new THREE.Group();
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 1.0 });

    // Left antenna
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1, 60, 8), antennaMaterial);
    leftArm.position.set(-15, 30, 0);
    leftArm.rotation.z = Math.PI / 6;
    antennaGroup.add(leftArm);

    // Right antenna
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1, 60, 8), antennaMaterial);
    rightArm.position.set(15, 30, 0);
    rightArm.rotation.z = -Math.PI / 6;
    antennaGroup.add(rightArm);

    antennaGroup.position.set(0, 50, 0); // Top of TV
    parentGroup.add(antennaGroup);
}

function createSmokeShader() {
    const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
    const material = new THREE.ShaderMaterial({
        uniforms: smokeUniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            varying vec2 vUv;
            // (Simplex noise implementation omitted for brevity, same as before)
            // ... [Insert Noise Function Here] ...
            // Simplified noise for this example
            float random (in vec2 st) { return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123); }
            float noise (in vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
                vec2 st = gl_FragCoord.xy/uResolution.xy;
                float n = noise(st * 3.0 + uTime * 0.1);
                float vignette = 1.0 - distance(vUv, vec2(0.5));
                vec3 color = vec3(n * 0.1);
                gl_FragColor = vec4(color, n * vignette * 0.2);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const smokePlane = new THREE.Mesh(geometry, material);
    smokePlane.position.z = 600;
    scene.add(smokePlane);
}

// --- Interaction Logic ---

function onScroll(event) {
    if (transitioning) return; // Block during black frame

    if (inIntro) {
        event.preventDefault();
        scrollZ += event.deltaY * 0.5;
        scrollZ = Math.max(0, Math.min(scrollZ, maxZ));

        // Calculate progress (0 to 1)
        const progress = scrollZ / maxZ;

        // Dolly camera from z=950 all the way THROUGH the screen
        // Start z=950, end z=-650 (well past screen plane at -557)
        const startZ = 950;
        const endZ = -650;

        // Ease-in-out for cinematic feel
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const targetZ = startZ + (endZ - startZ) * easeProgress;
        camera.position.z = targetZ;

        // Keep looking straight at TV (one-point perspective)
        camera.lookAt(0, -130, -600);

        // When camera passes THROUGH the screen plane, trigger transition
        // Screen plane is at z=-557.5, trigger when camera goes past it
        if (camera.position.z <= screenPlaneZ && inIntro) {
            triggerBlackFrameTransition();
        }
    } else {
        handleSpiralScroll(event.deltaY);
    }
}

// Black frame beat before spiral
function triggerBlackFrameTransition() {
    transitioning = true;
    inIntro = false;

    // Store exact scrollZ for symmetrical reverse transition
    transitionScrollZ = scrollZ;

    // Brief black frame, then show 3D spiral
    const canvasContainer = document.getElementById('canvas-container');

    // Fade to black briefly
    canvasContainer.style.opacity = '0';

    setTimeout(() => {
        // Hide HTML spiral view (not using it anymore)
        const spiralView = document.querySelector('.spiral-view');
        if (spiralView) spiralView.style.display = 'none';

        // Show 3D spiral group
        spiralGroup.visible = true;
        inSpiral3D = true;

        // Turn off TV lights to prevent card blow-out
        if (tvScreenGlow) tvScreenGlow.intensity = 0;
        if (tvForwardLight) tvForwardLight.intensity = 0;

        // Hide floor and wall for "floating in void" feel
        if (floorMesh) floorMesh.visible = false;
        if (wallMesh) wallMesh.visible = false;
        if (tvGroup) tvGroup.visible = false;

        // ENABLE god rays for dramatic backlit projector effect
        godRaysEnabled = true;
        if (godRaysPass) godRaysPass.enabled = true;
        if (lightSourceMesh) lightSourceMesh.visible = true;

        // Update god rays parameters for dramatic prismatic beams
        if (godRaysMaterial) {
            godRaysMaterial.uniforms.exposure.value = 0.85;   // Much stronger rays
            godRaysMaterial.uniforms.decay.value = 0.96;      // Rays extend further
            godRaysMaterial.uniforms.density.value = 0.8;     // Slightly less dense for distinct beams
            godRaysMaterial.uniforms.weight.value = 0.9;      // Stronger per-sample weight
            godRaysMaterial.uniforms.samples.value = 150;     // More samples for smoother rays
        }

        // Strong bloom for dramatic backlit glow
        if (bloomPass) {
            bloomPass.strength = 0.7;   // Strong backlit glow
            bloomPass.radius = 0.6;     // Wider bloom spread
            bloomPass.threshold = 0.7;  // Lower threshold to catch more light
        }

        // Increase fog for visible light beam scattering
        if (scene.fog) scene.fog.density = 0.0012;

        // Reposition camera for spiral viewing
        camera.position.set(0, -130, -580);  // Just past TV screen
        camera.lookAt(0, -130, -600);        // Look at spiral center

        // Initialize spiral positions
        focusProgress = -4;
        targetFocusProgress = -4;
        updateCard3DPositions(focusProgress);

        // Fade back in
        canvasContainer.style.opacity = '1';
        transitioning = false;
    }, 80); // Brief black frame
}

// Initialize spiral at starting position - cards below screen, ready to emerge
function initSpiralStartPosition() {
    // Start with negative progress so first card is WELL below screen edge
    // Need enough offset to push cards past bottom of viewport
    focusProgress = -4;
    targetFocusProgress = -4;
    updateCardPositions(focusProgress);
}

function completeIntro() {
    inIntro = false;
    document.getElementById('canvas-container').style.pointerEvents = 'none';
    document.querySelector('.spiral-view').classList.add('visible');
    document.querySelector('.spiral-view').classList.add('active');
}

// --- 3D Spiral Cards (Three.js) ---

function create3DCard(data, index) {
    const group = new THREE.Group();

    // Card dimensions (world units) - 1.75x size
    const width = 14;      // ~800px equivalent * 1.75
    const height = 8.75;   // ~500px equivalent * 1.75
    const depth = 2.0;     // Thick enough for large corner radius

    // Rounded geometry - radius 1.0 for very rounded corners
    const geometry = new THREE.RoundedBoxGeometry(width, height, depth, 8, 1.0);

    // Tinted translucent glass
    const cardColor = new THREE.Color(data.color);

    // Frosted tinted glass - NO clearcoat to avoid white Fresnel reflections
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: cardColor,
        transparent: true,
        opacity: 0.5,
        metalness: 0.0,
        roughness: 0.4,
        emissive: cardColor,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, glassMaterial);
    group.add(mesh);

    // Add title text to card
    if (loadedFont) {
        const textGeometry = new THREE.TextGeometry(data.title, {
            font: loadedFont,
            size: 1.0,
            height: 0.08,
            curveSegments: 8,
            bevelEnabled: false
        });

        // Center the text
        textGeometry.computeBoundingBox();
        const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        const centerX = -textWidth / 2;

        // White self-illuminated text
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const cardText = new THREE.Mesh(textGeometry, textMaterial);

        // Position at bottom of card face
        cardText.position.set(centerX, -height / 2 + 1.2, depth / 2 + 0.1);
        group.add(cardText);
    }

    group.userData = { index, data, frontMaterial: glassMaterial, baseColor: cardColor.clone() };

    return group;
}

function initSpiral3D() {
    spiralGroup = new THREE.Group();
    spiralGroup.position.set(0, -130, -600);  // Same position as TV
    scene.add(spiralGroup);

    // Initially hidden
    spiralGroup.visible = false;

    // Soft ambient glow - very dim so card colors shine through
    const ambientGlow = new THREE.AmbientLight(0x222233, 0.3);
    spiralGroup.add(ambientGlow);

    // === GOD RAYS LIGHT SOURCE ===
    // Add light source mesh to spiral group for proper positioning
    if (lightSourceMesh) {
        spiralGroup.add(lightSourceMesh);
        lightSourceMesh.visible = false; // Hidden until god rays are active
    }

    // === LAYER 1: SOFT HAZE PARTICLES ===
    // Large, very soft, barely visible - creates atmospheric base

    const hazeGeom = new THREE.BufferGeometry();
    const hazePositions = new Float32Array(dustParticleCount * 3);
    const hazeVelocities = new Float32Array(dustParticleCount * 3);

    // Backlit beam: particles distributed along Z-axis from light to camera
    const relativeBackLightZ = backLightZ - spiralCenterZ;  // -300
    const relativeCameraZ = cameraZ - spiralCenterZ;         // 20

    for (let i = 0; i < dustParticleCount; i++) {
        // Distribute along Z-axis (from light source toward camera)
        const z = relativeBackLightZ + Math.random() * beamLength;
        const depthRatio = (z - relativeBackLightZ) / beamLength;  // 0 at light, 1 at camera
        // Cone expands as it travels toward camera
        const radiusAtZ = (3 + beamConeRadius * depthRatio) * Math.sqrt(Math.random());
        const angle = Math.random() * Math.PI * 2;

        // Radial distribution around Z-axis
        hazePositions[i * 3] = Math.cos(angle) * radiusAtZ;
        hazePositions[i * 3 + 1] = Math.sin(angle) * radiusAtZ;
        hazePositions[i * 3 + 2] = z;

        // Particles drift TOWARD camera (positive Z direction) with slight XY turbulence
        hazeVelocities[i * 3] = (Math.random() - 0.5) * 0.01;
        hazeVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
        hazeVelocities[i * 3 + 2] = Math.random() * 0.03 + 0.02;  // Forward drift
    }

    hazeGeom.setAttribute('position', new THREE.BufferAttribute(hazePositions, 3));
    hazeGeom.userData = { velocities: hazeVelocities };

    // Haze material - large diffuse clouds
    const hazeMat = new THREE.PointsMaterial({
        color: 0xfff8ee,
        size: 12.0,  // Large for overlapping haze
        map: fogParticleTexture,
        transparent: true,
        opacity: 0.04,  // Very low - many overlapping create density
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: true
    });

    dustParticles = new THREE.Points(hazeGeom, hazeMat);
    spiralGroup.add(dustParticles);

    // === LAYER 2: VISIBLE DUST MOTES ===
    // Smaller, slightly more visible - the "specks" you see in projector beams

    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustParticleCount2 * 3);
    const dustVelocities = new Float32Array(dustParticleCount2 * 3);

    for (let i = 0; i < dustParticleCount2; i++) {
        // Distribute along Z-axis, more concentrated in center of beam
        const z = relativeBackLightZ + Math.random() * beamLength;
        const depthRatio = (z - relativeBackLightZ) / beamLength;
        // Smaller radius, more center-weighted for visible dust specks
        const radiusAtZ = (2 + beamConeRadius * 0.5 * depthRatio) * Math.pow(Math.random(), 1.5);
        const angle = Math.random() * Math.PI * 2;

        dustPositions[i * 3] = Math.cos(angle) * radiusAtZ;
        dustPositions[i * 3 + 1] = Math.sin(angle) * radiusAtZ;
        dustPositions[i * 3 + 2] = z;

        // Slightly faster forward drift with more turbulence
        dustVelocities[i * 3] = (Math.random() - 0.5) * 0.02;
        dustVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        dustVelocities[i * 3 + 2] = Math.random() * 0.04 + 0.025;  // Forward drift
    }

    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeom.userData = { velocities: dustVelocities };

    // Dust mote material - visible floating specks
    const dustMat = new THREE.PointsMaterial({
        color: 0xffeedd,
        size: 6.0,  // Medium size motes
        map: fogParticleTexture,
        transparent: true,
        opacity: 0.035,  // Very subtle - overlap creates density
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: true
    });

    dustParticles2 = new THREE.Points(dustGeom, dustMat);
    spiralGroup.add(dustParticles2);

    // === VISIBLE LIGHT SOURCE GLOW (BEHIND CARDS) ===
    // Glowing orb at the backlight position for visual anchor
    const glowGeom = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const lightGlow = new THREE.Mesh(glowGeom, glowMat);
    lightGlow.position.set(0, 0, backLightZ - spiralCenterZ);  // Behind cards
    spiralGroup.add(lightGlow);

    // Soft halo around light source
    const haloGeom = new THREE.SphereGeometry(25, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
    });
    const lightHalo = new THREE.Mesh(haloGeom, haloMat);
    lightHalo.position.set(0, 0, backLightZ - spiralCenterZ);  // Behind cards
    spiralGroup.add(lightHalo);

    // === VOLUMETRIC CONE (backlit projector beam) ===
    // Cone pointing from behind toward camera (along Z-axis)
    // Small radius at back (light source), expands toward camera
    const beamGeom = new THREE.CylinderGeometry(
        beamConeRadius * 1.2,  // Wide end (toward camera)
        3,                      // Narrow end (at light source)
        beamLength,
        32, 1, true
    );
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const beamCone = new THREE.Mesh(beamGeom, beamMat);
    // Rotate to point along Z-axis (from -Z toward +Z)
    beamCone.rotation.x = Math.PI / 2;
    // Position at midpoint between light and camera
    beamCone.position.set(0, 0, (backLightZ - spiralCenterZ + cameraZ - spiralCenterZ) / 2);
    spiralGroup.add(beamCone);

    // Inner core - brighter center of beam
    const innerBeamGeom = new THREE.CylinderGeometry(
        beamConeRadius * 0.5,  // Wide end
        1,                      // Narrow end
        beamLength,
        32, 1, true
    );
    const innerBeamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const innerBeamCone = new THREE.Mesh(innerBeamGeom, innerBeamMat);
    innerBeamCone.rotation.x = Math.PI / 2;
    innerBeamCone.position.set(0, 0, (backLightZ - spiralCenterZ + cameraZ - spiralCenterZ) / 2);
    spiralGroup.add(innerBeamCone);

    // Spotlight for backlit scene lighting - positioned behind, pointing toward camera
    beamSpotlight = new THREE.SpotLight(0xffeedd, 60, 400, Math.PI / 4, 0.7, 1.5);
    // Position behind the cards (relative to spiralGroup at z=-600)
    beamSpotlight.position.set(0, 0, backLightZ - spiralCenterZ);  // z=-300 relative
    // Point toward camera position (relative: z=20 puts target at world z=-580)
    beamSpotlight.target.position.set(0, 0, cameraZ - spiralCenterZ);  // z=20 relative
    spiralGroup.add(beamSpotlight);
    spiralGroup.add(beamSpotlight.target);

    // Create all cards
    carouselData.forEach((data, index) => {
        const card = create3DCard(data, index);
        card3DArray.push(card);
        spiralGroup.add(card);
    });

    // Initial positioning
    updateCard3DPositions(-4);
}

function updateCard3DPositions(progress) {
    const towerRadius = 14;        // World units - 1.75x
    const verticalSpacing = 15.75; // World units - 1.75x
    const anglePerCard = Math.PI / 2;  // 90 degrees

    card3DArray.forEach((card, index) => {
        const offset = index - progress;
        const angle = offset * anglePerCard;

        // Helical position
        const x = Math.sin(angle) * towerRadius;
        const z = Math.cos(angle) * towerRadius - towerRadius;
        const y = -offset * verticalSpacing;  // Negative so cards come from below

        card.position.set(x, y, z);
        card.rotation.y = angle;
        card.rotation.x = offset * -0.035;  // Subtle tilt

        // Scale based on distance
        const dist = Math.abs(offset);
        const scale = Math.max(0.6, 1.0 - dist * 0.06);
        card.scale.setScalar(scale);

        // Opacity and holographic shimmer via material
        const targetOpacity = Math.max(0.3, 1 - dist * 0.15);
        if (card.userData.frontMaterial) {
            card.userData.frontMaterial.opacity = targetOpacity;

            // Subtle holographic color shimmer based on rotation
            if (card.userData.baseColor) {
                const hueShift = Math.sin(angle * 2) * 0.08;
                const hsl = {};
                card.userData.baseColor.getHSL(hsl);
                hsl.h = (hsl.h + hueShift + 1) % 1;
                card.userData.frontMaterial.color.setHSL(hsl.h, hsl.s, hsl.l);
                card.userData.frontMaterial.emissive.setHSL(hsl.h, hsl.s * 0.5, hsl.l * 0.3);
            }
        }
    });
}

// --- Spiral Logic (Zero-Gravity Diagonal Showcase) - LEGACY HTML VERSION ---

function initSpiral() {
    let spiralView = document.querySelector('.spiral-view');
    if (!spiralView) {
        spiralView = document.createElement('div');
        spiralView.className = 'spiral-view';
        document.body.appendChild(spiralView);
    }

    carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';
    spiralView.appendChild(carouselContainer);

    carouselTrack = document.createElement('div');
    carouselTrack.className = 'carousel-track';
    carouselContainer.appendChild(carouselTrack);

    // Create all cards
    carouselData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'carousel-card visible';
        card.dataset.index = index;

        // Create card content using DOM methods
        const imagePlaceholder = document.createElement('div');
        imagePlaceholder.className = 'card-image-placeholder';
        imagePlaceholder.style.background = item.color;

        const content = document.createElement('div');
        content.className = 'card-content';

        const genreTag = document.createElement('div');
        genreTag.className = 'genre-tag';
        genreTag.textContent = 'GENRE';

        const title = document.createElement('h3');
        title.textContent = item.title;

        content.appendChild(genreTag);
        content.appendChild(title);
        card.appendChild(imagePlaceholder);
        card.appendChild(content);

        // Add 3D edge elements for glass shard depth
        // Key: position OUTSIDE the card, rotate around the edge that touches the card
        const edgeDepth = 30; // thickness in pixels

        const rightEdge = document.createElement('div');
        rightEdge.style.cssText = `
            position: absolute;
            top: 0;
            left: 100%;
            width: ${edgeDepth}px;
            height: 100%;
            background: linear-gradient(to right, rgba(60,60,70,0.9), rgba(20,20,25,0.9));
            transform: rotateY(90deg);
            transform-origin: left center;
            border-radius: 0 8px 8px 0;
        `;
        card.appendChild(rightEdge);

        const leftEdge = document.createElement('div');
        leftEdge.style.cssText = `
            position: absolute;
            top: 0;
            right: 100%;
            width: ${edgeDepth}px;
            height: 100%;
            background: linear-gradient(to left, rgba(60,60,70,0.9), rgba(20,20,25,0.9));
            transform: rotateY(-90deg);
            transform-origin: right center;
            border-radius: 8px 0 0 8px;
        `;
        card.appendChild(leftEdge);

        const topEdge = document.createElement('div');
        topEdge.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 0;
            width: 100%;
            height: ${edgeDepth}px;
            background: linear-gradient(to top, rgba(80,80,90,0.9), rgba(40,40,45,0.9));
            transform: rotateX(-90deg);
            transform-origin: bottom center;
            border-radius: 8px 8px 0 0;
        `;
        card.appendChild(topEdge);

        const bottomEdge = document.createElement('div');
        bottomEdge.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            width: 100%;
            height: ${edgeDepth}px;
            background: linear-gradient(to bottom, rgba(30,30,35,0.9), rgba(10,10,12,0.9));
            transform: rotateX(90deg);
            transform-origin: top center;
            border-radius: 0 0 8px 8px;
        `;
        card.appendChild(bottomEdge);

        carouselTrack.appendChild(card);
    });

    // Initial positioning - first card in spotlight
    updateCardPositions(0);

    // Start zero-gravity animation loop
    if (!carouselAnimating) {
        carouselAnimating = true;
        animateCarousel();
    }
}

// Update card positions based on current focus progress
function updateCardPositions(progress) {
    const cards = document.querySelectorAll('.carousel-card');
    const totalCards = cards.length;

    // Helical spiral around tower parameters (doubled for larger cards)
    const towerRadius = 800;      // Distance from center pillar
    const verticalSpacing = 900;  // Vertical distance between cards (doubled)
    const anglePerCard = Math.PI / 2;  // 90 degrees per card - so 2 cards = 180° (back to front)

    cards.forEach((card, index) => {
        // Offset from current focus (can be fractional for smooth animation)
        const offset = index - progress;

        // HELICAL POSITION: Spiral around invisible tower
        // offset +2 = 180° = back of card visible (entering from below/behind)
        // offset +1 = 90° = side view
        // offset 0 = 0° = front facing camera (spotlight)
        // offset -1 = -90° = side view (exiting)
        // offset -2 = -180° = back visible (exiting top)
        const angle = offset * anglePerCard;

        // Position on the helix - consistent spiral path
        const x = Math.sin(angle) * towerRadius;
        const z = Math.cos(angle) * towerRadius - towerRadius; // Shift so front card is at z=0
        const y = offset * verticalSpacing; // Positive offset = below screen

        // ROTATION: Face outward from tower (perpendicular to radius)
        const rotY = angle * (180 / Math.PI);
        // Subtle tilt following the spiral curve
        const rotX = offset * -2;

        // SCALE & OPACITY: Keep cards visible longer to see the back
        const distanceFromCenter = Math.abs(offset);
        const scale = Math.max(0.6, 1.0 - distanceFromCenter * 0.06);
        // Cards stay more visible so we can see backs
        const opacity = Math.max(0.3, 1 - distanceFromCenter * 0.15);

        // Z-INDEX: Based on Z position (closer to camera = higher)
        const zIndex = Math.floor(50 + z / 10);

        card.style.transform = `
            translate3d(${x}px, ${y}px, ${z}px)
            rotateY(${rotY}deg)
            rotateX(${rotX}deg)
            scale(${scale})
        `;
        card.style.opacity = opacity;
        card.style.zIndex = Math.max(1, zIndex);
    });
}

// Zero-gravity animation loop - smooth interpolation
function animateCarousel() {
    if (!carouselAnimating) return;

    // Smooth interpolation (floaty feel, but responsive enough to see path)
    const diff = targetFocusProgress - focusProgress;
    focusProgress += diff * 0.04; // Slightly faster for better path visibility

    // Update appropriate system based on mode
    if (inSpiral3D) {
        updateCard3DPositions(focusProgress);
    } else {
        updateCardPositions(focusProgress);
    }
    requestAnimationFrame(animateCarousel);
}

function handleSpiralScroll(delta) {
    // Slow scroll response (zero gravity feel)
    targetFocusProgress += delta * 0.003;

    // Clamp to valid range
    const totalCards = carouselData.length;
    const startProgress = -4; // Where cards start (well below screen)
    const maxProgress = totalCards + 2;

    targetFocusProgress = Math.max(startProgress, Math.min(targetFocusProgress, maxProgress));

    // Reverse back to TV if scrolling back past start
    if (targetFocusProgress <= startProgress + 0.1 && delta < 0) {
        triggerReverseTransition();
    }
}

// Reverse transition back to TV scene - smooth pullback through screen
function triggerReverseTransition() {
    if (transitioning) return;
    transitioning = true;

    const canvasContainer = document.getElementById('canvas-container');

    // Fade to black
    canvasContainer.style.opacity = '0';

    // Brief black frame beat
    setTimeout(() => {
        // Hide 3D spiral
        if (inSpiral3D) {
            spiralGroup.visible = false;
            inSpiral3D = false;
        }

        // Turn TV lights back on
        if (tvScreenGlow) tvScreenGlow.intensity = 30;
        if (tvForwardLight) tvForwardLight.intensity = 60;

        // Show floor, wall, and TV again
        if (floorMesh) floorMesh.visible = true;
        if (wallMesh) wallMesh.visible = true;
        if (tvGroup) tvGroup.visible = true;

        // Disable god rays
        godRaysEnabled = false;
        if (godRaysPass) godRaysPass.enabled = false;
        if (lightSourceMesh) lightSourceMesh.visible = false;

        // Reset bloom to TV settings
        if (bloomPass) {
            bloomPass.strength = 0.25;
            bloomPass.radius = 0.35;
            bloomPass.threshold = 0.88;
        }

        // Reset fog to normal density
        if (scene.fog) scene.fog.density = 0.00045;

        // Also hide HTML spiral view if it was visible
        const spiralView = document.querySelector('.spiral-view');
        if (spiralView) {
            spiralView.classList.remove('active', 'visible');
            spiralView.style.display = 'none';
        }

        // Use exact scrollZ from forward transition - symmetrical
        const startZ = 950;
        const endZ = -650;

        scrollZ = transitionScrollZ;
        inIntro = true;
        transitioning = false;

        // Set camera position to match stored scrollZ
        const progress = scrollZ / maxZ;
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        camera.position.z = startZ + (endZ - startZ) * easeProgress;
        camera.lookAt(0, -130, -600);

        // Fade back in
        canvasContainer.style.opacity = '1';
    }, 80);
}

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    staticUniforms.time.value = time;

    // Rotate TV slightly for 3D effect
    if (inIntro && tvGroup) {
        tvGroup.rotation.y = Math.sin(time * 0.5) * 0.05;
    }

    // === PROJECTOR FLICKER ANIMATION ===
    // Cinematic projector effect with subtle intensity variation
    if (inSpiral3D) {
        // Base flicker: gentle sine wave variation (projector hum)
        const baseFlicker = 1.0 + Math.sin(time * 12) * 0.015;

        // Secondary frequency for organic feel
        const secondFlicker = 1.0 + Math.sin(time * 7.3) * 0.01;

        // Occasional random micro-flicker (film gate flutter)
        const microFlicker = 1.0 + (Math.random() - 0.5) * 0.02;

        // Combine flicker components
        const flickerMultiplier = baseFlicker * secondFlicker * microFlicker;

        // Apply to beam spotlight
        if (beamSpotlight) {
            beamSpotlight.intensity = 30 * flickerMultiplier;
        }

        // Apply to god rays exposure for visible light variation
        if (godRaysMaterial) {
            godRaysMaterial.uniforms.exposure.value = 0.85 * flickerMultiplier;
        }

        // Subtle light source pulsing (projector lamp warmth)
        if (lightSourceMesh) {
            const pulseScale = 1.0 + Math.sin(time * 3) * 0.03;
            lightSourceMesh.scale.setScalar(pulseScale);
        }
    }

    // Animate fog particles in spiral mode (both layers)
    if (inSpiral3D) {
        // Layer 1: Soft haze (drifting toward camera along Z-axis)
        if (dustParticles) {
            const positions = dustParticles.geometry.attributes.position.array;
            const velocities = dustParticles.geometry.userData.velocities;
            const relBackZ = backLightZ - spiralCenterZ;  // -300
            const relCamZ = cameraZ - spiralCenterZ;       // 20

            for (let i = 0; i < dustParticleCount; i++) {
                // Apply velocity (mainly forward along Z)
                positions[i * 3] += velocities[i * 3];
                positions[i * 3 + 1] += velocities[i * 3 + 1];
                positions[i * 3 + 2] += velocities[i * 3 + 2];

                // Gentle XY turbulence for haze
                positions[i * 3] += Math.sin(time * 0.8 + i * 0.1) * 0.003;
                positions[i * 3 + 1] += Math.cos(time * 0.6 + i * 0.15) * 0.003;

                // Reset particle if it passes camera (Z > relCamZ)
                const z = positions[i * 3 + 2];
                if (z > relCamZ) {
                    // Reset to near light source
                    positions[i * 3 + 2] = relBackZ + Math.random() * 30;
                    const depthRatio = 0.1;  // Near light source
                    const radiusAtZ = (3 + beamConeRadius * depthRatio) * Math.sqrt(Math.random());
                    const angle = Math.random() * Math.PI * 2;
                    positions[i * 3] = Math.cos(angle) * radiusAtZ;
                    positions[i * 3 + 1] = Math.sin(angle) * radiusAtZ;
                }
            }
            dustParticles.geometry.attributes.position.needsUpdate = true;
        }

        // Layer 2: Dust motes (faster, drifting toward camera)
        if (dustParticles2) {
            const positions2 = dustParticles2.geometry.attributes.position.array;
            const velocities2 = dustParticles2.geometry.userData.velocities;
            const relBackZ = backLightZ - spiralCenterZ;
            const relCamZ = cameraZ - spiralCenterZ;

            for (let i = 0; i < dustParticleCount2; i++) {
                // Apply velocity (mainly forward along Z)
                positions2[i * 3] += velocities2[i * 3];
                positions2[i * 3 + 1] += velocities2[i * 3 + 1];
                positions2[i * 3 + 2] += velocities2[i * 3 + 2];

                // More turbulent XY movement for dust motes
                positions2[i * 3] += Math.sin(time * 2.5 + i * 0.3) * 0.005;
                positions2[i * 3 + 1] += Math.cos(time * 2.2 + i * 0.25) * 0.005;

                // Reset particle if it passes camera
                const z = positions2[i * 3 + 2];
                if (z > relCamZ) {
                    positions2[i * 3 + 2] = relBackZ + Math.random() * 30;
                    const depthRatio = 0.1;
                    const radiusAtZ = (2 + beamConeRadius * 0.5 * depthRatio) * Math.pow(Math.random(), 1.5);
                    const angle = Math.random() * Math.PI * 2;
                    positions2[i * 3] = Math.cos(angle) * radiusAtZ;
                    positions2[i * 3 + 1] = Math.sin(angle) * radiusAtZ;
                }

                // Keep within cone bounds based on Z position
                const depthRatio = (z - relBackZ) / beamLength;
                const maxRadius = 3 + beamConeRadius * depthRatio;
                const currentRadius = Math.sqrt(
                    positions2[i * 3] * positions2[i * 3] +
                    positions2[i * 3 + 1] * positions2[i * 3 + 1]
                );
                if (currentRadius > maxRadius * 0.9) {
                    const scale = maxRadius / currentRadius * 0.8;
                    positions2[i * 3] *= scale;
                    positions2[i * 3 + 1] *= scale;
                }
            }
            dustParticles2.geometry.attributes.position.needsUpdate = true;
        }
    }

    smokeUniforms.uTime.value = time;
    smokeUniforms.uMouse.value.set(mouseX, mouseY);

    // === GOD RAYS RENDERING ===
    // Only do god rays when fully in spiral mode with all systems ready
    const shouldRenderGodRays = inSpiral3D && godRaysEnabled &&
                                 godRaysMaterial && occlusionRenderTarget &&
                                 lightSourceMesh && spiralGroup && spiralGroup.visible;

    if (shouldRenderGodRays) {
        // Update light screen position for radial blur center
        updateLightScreenPosition();

        // Render occlusion pass (light source bright, rest black)
        renderOcclusionPass();
    }

    // Render the scene (god rays pass will be applied if enabled in composer)
    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    staticUniforms.resolution.value.set(window.innerWidth, window.innerHeight);

    // Resize occlusion render target for god rays
    if (occlusionRenderTarget) {
        occlusionRenderTarget.setSize(
            Math.floor(window.innerWidth / 2),
            Math.floor(window.innerHeight / 2)
        );
    }
}

function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = (event.clientY / window.innerHeight) * 2 - 1;
}
