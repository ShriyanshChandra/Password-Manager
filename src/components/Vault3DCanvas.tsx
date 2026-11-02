import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type Vault3DState = 'LOCKED' | 'UNLOCKING' | 'UNLOCKED' | 'BREACH';

interface Vault3DCanvasProps {
  vaultState: Vault3DState;
  interactive?: boolean;
}

export const Vault3DCanvas: React.FC<Vault3DCanvasProps> = ({ vaultState, interactive = true }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<Vault3DState>(vaultState);
  stateRef.current = vaultState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06090c, 0.045);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Vault Hologram Object Group
    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);

    // Outer Cyber Wireframe Hexagonal / Icosahedron Safe Cage
    const outerGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const outerCage = new THREE.Mesh(outerGeo, outerMat);
    vaultGroup.add(outerCage);

    // Middle Cryptographic Dial Ring 1
    const ring1Geo = new THREE.TorusGeometry(1.65, 0.025, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.7,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    vaultGroup.add(ring1);

    // Middle Cryptographic Dial Ring 2 (Perpendicular)
    const ring2Geo = new THREE.TorusGeometry(1.4, 0.02, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.6,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 2;
    vaultGroup.add(ring2);

    // Ring 3 (Diagonal)
    const ring3Geo = new THREE.TorusGeometry(1.15, 0.02, 16, 64);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0xffb000,
      transparent: true,
      opacity: 0.5,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.y = Math.PI / 4;
    vaultGroup.add(ring3);

    // Core Vault Octahedron / Quantum Cipher Core
    const coreGeo = new THREE.OctahedronGeometry(0.7, 0);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreWireMat);
    vaultGroup.add(coreMesh);

    // Inner Glowing Core Solid
    const innerSolidGeo = new THREE.OctahedronGeometry(0.4, 1);
    const innerSolidMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.85,
    });
    const innerSolid = new THREE.Mesh(innerSolidGeo, innerSolidMat);
    vaultGroup.add(innerSolid);

    // 3. Matrix Digital Stream Particles
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const speedArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      posArray[i * 3] = (Math.random() - 0.5) * 12;
      posArray[i * 3 + 1] = (Math.random() - 0.5) * 10;
      posArray[i * 3 + 2] = (Math.random() - 0.5) * 8;
      speedArray[i] = 0.02 + Math.random() * 0.05;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // Particle Material
    const particleMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0x00ff66,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ff66, 2, 8);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        targetRotationY += deltaX * 0.01;
        targetRotationX += deltaY * 0.01;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      } else {
        mouseX = normX * 0.35;
        mouseY = normY * 0.35;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const st = stateRef.current;

      // Color and appearance adaptations based on state
      if (st === 'LOCKED') {
        outerMat.color.setHex(0xff3355);
        outerMat.opacity = 0.4 + Math.sin(elapsedTime * 2.5) * 0.1;
        ring1Mat.color.setHex(0xff3355);
        ring2Mat.color.setHex(0xff9900);
        coreWireMat.color.setHex(0xff3355);
        innerSolidMat.color.setHex(0xff1133);
        pointLight.color.setHex(0xff3355);
        particleMat.color.setHex(0xff5533);
      } else if (st === 'UNLOCKING') {
        const pulse = Math.abs(Math.sin(elapsedTime * 12));
        outerMat.color.setHex(0x00ffaa);
        outerMat.opacity = 0.8;
        ring1Mat.color.setHex(0x00ff66);
        ring2Mat.color.setHex(0x00e5ff);
        coreWireMat.color.setHex(0xffffff);
        innerSolidMat.color.setHex(0x00ff66);
        pointLight.color.setHex(0x00ff66);
        pointLight.intensity = 3 + pulse * 2;
      } else if (st === 'BREACH') {
        outerMat.color.setHex(0xff0000);
        outerMat.opacity = Math.random() > 0.4 ? 0.9 : 0.1;
        pointLight.color.setHex(0xff0000);
        particleMat.color.setHex(0xff0000);
      } else {
        // UNLOCKED
        outerMat.color.setHex(0x00ff66);
        outerMat.opacity = 0.35 + Math.sin(elapsedTime) * 0.08;
        ring1Mat.color.setHex(0x00ff66);
        ring2Mat.color.setHex(0x00e5ff);
        ring3Mat.color.setHex(0xffb000);
        coreWireMat.color.setHex(0x00ff66);
        innerSolidMat.color.setHex(0x00ff66);
        pointLight.color.setHex(0x00ff66);
        pointLight.intensity = 1.8 + Math.sin(elapsedTime * 2) * 0.5;
        particleMat.color.setHex(0x00ff66);
      }

      // Rotational speeds
      const speedMultiplier = st === 'UNLOCKING' ? 7 : st === 'BREACH' ? 3 : 1;

      ring1.rotation.z += 0.012 * speedMultiplier;
      ring1.rotation.x += 0.006 * speedMultiplier;
      ring2.rotation.y += 0.015 * speedMultiplier;
      ring2.rotation.z += 0.009 * speedMultiplier;
      ring3.rotation.x -= 0.014 * speedMultiplier;
      ring3.rotation.y -= 0.01 * speedMultiplier;

      coreMesh.rotation.x += 0.008 * speedMultiplier;
      coreMesh.rotation.y += 0.018 * speedMultiplier;
      innerSolid.rotation.y -= 0.012 * speedMultiplier;

      const scalePulse = 1 + Math.sin(elapsedTime * 2.5) * 0.04;
      coreMesh.scale.set(scalePulse, scalePulse, scalePulse);

      // Smooth mouse follow
      if (!isDragging) {
        targetRotationY += (mouseX - targetRotationY) * 0.05;
        targetRotationX += (mouseY - targetRotationX) * 0.05;
      }

      vaultGroup.rotation.y = targetRotationY + (st === 'UNLOCKING' ? elapsedTime * 2 : 0);
      vaultGroup.rotation.x = targetRotationX;

      // Matrix particles downward flow
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] -= speedArray[i] * (st === 'UNLOCKING' ? 2.5 : 1);
        if (positions[i * 3 + 1] < -5) {
          positions[i * 3 + 1] = 5;
          positions[i * 3] = (Math.random() - 0.5) * 12;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.dispose();
      outerGeo.dispose();
      ring1Geo.dispose();
      ring2Geo.dispose();
      ring3Geo.dispose();
      coreGeo.dispose();
      innerSolidGeo.dispose();
      particleGeo.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive]);

  return (
    <div
      ref={mountRef}
      className="vault-3d-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: interactive ? 'grab' : 'default',
        overflow: 'hidden',
      }}
    />
  );
};
