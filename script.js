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
let spiralTextMesh = null;     // Current text at spiral center
let spiralTextMeshNext = null; // Next text (for wipe transition)
let wipeClipPlane = null;      // Clipping plane for text wipe
let wipeClipPlaneInverse = null; // Inverse clipping plane

// Raycaster for hover interaction
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
let hoveredCard = null;  // Currently hovered card

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
        renderer.localClippingEnabled = true; // Enable clipping planes for text wipe
        renderer.toneMappingExposure = 0.8; // Balanced exposure
        container.appendChild(renderer.domElement);

        // Post-processing
        setupPostProcessing();

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
                0.4, 0.8, 0.5 // Strength, Radius, Threshold - ethereal soft glow
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
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', function (font) {
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
        // Hide CSS spiral view (using 3D version)
        const spiralView = document.querySelector('.spiral-view');
        if (spiralView) spiralView.style.display = 'none';

        // Show 3D spiral group
        spiralGroup.visible = true;
        inSpiral3D = true;

        // Show spiral center text (both for wipe effect)
        if (spiralTextMesh) spiralTextMesh.visible = true;
        if (spiralTextMeshNext) spiralTextMeshNext.visible = true;
        lastCompletedWipe = -1;  // Reset wipe tracking

        // Turn off TV lights
        if (tvScreenGlow) tvScreenGlow.intensity = 0;
        if (tvForwardLight) tvForwardLight.intensity = 0;

        // Hide floor and wall for "floating in void" feel
        if (floorMesh) floorMesh.visible = false;
        if (wallMesh) wallMesh.visible = false;
        if (tvGroup) tvGroup.visible = false;

        // Reposition camera for spiral viewing
        camera.position.set(0, -130, -580);
        camera.lookAt(0, -130, -600);

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

// Create radial gradient glow texture for sprite
function createGlowTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Parse color to RGB
    const tempColor = new THREE.Color(color);
    const r = Math.floor(tempColor.r * 255);
    const g = Math.floor(tempColor.g * 255);
    const b = Math.floor(tempColor.b * 255);

    // Reduce center intensity for bright colors (prevents hotspot through glass)
    const luminance = 0.299 * tempColor.r + 0.587 * tempColor.g + 0.114 * tempColor.b;
    const maxChannel = Math.max(tempColor.r, tempColor.g, tempColor.b);
    const brightness = 0.5 * luminance + 0.5 * maxChannel;
    // Bright colors get lower center opacity (0.5 for bright, 1.0 for dark)
    const centerOpacity = Math.max(0.5, 1.0 - brightness * 0.6);

    // Radial gradient from center outward - adaptive glow
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${centerOpacity})`);
    gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${centerOpacity * 0.6})`);
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${centerOpacity * 0.25})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
}

function create3DCard(data, index) {
    const group = new THREE.Group();

    // Card dimensions (world units) - match CSS proportions
    const width = 14;       // ~800px equivalent
    const height = 8.75;    // ~500px equivalent
    const depth = 0.75;     // Thinner profile

    const cardColor = new THREE.Color(data.color);

    // === LAYER 0: COLORED MAIN BODY (liquid glass aesthetic) ===
    const bodyGeometry = new THREE.RoundedBoxGeometry(width, height, depth, 8, 0.8);
    // Liquid glass effect with transmission for see-through translucency
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color: cardColor,          // Tint the glass
        transmission: 0.7,         // Glass-like see-through
        thickness: 0.5,            // Refraction depth
        roughness: 0.15,           // Mostly clear glass
        ior: 1.5,                  // Index of refraction (standard glass)
        emissive: cardColor,       // Keep colored glow
        emissiveIntensity: 0.4,    // Reduced since transmission adds color
        transparent: true,
        depthWrite: true,          // Write to depth buffer for proper occlusion
        side: THREE.DoubleSide
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.userData.isCardBody = true;  // Tag for raycasting detection
    group.add(bodyMesh);

    // === OCCLUDER - solid version of card (no transmission) for text wipe ===
    // Matches card appearance but blocks see-through
    const occluderGeometry = new THREE.PlaneGeometry(width - 0.3, height - 0.3);
    const occluderMaterial = new THREE.MeshPhysicalMaterial({
        color: cardColor,
        emissive: cardColor,
        emissiveIntensity: 0.4,
        roughness: 0.15,
        metalness: 0,
        // NO transmission - this is the key difference
        transparent: false,
        side: THREE.DoubleSide
    });
    const occluderMesh = new THREE.Mesh(occluderGeometry, occluderMaterial);
    occluderMesh.position.z = 0; // Center of card
    group.add(occluderMesh);

    // === LAYER 1: GRAY SHELL wrapping entire card ===
    // const shellGeometry = new THREE.RoundedBoxGeometry(width + 0.1, height + 0.1, depth + 0.1, 8, 0.8);
    // const shellMaterial = new THREE.MeshStandardMaterial({
    //     color: 0x2a2a2f,
    //     transparent: true,
    //     opacity: 0.55,
    //     metalness: 0.05,
    //     roughness: 0.7,
    //     side: THREE.FrontSide
    // });
    // const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
    // group.add(shellMesh);

    // === LAYER 2: DARKER TITLE BAR - COMMENTED OUT (was causing front face darkening) ===
    const titleBarHeight = height * 0.35;
    // const titleBarGeometry = new THREE.PlaneGeometry(width - 0.2, titleBarHeight);
    // const darkTitleMaterial = new THREE.MeshStandardMaterial({
    //     color: 0x1a1a1f,
    //     transparent: true,
    //     opacity: 0.7,
    //     metalness: 0.05,
    //     roughness: 0.7,
    //     side: THREE.FrontSide
    // });
    // const frontTitleBar = new THREE.Mesh(titleBarGeometry, darkTitleMaterial);
    // frontTitleBar.position.set(0, -height / 2 + titleBarHeight / 2, depth / 2 + 0.06);
    // group.add(frontTitleBar);

    // // === LAYER 2: DARKER TITLE BAR - BACK ===
    // const backTitleBar = new THREE.Mesh(titleBarGeometry, darkTitleMaterial.clone());
    // backTitleBar.position.set(0, -height / 2 + titleBarHeight / 2, -depth / 2 - 0.06);
    // backTitleBar.rotation.y = Math.PI;
    // group.add(backTitleBar);

    // === POINT LIGHT with adaptive intensity ===
    // Luminance + maxChannel + aggressive penalties for green/yellow
    const luminance = 0.299 * cardColor.r + 0.587 * cardColor.g + 0.114 * cardColor.b;
    const maxChannel = Math.max(cardColor.r, cardColor.g, cardColor.b);
    const blendedFactor = 0.5 * luminance + 0.5 * maxChannel;
    // Aggressive penalties for bright colors, especially green and yellow
    const brightChannels = (cardColor.r > 0.7 ? 1 : 0) + (cardColor.g > 0.7 ? 1 : 0) + (cardColor.b > 0.7 ? 1 : 0);
    const greenPenalty = cardColor.g > 0.6 ? Math.pow(cardColor.g, 2) * 3 : 0;  // Exponential green penalty
    const yellowPenalty = (cardColor.r > 0.7 && cardColor.g > 0.7) ? 2 : 0;  // Extra for yellow (R+G)
    const multiChannelPenalty = brightChannels * 0.5 + greenPenalty + yellowPenalty;
    const adaptiveIntensity = Math.max(0.5, 10 * (1 - blendedFactor * 0.75) - multiChannelPenalty);
    const cardLight = new THREE.PointLight(cardColor, adaptiveIntensity, 30, 2);
    cardLight.position.set(0, 0, 0);
    group.add(cardLight);

    // === GLOW SPRITE - radiates soft aura into empty space ===
    const glowTexture = createGlowTexture(cardColor);
    const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(width * 2.5, height * 2.5, 1); // Larger than card for aura
    glowSprite.position.set(0, 0, -1); // Slightly behind card
    glowSprite.userData.baseScale = { x: width * 2.5, y: height * 2.5 }; // Store for hover
    group.add(glowSprite);

    // Store glow sprite reference for hover effects
    group.userData.glowSprite = glowSprite;
    group.userData.glowMaterial = glowMaterial;

    // === TITLE TEXT at bottom (front only) ===
    if (loadedFont) {
        const textGeometry = new THREE.TextGeometry(data.title, {
            font: loadedFont,
            size: 0.9,
            height: 0.06,
            curveSegments: 8,
            bevelEnabled: false
        });

        textGeometry.computeBoundingBox();
        const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        const centerX = -textWidth / 2;

        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const cardText = new THREE.Mesh(textGeometry, textMaterial);

        // Position centered in title bar
        cardText.position.set(centerX, -height / 2 + titleBarHeight / 2 - 0.3, depth / 2 + 0.1);
        group.add(cardText);
    }

    group.userData = { index, data, bodyMaterial, baseColor: cardColor.clone() };

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

    // Create all cards
    carouselData.forEach((data, index) => {
        const card = create3DCard(data, index);
        card3DArray.push(card);
        spiralGroup.add(card);
    });

    // Initial positioning
    updateCard3DPositions(-4);

    // Create spiral center text
    createSpiralText();
}

// Create text at the center of the spiral helix with wipe clipping
function createSpiralText() {
    if (!loadedFont) return;

    // Create clipping planes for wipe effect
    // Plane clips where normal.dot(point) + constant < 0
    // wipeClipPlane (-1,0,0): clips x > constant, shows x <= constant (current text, LEFT of wipe)
    // wipeClipPlaneInverse (1,0,0): clips x < -constant, shows x >= -constant (next text, RIGHT of wipe)
    wipeClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 50);  // Start showing all
    wipeClipPlaneInverse = new THREE.Plane(new THREE.Vector3(1, 0, 0), 50);  // Start hiding all

    // Current text (shown on LEFT of wipe line)
    const textGeometry = new THREE.TextGeometry(phrases[0], {
        font: loadedFont,
        size: 2.5,  // Small enough to fit behind card when it passes
        height: 0.15,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.03,
        bevelSegments: 3
    });
    textGeometry.computeBoundingBox();
    const centerOffset = (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) / 2;

    const textMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        clippingPlanes: [wipeClipPlane],
        clipShadows: true
    });
    spiralTextMesh = new THREE.Mesh(textGeometry, textMaterial);
    spiralTextMesh.position.set(-centerOffset, 0, -14);
    spiralTextMesh.userData.centerOffset = centerOffset;  // Store for wipe calculations
    spiralTextMesh.visible = false;
    spiralGroup.add(spiralTextMesh);

    // Next text (shown on RIGHT of wipe line)
    const nextTextGeometry = new THREE.TextGeometry(phrases[1], {
        font: loadedFont,
        size: 2.5,
        height: 0.15,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.03,
        bevelSegments: 3
    });
    nextTextGeometry.computeBoundingBox();
    const nextCenterOffset = (nextTextGeometry.boundingBox.max.x - nextTextGeometry.boundingBox.min.x) / 2;

    const nextTextMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        clippingPlanes: [wipeClipPlaneInverse],
        clipShadows: true
    });
    spiralTextMeshNext = new THREE.Mesh(nextTextGeometry, nextTextMaterial);
    spiralTextMeshNext.position.set(-nextCenterOffset, 0, -14);
    spiralTextMeshNext.userData.centerOffset = nextCenterOffset;  // Store for wipe calculations
    spiralTextMeshNext.visible = false;
    spiralGroup.add(spiralTextMeshNext);

    // Store phrase indices
    spiralTextMesh.userData.phraseIndex = 0;
    spiralTextMeshNext.userData.phraseIndex = 1;
}

function updateCard3DPositions(progress) {
    const towerRadius = 14;        // World units - 1.75x
    const verticalSpacing = 15.75; // World units - 1.75x
    const anglePerCard = Math.PI / 2;  // 90 degrees

    card3DArray.forEach((card, index) => {
        const offset = index - progress;
        const angle = offset * anglePerCard;

        // Asymmetric helical position - cards come closer when facing front
        // cos(angle) = 1 when facing camera, -1 when facing away
        const facingFactor = (Math.cos(angle) + 1) / 2;  // 0 to 1 (1 = facing front)
        const radiusMultiplier = 1 + facingFactor * 0.5;  // 1.0x to 1.5x when facing front
        const dynamicRadius = towerRadius * radiusMultiplier;

        const x = Math.sin(angle) * dynamicRadius;
        const z = Math.cos(angle) * dynamicRadius - towerRadius;
        const y = -offset * verticalSpacing;  // Negative so cards come from below

        // Apply hover float offset if card is hovered
        const floatOffset = card.userData.hoverFloatOffset || 0;
        card.position.set(x, y + floatOffset, z);
        card.rotation.y = angle;
        card.rotation.x = offset * -0.035;  // Subtle tilt

        // Scale based on distance
        const dist = Math.abs(offset);
        const scale = Math.max(0.6, 1.0 - dist * 0.06);
        card.scale.setScalar(scale);

        // Opacity via body material (no hue shift - keep colors consistent)
        const targetOpacity = Math.max(0.4, 1 - dist * 0.12);
        if (card.userData.bodyMaterial) {
            card.userData.bodyMaterial.opacity = targetOpacity;

            // Hyper-saturated colors - no angle-based shifting
            if (card.userData.baseColor) {
                const hsl = {};
                card.userData.baseColor.getHSL(hsl);
                // Boost saturation (hyper-saturate) - clamp to 1.0 max
                const hyperSat = Math.min(1.0, hsl.s * 1.5);
                card.userData.bodyMaterial.emissive.setHSL(hsl.h, hyperSat, hsl.l);
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
        updateSpiralText(focusProgress);  // Text wipe for spiral center
    } else {
        updateCardPositions(focusProgress);
    }
    requestAnimationFrame(animateCarousel);
}

// Text Wipe Effect - card-synced reveal
// As each card sweeps across, it wipes from one phrase to the next
let currentTextIndex = 0;
let lastCompletedWipe = -1;  // Track completed wipes for phrase cycling
// Phrases for spiral center text - one for each "slot" between cards
// 8 cards = 9 slots: initial + after each card passes
// Last phrase is always "FRESH PRODUCE"
const phrases = [
    "STANDOUT IP",      // Initial (before Big Fix passes)
    "BUILT TO SCALE",   // After Big Fix S2
    "CINEMATIC",        // After Blood Hound
    "IMMERSIVE",        // After The Signal
    "STORYTELLING",     // After Hit Singles
    "ORIGINAL",         // After The Boar's Nest
    "COMPELLING",       // After Coming Soon #1
    "VISIONARY",        // After Coming Soon #2
    "FRESH PRODUCE"     // After Coming Soon #3 (final)
];

function updateSpiralText(progress) {
    if (!spiralTextMesh || !loadedFont) return;

    // Simple approach: swap text when a card passes through center while in front
    // The card's solid occluder naturally hides the text during transition
    const textZ = -14;

    // Find the card that's most in front (highest z)
    let frontCardX = null;
    let highestZ = textZ;

    card3DArray.forEach((card) => {
        const cardZ = card.position.z;
        if (cardZ > highestZ) {
            highestZ = cardZ;
            frontCardX = card.position.x;
        }
    });

    // Track when the front card crosses center (x ≈ 0) while in front of text
    // This is when the text swap should happen - card is covering the text
    const cardIsCovering = highestZ > textZ && Math.abs(frontCardX) < 5;

    // Update phrase based on progress (each integer = one card passed)
    // Clamp to last phrase - no repeating
    const currentIndex = Math.floor(progress);
    if (currentIndex !== lastCompletedWipe && currentIndex >= 0) {
        lastCompletedWipe = currentIndex;
        // Clamp to phrases array bounds - stay on last phrase once reached
        const phraseIndex = Math.min(currentIndex, phrases.length - 1);
        updateTextMeshContent(spiralTextMesh, phrases[phraseIndex]);
    }

    // Hide the second text mesh - we're not using clipping anymore
    if (spiralTextMeshNext) {
        spiralTextMeshNext.visible = false;
    }
}

// Helper to update text mesh geometry
function updateTextMeshContent(mesh, text) {
    if (!mesh || !loadedFont) return;

    mesh.geometry.dispose();
    const textGeometry = new THREE.TextGeometry(text, {
        font: loadedFont,
        size: 2.5,  // Match createSpiralText size
        height: 0.15,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.03,
        bevelSegments: 3
    });
    textGeometry.computeBoundingBox();
    const centerOffset = (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) / 2;
    mesh.geometry = textGeometry;
    mesh.position.x = -centerOffset;
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

        // Hide spiral center text and reset wipe state
        if (spiralTextMesh) spiralTextMesh.visible = false;
        if (spiralTextMeshNext) spiralTextMeshNext.visible = false;
        lastCompletedWipe = -1;  // Reset for next entry

        // Turn TV lights back on
        if (tvScreenGlow) tvScreenGlow.intensity = 30;
        if (tvForwardLight) tvForwardLight.intensity = 60;

        // Show floor, wall, and TV again
        if (floorMesh) floorMesh.visible = true;
        if (wallMesh) wallMesh.visible = true;
        if (tvGroup) tvGroup.visible = true;

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

// --- Card Hover Interaction ---

function updateCardHover() {
    // Update raycaster with current mouse position
    mouseVec.set(mouseX, mouseY);
    raycaster.setFromCamera(mouseVec, camera);

    // Get all card body meshes for intersection testing
    const cardMeshes = [];
    card3DArray.forEach(card => {
        card.traverse(child => {
            if (child.isMesh && child.userData.isCardBody) {
                cardMeshes.push(child);
            }
        });
    });

    const intersects = raycaster.intersectObjects(cardMeshes);

    // Find which card group is being hovered
    let newHoveredCard = null;
    if (intersects.length > 0) {
        // Walk up to find the card group
        let obj = intersects[0].object;
        while (obj.parent && !card3DArray.includes(obj)) {
            obj = obj.parent;
        }
        if (card3DArray.includes(obj)) {
            newHoveredCard = obj;
        }
    }

    // Handle hover state changes
    if (newHoveredCard !== hoveredCard) {
        // Un-hover previous card
        if (hoveredCard) {
            applyHoverEffect(hoveredCard, false);
        }
        // Hover new card
        if (newHoveredCard) {
            applyHoverEffect(newHoveredCard, true);
        }
        hoveredCard = newHoveredCard;

        // Update cursor
        document.body.style.cursor = hoveredCard ? 'pointer' : 'default';
    }

    // Apply gentle float to hovered card
    if (hoveredCard && hoveredCard.userData.isHovered) {
        applyHoverFloat(hoveredCard);
    }
}

function applyHoverFloat(card) {
    const anim = card.userData.hoverAnim;
    if (!anim) return;

    // Initialize float phase if needed
    if (anim.floatPhase === undefined) {
        anim.floatPhase = Math.random() * Math.PI * 2;
    }

    // Very slow, gentle floating bob - applied as OFFSET to current position
    const time = clock.getElapsedTime();
    const floatY = Math.sin(time * 0.3 + anim.floatPhase) * 0.08;  // Slow and subtle

    // Store offset for use by updateCard3DPositions
    card.userData.hoverFloatOffset = floatY;
}

function applyHoverEffect(card, isHovered) {
    // Subtle, dreamy hover effects
    const targetScale = isHovered ? 1.05 : 1.0;        // Very subtle scale
    const targetGlowScale = isHovered ? 1.15 : 1.0;    // Gentle glow expansion
    const targetEmissiveBoost = isHovered ? 1.2 : 1.0; // Soft brightness increase

    // Use a simple lerp animation via userData
    if (!card.userData.hoverAnim) {
        card.userData.hoverAnim = {
            scale: card.scale.x,
            glowScale: 1.0,
            emissiveBoost: 1.0
        };
    }

    // Store hover state for reactive motion
    card.userData.isHovered = isHovered;

    // Start animation
    animateHover(card, targetScale, targetGlowScale, targetEmissiveBoost);
}

function animateHover(card, targetScale, targetGlowScale, targetEmissiveBoost) {
    const anim = card.userData.hoverAnim;
    const lerpFactor = 0.04;  // Slow, dreamy transitions
    const isUnhovering = targetScale < 1.02;

    function step() {
        // Lerp card scale
        anim.scale += (targetScale - anim.scale) * lerpFactor;
        card.scale.setScalar(anim.scale);

        // Lerp glow
        if (card.userData.glowSprite) {
            const baseScale = card.userData.glowSprite.userData.baseScale;
            anim.glowScale += (targetGlowScale - anim.glowScale) * lerpFactor;
            card.userData.glowSprite.scale.set(
                baseScale.x * anim.glowScale,
                baseScale.y * anim.glowScale,
                1
            );
        }

        // Lerp emissive intensity
        if (card.userData.bodyMaterial) {
            anim.emissiveBoost += (targetEmissiveBoost - anim.emissiveBoost) * lerpFactor;
            card.userData.bodyMaterial.emissiveIntensity = anim.emissiveBoost;
        }

        // Clear float offset when un-hovering
        if (isUnhovering && card.userData.hoverFloatOffset) {
            card.userData.hoverFloatOffset *= (1 - lerpFactor);  // Fade out smoothly
            if (Math.abs(card.userData.hoverFloatOffset) < 0.001) {
                card.userData.hoverFloatOffset = 0;
            }
        }

        // Continue animation if not close enough
        if (Math.abs(anim.scale - targetScale) > 0.001) {
            requestAnimationFrame(step);
        }
    }
    step();
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

    smokeUniforms.uTime.value = time;
    smokeUniforms.uMouse.value.set(mouseX, mouseY);

    // Card hover detection DISABLED for now
    // if (inSpiral3D && card3DArray.length > 0) {
    //     updateCardHover();
    // }

    // Update card positions every frame (for scroll-based positioning)
    if (inSpiral3D && card3DArray.length > 0) {
        updateCard3DPositions(focusProgress);
    }

    // Render the scene
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
}

function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = (event.clientY / window.innerHeight) * 2 - 1;
}
