import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Peaceful Anime Summer Beach Ocean Simulation
 *
 * Technical references synthesized:
 * 1. victorzakharov--beautiful-water: Clear turquoise shallow-water absorption, caustics, sun glints
 * 2. threejs.org/examples/?q=water: Flow direction, normal perturbation, specular reflections
 * 3. askalice.github.io/threejs-worldgen/water: Gerstner wave trochoids, continuous shoreline reach & retreat
 *
 * Behavior:
 * - Still anime beach landscape (grassland, wildflowers, sky, clouds, dry beach sand).
 * - Only the ocean waves and shoreline foam animate continuously.
 */
export const AnimeBeachLandscape3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // ── 1. Scene & Orthographic Full-Screen Camera ────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ── 2. High-Performance Renderer ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── 3. Texture Loading ────────────────────────────────────────────────────
    const texLoader = new THREE.TextureLoader();

    const beachTexture = texLoader.load('/images/anime-beach.png', (tex) => {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    });

    const maskTexture = texLoader.load('/images/water-mask.png', (tex) => {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    });

    // ── 4. Shader Setup ───────────────────────────────────────────────────────
    const uniforms = {
      uTexture: { value: beachTexture },
      uMask: { value: maskTexture },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uImageResolution: { value: new THREE.Vector2(1376, 768) },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      uniform sampler2D uTexture;
      uniform sampler2D uMask;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uImageResolution;
      varying vec2 vUv;

      // Cover-mode aspect ratio mapping
      vec2 getCoverUv(vec2 uv, vec2 screenRes, vec2 imageRes) {
        float screenAspect = screenRes.x / screenRes.y;
        float imageAspect = imageRes.x / imageRes.y;
        vec2 newUv = uv;
        if (screenAspect > imageAspect) {
          float scale = imageAspect / screenAspect;
          newUv.y = (uv.y - 0.5) * scale + 0.5;
        } else {
          float scale = screenAspect / imageAspect;
          newUv.x = (uv.x - 0.5) * scale + 0.5;
        }
        return newUv;
      }

      // Procedural noise for natural anime foam contours
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.5000 * noise(p); p *= 2.02;
        v += 0.2500 * noise(p); p *= 2.03;
        v += 0.1250 * noise(p);
        return v;
      }

      // Gerstner Wave (Trochoidal displacement)
      vec2 gerstnerWave(vec2 p, vec2 dir, float steepness, float wavelength, float speed, float time) {
        float k = 6.28318 / wavelength;
        float f = k * (dot(dir, p) - speed * time);
        float a = steepness / k;
        return vec2(
          dir.x * (a * cos(f)),
          dir.y * (a * cos(f))
        );
      }

      void main() {
        vec2 uv = getCoverUv(vUv, uResolution, uImageResolution);
        vec2 clampedUv = clamp(uv, 0.001, 0.999);

        vec4 originalColor = texture2D(uTexture, clampedUv);
        vec4 maskData = texture2D(uMask, clampedUv);

        float waterMask  = maskData.r;   // 1.0 = ocean, 0.0 = still land/sky
        float shoreBand  = maskData.g;   // 1.0 = shoreline waterline zone
        float shoreDepth = maskData.b;   // 0.0 = shallow shore, 1.0 = deep water

        // Outside water region: render the untouched still anime illustration
        if (waterMask < 0.005) {
          gl_FragColor = originalColor;
          return;
        }

        // ── 1. Wave Travel Directions ──────────────────────────────────────────
        // Primary ocean swell rolls from deep sea towards the beach
        vec2 swellDir = normalize(vec2(-0.78, -0.42));
        vec2 crestDir = vec2(-swellDir.y, swellDir.x); // Perpendicular crest line

        // Perspective scaling: near horizon waves are tighter; near beach they expand
        float perspective = mix(0.5, 1.35, clamp(1.0 - clampedUv.y * 1.5, 0.0, 1.0));

        // ── 2. Gerstner Waves Superposition ────────────────────────────────────
        vec2 disp1 = gerstnerWave(clampedUv * perspective, swellDir, 0.022, 0.085, 0.038, uTime);
        vec2 disp2 = gerstnerWave(clampedUv * perspective, normalize(vec2(-0.65, -0.55)), 0.015, 0.048, 0.052, uTime);
        vec2 disp3 = gerstnerWave(clampedUv * perspective, normalize(vec2(-0.85, -0.30)), 0.011, 0.026, 0.075, uTime);

        vec2 totalDisp = (disp1 + disp2 + disp3) * waterMask * perspective;
        vec2 displacedUv = clamp(clampedUv + totalDisp, 0.001, 0.999);

        // ── 3. Anime Color Palette & Smooth Depth Transitions ──────────────────
        // Shallow clear turquoise (near shoreline)
        vec3 shallowTurquoise = vec3(0.18, 0.86, 0.82);
        // Mid-water tropical cerulean
        vec3 midCerulean      = vec3(0.06, 0.62, 0.88);
        // Deep offshore sapphire blue (towards horizon)
        vec3 deepSapphire     = vec3(0.02, 0.32, 0.68);

        // Smooth color transition based on shoreline depth & horizon distance
        float depthGrad = clamp(shoreDepth * 1.35 + (clampedUv.y - 0.48) * 0.8, 0.0, 1.0);
        vec3 animeWaterColor = mix(shallowTurquoise, midCerulean, smoothstep(0.05, 0.45, depthGrad));
        animeWaterColor = mix(animeWaterColor, deepSapphire, smoothstep(0.45, 0.95, depthGrad));

        // Blend with underlying artwork so painted sandy shallow bed shows naturally
        vec4 baseTexture = texture2D(uTexture, displacedUv);
        vec3 waterComposite = mix(baseTexture.rgb, animeWaterColor, 0.45 + depthGrad * 0.35);

        // ── 4. Dancing Sunlight Caustics in Shallow Turquoise Water ────────────
        // (Reference 1: victorzakharov--beautiful-water)
        float causticsP1 = sin(dot(clampedUv, swellDir) * 65.0 - uTime * 2.2) * 
                           cos(dot(clampedUv, crestDir) * 55.0 + uTime * 1.8);
        float causticsP2 = sin(dot(clampedUv, crestDir) * 80.0 - uTime * 1.6) * 
                           cos(dot(clampedUv, swellDir) * 45.0 + uTime * 2.4);
        float caustics = max(0.0, causticsP1 + causticsP2) * 0.12 * (1.0 - smoothstep(0.1, 0.65, shoreDepth));
        waterComposite += vec3(0.12, 0.35, 0.38) * caustics * waterMask;

        // ── 5. Continuous Shoreline Foam Wash (Tidal Reach & Retreat) ──────────
        // (Reference 3: askalice.github.io/threejs-worldgen/water/)
        // Peaceful tidal ocean rhythm (~4.8 second wave cycle)
        float tidalTime = uTime * 1.3;
        float tideCycle = sin(tidalTime); // -1.0 (retreated) to +1.0 (reached)

        // As wave reaches up the beach (tideCycle > 0): foam surges smoothly over sand
        // As wave retreats (tideCycle < 0): water recedes leaving a wet sand sheen
        float reachPhase   = smoothstep(-0.4, 0.85, tideCycle);
        float retreatPhase = smoothstep(0.85, -0.3, tideCycle);

        // Dynamic shoreline foam contour with natural lacy edge
        float shoreWaveOffset = sin(dot(clampedUv, crestDir) * 35.0 + uTime * 0.8) * 0.08;
        float shoreFoamBand = smoothstep(0.15, 0.85, shoreBand + shoreWaveOffset);

        float foamNoise = fbm(clampedUv * 65.0 + vec2(tideCycle * 0.15, uTime * 0.2));
        float dynamicShoreFoam = smoothstep(0.35, 0.65, shoreFoamBand * reachPhase + foamNoise * 0.35 * shoreBand);

        // Thin wet sand sheen when wave retreats
        float wetSheen = shoreBand * retreatPhase * (0.35 + foamNoise * 0.25);

        // ── 6. Rolling Wave Crests (Breaking Foam Lines) ────────────────────────
        float waveDist = dot(clampedUv, swellDir) * 5.2 * perspective;
        
        // Breaker 1: Main rolling wave crest
        float rollCycle1 = fract(waveDist - uTime * 0.26);
        float crest1 = smoothstep(0.87, 0.94, rollCycle1) * (1.0 - smoothstep(0.96, 0.995, rollCycle1));
        float crestNoise1 = fbm(clampedUv * 85.0 + vec2(uTime * 0.4, 0.0));
        crest1 = smoothstep(0.38, 0.72, crest1 + crestNoise1 * 0.25 * crest1);

        // Breaker 2: Secondary swell
        float rollCycle2 = fract(waveDist * 1.65 - uTime * 0.36 + 0.45);
        float crest2 = smoothstep(0.89, 0.95, rollCycle2) * (1.0 - smoothstep(0.97, 1.0, rollCycle2));
        crest2 = smoothstep(0.42, 0.76, crest2 + crestNoise1 * 0.2 * crest2);

        // ── 7. Soft Sunlight Specular Reflections ──────────────────────────────
        // (Reference 2: threejs.org/examples/?q=water)
        float waveSlope = disp1.x + disp2.y;
        float sunGlint = pow(max(0.0, sin(dot(clampedUv, swellDir) * 38.0 * perspective - uTime * 2.5 + waveSlope * 8.0)), 9.0) * 0.28 * waterMask;
        waterComposite += vec3(0.95, 0.98, 1.0) * sunGlint;

        // ── 8. Foam Compositing ────────────────────────────────────────────────
        vec3 pureFoamColor = vec3(0.98, 1.0, 1.0);
        float totalFoam = clamp(
          dynamicShoreFoam * 0.9 + 
          wetSheen * 0.5 + 
          crest1 * 0.85 + 
          crest2 * 0.65, 
          0.0, 1.0
        );

        vec3 finalWater = mix(waterComposite, pureFoamColor, totalFoam * waterMask);

        // ── 9. Seamless Edge Blending ──────────────────────────────────────────
        gl_FragColor = mix(originalColor, vec4(finalWater, 1.0), waterMask);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeo, material);
    scene.add(quadMesh);

    // ── 5. Tab Visibility Optimization ────────────────────────────────────────
    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── 6. Animation Loop ─────────────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    animate();

    // ── 7. Resize Handler ─────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      uniforms.uResolution.value.set(width, height);
    };
    window.addEventListener('resize', handleResize);

    // ── 8. Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      renderer.dispose();
      quadGeo.dispose();
      material.dispose();
      beachTexture.dispose();
      maskTexture.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    />
  );
};
