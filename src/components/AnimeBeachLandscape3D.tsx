import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const AnimeBeachLandscape3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // ── 1. Scene & Fog ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // Studio Ghibli summer atmosphere: soft azure haze at horizon
    const skyHazeColor = 0xcde8ff;
    scene.background = new THREE.Color(skyHazeColor);
    scene.fog = new THREE.Fog(skyHazeColor, 40, 110);

    // ── 2. Camera ─────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 200);
    camera.position.set(0, 3.4, 13);
    camera.lookAt(0, 1.4, -10);

    // ── 3. Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ── 4. Lighting (Warm Summer Sunlight) ─────────────────────────────────────
    const sunLight = new THREE.DirectionalLight(0xfff6df, 1.7);
    sunLight.position.set(28, 42, 12);
    scene.add(sunLight);

    // Sky + Sand ambient illumination
    const hemiLight = new THREE.HemisphereLight(0x70c5ff, 0xfde68a, 0.85);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // ── 5. Anime Sky Gradient Dome ───────────────────────────────────────────
    const skyGeo = new THREE.CylinderGeometry(140, 140, 75, 24, 8, true);
    skyGeo.scale(-1, 1, 1);
    const skyPos = skyGeo.attributes.position;
    const skyColors: number[] = [];
    for (let i = 0; i < skyPos.count; i++) {
      const yNorm = (skyPos.getY(i) + 37.5) / 75; // 0 = horizon, 1 = zenith
      if (yNorm > 0.7) {
        // Vibrant deep summer cerulean
        skyColors.push(0.08, 0.48, 0.84);
      } else if (yNorm > 0.35) {
        // Bright azure anime sky
        const t = (yNorm - 0.35) / 0.35;
        skyColors.push(0.2 + t * 0.1, 0.65 + t * 0.05, 0.95);
      } else {
        // Pale horizon sky with sunny warmth
        const t = yNorm / 0.35;
        skyColors.push(0.78 - t * 0.45, 0.9 - t * 0.2, 1.0 - t * 0.05);
      }
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(0, 15, -10);
    scene.add(skyMesh);

    // ── 6. Sun Disc & Halo ───────────────────────────────────────────────────
    const sunGroup = new THREE.Group();
    sunGroup.position.set(32, 26, -55);
    scene.add(sunGroup);

    const sunDiscGeo = new THREE.CircleGeometry(3.6, 36);
    const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    sunGroup.add(sunDisc);

    // Sun core glow
    const halo1Geo = new THREE.CircleGeometry(7.0, 36);
    const halo1Mat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    sunGroup.add(new THREE.Mesh(halo1Geo, halo1Mat));

    // Outer warm atmospheric glow
    const halo2Geo = new THREE.CircleGeometry(16.0, 36);
    const halo2Mat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    sunGroup.add(new THREE.Mesh(halo2Geo, halo2Mat));

    // Sunbeams / Crepuscular God Rays (Studio Ghibli sunlight, matching reference)
    const rayGroup = new THREE.Group();
    rayGroup.position.set(30, 26, -52);
    scene.add(rayGroup);

    const rayGeo = new THREE.PlaneGeometry(10, 58);
    rayGeo.translate(0, -29, 0);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfffbe8,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    [-0.36, -0.20, -0.06, 0.09, 0.24].forEach((rot) => {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.rotation.z = -0.68 + rot;
      ray.rotation.y = 0.16;
      rayGroup.add(ray);
    });

    // ── 7. Soft Billowing Anime Cumulus Clouds ────────────────────────────────
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);

    interface CloudPuffData {
      group: THREE.Group;
      baseX: number;
      speed: number;
    }
    const cloudClusters: CloudPuffData[] = [];

    const cloudClusterDefs = [
      { x: -35, y: 16, z: -48, scale: 1.6, speed: 0.012 },
      { x: -8,  y: 19, z: -52, scale: 2.1, speed: 0.009 },
      { x: 18,  y: 15, z: -45, scale: 1.7, speed: 0.014 },
      { x: 44,  y: 20, z: -54, scale: 2.4, speed: 0.008 },
      { x: -55, y: 13, z: -42, scale: 1.3, speed: 0.015 },
      { x: 65,  y: 17, z: -50, scale: 1.8, speed: 0.011 },
    ];

    const puffMatTop = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      fog: false,
    });
    const puffMatBase = new THREE.MeshLambertMaterial({
      color: 0xd6e5f8,
      transparent: true,
      opacity: 0.88,
      fog: false,
    });

    cloudClusterDefs.forEach((def) => {
      const cluster = new THREE.Group();
      cluster.position.set(def.x, def.y, def.z);
      cluster.scale.set(def.scale, def.scale, def.scale);

      // Multi-puff formation to resemble Studio Ghibli cumulus clouds
      const puffs = [
        { x: 0,    y: 0,   z: 0,    r: 3.2, mat: puffMatTop },
        { x: -2.6, y: -0.6,z: 0.4,  r: 2.5, mat: puffMatTop },
        { x: 2.8,  y: -0.5,z: -0.3, r: 2.6, mat: puffMatTop },
        { x: -1.2, y: 1.8, z: 0.2,  r: 2.4, mat: puffMatTop },
        { x: 1.4,  y: 1.6, z: -0.1, r: 2.2, mat: puffMatTop },
        { x: 0,    y: -1.4,z: 0.2,  r: 2.8, mat: puffMatBase },
        { x: -2.2, y: -1.2,z: 0.3,  r: 2.2, mat: puffMatBase },
        { x: 2.4,  y: -1.2,z: -0.2, r: 2.3, mat: puffMatBase },
      ];

      puffs.forEach((p) => {
        const pGeo = new THREE.SphereGeometry(p.r, 8, 6);
        const pMesh = new THREE.Mesh(pGeo, p.mat);
        pMesh.position.set(p.x, p.y, p.z);
        cluster.add(pMesh);
      });

      cloudsGroup.add(cluster);
      cloudClusters.push({ group: cluster, baseX: def.x, speed: def.speed });
    });

    // ── 8. Distant Mountains & Islands (Studio Ghibli style) ───────────────────
    const createMountain = (
      shapeCoords: [number, number][],
      colorHex: number,
      zPos: number,
      xPos: number,
      yPos: number
    ) => {
      const shape = new THREE.Shape();
      shape.moveTo(shapeCoords[0][0], shapeCoords[0][1]);
      for (let i = 1; i < shapeCoords.length; i++) {
        shape.lineTo(shapeCoords[i][0], shapeCoords[i][1]);
      }
      shape.closePath();

      const mGeo = new THREE.ShapeGeometry(shape);
      const mMat = new THREE.MeshLambertMaterial({ color: colorHex });
      const mMesh = new THREE.Mesh(mGeo, mMat);
      mMesh.position.set(xPos, yPos, zPos);
      scene.add(mMesh);
    };

    // Far hazy island ridge (blue-green Ghibli silhouette)
    createMountain(
      [
        [-50, -2], [-40, 5.5], [-32, 3.8], [-24, 7.5], [-16, 4.2],
        [-8, 9.2], [0, 5.0], [10, 8.4], [22, 4.5], [35, 7.0],
        [48, 3.2], [55, -2],
      ],
      0x5a9ebf, // Soft azure haze
      -40,
      -4,
      -0.5
    );

    // Closer lush green island / headland
    createMountain(
      [
        [-28, -2], [-20, 6.2], [-14, 4.5], [-6, 7.8], [2, 3.8],
        [12, 6.0], [20, 2.5], [26, -2],
      ],
      0x2f7d54, // Rich anime mossy green
      -26,
      -10,
      -0.6
    );

    // ── 9. Animated Anime Ocean ───────────────────────────────────────────────
    // Multi-frequency wave mesh with turquoise near-shore and sapphire deep water
    const oceanWidth = 140;
    const oceanLength = 80;
    const oceanGeo = new THREE.PlaneGeometry(oceanWidth, oceanLength, 120, 70);
    oceanGeo.rotateX(-Math.PI / 2);
    oceanGeo.translate(0, -0.15, -18);

    const oceanCount = oceanGeo.attributes.position.count;
    const oceanColors = new Float32Array(oceanCount * 3);
    const origPositions = oceanGeo.attributes.position.clone();

    // Base color gradient setup
    for (let i = 0; i < oceanCount; i++) {
      const zVal = origPositions.getZ(i); // Z in world space is distance from shore
      // Distance: shore is around z = 10, deep water is z = -50
      const depthFactor = THREE.MathUtils.clamp((zVal + 50) / 60, 0, 1);

      if (depthFactor > 0.85) {
        // Crystal shallow mint turquoise right at shoreline
        oceanColors[i * 3]     = 0.22; // R
        oceanColors[i * 3 + 1] = 0.86; // G
        oceanColors[i * 3 + 2] = 0.82; // B
      } else if (depthFactor > 0.5) {
        // Tropical bright turquoise
        const t = (depthFactor - 0.5) / 0.35;
        oceanColors[i * 3]     = 0.05 + t * 0.17;
        oceanColors[i * 3 + 1] = 0.65 + t * 0.21;
        oceanColors[i * 3 + 2] = 0.85 - t * 0.03;
      } else if (depthFactor > 0.2) {
        // Cerulean anime blue
        const t = (depthFactor - 0.2) / 0.3;
        oceanColors[i * 3]     = 0.02 + t * 0.03;
        oceanColors[i * 3 + 1] = 0.45 + t * 0.2;
        oceanColors[i * 3 + 2] = 0.82 + t * 0.03;
      } else {
        // Deep sapphire ocean
        oceanColors[i * 3]     = 0.01;
        oceanColors[i * 3 + 1] = 0.25;
        oceanColors[i * 3 + 2] = 0.65;
      }
    }
    oceanGeo.setAttribute('color', new THREE.BufferAttribute(oceanColors, 3));
    const baseOceanColors = new Float32Array(oceanColors);

    const oceanMat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 90,
      specular: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.94,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    scene.add(oceanMesh);

    // ── 10. Multi-layer Animated Rolling Waves & Foam Wash ───────────────────
    // Wave 1: Rolling outer swell with white crest line
    const rollWaveGeo1 = new THREE.PlaneGeometry(130, 2.6, 40, 2);
    rollWaveGeo1.rotateX(-Math.PI / 2);
    const rollWaveMat1 = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rollWaveMesh1 = new THREE.Mesh(rollWaveGeo1, rollWaveMat1);
    rollWaveMesh1.position.set(0, 0.08, -12);
    scene.add(rollWaveMesh1);

    // Wave 2: Breaking mid-water surf line
    const rollWaveGeo2 = new THREE.PlaneGeometry(125, 3.2, 40, 2);
    rollWaveGeo2.rotateX(-Math.PI / 2);
    const rollWaveMat2 = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rollWaveMesh2 = new THREE.Mesh(rollWaveGeo2, rollWaveMat2);
    rollWaveMesh2.position.set(0, 0.05, 2);
    scene.add(rollWaveMesh2);

    // Shoreline surge foam wash
    const foamGeo = new THREE.PlaneGeometry(120, 7.5, 60, 10);
    foamGeo.rotateX(-Math.PI / 2);
    foamGeo.translate(0, -0.06, 9.5);

    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    scene.add(foamMesh);

    // ── 11. Sandy Beach & Coastal Bluffs ──────────────────────────────────────
    // Golden sand plane sloping gently into the surf
    const beachGeo = new THREE.PlaneGeometry(140, 26, 30, 8);
    beachGeo.rotateX(-Math.PI / 2);
    beachGeo.translate(0, -0.22, 18);

    const beachMat = new THREE.MeshLambertMaterial({
      color: 0xfef08a, // Warm anime golden sand
    });
    const beachMesh = new THREE.Mesh(beachGeo, beachMat);
    scene.add(beachMesh);

    // Wet sand line where ocean surf recedes
    const wetSandGeo = new THREE.PlaneGeometry(130, 4.5);
    wetSandGeo.rotateX(-Math.PI / 2);
    wetSandGeo.translate(0, -0.19, 10.5);
    const wetSandMat = new THREE.MeshLambertMaterial({
      color: 0xd5ad70, // Glossier wet sand
      transparent: true,
      opacity: 0.82,
    });
    scene.add(new THREE.Mesh(wetSandGeo, wetSandMat));

    // Foreground grassy coastal bluff (left side, like image 3)
    const bluffGeo = new THREE.PlaneGeometry(50, 16, 16, 6);
    bluffGeo.rotateX(-Math.PI / 2);
    bluffGeo.rotateZ(0.12);
    bluffGeo.translate(-16, 0.15, 18);
    const bluffMat = new THREE.MeshLambertMaterial({ color: 0x22c55e }); // Lush Ghibli green
    const bluffMesh = new THREE.Mesh(bluffGeo, bluffMat);
    scene.add(bluffMesh);

    // ── 12. Tropical Palm Trees with Wind Simulation ─────────────────────────
    interface PalmTree {
      trunk: THREE.Mesh;
      fronds: THREE.Group;
      baseX: number;
      baseZ: number;
      swayOffset: number;
      frondMeshes: THREE.Mesh[];
    }
    const palmTrees: PalmTree[] = [];

    const createPalmTree = (x: number, z: number, height: number, swayOffset: number) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, -0.2, z);
      scene.add(treeGroup);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, height, 8);
      trunkGeo.translate(0, height / 2, 0);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      treeGroup.add(trunk);

      // Crown of Fronds
      const frondsGroup = new THREE.Group();
      frondsGroup.position.set(0, height, 0);
      treeGroup.add(frondsGroup);

      const frondMeshes: THREE.Mesh[] = [];
      const frondMat = new THREE.MeshLambertMaterial({
        color: 0x16a34a,
        side: THREE.DoubleSide,
      });

      const frondCount = 10;
      for (let i = 0; i < frondCount; i++) {
        const angle = (i / frondCount) * Math.PI * 2;
        const frondShape = new THREE.Shape();
        frondShape.moveTo(0, 0);
        frondShape.quadraticCurveTo(1.2, 0.6, 2.8, -0.3);
        frondShape.quadraticCurveTo(1.4, -0.2, 0, 0);

        const frondGeo = new THREE.ShapeGeometry(frondShape);
        const frondMesh = new THREE.Mesh(frondGeo, frondMat);
        frondMesh.rotation.z = 0.35;
        frondMesh.rotation.y = angle;
        frondMesh.scale.set(1.4, 1.2, 1.2);
        frondsGroup.add(frondMesh);
        frondMeshes.push(frondMesh);
      }

      palmTrees.push({
        trunk,
        fronds: frondsGroup,
        baseX: x,
        baseZ: z,
        swayOffset,
        frondMeshes,
      });
    };

    createPalmTree(14,  6.5,  6.8, 0.2);
    createPalmTree(17,  5.0,  8.0, 1.1);
    createPalmTree(20,  7.2,  6.2, 2.3);
    createPalmTree(-18, 12.0, 5.8, 3.4);
    createPalmTree(-22, 13.5, 6.5, 0.7);

    // ── 13. Wind-Oscillating Coastal Bushes ────────────────────────────────────
    interface BushObject {
      mesh: THREE.Mesh;
      baseScale: number;
      swayOffset: number;
    }
    const bushes: BushObject[] = [];

    const bushMat1 = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const bushMat2 = new THREE.MeshLambertMaterial({ color: 0x22c55e });

    const bushCoords = [
      { x: 11,  z: 10, r: 0.9, mat: bushMat1 },
      { x: 13,  z: 11, r: 1.2, mat: bushMat2 },
      { x: 15,  z: 9.5, r: 0.8, mat: bushMat1 },
      { x: -12, z: 14, r: 1.1, mat: bushMat2 },
      { x: -15, z: 15, r: 1.4, mat: bushMat1 },
      { x: -17, z: 13, r: 0.9, mat: bushMat2 },
      { x: -9,  z: 16, r: 0.7, mat: bushMat1 },
    ];

    bushCoords.forEach((b, idx) => {
      const bGeo = new THREE.SphereGeometry(b.r, 8, 6);
      bGeo.scale(1.3, 0.85, 1.1);
      const bMesh = new THREE.Mesh(bGeo, b.mat);
      bMesh.position.set(b.x, 0.1, b.z);
      scene.add(bMesh);
      bushes.push({ mesh: bMesh, baseScale: 1.0, swayOffset: idx * 0.8 });
    });

    // ── 14. Wildflowers & Grass Highlights ────────────────────────────────────
    const flowersGroup = new THREE.Group();
    scene.add(flowersGroup);

    const flowerMatRed = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const flowerMatYellow = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const flowerGeo = new THREE.SphereGeometry(0.09, 4, 4);

    for (let i = 0; i < 45; i++) {
      const mat = i % 2 === 0 ? flowerMatRed : flowerMatYellow;
      const fl = new THREE.Mesh(flowerGeo, mat);
      fl.position.set(
        -22 + Math.random() * 16,
        0.25 + Math.random() * 0.15,
        14 + Math.random() * 6
      );
      flowersGroup.add(fl);
    }

    // Swaying coastal anime grass tufts (matching foreground of Reference Image 3)
    const grassGroup = new THREE.Group();
    scene.add(grassGroup);
    const grassMat = new THREE.MeshLambertMaterial({
      color: 0x16a34a,
      side: THREE.DoubleSide,
    });
    const grassBladeGeo = new THREE.BufferGeometry();
    const grassVerts = new Float32Array([
      -0.08, 0, 0,
       0.08, 0, 0,
       0.0, 0.75, 0.14,
    ]);
    grassBladeGeo.setAttribute('position', new THREE.BufferAttribute(grassVerts, 3));

    interface GrassTuft {
      mesh: THREE.Mesh;
      baseRotZ: number;
      offset: number;
    }
    const grassTufts: GrassTuft[] = [];

    for (let i = 0; i < 65; i++) {
      const blade = new THREE.Mesh(grassBladeGeo, grassMat);
      const bx = -25 + Math.random() * 18;
      const bz = 13.5 + Math.random() * 7.5;
      blade.position.set(bx, 0.22, bz);
      blade.rotation.y = Math.random() * Math.PI * 2;
      const sc = 0.8 + Math.random() * 0.65;
      blade.scale.set(sc, sc, sc);
      grassGroup.add(blade);
      grassTufts.push({ mesh: blade, baseRotZ: blade.rotation.z, offset: i * 0.25 });
    }

    // ── 15. Distant Soaring White Birds (Seagulls) ────────────────────────────
    interface Bird {
      group: THREE.Group;
      baseX: number;
      baseY: number;
      baseZ: number;
      radius: number;
      speed: number;
      angle: number;
      wingL: THREE.Mesh;
      wingR: THREE.Mesh;
    }
    const birds: Bird[] = [];

    const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const wingGeo = new THREE.BufferGeometry();
    const wingVertices = new Float32Array([
      0, 0, 0,
      0.45, 0.08, -0.15,
      0.15, 0, 0.25,
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));

    const birdDefs = [
      { r: 24, y: 16, z: -32, speed: 0.007, angle: 0 },
      { r: 28, y: 18, z: -36, speed: 0.006, angle: 1.8 },
      { r: 20, y: 14, z: -28, speed: 0.009, angle: 3.5 },
      { r: 32, y: 21, z: -40, speed: 0.005, angle: 4.8 },
    ];

    birdDefs.forEach((b) => {
      const bGroup = new THREE.Group();
      scene.add(bGroup);

      const wingL = new THREE.Mesh(wingGeo, birdMat);
      const wingR = new THREE.Mesh(wingGeo, birdMat);
      wingR.scale.x = -1;

      bGroup.add(wingL);
      bGroup.add(wingR);

      birds.push({
        group: bGroup,
        baseX: 4,
        baseY: b.y,
        baseZ: b.z,
        radius: b.r,
        speed: b.speed,
        angle: b.angle,
        wingL,
        wingR,
      });
    });

    // ── 16. Subtle Environmental Floating Spores / Sunlight Particles ─────────
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3]     = (Math.random() - 0.5) * 55;
      particlePos[i * 3 + 1] = 0.5 + Math.random() * 12;
      particlePos[i * 3 + 2] = -5 + Math.random() * 25;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ── 17. Smooth Cursor Parallax ───────────────────────────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetCamX = 0;
    let targetCamY = 3.4;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseX = normX * 0.9;
      mouseY = normY * 0.45;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // ── 18. Tab Inactivity Optimization ──────────────────────────────────────
    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── 19. Animation Loop ───────────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      const t = clock.getElapsedTime();

      // ── Ocean Wave Vertex Displacement & Crest Foam ──────────────────────
      const posAttr = oceanGeo.attributes.position;
      const colorAttr = oceanGeo.attributes.color as THREE.BufferAttribute;

      for (let i = 0; i < oceanCount; i++) {
        const ox = origPositions.getX(i);
        const oy = origPositions.getY(i);
        const oz = origPositions.getZ(i);

        // Wave superposition: main rolling shoreward swell + secondary diagonal + chop
        const wave1 = Math.sin(ox * 0.12 + oz * 0.28 - t * 1.5) * 0.38;
        const wave2 = Math.sin(ox * 0.28 - oz * 0.14 - t * 2.1) * 0.18;
        const wave3 = Math.sin(ox * 0.6 + oz * 0.5 + t * 3.0) * 0.07;
        const totalHeight = oy + wave1 + wave2 + wave3;

        posAttr.setY(i, totalHeight);

        // Dynamic white crest foam when wave peaks rise (Studio Ghibli wave crests)
        const peak = wave1 + wave2 + wave3;
        const baseR = baseOceanColors[i * 3];
        const baseG = baseOceanColors[i * 3 + 1];
        const baseB = baseOceanColors[i * 3 + 2];

        if (peak > 0.24) {
          const foamFactor = Math.min((peak - 0.24) / 0.22, 1.0);
          colorAttr.setXYZ(
            i,
            baseR + (1.0 - baseR) * foamFactor,
            baseG + (1.0 - baseG) * foamFactor,
            baseB + (1.0 - baseB) * foamFactor
          );
        } else {
          colorAttr.setXYZ(i, baseR, baseG, baseB);
        }
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      oceanGeo.computeVertexNormals();

      // ── Multi-layer Rolling Waves & Shoreline Foam ────────────────────────
      // Outer rolling swell moves shoreward
      const roll1Phase = (t * 0.32) % 1.0;
      rollWaveMesh1.position.z = -22 + roll1Phase * 20;
      rollWaveMat1.opacity = Math.sin(roll1Phase * Math.PI) * 0.65;

      // Mid-water breaking wave moves shoreward
      const roll2Phase = ((t * 0.36) + 0.5) % 1.0;
      rollWaveMesh2.position.z = -6 + roll2Phase * 14;
      rollWaveMat2.opacity = Math.sin(roll2Phase * Math.PI) * 0.72;

      // Shoreline surge foam wash
      const foamSurge = Math.sin(t * 1.2);
      foamMesh.position.z = 9.5 + foamSurge * 1.4;
      foamMat.opacity = 0.55 + Math.sin(t * 2.4) * 0.18;

      // Gentle sunlight ray pulsation
      rayMat.opacity = 0.08 + Math.sin(t * 0.8) * 0.025;

      // ── Drifting Anime Clouds ─────────────────────────────────────────────
      cloudClusters.forEach((c) => {
        c.group.position.x += c.speed;
        if (c.group.position.x > 80) {
          c.group.position.x = -80;
        }
      });

      // ── Wind Simulation on Palm Trees ─────────────────────────────────────
      const windGust = Math.sin(t * 0.8) * 0.5 + 0.5; // Wind pulse
      palmTrees.forEach((p) => {
        const trunkSway = Math.sin(t * 1.7 + p.swayOffset) * 0.035 * (1 + windGust * 0.6);
        p.trunk.rotation.z = trunkSway;
        p.fronds.rotation.z = trunkSway * 1.4;

        // Individual fronds oscillate independently
        p.frondMeshes.forEach((fm, fIdx) => {
          fm.rotation.x = Math.sin(t * 3.2 + fIdx * 0.6 + p.swayOffset) * 0.05 * (1 + windGust * 0.8);
        });
      });

      // ── Wind Oscillation on Bushes & Grass Tufts ─────────────────────────
      bushes.forEach((b) => {
        const bSway = Math.sin(t * 2.4 + b.swayOffset) * 0.03;
        b.mesh.rotation.z = bSway;
        b.mesh.rotation.x = bSway * 0.5;
      });

      grassTufts.forEach((g) => {
        g.mesh.rotation.z = g.baseRotZ + Math.sin(t * 2.8 + g.offset) * 0.12 * (1 + windGust * 0.6);
      });

      // ── Soaring Seagulls ──────────────────────────────────────────────────
      birds.forEach((b) => {
        b.angle += b.speed;
        b.group.position.x = b.baseX + Math.cos(b.angle) * b.radius;
        b.group.position.z = b.baseZ + Math.sin(b.angle) * (b.radius * 0.7);
        b.group.position.y = b.baseY + Math.sin(t * 1.2 + b.angle) * 0.4;
        b.group.rotation.y = -b.angle + Math.PI / 2;

        // Wing flapping
        const flap = Math.sin(t * 6.5 + b.angle * 2) * 0.35;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;
      });

      // ── Environmental Sunlight Spores ─────────────────────────────────────
      const pPositions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pPositions[i * 3 + 1] += 0.012; // Float gently upward
        pPositions[i * 3]     += Math.sin(t * 0.8 + i) * 0.008; // Drift with breeze
        if (pPositions[i * 3 + 1] > 14) {
          pPositions[i * 3 + 1] = 0.5;
          pPositions[i * 3]     = (Math.random() - 0.5) * 55;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // ── Smooth Camera Parallax ────────────────────────────────────────────
      targetCamX = mouseX;
      targetCamY = 3.4 + mouseY;
      camera.position.x += (targetCamX - camera.position.x) * 0.04;
      camera.position.y += (targetCamY - camera.position.y) * 0.04;
      camera.lookAt(0, 1.4, -10);

      renderer.render(scene, camera);
    };

    animate();

    // ── 20. Resize Handler ───────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // ── 21. Cleanup ──────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      renderer.dispose();
      skyGeo.dispose(); skyMat.dispose();
      sunDiscGeo.dispose(); sunDiscMat.dispose();
      halo1Geo.dispose(); halo1Mat.dispose();
      halo2Geo.dispose(); halo2Mat.dispose();
      rayGeo.dispose(); rayMat.dispose();
      oceanGeo.dispose(); oceanMat.dispose();
      rollWaveGeo1.dispose(); rollWaveMat1.dispose();
      rollWaveGeo2.dispose(); rollWaveMat2.dispose();
      foamGeo.dispose(); foamMat.dispose();
      beachGeo.dispose(); beachMat.dispose();
      wetSandGeo.dispose(); wetSandMat.dispose();
      bluffGeo.dispose(); bluffMat.dispose();
      grassBladeGeo.dispose(); grassMat.dispose();
      particleGeo.dispose(); particleMat.dispose();
      birdMat.dispose(); wingGeo.dispose();

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

