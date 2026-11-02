import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type Beach3DState = 'LOCKED' | 'UNLOCKING' | 'UNLOCKED' | 'BREACH';

interface BeachScene3DProps {
  vaultState: Beach3DState;
}

export const BeachScene3D: React.FC<BeachScene3DProps> = ({ vaultState }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<Beach3DState>(vaultState);
  stateRef.current = vaultState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // ── Scene & Camera ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0520);
    scene.fog = new THREE.Fog(0x0d0520, 28, 55);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 120);
    camera.position.set(0, 1.8, 10);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // ── Sky gradient quad ───────────────────────────────────────────────────────
    // Sky goes from deep indigo-purple (top) → fiery crimson (mid) → golden horizon (bottom)
    const skyGeo = new THREE.PlaneGeometry(120, 60, 1, 6);
    const skyColors = skyGeo.attributes.position;
    const skyColorAttr: number[] = [];
    for (let i = 0; i < skyColors.count; i++) {
      const y = (skyColors.getY(i) + 30) / 60; // 0 = bottom, 1 = top
      if (y > 0.82) {
        // Deep indigo-purple at zenith
        skyColorAttr.push(0.05, 0.02, 0.18);
      } else if (y > 0.6) {
        // Purple → crimson
        const t = (y - 0.6) / 0.22;
        skyColorAttr.push(0.05 + t * 0.55, 0.02 + t * 0.03, 0.18 - t * 0.12);
      } else if (y > 0.38) {
        // Crimson → fiery orange-red
        const t = (y - 0.38) / 0.22;
        skyColorAttr.push(0.6 + t * 0.2, 0.05 + t * 0.1, 0.06 - t * 0.02);
      } else if (y > 0.18) {
        // Orange → gold
        const t = (y - 0.18) / 0.2;
        skyColorAttr.push(0.8 + t * 0.1, 0.25 + t * 0.35, 0.01 + t * 0.02);
      } else {
        // Golden horizon
        skyColorAttr.push(0.9, 0.6, 0.03);
      }
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColorAttr, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(0, 8, -20);
    skyMesh.rotation.x = Math.PI;
    scene.add(skyMesh);

    // ── Sun disc ────────────────────────────────────────────────────────────────
    const sunGeo = new THREE.CircleGeometry(1.6, 48);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc22, fog: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(-4.5, 3.6, -18);
    scene.add(sunMesh);

    // Sun glow halo
    const haloGeo = new THREE.CircleGeometry(3.0, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.18,
      fog: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.set(-4.5, 3.6, -18.01);
    scene.add(haloMesh);

    // Outer softer halo
    const halo2Geo = new THREE.CircleGeometry(5.5, 48);
    const halo2Mat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.07,
      fog: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo2Mesh = new THREE.Mesh(halo2Geo, halo2Mat);
    halo2Mesh.position.set(-4.5, 3.6, -18.02);
    scene.add(halo2Mesh);

    // ── Dramatic clouds ─────────────────────────────────────────────────────────
    const cloudMeshes: THREE.Mesh[] = [];
    const cloudColors = [0xcc2200, 0xdd3311, 0xcc4400, 0xbb3300, 0xdd4422, 0xcc5533];
    const cloudData = [
      { x: -16, y: 7.0, z: -22, sx: 14, sy: 3.5 },
      { x: 5,   y: 6.5, z: -21, sx: 12, sy: 3.0 },
      { x: 18,  y: 6.0, z: -23, sx: 10, sy: 2.5 },
      { x: -8,  y: 5.2, z: -19, sx: 9,  sy: 2.0 },
      { x: 12,  y: 5.8, z: -20, sx: 11, sy: 2.8 },
      { x: -22, y: 5.5, z: -24, sx: 8,  sy: 2.2 },
      { x: -2,  y: 8.0, z: -25, sx: 16, sy: 4.0 },
      { x: 22,  y: 7.5, z: -24, sx: 13, sy: 3.0 },
    ];
    cloudData.forEach((cd, i) => {
      const cGeo = new THREE.PlaneGeometry(cd.sx, cd.sy, 3, 2);
      const cMat = new THREE.MeshBasicMaterial({
        color: cloudColors[i % cloudColors.length],
        transparent: true,
        opacity: 0.72,
        fog: false,
        depthWrite: false,
      });
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.set(cd.x, cd.y, cd.z);
      scene.add(cMesh);
      cloudMeshes.push(cMesh);
    });

    // ── Stars (visible near top of sky) ────────────────────────────────────────
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 100;
      starPos[i * 3 + 1] = 12 + Math.random() * 20;
      starPos[i * 3 + 2] = -15 - Math.random() * 30;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.08, color: 0xffffee, fog: false });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Mountains / hills (dark silhouette) ────────────────────────────────────
    const mountainShape = new THREE.Shape();
    mountainShape.moveTo(-35, -2);
    mountainShape.lineTo(-28, 3.5);
    mountainShape.lineTo(-22, 1.5);
    mountainShape.lineTo(-16, 5.5);
    mountainShape.lineTo(-9,  2.5);
    mountainShape.lineTo(-2,  7.0);
    mountainShape.lineTo(4,   3.5);
    mountainShape.lineTo(10,  6.2);
    mountainShape.lineTo(17,  4.0);
    mountainShape.lineTo(24,  2.8);
    mountainShape.lineTo(30,  1.5);
    mountainShape.lineTo(36,  -2);
    mountainShape.closePath();
    const mtnGeo = new THREE.ShapeGeometry(mountainShape);
    const mtnMat = new THREE.MeshBasicMaterial({ color: 0x080415, fog: false });
    const mtnMesh = new THREE.Mesh(mtnGeo, mtnMat);
    mtnMesh.position.set(-1, 0.2, -12);
    scene.add(mtnMesh);

    // City lights on mountains - tiny warm dots
    const cityGeo = new THREE.BufferGeometry();
    const cityPos: number[] = [];
    for (let i = 0; i < 120; i++) {
      cityPos.push(
        (Math.random() - 0.5) * 60,
        Math.random() * 2.5,
        -11.5 - Math.random() * 4
      );
    }
    cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPos, 3));
    const cityMat = new THREE.PointsMaterial({
      size: 0.07,
      color: 0xffcc77,
      transparent: true,
      opacity: 0.85,
      fog: false,
    });
    const cityLights = new THREE.Points(cityGeo, cityMat);
    scene.add(cityLights);

    // ── Ocean plane ─────────────────────────────────────────────────────────────
    const oceanGeo = new THREE.PlaneGeometry(90, 40, 80, 40);
    const oceanMat = new THREE.MeshPhongMaterial({
      color: 0x0a3d62,
      shininess: 120,
      specular: new THREE.Color(0xff7700),
      transparent: true,
      opacity: 0.92,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(0, -0.3, -6);
    scene.add(oceanMesh);

    // Save original ocean vertex Y positions for animation
    const oceanPositions = oceanGeo.attributes.position.array as Float32Array;
    const oceanBaseY = new Float32Array(oceanPositions.length / 3);
    for (let i = 0; i < oceanPositions.length / 3; i++) {
      oceanBaseY[i] = oceanPositions[i * 3 + 2]; // PlaneGeometry rotated, so Z is Y in world
    }

    // Sunset reflection stripe on ocean
    const reflGeo = new THREE.PlaneGeometry(4.5, 40);
    const reflMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const reflMesh = new THREE.Mesh(reflGeo, reflMat);
    reflMesh.rotation.x = -Math.PI / 2;
    reflMesh.position.set(-4.5, -0.28, -5);
    scene.add(reflMesh);

    // ── Beach/sand ──────────────────────────────────────────────────────────────
    const sandGeo = new THREE.PlaneGeometry(90, 18, 20, 5);
    const sandMat = new THREE.MeshPhongMaterial({ color: 0xb5865a, shininess: 8 });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.position.set(0, -0.32, 4);
    scene.add(sandMesh);

    // ── Rocky foreground boulders ───────────────────────────────────────────────
    const rockMat = new THREE.MeshPhongMaterial({ color: 0x1a1028, shininess: 20 });
    const rockData2 = [
      { x: -5.5, y: -0.1, z: 2.0, r: 0.7 },
      { x: -4.2, y: -0.2, z: 1.6, r: 0.45 },
      { x: -6.8, y: -0.25, z: 1.2, r: 0.55 },
      { x: -3.5, y: -0.3, z: 0.9, r: 0.35 },
      { x: -7.5, y: -0.2, z: 1.8, r: 0.65 },
      { x: -5.0, y: -0.1, z: 0.5, r: 0.3 },
    ];
    const rockMeshes: THREE.Mesh[] = [];
    rockData2.forEach(rd => {
      const rGeo = new THREE.DodecahedronGeometry(rd.r, 0);
      const rMesh = new THREE.Mesh(rGeo, rockMat);
      rMesh.position.set(rd.x, rd.y, rd.z);
      rMesh.rotation.y = Math.random() * Math.PI;
      scene.add(rMesh);
      rockMeshes.push(rMesh);
    });

    // ── Driftwood log ───────────────────────────────────────────────────────────
    const logGeo = new THREE.CylinderGeometry(0.12, 0.18, 3.5, 8);
    const logMat = new THREE.MeshPhongMaterial({ color: 0x3d2510, shininess: 5 });
    const logMesh = new THREE.Mesh(logGeo, logMat);
    logMesh.position.set(-8.5, -0.25, 3.5);
    logMesh.rotation.z = Math.PI / 2;
    logMesh.rotation.y = 0.3;
    scene.add(logMesh);

    // ── Palm trees ──────────────────────────────────────────────────────────────
    const silhouetteColor = 0x080415;
    const palmTrunkMat = new THREE.MeshBasicMaterial({ color: silhouetteColor });
    const palmLeafMat = new THREE.MeshBasicMaterial({ color: silhouetteColor, side: THREE.DoubleSide });

    const createPalmTree = (x: number, z: number, height: number, lean: number, leanDir: number) => {
      // Trunk: tapered cylinder
      const trunkGeo = new THREE.CylinderGeometry(0.06, 0.14, height, 6);
      const trunk = new THREE.Mesh(trunkGeo, palmTrunkMat);
      trunk.position.set(x, height / 2 - 0.35, z);
      trunk.rotation.z = lean * leanDir;
      scene.add(trunk);

      // Leaves: fanned out from top
      const topX = x + Math.sin(lean * leanDir) * height;
      const topY = height - 0.35;
      const leafAngles = [0, 0.55, -0.55, 1.1, -1.1, 1.6, -1.6, 2.1, -2.1, Math.PI];
      leafAngles.forEach(angle => {
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0);
        leafShape.quadraticCurveTo(0.6, 0.25, 1.5, -0.2);
        leafShape.quadraticCurveTo(0.55, -0.15, 0, 0);
        const leafGeo = new THREE.ShapeGeometry(leafShape);
        const leaf = new THREE.Mesh(leafGeo, palmLeafMat);
        leaf.position.set(topX, topY, z);
        leaf.rotation.z = angle;
        leaf.rotation.y = Math.random() * 0.3;
        leaf.scale.set(1.3, 1.3, 1);
        scene.add(leaf);
      });
    };

    createPalmTree(7.5,  0.0, 9.5,  0.12,  1);
    createPalmTree(9.5, -0.5, 11.5, 0.08,  1);
    createPalmTree(11.5, 0.2, 8.0,  0.15, -1);
    createPalmTree(13.0, 0.0, 7.0,  0.05,  1);

    // ── Low bushes / scrub ──────────────────────────────────────────────────────
    const bushMat = new THREE.MeshBasicMaterial({ color: silhouetteColor });
    const bushData = [
      { x: 5.5, z: 3.0, r: 0.55 }, { x: 6.8, z: 3.2, r: 0.4 },
      { x: 4.5, z: 3.5, r: 0.35 }, { x: 8.0, z: 2.8, r: 0.45 },
      { x: -9.5, z: 3.0, r: 0.5 }, { x: -11, z: 3.3, r: 0.42 },
      { x: 14.5, z: 2.5, r: 0.6 }, { x: 16.0, z: 2.2, r: 0.45 },
    ];
    bushData.forEach(bd => {
      const bGeo = new THREE.SphereGeometry(bd.r, 6, 5);
      const bMesh = new THREE.Mesh(bGeo, bushMat);
      bMesh.position.set(bd.x, -0.35 + bd.r * 0.6, bd.z);
      bMesh.scale.set(1.4, 0.75, 1.0);
      scene.add(bMesh);
    });

    // ── Ocean foam particles ────────────────────────────────────────────────────
    const foamCount = 200;
    const foamGeo = new THREE.BufferGeometry();
    const foamPos = new Float32Array(foamCount * 3);
    for (let i = 0; i < foamCount; i++) {
      foamPos[i * 3] = (Math.random() - 0.5) * 50;
      foamPos[i * 3 + 1] = -0.28;
      foamPos[i * 3 + 2] = -0.5 + Math.random() * 2.5;
    }
    foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3));
    const foamMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0xddeeff,
      transparent: true,
      opacity: 0.7,
    });
    const foamParticles = new THREE.Points(foamGeo, foamMat);
    scene.add(foamParticles);

    // ── Lights ──────────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xff8844, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xff9933, 1.2);
    sunLight.position.set(-4, 5, 2);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xff7722, 0x1a0d30, 0.5);
    scene.add(hemiLight);

    // ── Animation Loop ──────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const st = stateRef.current;

      // Ocean wave animation
      const oceanPos = oceanGeo.attributes.position.array as Float32Array;
      const oceanVertexCount = oceanPos.length / 3;
      for (let i = 0; i < oceanVertexCount; i++) {
        const x = oceanPos[i * 3];
        const baseZ = oceanBaseY[i];
        oceanPos[i * 3 + 2] = baseZ + Math.sin(x * 0.4 + t * 1.5) * 0.18 + Math.sin(x * 0.7 - t * 1.1) * 0.1;
      }
      oceanGeo.attributes.position.needsUpdate = true;
      oceanGeo.computeVertexNormals();

      // Gentle cloud drift
      cloudMeshes.forEach((cm, i) => {
        cm.position.x += 0.003 * (i % 2 === 0 ? 1 : -0.6);
        if (cm.position.x > 45) cm.position.x = -45;
        if (cm.position.x < -45) cm.position.x = 45;
      });

      // Reflection flicker
      reflMesh.material.opacity = 0.18 + Math.sin(t * 2.2) * 0.06;

      // State reactions
      if (st === 'BREACH') {
        sunMat.color.setHex(0xff2200);
        haloMat.color.setHex(0xff0000);
        oceanMat.color.setHex(0x3d0010);
        ambientLight.color.setHex(0xff2200);
      } else if (st === 'UNLOCKING') {
        const pulse = Math.abs(Math.sin(t * 8));
        sunMat.color.setHex(0xffdd44);
        ambientLight.intensity = 0.6 + pulse * 0.5;
        haloMat.opacity = 0.2 + pulse * 0.15;
      } else {
        sunMat.color.setHex(0xffcc22);
        haloMat.color.setHex(0xff7700);
        oceanMat.color.setHex(0x0a3d62);
        ambientLight.color.setHex(0xff8844);
        ambientLight.intensity = 0.6;
        haloMat.opacity = 0.18;
      }

      // Gentle camera bob
      camera.position.y = 1.8 + Math.sin(t * 0.35) * 0.04;

      renderer.render(scene, camera);
    };

    animate();

    // ── Resize handler ──────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      skyGeo.dispose(); skyMat.dispose();
      sunGeo.dispose(); sunMat.dispose();
      haloGeo.dispose(); haloMat.dispose();
      halo2Geo.dispose(); halo2Mat.dispose();
      cloudMeshes.forEach(cm => { cm.geometry.dispose(); });
      starGeo.dispose(); starMat.dispose();
      mtnGeo.dispose(); mtnMat.dispose();
      cityGeo.dispose(); cityMat.dispose();
      oceanGeo.dispose(); oceanMat.dispose();
      reflGeo.dispose(); reflMat.dispose();
      sandGeo.dispose(); sandMat.dispose();
      logGeo.dispose(); logMat.dispose();
      foamGeo.dispose(); foamMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
};
