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
        updateCardText(focusProgress); // Check for text wipe
    } else {
        updateCardPositions(focusProgress);
    }
    requestAnimationFrame(animateCarousel);
}

// Text Swap Logic for "Wipe" Effect
// Swaps text exactly when a card passes the center point
let currentTextIndex = -1;
const phrases = [
    "FRESH PRODUCE",
    "CINEMATIC",
    "IMMERSIVE",
    "STORYTELLING",
    "DIGITAL",
    "EXPERIENCE"
];

function updateCardText(progress) {
    if (!textMesh || !loadedFont) return;

    // Determine which "card index" is currently passing center (progress tracks card index)
    // When progress is near an integer, that card is at center
    // We trigger the swap when the card covers the text (approx progress = index)

    const centerIndex = Math.round(progress);

    // Check if we have crossed a new integer threshold (card passing center)
    if (centerIndex !== currentTextIndex) {
        // Swap text!
        currentTextIndex = centerIndex;

        // Cycle through phrases
        // Use absolute value to handle negative progress (scrolling up)
        const phraseIndex = Math.abs(centerIndex) % phrases.length;
        const newText = phrases[phraseIndex];

        // Dispose old geometry
        textMesh.geometry.dispose();

        // Create new geometry
        const textGeometry = new THREE.TextGeometry(newText, {
            font: loadedFont,
            size: 12,
            height: 0.5,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.05,
            bevelSegments: 3
        });

        // Center it
        textGeometry.computeBoundingBox();
        const centerOffset = (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) / 2;

        textMesh.geometry = textGeometry;
        // Keep same Z/Y, just update X centering
        textMesh.position.x = -centerOffset;
    }
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

    smokeUniforms.uTime.value = time;
    smokeUniforms.uMouse.value.set(mouseX, mouseY);

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
