// Fresh Produce Media - Full 3D Cinematic Scene
// Procedural 3D TV & Spiral Transition

// --- Global Variables ---
let scene, camera, renderer, composer;
let tvGroup, screenMesh, textMesh;
let clock = new THREE.Clock();
let mouseX = 0, mouseY = 0;

// Spiral Variables
let carouselContainer, carouselTrack;
let rotation = 0;
const radius = 1000;

// Scroll State
let scrollZ = 0;
const maxZ = 1500; // Longer scroll for dolly
const transitionZ = 1200; // Point where transition starts
let inIntro = true;

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
        scene.fog = new THREE.FogExp2(0x050505, 0.0015); // Blend floor into background

        // Camera
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
        camera.position.set(0, 20, 800); // Start far back, slightly elevated
        camera.lookAt(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true; // Enable shadows
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // Post-processing
        setupPostProcessing();

        // Lighting
        createLighting();

        // Create Environment (Floor)
        createEnvironment();

        // Create Procedural 3D TV
        createProceduralTV();

        // Create Smoke Shader
        createSmokeShader();

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
        if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
            composer = new THREE.EffectComposer(renderer);
            const renderPass = new THREE.RenderPass(scene, camera);
            composer.addPass(renderPass);
            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.8, 0.3, 0.85 // Strength, Radius, Threshold
            );
            composer.addPass(bloomPass);
        } else {
            composer = null;
        }
    } catch (e) {
        console.warn('Post-processing setup failed:', e);
        composer = null;
    }
}

function createLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambient);

    // Key Light (Spotlight)
    const spotLight = new THREE.SpotLight(0xffffff, 1.5);
    spotLight.position.set(100, 200, 200);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    scene.add(spotLight);

    // Rim Light (Blue-ish)
    const rimLight = new THREE.SpotLight(0x4444ff, 2);
    rimLight.position.set(-200, 100, -100);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // Screen Glow Light (from the TV itself)
    const screenLight = new THREE.PointLight(0xffffff, 0.5, 200);
    screenLight.position.set(0, 0, 20);
    scene.add(screenLight);
}

function createEnvironment() {
    // Reflective Floor
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.1,
        metalness: 0.5
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -60; // Below TV
    floor.receiveShadow = true;
    scene.add(floor);
}

function createProceduralTV() {
    tvGroup = new THREE.Group();

    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, // Dark grey plastic
        roughness: 0.6,
        metalness: 0.1
    });

    const bezelMaterial = new THREE.MeshStandardMaterial({
        color: 0x050505, // Black bezel
        roughness: 0.2,
        metalness: 0.5
    });

    // 1. Main Body (Box)
    const bodyGeom = new THREE.BoxGeometry(140, 100, 80);
    const body = new THREE.Mesh(bodyGeom, bodyMaterial);
    body.castShadow = true;
    tvGroup.add(body);

    // 2. Screen Bezel (Slightly smaller box, extruded front)
    const bezelGeom = new THREE.BoxGeometry(130, 90, 5);
    const bezel = new THREE.Mesh(bezelGeom, bezelMaterial);
    bezel.position.z = 40; // Front of body
    bezel.castShadow = true;
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
                vec3 color = vec3(noise * 0.8 + scanline);
                
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
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 20;
    ctx.fillText('FRESH PRODUCE', canvas.width / 2, canvas.height / 2);

    const textTexture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
    const textGeometry = new THREE.PlaneGeometry(100, 25);
    textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(0, -60, 40); // Below TV screen, front aligned
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
    if (inIntro) {
        event.preventDefault();
        scrollZ += event.deltaY * 0.5;
        if (scrollZ < 0) scrollZ = 0;

        // Dolly Camera
        // Move from 800 to 42.5 (screen Z)
        // We want to stop JUST before hitting the screen
        const targetZ = 800 - (scrollZ * 0.8);

        // Smooth camera movement
        camera.position.z += (targetZ - camera.position.z) * 0.1;

        // Slight rotation for "looking at" effect
        camera.lookAt(0, 0, 0);

        // Transition Logic
        if (scrollZ > transitionZ) {
            const progress = (scrollZ - transitionZ) / (maxZ - transitionZ);
            const opacity = 1 - Math.min(1, progress);

            renderer.domElement.style.opacity = opacity;

            if (scrollZ > maxZ) {
                completeIntro();
            }
        } else {
            renderer.domElement.style.opacity = 1;
        }
    } else {
        handleSpiralScroll(event.deltaY);
    }
}

function completeIntro() {
    inIntro = false;
    document.getElementById('canvas-container').style.pointerEvents = 'none';
    document.querySelector('.spiral-view').classList.add('visible');
    document.querySelector('.spiral-view').classList.add('active');
}

// --- Spiral Logic (Vertical Helix) ---

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

    const cardHeight = 216;
    const verticalGap = 50;
    const spiralHeightPerItem = cardHeight + verticalGap;

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

        const angle = (index / carouselData.length) * Math.PI * 2;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const y = index * spiralHeightPerItem;
        const rotationY = angle * (180 / Math.PI);

        card.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotationY}deg)`;
        carouselTrack.appendChild(card);
    });
}

function handleSpiralScroll(delta) {
    rotation -= delta * 0.002;
    const verticalMove = delta * 0.5;

    if (!carouselTrack.dataset.scrollY) carouselTrack.dataset.scrollY = 0;
    let currentY = parseFloat(carouselTrack.dataset.scrollY) - verticalMove;
    carouselTrack.dataset.scrollY = currentY;

    carouselTrack.style.transform = `translateZ(-${radius}px) translateY(${currentY}px) rotateY(${rotation}deg)`;
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
