import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Living Anime Beach Wallpaper with Dedicated Wave Simulation
 * Displays a high-resolution, still anime beach landscape (sky, clouds,
 * palm trees, mountains, dry sand) while animating ONLY the ocean waves,
 * breaking foam crests, tidal shoreline wash, and sunlit water glints.
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

    // ── 2. Renderer ───────────────────────────────────────────────────────────
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
      uImageResolution: { value: new THREE.Vector2(1024, 573) },
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

      // Cover-mode UV mapping (preserves aspect ratio without stretching)
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

      void main() {
        // Calculate aspect-corrected UV
        vec2 uv = getCoverUv(vUv, uResolution, uImageResolution);

        // Clamp to prevent out-of-bounds artifacting
        vec2 clampedUv = clamp(uv, 0.001, 0.999);

        // Sample original still image
        vec4 originalColor = texture2D(uTexture, clampedUv);

        // Sample water mask: 1.0 = ocean/waves, 0.0 = still land/sky
        float mask = texture2D(uMask, clampedUv).r;

        // If outside water region, render the untouched still image immediately
        if (mask < 0.005) {
          gl_FragColor = originalColor;
          return;
        }

        // ── Wave Flow Dynamics ─────────────────────────────────────────────────
        // In this coastal perspective, waves roll from horizon/NW towards beach/SE
        vec2 waveDir = normalize(vec2(0.68, -0.42));
        vec2 crestDir = vec2(-waveDir.y, waveDir.x); // Perpendicular along the crest

        float distAlongWave = dot(clampedUv, waveDir);
        float distAlongCrest = dot(clampedUv, crestDir);

        // Perspective scaling: near horizon waves are compressed; near shore they expand
        float depth = clamp(1.0 - clampedUv.y * 1.85, 0.0, 1.0);
        float p = mix(0.45, 1.3, depth);

        // Multi-frequency trochoidal water swells
        float w1 = sin(distAlongWave * 34.0 * p - uTime * 2.2 + sin(distAlongCrest * 14.0) * 0.45);
        float w2 = sin(distAlongWave * 65.0 * p - uTime * 3.5 + cos(distAlongCrest * 22.0) * 0.35);
        float w3 = sin(distAlongWave * 16.0 * p - uTime * 1.4);

        // Smooth wave displacement on water UV
        vec2 displacement = waveDir * (w1 * 0.004 + w2 * 0.0022 + w3 * 0.0055) * p * mask;
        vec2 distortedUv = clamp(clampedUv + displacement, 0.001, 0.999);

        // Sample water with animated surface displacement
        vec4 baseWater = texture2D(uTexture, distortedUv);

        // ── Rolling Breaking Wave Crests (Studio Ghibli Foam Lines) ────────────
        // Breaker 1: Main surf crest line rolling toward shore
        float cycle1 = fract(distAlongWave * 4.4 * p - uTime * 0.28);
        float crest1 = smoothstep(0.86, 0.94, cycle1) * (1.0 - smoothstep(0.96, 1.0, cycle1));
        float noise1 = sin(distAlongCrest * 55.0 + uTime * 1.6) * cos(distAlongWave * 75.0);
        crest1 = smoothstep(0.35, 0.72, crest1 + noise1 * 0.22 * crest1);

        // Breaker 2: Mid-water rolling wave swell
        float cycle2 = fract(distAlongWave * 7.8 * p - uTime * 0.38 + 0.48);
        float crest2 = smoothstep(0.88, 0.95, cycle2) * (1.0 - smoothstep(0.97, 1.0, cycle2));
        float noise2 = cos(distAlongCrest * 70.0 - uTime * 2.0);
        crest2 = smoothstep(0.38, 0.78, crest2 + noise2 * 0.18 * crest2);

        // ── Shoreline Surf Wash (Tidal Surge & Recede) ─────────────────────────
        float tide = sin(uTime * 1.2) * 0.5 + 0.5;
        float shoreZone = smoothstep(0.08, 0.75, mask) * (1.0 - smoothstep(0.75, 1.0, mask));
        float shoreFoam = shoreZone * (tide * 0.65 + 0.25);

        // ── Sunlit Caustics & Water Glints ────────────────────────────────────
        float caustics = sin(distAlongWave * 50.0 - uTime * 2.0) * sin(distAlongCrest * 45.0 + uTime * 1.8) * 0.045;
        float glint = pow(max(0.0, w1 * 0.65 + w2 * 0.35), 7.0) * 0.32 * mask;

        // ── Color Compositing ─────────────────────────────────────────────────
        vec3 finalColor = baseWater.rgb;

        // Add turquoise depth shimmer
        finalColor += vec3(0.02, 0.09, 0.11) * caustics * mask;

        // Add warm sun specular highlights
        finalColor += vec3(0.94, 0.98, 1.0) * glint;

        // Add pure white anime wave crests and shoreline foam
        vec3 foamColor = vec3(0.98, 1.0, 1.0);
        float totalFoam = clamp(crest1 * 0.85 + crest2 * 0.65 + shoreFoam * 0.8, 0.0, 1.0);
        finalColor = mix(finalColor, foamColor, totalFoam * mask);

        // Smooth transition along feathered mask boundary
        gl_FragColor = mix(originalColor, vec4(finalColor, 1.0), mask);
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
