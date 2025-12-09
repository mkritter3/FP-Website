// Fresh Produce Media - 2.5D Cinematic Scene
// Uses reference image with animated static overlay

// --- Global Variables ---
let scene, camera, renderer, composer;
let bgLayer, tvLayer, screenMesh, textMesh, textReflection;
let clock = new THREE.Clock();

// Scroll State
let scrollProgress = 0;
let targetScrollProgress = 0;

// Camera dolly settings - adjusted for 2.5D
const cameraStart = { z: 800, y: 0 };
const cameraEnd = { z: 200, y: 0 };

// Static Shader Uniforms
const staticUniforms = {
    time: { value: 0 },
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

        // Camera - orthographic-like perspective for 2.5D
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.set(0, cameraStart.y, cameraStart.z);
        camera.lookAt(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Post-processing (subtle bloom)
        setupPostProcessing();

        // Load reference image and create scene
        loadSceneLayers();

        // Hide loader after image loads
        setTimeout(function() {
            const loader = document.getElementById('loading');
            if (loader) loader.classList.add('hidden');
        }, 1500);

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

            // Very subtle bloom for screen glow
            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.15,  // strength - very subtle
                0.3,   // radius
                0.95   // threshold - only brightest areas
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

function loadSceneLayers() {
    const textureLoader = new THREE.TextureLoader();

    // Calculate plane size to fill viewport
    const vFov = camera.fov * Math.PI / 180;
    const planeHeight = 2 * Math.tan(vFov / 2) * cameraStart.z;
    const planeWidth = planeHeight * (window.innerWidth / window.innerHeight);

    // Load reference image as main scene layer
    textureLoader.load('assets/tv shot 1.jpg', function(texture) {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Main background/scene layer with the full reference image
        const bgGeom = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const bgMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: false
        });
        bgLayer = new THREE.Mesh(bgGeom, bgMat);
        bgLayer.position.z = 0;
        scene.add(bgLayer);

        // Create animated static screen overlay
        createStaticScreen(planeWidth, planeHeight);

    }, undefined, function(err) {
        console.error('Failed to load reference image:', err);
    });
}

function createStaticScreen(planeWidth, planeHeight) {
    // Screen position relative to reference image
    // Based on tv shot 1.jpg: screen is nearly centered, upper portion
    // Fine-tuned to overlay exactly on TV screen
    const screenWidth = planeWidth * 0.175;   // ~17.5% of image width
    const screenHeight = planeHeight * 0.20;  // ~20% of image height
    const screenX = planeWidth * -0.022;      // Very slightly left of center
    const screenY = planeHeight * 0.175;      // Upper portion of image

    const screenGeom = new THREE.PlaneGeometry(screenWidth, screenHeight);

    // Static shader material
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
            uniform float brightness;
            varying vec2 vUv;

            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            void main() {
                vec2 uv = vUv;

                // Multi-layer static noise
                float noise1 = random(uv * 800.0 + time * 100.0);
                float noise2 = random(uv * 400.0 + time * 60.0 + 50.0);
                float noise3 = random(uv * 150.0 + time * 30.0 + 100.0);
                float noise = noise1 * 0.5 + noise2 * 0.35 + noise3 * 0.15;

                // Scanlines
                float scanline = sin(uv.y * 500.0) * 0.03;
                float scanline2 = sin(uv.y * 250.0 + time * 2.0) * 0.015;

                // Horizontal interference
                float hBand = smoothstep(0.0, 0.1, sin(uv.y * 6.0 + time * 0.4)) * 0.025;

                // Rolling bar
                float roll = sin(uv.y * 1.5 - time * 0.25) * 0.5 + 0.5;
                roll = smoothstep(0.35, 0.65, roll) * 0.04;

                // Combine
                float staticVal = noise * 0.75 + 0.25;
                staticVal += scanline + scanline2 + hBand + roll;

                // CRT curvature vignette - softer for blend
                vec2 vigUv = uv * 2.0 - 1.0;
                float vig = 1.0 - length(vigUv * vec2(0.7, 0.85));
                vig = smoothstep(-0.2, 0.7, vig);

                // Edge softening for blend with reference
                float edgeFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
                edgeFade *= smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);

                float finalStatic = staticVal * brightness * vig * edgeFade;
                finalStatic = finalStatic * 1.1 + 0.1;

                gl_FragColor = vec4(vec3(finalStatic), 1.0);
            }
        `,
        transparent: false,
        blending: THREE.NormalBlending
    });

    screenMesh = new THREE.Mesh(screenGeom, staticMaterial);
    screenMesh.position.set(screenX, screenY, 1); // Slightly in front of bg
    scene.add(screenMesh);
}

// --- Scroll Handling ---

function onScroll(event) {
    event.preventDefault();
    handleScroll(event.deltaY);
}

function handleScroll(deltaY) {
    targetScrollProgress += deltaY * 0.0008;
    targetScrollProgress = Math.max(0, Math.min(1, targetScrollProgress));
}

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Update static shader
    staticUniforms.time.value = time;

    // Smooth scroll interpolation
    scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;

    // Camera dolly (zoom effect in 2.5D)
    const camZ = cameraStart.z + (cameraEnd.z - cameraStart.z) * scrollProgress;
    camera.position.z = camZ;

    // Slight parallax on layers (bg moves slower than screen)
    if (bgLayer) {
        // Background scales up as we zoom in
        const bgScale = 1 + scrollProgress * 0.3;
        bgLayer.scale.set(bgScale, bgScale, 1);
    }

    if (screenMesh) {
        // Screen moves toward camera faster (parallax)
        const screenZ = 1 + scrollProgress * 50;
        screenMesh.position.z = screenZ;

        // Screen scales up slightly more
        const screenScale = 1 + scrollProgress * 0.5;
        screenMesh.scale.set(screenScale, screenScale, 1);
    }

    // Static brightness pulse
    staticUniforms.brightness.value = 0.95 + Math.sin(time * 1.2) * 0.05;

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

    // Recalculate plane sizes on resize
    const vFov = camera.fov * Math.PI / 180;
    const planeHeight = 2 * Math.tan(vFov / 2) * cameraStart.z;
    const planeWidth = planeHeight * camera.aspect;

    if (bgLayer) {
        bgLayer.geometry.dispose();
        bgLayer.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    }

    if (screenMesh) {
        const screenWidth = planeWidth * 0.175;
        const screenHeight = planeHeight * 0.20;
        const screenX = planeWidth * -0.022;
        const screenY = planeHeight * 0.175;

        screenMesh.geometry.dispose();
        screenMesh.geometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
        screenMesh.position.x = screenX;
        screenMesh.position.y = screenY;
    }
}
