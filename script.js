// Fresh Produce Media - Full 3D Cinematic Scene
// Procedural 3D TV & Spiral Transition

// --- Global Variables ---
let scene, camera, renderer, composer;
let tvGroup, screenMesh, textMesh;
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
    { title: "NARRATIVE", color: "#FF3366", image: "assets/placeholder1.jpg" },
    { title: "DOCUMENTARY", color: "#33CCFF", image: "assets/placeholder2.jpg" },
    { title: "FICTION", color: "#FFCC33", image: "assets/placeholder3.jpg" },
    { title: "BRANDED", color: "#33FF99", image: "assets/placeholder4.jpg" },
    { title: "ORIGINALS", color: "#CC33FF", image: "assets/placeholder5.jpg" },
    { title: "EXPERIMENTAL", color: "#FF6633", image: "assets/placeholder6.jpg" },
    { title: "IMMERSIVE", color: "#3366FF", image: "assets/placeholder7.jpg" },
    { title: "AUDIO", color: "#FF33CC", image: "assets/placeholder8.jpg" }
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
        initSpiral();

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

            const bloomPass = new THREE.UnrealBloomPass(
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
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -180;
    floor.receiveShadow = true;
    scene.add(floor);

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
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, 300, -900);
    wall.receiveShadow = true;
    scene.add(wall);
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
    const screenGlow = new THREE.PointLight(0xeeeeff, 30, 300, 2);
    screenGlow.position.set(0, 0, 45); // At screen surface
    tvGroup.add(screenGlow);

    // Forward light path - SpotLight casting towards viewer
    const forwardLight = new THREE.SpotLight(0xddeeff, 60, 800, Math.PI / 6, 0.6, 2);
    forwardLight.position.set(0, -20, 50); // Bottom of screen, facing forward
    forwardLight.target.position.set(0, -100, 400); // Aim forward and down
    tvGroup.add(forwardLight);
    tvGroup.add(forwardLight.target);

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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 256;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 100px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText('FRESH PRODUCE', canvas.width / 2, canvas.height / 2);

    const textTexture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
    const textGeometry = new THREE.PlaneGeometry(100, 25);
    textMesh = new THREE.Mesh(textGeometry, textMaterial);

    // Adjusted Position: Higher and Forward to avoid clipping floor
    textMesh.position.set(0, -55, 60);
    // Tilted slightly up to face camera
    textMesh.rotation.x = -Math.PI / 12;

    tvGroup.add(textMesh);
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

    // Instant cut to black - hide 3D canvas immediately
    document.getElementById('canvas-container').style.display = 'none';

    // Show black screen (spiral view with opacity 0 initially)
    const spiralView = document.querySelector('.spiral-view');
    spiralView.classList.add('visible');
    spiralView.style.opacity = '0'; // Pure black

    // After black frame, make spiral visible but positioned below screen
    setTimeout(() => {
        spiralView.style.opacity = '1';
        spiralView.classList.add('active');
        initSpiralStartPosition();
        transitioning = false;
    }, 80); // Brief black frame
}

// Initialize spiral at starting position - far below screen
// User must scroll to bring it up
function initSpiralStartPosition() {
    const helixRadius = 600;
    carouselTrack.dataset.scrollY = -600; // Start way below
    rotation = 0;
    // Position helix far below so cards scroll in from bottom
    carouselTrack.style.transform = `translateZ(-${helixRadius}px) translateY(600px) rotateY(0deg)`;
}

function completeIntro() {
    inIntro = false;
    document.getElementById('canvas-container').style.pointerEvents = 'none';
    document.querySelector('.spiral-view').classList.add('visible');
    document.querySelector('.spiral-view').classList.add('active');
}

// --- Spiral Logic (Single-Strand DNA Helix) ---

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

    // DNA Helix parameters
    const helixRadius = 600;        // Tighter than before for drill feel
    const verticalPitch = 350;      // Vertical distance per card
    const totalCards = carouselData.length;

    carouselData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'carousel-card visible';
        card.innerHTML = `
            <div class="card-image-placeholder" style="background: ${item.color}"></div>
            <div class="card-content">
                <div class="genre-tag">GENRE</div>
                <h3>${item.title}</h3>
            </div>
        `;

        // Single helix: each card spirals upward
        // Full rotation spread across cards for continuous spiral effect
        const angle = (index / totalCards) * Math.PI * 2 * 2; // 2 full rotations total
        const x = Math.sin(angle) * helixRadius;
        const z = Math.cos(angle) * helixRadius - helixRadius; // Center behind viewer
        const y = index * verticalPitch; // Spiral upward

        // Face outward from helix center (perpendicular to radius)
        const rotationY = (angle * 180 / Math.PI) + 90;

        card.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotationY}deg)`;
        carouselTrack.appendChild(card);
    });
}

function handleSpiralScroll(delta) {
    // Track spiral scroll position
    if (!carouselTrack.dataset.scrollY) carouselTrack.dataset.scrollY = 0;
    let currentY = parseFloat(carouselTrack.dataset.scrollY) + delta * 0.6;

    // If scrolling back past the start, reverse to TV scene
    if (currentY < -100 && delta < 0) {
        triggerReverseTransition();
        return;
    }

    carouselTrack.dataset.scrollY = currentY;

    // Rotate the helix (drilling motion)
    rotation += delta * 0.002;

    // Combined transform: translate (move through) + rotate (drill) = ascending helix
    const helixRadius = 600;
    carouselTrack.style.transform =
        `translateZ(-${helixRadius}px) translateY(${-currentY}px) rotateY(${rotation}rad)`;
}

// Reverse transition back to TV scene
function triggerReverseTransition() {
    if (transitioning) return;
    transitioning = true;

    // Hide spiral instantly - cut to black
    const spiralView = document.querySelector('.spiral-view');
    spiralView.style.opacity = '0';

    // Brief black frame beat
    setTimeout(() => {
        spiralView.classList.remove('active', 'visible');

        // Show canvas again
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.style.display = 'block';
        canvasContainer.style.opacity = '1';

        // Reset scroll state - position camera just before screen plane
        // Calculate scrollZ that puts camera just before screen plane
        const startZ = 950;
        const endZ = -650;
        const targetCameraZ = screenPlaneZ + 50; // Just before screen
        // Reverse the easing math to find scrollZ
        // For simplicity, estimate scrollZ at about 70% progress
        scrollZ = maxZ * 0.68;
        inIntro = true;
        transitioning = false;

        // Update camera position
        const progress = scrollZ / maxZ;
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        camera.position.z = startZ + (endZ - startZ) * easeProgress;
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
