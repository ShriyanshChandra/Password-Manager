import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface AppleLiquidGlass3DProps {
  isBreach?: boolean;
  isUnlocking?: boolean;
}

/**
 * Apple Liquid Glass 3D Canvas (WWDC25 / macOS Tahoe / iOS 26)
 *
 * Implements Apple's signature 2025 Liquid Glass visual language:
 * 1. Physical Lensing & Optical Refraction: Bends background light using Snell's Law.
 * 2. Chromatic Dispersion: Splits light into subtle RGB spectral fringes along curved glass edges.
 * 3. Specular Sheen & Gyro-Parallax: Dynamic specular highlights travel across silhouette contours.
 * 4. Ambient Caustic Subsurface: Soft celestial illumination (Deep Space, Sapphire Blue, Titanium).
 */
export const AppleLiquidGlass3D: React.FC<AppleLiquidGlass3DProps> = ({
  isBreach = false,
  isUnlocking = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Interactive Pointer State ─────────────────────────────────────────────
    const pointer = {
      targetX: 0.5,
      targetY: 0.5,
      currentX: 0.5,
      currentY: 0.5,
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      pointer.targetX = clientX / (window.innerWidth || 1);
      pointer.targetY = 1.0 - clientY / (window.innerHeight || 1);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // ── Shader Uniforms ───────────────────────────────────────────────────────
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uBreach: { value: 0.0 },
      uUnlocking: { value: 0.0 },
    };

    // ── Vertex Shader ─────────────────────────────────────────────────────────
    const vertexShader = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    // ── Fragment Shader ───────────────────────────────────────────────────────
    const fragmentShader = /* glsl */ `
      precision highp float;
      varying vec2 vUv;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uPointer;
      uniform float uBreach;
      uniform float uUnlocking;

      #define PI 3.14159265359

      // Rotation helper
      mat2 rot(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      // Smooth noise function
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // ── Physical Liquid Glass Heightfield ─────────────────────────────────────
      // Simulates organic, undulating glass ribbons and floating optical lenses
      float glassSurfaceHeight(vec2 p, float t) {
        vec2 q = p * 1.2;
        q = rot(0.25) * q;

        // Primary undulating glass waves
        float h1 = sin(q.x * 2.2 + t * 0.45) * cos(q.y * 1.8 + t * 0.35);
        float h2 = sin((q.x - q.y) * 1.5 - t * 0.3) * 0.6;

        // Floating lens dome contour near center
        vec2 centerOffset = p - (uPointer - 0.5) * 0.6;
        float distToCenter = length(centerOffset);
        float lensBubble = smoothstep(1.2, 0.0, distToCenter) * 0.85;

        // Secondary smooth harmonic surface
        float n = smoothNoise(q * 1.8 + t * 0.15) * 0.4;

        return (h1 + h2 + lensBubble + n) * 0.35;
      }

      // Derive analytical surface normal via finite difference
      vec3 getGlassNormal(vec2 p, float t) {
        float eps = 0.005;
        float h = glassSurfaceHeight(p, t);
        float hx = glassSurfaceHeight(p + vec2(eps, 0.0), t);
        float hy = glassSurfaceHeight(p + vec2(0.0, eps), t);
        vec3 normal = normalize(vec3(-(hx - h) / eps, -(hy - h) / eps, 1.0));
        return normal;
      }

      // ── Apple Studio Environment (Deep Space, Titanium, Luminous Sapphire) ───
      vec3 sampleEnvironment(vec2 uv, float t) {
        // Base Apple Studio gradient: Deep Cosmic Space -> Soft Sapphire -> Midnight
        vec3 colTop = vec3(0.039, 0.043, 0.063);     // #0a0b10 (Deep Space Titanium)
        vec3 colMid = vec3(0.055, 0.098, 0.188);     // #0e1930 (Subtle Sapphire)
        vec3 colBottom = vec3(0.024, 0.035, 0.059);  // #06090f (Grounding Void)

        vec3 bg = mix(colBottom, colMid, smoothstep(-0.8, 0.3, uv.y));
        bg = mix(bg, colTop, smoothstep(0.1, 1.0, uv.y));

        // Floating chromatic caustic light orbs
        vec2 orb1Pos = vec2(sin(t * 0.3) * 0.6, cos(t * 0.25) * 0.4) + (uPointer - 0.5) * 0.4;
        float orb1Dist = length(uv - orb1Pos);
        vec3 orb1Color = vec3(0.0, 0.443, 0.890); // Apple System Blue (#0071e3)
        bg += orb1Color * (0.42 / (1.0 + orb1Dist * orb1Dist * 3.5));

        vec2 orb2Pos = vec2(cos(t * 0.22) * 0.7, sin(t * 0.32) * 0.5) - (uPointer - 0.5) * 0.3;
        float orb2Dist = length(uv - orb2Pos);
        vec3 orb2Color = vec3(0.345, 0.337, 0.839); // Apple Indigo (#5856d6)
        bg += orb2Color * (0.35 / (1.0 + orb2Dist * orb2Dist * 4.0));

        vec2 orb3Pos = vec2(sin(t * 0.18 + 2.0) * 0.8, -0.4 + sin(t * 0.15) * 0.3);
        float orb3Dist = length(uv - orb3Pos);
        vec3 orb3Color = vec3(0.04, 0.65, 0.75); // Apple Cyan/Teal
        bg += orb3Color * (0.28 / (1.0 + orb3Dist * orb3Dist * 5.0));

        // State reaction: Breach warning glow
        if (uBreach > 0.01) {
          vec3 breachColor = vec3(0.95, 0.12, 0.15); // Apple Alert Red (#ff3b30)
          bg = mix(bg, bg * 0.4 + breachColor * 0.65, uBreach);
        }

        // State reaction: Unlocking resonance pulse
        if (uUnlocking > 0.01) {
          vec3 unlockColor = vec3(0.0, 0.65, 1.0);
          bg += unlockColor * uUnlocking * 0.45;
        }

        return bg;
      }

      void main() {
        // Aspect ratio correction
        vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

        float t = uTime * 0.45;

        // View vector pointing out of screen towards viewer
        vec3 V = vec3(0.0, 0.0, 1.0);

        // Compute physical normal of the fluid liquid glass surface
        vec3 N = getGlassNormal(p, t);

        // Optical Index of Refraction (Crown Glass ~ 1.52)
        // With chromatic dispersion (different IOR for Red, Green, Blue)
        float iorBase = 1.48;
        float dispersion = 0.038;

        // Refraction ray vectors per color channel (Snell's Law approximation)
        vec2 refrR = p + refract(-V, N, 1.0 / (iorBase - dispersion)).xy * 0.22;
        vec2 refrG = p + refract(-V, N, 1.0 / iorBase).xy * 0.22;
        vec2 refrB = p + refract(-V, N, 1.0 / (iorBase + dispersion)).xy * 0.22;

        // Sample refracted chromatic environment
        float r = sampleEnvironment(refrR, t).r;
        float g = sampleEnvironment(refrG, t).g;
        float b = sampleEnvironment(refrB, t).b;
        vec3 refractedColor = vec3(r, g, b);

        // ── Fresnel Reflection Equation ──────────────────────────────────────────
        // Light glances off grazing angles according to Fresnel-Schlick
        float NdotV = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - NdotV, 3.2);

        // Studio key light position (sweeps dynamically with pointer)
        vec3 lightPos1 = normalize(vec3(-0.4 + (uPointer.x - 0.5) * 1.5, 0.7 + (uPointer.y - 0.5) * 1.5, 1.2));
        vec3 H1 = normalize(lightPos1 + V);
        float spec1 = pow(max(dot(N, H1), 0.0), 42.0);

        // Soft secondary fill light
        vec3 lightPos2 = normalize(vec3(0.6, -0.5, 0.9));
        vec3 H2 = normalize(lightPos2 + V);
        float spec2 = pow(max(dot(N, H2), 0.0), 24.0);

        // ── Liquid Glass Specular Edge Sheen (Apple 2025 HIG) ───────────────────
        // Highlights that follow the curvature silhouette
        vec3 specularColor = vec3(1.0, 1.0, 1.0) * spec1 * 0.95;
        specularColor += vec3(0.75, 0.88, 1.0) * spec2 * 0.45;

        // Silhouette rim highlight
        float rimSheen = smoothstep(0.45, 0.95, fresnel);
        vec3 rimColor = vec3(0.85, 0.92, 1.0) * rimSheen * 0.55;

        // Internal glass physical absorption (Beer-Lambert optical tint)
        vec3 glassTint = vec3(0.96, 0.98, 1.0);
        vec3 finalColor = refractedColor * glassTint;

        // Combine refraction + Fresnel reflections + Specular gleam
        finalColor += specularColor;
        finalColor += rimColor;

        // Subtle ambient film grain for physical material texture
        float grain = (hash(gl_FragCoord.xy + t) - 0.5) * 0.015;
        finalColor += grain;

        // Tone mapping & soft contrast curve
        finalColor = clamp(finalColor, 0.0, 1.0);
        finalColor = pow(finalColor, vec3(0.95)); // Soft gamma lift

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // ── Mesh & Quad ───────────────────────────────────────────────────────────
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    // ── Resize Handler ────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      uniforms.uResolution.value.set(width, height);
    };

    window.addEventListener('resize', handleResize);

    // ── Animation Loop ────────────────────────────────────────────────────────
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Update uniform time
      uniforms.uTime.value += delta;

      // Smooth pointer interpolation (lerp)
      pointer.currentX += (pointer.targetX - pointer.currentX) * 0.06;
      pointer.currentY += (pointer.targetY - pointer.currentY) * 0.06;
      uniforms.uPointer.value.set(pointer.currentX, pointer.currentY);

      // Smooth state transitions (breach & unlocking)
      const targetBreach = isBreach ? 1.0 : 0.0;
      uniforms.uBreach.value += (targetBreach - uniforms.uBreach.value) * 0.12;

      const targetUnlocking = isUnlocking ? 1.0 : 0.0;
      uniforms.uUnlocking.value += (targetUnlocking - uniforms.uUnlocking.value) * 0.1;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [isBreach, isUnlocking]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
