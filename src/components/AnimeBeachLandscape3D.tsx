import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Anime Beach Landscape — Peaceful Ocean Animation
 *
 * Design philosophy: Let the hand-painted artwork breathe. The shader adds
 * gentle, dreamy wave motion and light play *over* the illustration rather
 * than replacing its colors with procedural gradients. Only the ocean
 * moves; everything else stays still.
 *
 * Mask channels (water-mask.png):
 *   R = water region (0 = land/sky, 1 = ocean)
 *   G = shoreline band (1 = waterline zone)
 *   B = depth (0 = shallow shore, 1 = deep offshore)
 */
export const AnimeBeachLandscape3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // ── Scene & Camera ──────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Textures ────────────────────────────────────────────────────────────
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

    // ── Uniforms ────────────────────────────────────────────────────────────
    const uniforms = {
      uTexture: { value: beachTexture },
      uMask: { value: maskTexture },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uImageResolution: { value: new THREE.Vector2(1376, 768) },
    };

    // ── Vertex Shader ───────────────────────────────────────────────────────
    const vertexShader = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    // ── Fragment Shader ─────────────────────────────────────────────────────
    const fragmentShader = /* glsl */ `
      precision highp float;

      uniform sampler2D uTexture;
      uniform sampler2D uMask;
      uniform float     uTime;
      uniform vec2      uResolution;
      uniform vec2      uImageResolution;

      varying vec2 vUv;

      // ════════════════════════════════════════════════════════════════════════
      // Utility: cover-mode UV (like CSS object-fit: cover)
      // ════════════════════════════════════════════════════════════════════════
      vec2 coverUV(vec2 uv, vec2 screen, vec2 image) {
        float sa = screen.x / screen.y;
        float ia = image.x  / image.y;
        vec2 o = uv;
        if (sa > ia) {
          o.y = (uv.y - 0.5) * (ia / sa) + 0.5;
        } else {
          o.x = (uv.x - 0.5) * (sa / ia) + 0.5;
        }
        return o;
      }

      // ════════════════════════════════════════════════════════════════════════
      // Noise — value noise with smooth quintic interpolation
      // ════════════════════════════════════════════════════════════════════════
      float hash21(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic
        return mix(
          mix(hash21(i),                hash21(i + vec2(1, 0)), u.x),
          mix(hash21(i + vec2(0, 1)),   hash21(i + vec2(1, 1)), u.x),
          u.y
        );
      }

      float fbm3(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2  r = mat2(0.8, 0.6, -0.6, 0.8); // rotation between octaves
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p  = r * p * 2.0 + 4.3;
          a *= 0.5;
        }
        return v;
      }

      float fbm5(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2  r = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          v += a * vnoise(p);
          p  = r * p * 2.0 + 4.3;
          a *= 0.5;
        }
        return v;
      }

      // ════════════════════════════════════════════════════════════════════════
      // Main
      // ════════════════════════════════════════════════════════════════════════
      void main() {
        float t = uTime;

        vec2 uv  = coverUV(vUv, uResolution, uImageResolution);
        vec2 cuv = clamp(uv, 0.001, 0.999);

        vec4 orig = texture2D(uTexture, cuv);
        vec4 mask = texture2D(uMask,    cuv);

        float water = mask.r;           // ocean region
        float shore = mask.g;           // shoreline foam band
        float depth = mask.b;           // 0 shallow → 1 deep

        // Land / sky: pass through untouched
        if (water < 0.01) {
          gl_FragColor = orig;
          return;
        }

        // ────────────────────────────────────────────────────────────────────
        // 1. GENTLE UV DISTORTION — makes the painted waves feel alive
        //    Key insight: distort the UV *sample* position of the original
        //    artwork, so the illustrated colors flow naturally rather than
        //    being overwritten by procedural flat gradients.
        // ────────────────────────────────────────────────────────────────────

        // Wave direction: rolls toward shore (upper-left to lower-right in UV)
        vec2 waveDir = normalize(vec2(0.75, 0.50));

        // Layered slow distortion (large gentle sway)
        float n1 = vnoise(cuv * 8.0  + waveDir * t * 0.12);
        float n2 = vnoise(cuv * 16.0 - waveDir * t * 0.18 + 3.7);
        float n3 = vnoise(cuv * 32.0 + vec2(t * 0.08, -t * 0.14) + 7.1);

        // Distortion magnitude: stronger in deep water, very gentle at shore
        float distStrength = mix(0.003, 0.012, smoothstep(0.0, 0.7, depth));
        // Reduce distortion near mask boundary for clean transition
        distStrength *= smoothstep(0.01, 0.15, water);

        vec2 distort = vec2(
          (n1 - 0.5) * 2.0 + (n3 - 0.5) * 0.6,
          (n2 - 0.5) * 2.0 + (n3 - 0.5) * 0.6
        ) * distStrength;

        vec2 sampUV = clamp(cuv + distort, 0.001, 0.999);
        vec3 col = texture2D(uTexture, sampUV).rgb;

        // ────────────────────────────────────────────────────────────────────
        // 2. SUBTLE COLOR ENHANCEMENT — deepen the illustrated water tones
        //    instead of replacing them. Push blues a touch, add depth haze.
        // ────────────────────────────────────────────────────────────────────

        // Gentle blue deepening in offshore areas
        vec3 deepTint = vec3(0.02, 0.08, 0.18);
        float deepBlend = depth * 0.22 * water;
        col = col - deepTint * deepBlend;
        // Ensure colors don't go negative
        col = max(col, vec3(0.0));

        // Very subtle warm-teal lift in shallow areas (turquoise pop)
        float shallowLift = (1.0 - smoothstep(0.0, 0.35, depth)) * water * 0.06;
        col += vec3(-0.01, 0.03, 0.04) * shallowLift;

        // ────────────────────────────────────────────────────────────────────
        // 3. SHORELINE FOAM — the white wash advancing and retreating
        //    on the beach, with lacy organic edges.
        // ────────────────────────────────────────────────────────────────────

        // Tidal rhythm: ~5 second cycle, smooth sinusoidal
        float tideA = sin(t * 1.20) * 0.5 + 0.5;   // 0→1→0 cycle
        float tideB = sin(t * 0.85 + 1.9) * 0.5 + 0.5; // offset secondary

        // Foam noise: slowly drifting lacy pattern
        float foamNoise = fbm5(
          cuv * vec2(55.0, 40.0) + vec2(t * 0.06, -t * 0.04)
        );

        // Shore-parallel wiggly contour
        float wiggle = sin(cuv.x * 50.0 + t * 0.7) * 0.04
                     + sin(cuv.x * 85.0 - t * 0.5) * 0.025;

        // Foam visibility: combine tidal advance with shore mask
        float foamEdge = shore + wiggle;
        float foamMask = smoothstep(0.10, 0.70, foamEdge * (tideA * 0.7 + tideB * 0.3)
                                                  + foamNoise * 0.25 * shore);

        // Soft foam: white with very slight warm tint for sunlit sand
        vec3 foamColor = vec3(0.97, 0.99, 1.00);
        // Foam opacity: stronger at the leading edge, softer behind
        float foamAlpha = foamMask * 0.85 * shore;

        // Wet sand sheen when retreating
        float retreatPhase = smoothstep(0.6, 0.0, tideA);
        float wetSand = shore * retreatPhase * 0.15 * (0.5 + foamNoise * 0.5);

        col = mix(col, foamColor, foamAlpha);
        // Wet sheen: slightly darken + saturate the sand
        col = mix(col, col * vec3(0.85, 0.88, 0.92), wetSand);

        // ────────────────────────────────────────────────────────────────────
        // 4. SINGLE ROLLING WAVE — one clean white crest line that
        //    continuously travels toward shore, with a soft foam trail
        //    behind it and a noisy organic edge.
        // ────────────────────────────────────────────────────────────────────

        float wProj = dot(cuv, waveDir);

        // Single wave: slow travel toward shore, ~12 second full cycle
        float wavePhase = fract(wProj * 3.5 - t * 0.055);

        // Shape the wave: bright crest peak with soft trailing foam
        //   0.0 ──────── 0.82 (nothing) ── 0.88 (foam trail) ── 0.94 (crest peak) ── 1.0
        float crestPeak  = smoothstep(0.90, 0.96, wavePhase) * (1.0 - smoothstep(0.97, 1.00, wavePhase));
        float foamTrail  = smoothstep(0.80, 0.90, wavePhase) * (1.0 - smoothstep(0.90, 0.97, wavePhase));

        // Organic edge: noise breaks up the perfectly straight line
        float edgeNoise = fbm3(cuv * 50.0 + vec2(t * 0.08, 0.0));
        crestPeak = smoothstep(0.25, 0.65, crestPeak + edgeNoise * 0.20 * crestPeak);
        foamTrail = smoothstep(0.20, 0.55, foamTrail + edgeNoise * 0.18 * foamTrail) * 0.4;

        float wave = clamp(crestPeak + foamTrail, 0.0, 1.0);

        // Fade out near shore (shore foam already handles that zone) & near horizon
        wave *= smoothstep(0.0, 0.15, depth) * (1.0 - smoothstep(0.80, 1.0, depth));

        // Apply as soft translucent white
        col = mix(col, vec3(1.0), wave * 0.6 * water);

        // ────────────────────────────────────────────────────────────────────
        // 5. FINAL BLEND — lerp between original and animated water
        //    Use the water mask with softened edges for seamless transition.
        // ────────────────────────────────────────────────────────────────────

        float blendMask = smoothstep(0.0, 0.08, water);
        gl_FragColor = vec4(mix(orig.rgb, col, blendMask), 1.0);
      }
    `;

    // ── Material & Mesh ─────────────────────────────────────────────────────
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

    // ── Tab Visibility ──────────────────────────────────────────────────────
    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Animation Loop ──────────────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isTabVisible) return;
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };

    animate();

    // ── Resize ──────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      uniforms.uResolution.value.set(width, height);
    };
    window.addEventListener('resize', handleResize);

    // ── Cleanup ─────────────────────────────────────────────────────────────
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
