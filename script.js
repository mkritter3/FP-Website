// Fresh Produce Media - Cinematic 3D TV Scene
// Scroll-driven camera dolly with god rays and atmospheric fog

// --- Global Variables ---
let scene, camera, renderer, composer;
let tvGroup, screenMesh, textMesh, textReflection;
let godRays = [];
let clock = new THREE.Clock();

// Scroll State
let scrollProgress = 0;
let targetScrollProgress = 0;
const cameraStart = { z: 400, y: 25 };  // Lower camera, looking up at TV
const cameraEnd = { z: 40, y: 40 };

// Static Shader Uniforms
const staticUniforms = {
    time: { value: 0 },
    resolution: { value: new THREE.Vector2() },
    brightness: { value: 1.0 }
};

// --- Initialization ---
init();

function init() {
    try {
        const container = document.getElementById('canvas-container');

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // Atmospheric Fog
        scene.fog = new THREE.FogExp2(0x000000, 0.004);

        // Camera
        camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, cameraStart.y, cameraStart.z);
        camera.lookAt(0, 15, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        // Post-processing (bloom for glow)
        setupPostProcessing();

        // Create Scene Elements
        createLighting();
        createFloor();
        createTV();
        createGodRays();
        createText();

        // Hide loader
        setTimeout(function() {
            const loader = document.getElementById('loading');
            if (loader) loader.classList.add('hidden');
        }, 800);

        // Events
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('wheel', onScroll, { passive: false });

        // Touch support
        let touchStartY = 0;
        window.addEventListener('touchstart', function(e) {
            touchStartY = e.touches[0].clientY;
        });
        window.addEventListener('touchmove', function(e) {
            const deltaY = touchStartY - e.touches[0].clientY;
            touchStartY = e.touches[0].clientY;
            handleScroll(deltaY * 2);
        }, { passive: true });

        // Start Loop
        animate();

        // Debug off
        const debugLog = document.getElementById('debug-log');
        if (debugLog) debugLog.style.display = 'none';

    } catch (e) {
        console.error(e);
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            debugLog.style.display = 'block';
            debugLog.textContent = 'ERROR: ' + e.message;
        }
    }
}

function setupPostProcessing() {
    try {
        if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
            composer = new THREE.EffectComposer(renderer);

            const renderPass = new THREE.RenderPass(scene, camera);
            composer.addPass(renderPass);

            // Bloom for god rays glow - subtle
            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.3,   // strength - reduced
                0.3,   // radius
                0.92   // threshold - higher = less bloom
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
    // Ambient - very dim for moody atmosphere
    const ambient = new THREE.AmbientLight(0xffffff, 0.02);
    scene.add(ambient);

    // Main light from TV screen (simulates CRT glow)
    const screenLight = new THREE.PointLight(0xffffff, 3, 500);
    screenLight.position.set(-12, 50, 80);
    scene.add(screenLight);

    // Secondary screen glow (fills the room)
    const fillLight = new THREE.PointLight(0xaabbcc, 1.5, 600);
    fillLight.position.set(0, 60, 150);
    scene.add(fillLight);

    // Subtle rim lights for depth and separation
    const rimLeft = new THREE.PointLight(0x334466, 0.3, 400);
    rimLeft.position.set(-200, 80, 100);
    scene.add(rimLeft);

    const rimRight = new THREE.PointLight(0x664433, 0.2, 400);
    rimRight.position.set(200, 80, 100);
    scene.add(rimRight);

    // Floor bounce light (subtle)
    const bounceLight = new THREE.PointLight(0x222222, 0.5, 300);
    bounceLight.position.set(0, 5, 100);
    scene.add(bounceLight);
}

function createFloor() {
    // Large floor plane
    const floorGeometry = new THREE.PlaneGeometry(3000, 3000);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.25,
        metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);
}

function createTV() {
    tvGroup = new THREE.Group();

    // === DIMENSIONS ===
    const tvWidth = 110;
    const tvHeight = 85;
    const tvDepth = 55;
    const cornerRadius = 8;

    // === MATERIALS ===

    // Wood cabinet material - dark grayish brown like reference
    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x2a2622,
        roughness: 0.85,
        metalness: 0.05
    });

    // Darker wood trim
    const darkWoodMat = new THREE.MeshStandardMaterial({
        color: 0x1a1714,
        roughness: 0.8,
        metalness: 0.05
    });

    // Plastic/bakelite for bezels - very dark
    const bakeliteMat = new THREE.MeshStandardMaterial({
        color: 0x0f0e0d,
        roughness: 0.4,
        metalness: 0.1
    });

    // Metal for knobs and details
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x8a8a8a,
        roughness: 0.3,
        metalness: 0.8
    });

    // Chrome accent
    const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.1,
        metalness: 0.95
    });

    // === MAIN CABINET ===

    // Create rounded box shape using multiple parts
    // Main body
    const mainBodyGeom = new THREE.BoxGeometry(tvWidth - cornerRadius * 2, tvHeight - cornerRadius * 2, tvDepth);
    const mainBody = new THREE.Mesh(mainBodyGeom, woodMat);
    mainBody.position.set(0, tvHeight / 2, 0);
    tvGroup.add(mainBody);

    // Top panel (slightly inset)
    const topGeom = new THREE.BoxGeometry(tvWidth - 4, 3, tvDepth - 4);
    const topPanel = new THREE.Mesh(topGeom, woodMat);
    topPanel.position.set(0, tvHeight - 1.5, 0);
    tvGroup.add(topPanel);

    // Side panels for rounded effect
    const sidePanelGeom = new THREE.BoxGeometry(cornerRadius, tvHeight - cornerRadius * 2, tvDepth - 8);

    const leftPanel = new THREE.Mesh(sidePanelGeom, woodMat);
    leftPanel.position.set(-tvWidth / 2 + cornerRadius / 2, tvHeight / 2, 0);
    tvGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(sidePanelGeom, woodMat);
    rightPanel.position.set(tvWidth / 2 - cornerRadius / 2, tvHeight / 2, 0);
    tvGroup.add(rightPanel);

    // Vertical edge strips (simulating rounded corners)
    const edgeGeom = new THREE.CylinderGeometry(cornerRadius / 2, cornerRadius / 2, tvHeight - cornerRadius * 2, 8);
    const edgePositions = [
        [-tvWidth / 2 + cornerRadius / 2, tvHeight / 2, tvDepth / 2 - cornerRadius / 2],
        [-tvWidth / 2 + cornerRadius / 2, tvHeight / 2, -tvDepth / 2 + cornerRadius / 2],
        [tvWidth / 2 - cornerRadius / 2, tvHeight / 2, tvDepth / 2 - cornerRadius / 2],
        [tvWidth / 2 - cornerRadius / 2, tvHeight / 2, -tvDepth / 2 + cornerRadius / 2]
    ];
    edgePositions.forEach(function(pos) {
        const edge = new THREE.Mesh(edgeGeom, woodMat);
        edge.position.set(pos[0], pos[1], pos[2]);
        tvGroup.add(edge);
    });

    // === FRONT FACE DETAIL ===

    // Front panel (recessed area for screen)
    const frontPanelGeom = new THREE.BoxGeometry(tvWidth - 8, tvHeight - 12, 4);
    const frontPanel = new THREE.Mesh(frontPanelGeom, darkWoodMat);
    frontPanel.position.set(0, tvHeight / 2, tvDepth / 2 - 2);
    tvGroup.add(frontPanel);

    // Screen area frame (outer)
    const screenFrameOuterGeom = new THREE.BoxGeometry(75, 62, 3);
    const screenFrameOuter = new THREE.Mesh(screenFrameOuterGeom, bakeliteMat);
    screenFrameOuter.position.set(-12, tvHeight / 2 + 4, tvDepth / 2);
    tvGroup.add(screenFrameOuter);

    // Screen bezel (inner dark ring)
    const bezelRingGeom = new THREE.RingGeometry(28, 34, 32);
    const bezelRing = new THREE.Mesh(bezelRingGeom, bakeliteMat);
    bezelRing.position.set(-12, tvHeight / 2 + 4, tvDepth / 2 + 1.6);
    bezelRing.scale.set(1.1, 0.85, 1);
    tvGroup.add(bezelRing);

    // === CRT SCREEN ===

    const screenWidth = 62;
    const screenHeight = 50;

    // Use simple plane - more reliable for shader
    const screenGeom = new THREE.PlaneGeometry(screenWidth, screenHeight, 1, 1);

    const staticMaterial = new THREE.ShaderMaterial({
        uniforms: staticUniforms,
        vertexShader: [
            'varying vec2 vUv;',
            'varying vec3 vPosition;',
            'void main() {',
            '    vUv = uv;',
            '    vPosition = position;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform float time;',
            'uniform float brightness;',
            'varying vec2 vUv;',
            'varying vec3 vPosition;',
            '',
            'float random(vec2 st) {',
            '    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);',
            '}',
            '',
            'void main() {',
            '    vec2 uv = vUv;',
            '',
            '    // Multi-layer static noise for realistic effect',
            '    float noise1 = random(uv * 1000.0 + time * 120.0);',
            '    float noise2 = random(uv * 500.0 + time * 80.0 + 100.0);',
            '    float noise3 = random(uv * 200.0 + time * 40.0 + 200.0);',
            '    float noise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;',
            '',
            '    // Scanlines (CRT effect)',
            '    float scanline = sin(uv.y * 600.0) * 0.04;',
            '    float scanline2 = sin(uv.y * 300.0 + time * 2.0) * 0.02;',
            '',
            '    // Horizontal sync interference',
            '    float hSync = sin(uv.y * 40.0 + time * 3.0) * 0.015;',
            '    float hBand = smoothstep(0.0, 0.1, sin(uv.y * 8.0 + time * 0.5)) * 0.03;',
            '',
            '    // Rolling bar effect',
            '    float roll = sin(uv.y * 2.0 - time * 0.3) * 0.5 + 0.5;',
            '    roll = smoothstep(0.4, 0.6, roll) * 0.05;',
            '',
            '    // Combine',
            '    float staticVal = noise * 0.8 + 0.2;',
            '    staticVal += scanline + scanline2 + hSync + hBand + roll;',
            '',
            '    // CRT curvature vignette',
            '    vec2 vigUv = uv * 2.0 - 1.0;',
            '    float vig = 1.0 - length(vigUv * vec2(0.8, 0.9));',
            '    vig = smoothstep(-0.1, 0.8, vig);',
            '',
            '    // Edge darkening (more at corners)',
            '    float corner = 1.0 - pow(length(vigUv), 3.0) * 0.3;',
            '',
            '    // Bright white static like reference',
            '    float finalStatic = staticVal * brightness * vig * corner;',
            '    finalStatic = finalStatic * 1.3 + 0.1; // Boost brightness',
            '    vec3 color = vec3(finalStatic);',
            '',
            '    gl_FragColor = vec4(color, 1.0);',
            '}'
        ].join('\n'),
        side: THREE.FrontSide
    });

    screenMesh = new THREE.Mesh(screenGeom, staticMaterial);
    // PlaneGeometry faces +Z by default, position just inside the bezel
    screenMesh.position.set(-12, tvHeight / 2 + 4, tvDepth / 2 + 1.5);
    tvGroup.add(screenMesh);

    // Screen glass rim (chrome ring around CRT)
    const glassRimGeom = new THREE.TorusGeometry(30, 1.5, 8, 32);
    const glassRim = new THREE.Mesh(glassRimGeom, chromeMat);
    glassRim.position.set(-12, tvHeight / 2 + 4, tvDepth / 2 + 2);
    glassRim.scale.set(1.0, 0.82, 0.3);
    tvGroup.add(glassRim);

    // === CONTROL PANEL (Right Side) ===

    // Panel background
    const controlPanelGeom = new THREE.BoxGeometry(22, 55, 3);
    const controlPanel = new THREE.Mesh(controlPanelGeom, darkWoodMat);
    controlPanel.position.set(tvWidth / 2 - 20, tvHeight / 2 + 2, tvDepth / 2);
    tvGroup.add(controlPanel);

    // Channel display window
    const displayGeom = new THREE.BoxGeometry(14, 10, 2);
    const displayMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.3,
        metalness: 0.1
    });
    const display = new THREE.Mesh(displayGeom, displayMat);
    display.position.set(tvWidth / 2 - 20, tvHeight / 2 + 22, tvDepth / 2 + 1);
    tvGroup.add(display);

    // Large channel knob (top)
    createDetailedKnob(tvWidth / 2 - 20, tvHeight / 2 + 5, tvDepth / 2 + 2, 6, true);

    // Volume knob (middle)
    createDetailedKnob(tvWidth / 2 - 20, tvHeight / 2 - 12, tvDepth / 2 + 2, 5, false);

    // Small adjustment knobs (bottom)
    createDetailedKnob(tvWidth / 2 - 26, tvHeight / 2 - 24, tvDepth / 2 + 2, 2.5, false);
    createDetailedKnob(tvWidth / 2 - 14, tvHeight / 2 - 24, tvDepth / 2 + 2, 2.5, false);

    function createDetailedKnob(x, y, z, radius, hasRidges) {
        const knobGroup = new THREE.Group();

        // Knob base
        const baseGeom = new THREE.CylinderGeometry(radius * 1.1, radius * 1.2, 2, 24);
        const base = new THREE.Mesh(baseGeom, bakeliteMat);
        base.rotation.x = Math.PI / 2;
        knobGroup.add(base);

        // Main knob body
        const bodyGeom = new THREE.CylinderGeometry(radius, radius * 0.9, 4, 24);
        const body = new THREE.Mesh(bodyGeom, metalMat);
        body.rotation.x = Math.PI / 2;
        body.position.z = 2;
        knobGroup.add(body);

        // Knob cap
        const capGeom = new THREE.CylinderGeometry(radius * 0.7, radius * 0.8, 1.5, 24);
        const cap = new THREE.Mesh(capGeom, chromeMat);
        cap.rotation.x = Math.PI / 2;
        cap.position.z = 4;
        knobGroup.add(cap);

        // Indicator line
        const indicatorGeom = new THREE.BoxGeometry(0.5, radius * 0.5, 0.3);
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        indicator.position.set(0, radius * 0.4, 4.5);
        knobGroup.add(indicator);

        // Ridges for channel knob
        if (hasRidges) {
            for (var i = 0; i < 12; i++) {
                var angle = (i / 12) * Math.PI * 2;
                var ridgeGeom = new THREE.BoxGeometry(0.8, 1.5, 3);
                var ridge = new THREE.Mesh(ridgeGeom, metalMat);
                ridge.position.set(
                    Math.cos(angle) * (radius - 0.5),
                    Math.sin(angle) * (radius - 0.5),
                    2
                );
                ridge.rotation.z = angle;
                knobGroup.add(ridge);
            }
        }

        knobGroup.position.set(x, y, z);
        tvGroup.add(knobGroup);
    }

    // === SPEAKER GRILLE ===

    // Speaker area (below screen on left)
    const speakerFrameGeom = new THREE.BoxGeometry(25, 20, 2);
    const speakerFrame = new THREE.Mesh(speakerFrameGeom, darkWoodMat);
    speakerFrame.position.set(-35, 15, tvDepth / 2);
    tvGroup.add(speakerFrame);

    // Grille slats
    for (var s = 0; s < 8; s++) {
        var slatGeom = new THREE.BoxGeometry(20, 1, 1);
        var slat = new THREE.Mesh(slatGeom, bakeliteMat);
        slat.position.set(-35, 10 + s * 2.2, tvDepth / 2 + 1);
        tvGroup.add(slat);
    }

    // Speaker cloth backing (visible between slats)
    var clothGeom = new THREE.PlaneGeometry(20, 16);
    var clothMat = new THREE.MeshStandardMaterial({
        color: 0x2a2520,
        roughness: 0.95,
        metalness: 0
    });
    var cloth = new THREE.Mesh(clothGeom, clothMat);
    cloth.position.set(-35, 15, tvDepth / 2 + 0.3);
    tvGroup.add(cloth);

    // === BRAND BADGE ===

    var badgeGeom = new THREE.BoxGeometry(18, 4, 0.5);
    var badge = new THREE.Mesh(badgeGeom, chromeMat);
    badge.position.set(-12, tvHeight / 2 - 28, tvDepth / 2 + 1);
    tvGroup.add(badge);

    // === VENTILATION SLOTS (Back/Top) ===

    for (var v = 0; v < 6; v++) {
        var ventGeom = new THREE.BoxGeometry(8, 1, tvDepth - 20);
        var ventMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        var vent = new THREE.Mesh(ventGeom, ventMat);
        vent.position.set(-30 + v * 12, tvHeight - 3, 0);
        tvGroup.add(vent);
    }

    // === FEET ===

    var footGeom = new THREE.CylinderGeometry(3, 4, 3, 8);
    var footPositions = [
        [-tvWidth / 2 + 12, 1.5, tvDepth / 2 - 10],
        [tvWidth / 2 - 12, 1.5, tvDepth / 2 - 10],
        [-tvWidth / 2 + 12, 1.5, -tvDepth / 2 + 10],
        [tvWidth / 2 - 12, 1.5, -tvDepth / 2 + 10]
    ];
    footPositions.forEach(function(pos) {
        var foot = new THREE.Mesh(footGeom, bakeliteMat);
        foot.position.set(pos[0], pos[1], pos[2]);
        tvGroup.add(foot);
    });

    // === ANTENNA ===

    var antennaMat = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.25,
        metalness: 0.85
    });

    // Antenna base (more detailed)
    var antennaBaseGeom = new THREE.CylinderGeometry(5, 6, 5, 12);
    var antennaBase = new THREE.Mesh(antennaBaseGeom, antennaMat);
    antennaBase.position.set(0, tvHeight + 2.5, 0);
    tvGroup.add(antennaBase);

    // Base collar
    var collarGeom = new THREE.TorusGeometry(5.5, 1, 8, 16);
    var collar = new THREE.Mesh(collarGeom, chromeMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, tvHeight + 0.5, 0);
    tvGroup.add(collar);

    // Antenna arms (tapered tubes)
    var armLength = 50;
    var armSegments = 3;

    function createAntennaArm(angleZ, angleY) {
        var armGroup = new THREE.Group();

        for (var seg = 0; seg < armSegments; seg++) {
            var segLength = armLength / armSegments;
            var topRadius = 1.2 - seg * 0.3;
            var bottomRadius = 1.5 - seg * 0.3;

            var segGeom = new THREE.CylinderGeometry(topRadius, bottomRadius, segLength, 8);
            var segment = new THREE.Mesh(segGeom, antennaMat);
            segment.position.y = segLength / 2 + seg * segLength;
            armGroup.add(segment);

            // Joint rings
            if (seg < armSegments - 1) {
                var jointGeom = new THREE.TorusGeometry(topRadius + 0.3, 0.4, 6, 12);
                var joint = new THREE.Mesh(jointGeom, chromeMat);
                joint.rotation.x = Math.PI / 2;
                joint.position.y = (seg + 1) * segLength;
                armGroup.add(joint);
            }
        }

        // Tip ball
        var tipGeom = new THREE.SphereGeometry(2, 12, 12);
        var tip = new THREE.Mesh(tipGeom, chromeMat);
        tip.position.y = armLength;
        armGroup.add(tip);

        armGroup.rotation.z = angleZ;
        armGroup.rotation.y = angleY;
        armGroup.position.set(0, tvHeight + 5, 0);

        return armGroup;
    }

    var leftAntenna = createAntennaArm(Math.PI / 5, 0);
    leftAntenna.position.x = -3;
    tvGroup.add(leftAntenna);

    var rightAntenna = createAntennaArm(-Math.PI / 5, 0);
    rightAntenna.position.x = 3;
    tvGroup.add(rightAntenna);

    scene.add(tvGroup);
}

function createGodRays() {
    // Create subtle volumetric god rays emanating from the screen
    const rayCount = 5;
    const tvHeight = 85;
    const tvDepth = 55;
    const screenCenterY = tvHeight / 2 + 4;
    const screenCenterZ = tvDepth / 2 + 5;

    for (let i = 0; i < rayCount; i++) {
        const rayMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.015,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // Create tapered cone for each ray - longer, thinner
        const rayLength = 350;
        const rayWidth = 40 + i * 15;
        const coneGeom = new THREE.ConeGeometry(rayWidth, rayLength, 4, 1, true);
        const ray = new THREE.Mesh(coneGeom, rayMaterial);

        // Position at screen center
        ray.position.set(-12, screenCenterY, screenCenterZ + rayLength / 2);
        ray.rotation.x = Math.PI / 2;

        // Fan out rays symmetrically
        const spreadAngle = (i - rayCount / 2) * 0.15;
        ray.rotation.z = spreadAngle;

        // Store for animation
        ray.userData.baseOpacity = 0.012 + Math.random() * 0.008;
        ray.userData.phase = Math.random() * Math.PI * 2;

        godRays.push(ray);
        scene.add(ray);
    }
}

function createText() {
    // Create 3D text using canvas texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 2048;
    canvas.height = 256;

    // Clear with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Text styling
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 130px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRESH PRODUCE MEDIA', canvas.width / 2, canvas.height / 2);

    const textTexture = new THREE.CanvasTexture(canvas);
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.magFilter = THREE.LinearFilter;

    const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    // Main text - positioned lower in frame like reference
    const textGeom = new THREE.PlaneGeometry(350, 45);
    textMesh = new THREE.Mesh(textGeom, textMaterial);
    textMesh.position.set(0, -5, 180);  // Lower position
    scene.add(textMesh);

    // Reflection (flipped, faded) - on floor
    const reflectionMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const reflectionGeom = new THREE.PlaneGeometry(350, 45);
    textReflection = new THREE.Mesh(reflectionGeom, reflectionMaterial);
    textReflection.position.set(0, -5, 180);
    textReflection.rotation.x = Math.PI / 2;  // Lay flat on floor
    textReflection.position.y = 1;  // Just above floor
    scene.add(textReflection);
}

// --- Scroll Handling ---

function onScroll(event) {
    event.preventDefault();
    handleScroll(event.deltaY);
}

function handleScroll(deltaY) {
    targetScrollProgress += deltaY * 0.0006;
    targetScrollProgress = Math.max(0, Math.min(1, targetScrollProgress));
}

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Update static shader
    staticUniforms.time.value = time;

    // Smooth scroll interpolation
    scrollProgress += (targetScrollProgress - scrollProgress) * 0.04;

    // Camera position based on scroll
    const camZ = cameraStart.z + (cameraEnd.z - cameraStart.z) * scrollProgress;
    const camY = cameraStart.y + (cameraEnd.y - cameraStart.y) * scrollProgress;
    camera.position.z = camZ;
    camera.position.y = camY;

    // Camera looks at screen center (tvHeight/2 + 4 = ~46.5)
    camera.lookAt(0, 46, 0);

    // Text parallax - moves toward camera faster, fades out
    const textZ = 180 - scrollProgress * 220;
    const textOpacity = 1 - Math.pow(scrollProgress, 0.4);
    if (textMesh) {
        textMesh.position.z = textZ;
        textMesh.material.opacity = Math.max(0, textOpacity);
    }
    if (textReflection) {
        textReflection.position.z = textZ;
        textReflection.material.opacity = Math.max(0, textOpacity * 0.15);
    }

    // God rays animation - subtle pulsing
    for (let i = 0; i < godRays.length; i++) {
        const ray = godRays[i];
        const pulse = Math.sin(time * 0.4 + ray.userData.phase) * 0.015;
        ray.material.opacity = ray.userData.baseOpacity + pulse;

        // Very subtle rotation drift
        ray.rotation.z += Math.sin(time * 0.2 + i) * 0.0001;
    }

    // Screen brightness subtle pulse
    staticUniforms.brightness.value = 0.92 + Math.sin(time * 1.5) * 0.08;

    // Render
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
