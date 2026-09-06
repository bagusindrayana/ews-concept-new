<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
  import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

  // ----- Public props -----
  interface LayerTransform {
    height?: number; // Y position
    tilt?: number; // X rotation
  }

  interface Props {
    width?: string;
    height?: string;
    lat?: number;
    lon?: number;
    range?: number; // bbox radius in km
    autoLoad?: boolean; // fetch on mount / when coords change
    layer1Cfg?: LayerTransform;
    layer2Cfg?: LayerTransform;
    layer3Cfg?: LayerTransform;
    bokeh?: { focus?: number; aperture?: number; maxblur?: number };
    // bindable outputs
    statusMsg?: string;
    statusClass?: string;
    isFetching?: boolean;
  }

  let {
    width = "100%",
    height = "100%",
    lat = -0.501005,
    lon = 117.167936,
    range = 1.5,
    autoLoad = true,
    layer1Cfg = {},
    layer2Cfg = {},
    layer3Cfg = {},
    bokeh = {},
    statusMsg = $bindable(""),
    statusClass = $bindable(""),
    isFetching = $bindable(false),
  }: Props = $props();

  // ----- Bounding box from props -----
  const KM_PER_DEG_LAT = 110.574;
  function kmPerDegLon(latitude: number) {
    return 111.32 * Math.cos((latitude * Math.PI) / 180);
  }
  function calcBbox(latitude: number, longitude: number, rangeKm: number) {
    const dLat = rangeKm / KM_PER_DEG_LAT;
    const dLon = rangeKm / kmPerDegLon(latitude);
    return {
      south: latitude - dLat,
      north: latitude + dLat,
      west: longitude - dLon,
      east: longitude + dLon,
    };
  }
  let bbox = $derived(calcBbox(lat, lon, range));

  function setStatus(msg: string, cls = "") {
    statusMsg = msg;
    statusClass = cls;
  }

  // ----- Three.js references -----
  let canvasElement: HTMLCanvasElement;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let controls: OrbitControls;
  let composer: EffectComposer;
  let animationFrameId: number;
  let bokehPass: BokehPass;

  // Live bokeh values (driven by props, but local so we can push to uniforms)
  let bokehFocus = $state(bokeh.focus ?? 30.0);
  let bokehAperture = $state(bokeh.aperture ?? 0.002);
  let bokehMaxBlur = $state(bokeh.maxblur ?? 0.025);

  function updateBokeh() {
    if (!bokehPass) return;
    (bokehPass.uniforms as any)["focus"].value = bokehFocus;
    (bokehPass.uniforms as any)["aperture"].value = bokehAperture;
    (bokehPass.uniforms as any)["maxblur"].value = bokehMaxBlur;
  }

  // ----- Layer transforms (driven by props) -----
  let layer1Height = $state(layer1Cfg.height ?? 0.0);
  let layer1Tilt = $state(layer1Cfg.tilt ?? 0.0);
  let layer2Height = $state(layer2Cfg.height ?? 1.8);
  let layer2Tilt = $state(layer2Cfg.tilt ?? 0.22);
  let layer3Height = $state(layer3Cfg.height ?? 3.8);
  let layer3Tilt = $state(layer3Cfg.tilt ?? 0.52);

  function updateLayers() {
    if (!layer1 || !layer2 || !layer3) return;
    layer1.position.y = layer1Height;
    layer1.rotation.x = layer1Tilt;
    layer2.position.y = layer2Height;
    layer2.rotation.x = layer2Tilt;
    layer3.position.y = layer3Height;
    layer3.rotation.x = layer3Tilt;
  }

  // Keep bokeh + layer transforms in sync with incoming props.
  $effect(() => {
    bokehFocus = bokeh.focus ?? bokehFocus;
    bokehAperture = bokeh.aperture ?? bokehAperture;
    bokehMaxBlur = bokeh.maxblur ?? bokehMaxBlur;
    updateBokeh();
  });
  $effect(() => {
    layer1Height = layer1Cfg.height ?? layer1Height;
    layer1Tilt = layer1Cfg.tilt ?? layer1Tilt;
    layer2Height = layer2Cfg.height ?? layer2Height;
    layer2Tilt = layer2Cfg.tilt ?? layer2Tilt;
    layer3Height = layer3Cfg.height ?? layer3Height;
    layer3Tilt = layer3Cfg.tilt ?? layer3Tilt;
    updateLayers();
  });

  // ----- Layer dimensions / dynamic grid -----
  const L1_W = 18;
  const L1_D = 26;
  const L2_W = 18;
  const L2_D = 26;
  const L3_W = 18;
  const L3_D = 26;

  function l3ColsForRange(rangeKm: number) {
    return Math.max(2, Math.min(40, Math.round(rangeKm / 0.3)));
  }
  function l3RowsForRange(rangeKm: number) {
    return Math.max(2, Math.min(40, Math.round(rangeKm / 0.3)));
  }
  let L3_COLS = $derived(l3ColsForRange(range));
  let L3_ROWS = $derived(l3RowsForRange(range));

  // Layers & meshes
  let layer1: THREE.Group;
  let layer2: THREE.Group;
  let layer3: THREE.Group;
  let terrainMesh: THREE.Mesh | null = null;
  let terrainWire: THREE.LineSegments | null = null;
  let roadGroup: THREE.Group;
  let gl1: THREE.PointLight;
  let gl2: THREE.PointLight;
  let gl3: THREE.PointLight;
  let t = 0;

  // Cohen-Sutherland clipping (Layer 2 roads)
  const XMIN = -L2_W / 2,
    XMAX = L2_W / 2,
    ZMIN = -L2_D,
    ZMAX = 0;
  function outCode(x: number, z: number) {
    let c = 0;
    if (x < XMIN) c |= 1;
    else if (x > XMAX) c |= 2;
    if (z < ZMIN) c |= 4;
    else if (z > ZMAX) c |= 8;
    return c;
  }
  function clipSeg(x1: number, z1: number, x2: number, z2: number) {
    let c1 = outCode(x1, z1),
      c2 = outCode(x2, z2);
    while (true) {
      if (!(c1 | c2)) return { x1, z1, x2, z2 };
      if (c1 & c2) return null;
      const cout = c1 || c2;
      let x = 0,
        z = 0;
      if (cout & 8) {
        x = x1 + ((x2 - x1) * (ZMAX - z1)) / (z2 - z1);
        z = ZMAX;
      } else if (cout & 4) {
        x = x1 + ((x2 - x1) * (ZMIN - z1)) / (z2 - z1);
        z = ZMIN;
      } else if (cout & 2) {
        z = z1 + ((z2 - z1) * (XMAX - x1)) / (x2 - x1);
        x = XMAX;
      } else {
        z = z1 + ((z2 - z1) * (XMIN - x1)) / (x2 - x1);
        x = XMIN;
      }
      if (cout === c1) {
        x1 = x;
        z1 = z;
        c1 = outCode(x1, z1);
      } else {
        x2 = x;
        z2 = z;
        c2 = outCode(x2, z2);
      }
    }
  }
  function clipPolyline(pts: { x: number; z: number }[]) {
    const segments: { x1: number; z1: number; x2: number; z2: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = clipSeg(pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
      if (seg) segments.push(seg);
    }
    if (!segments.length) return [];
    const polylines: THREE.Vector3[][] = [];
    let cur = [
      new THREE.Vector3(segments[0].x1, 0.02, segments[0].z1),
      new THREE.Vector3(segments[0].x2, 0.02, segments[0].z2),
    ];
    for (let i = 1; i < segments.length; i++) {
      const s = segments[i];
      const last = cur[cur.length - 1];
      if (
        Math.abs(last.x - s.x1) < 0.0001 &&
        Math.abs(last.z - s.z1) < 0.0001
      ) {
        cur.push(new THREE.Vector3(s.x2, 0.02, s.z2));
      } else {
        polylines.push(cur);
        cur = [
          new THREE.Vector3(s.x1, 0.02, s.z1),
          new THREE.Vector3(s.x2, 0.02, s.z2),
        ];
      }
    }
    polylines.push(cur);
    return polylines;
  }
  function geoToLocal(gLat: number, gLon: number, currentBbox: typeof bbox) {
    const nx = (gLon - currentBbox.west) / (currentBbox.east - currentBbox.west);
    const nz =
      (gLat - currentBbox.south) / (currentBbox.north - currentBbox.south);
    return {
      x: nx * L2_W - L2_W / 2,
      z: -(nz * L2_D - L2_D / 2),
    };
  }

  const ROAD_STYLE: Record<string, { color: number; opacity: number }> = {
    motorway: { color: 0xff9900, opacity: 1.0 },
    motorway_link: { color: 0xff9900, opacity: 0.75 },
    trunk: { color: 0xff8800, opacity: 1.0 },
    trunk_link: { color: 0xff8800, opacity: 0.75 },
    primary: { color: 0xff6600, opacity: 1.0 },
    primary_link: { color: 0xff6600, opacity: 0.75 },
    secondary: { color: 0xff5500, opacity: 0.9 },
    secondary_link: { color: 0xff5500, opacity: 0.7 },
    tertiary: { color: 0xff4400, opacity: 0.85 },
    tertiary_link: { color: 0xff4400, opacity: 0.65 },
    residential: { color: 0xdd3300, opacity: 0.7 },
    living_street: { color: 0xcc3300, opacity: 0.6 },
    unclassified: { color: 0xbb3300, opacity: 0.55 },
    service: { color: 0xaa3300, opacity: 0.45 },
    footway: { color: 0x884422, opacity: 0.35 },
    path: { color: 0x884422, opacity: 0.3 },
    cycleway: { color: 0x885522, opacity: 0.3 },
  };

  function buildTerrain(heightGrid: Float32Array | null, cols: number, rows: number) {
    if (terrainMesh) {
      layer1.remove(terrainMesh);
      terrainMesh.geometry.dispose();
      if (Array.isArray(terrainMesh.material)) {
        terrainMesh.material.forEach((m) => m.dispose());
      } else {
        terrainMesh.material.dispose();
      }
    }
    if (terrainWire) {
      layer1.remove(terrainWire);
      terrainWire.geometry.dispose();
      if (Array.isArray(terrainWire.material)) {
        terrainWire.material.forEach((m) => m.dispose());
      } else {
        terrainWire.material.dispose();
      }
    }

    let workingGrid = heightGrid;
    if (!workingGrid) {
      workingGrid = new Float32Array(cols * rows);
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dx = c - cx;
          const dy = r - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
          workingGrid[r * cols + c] = Math.max(0, 1 - dist / maxDist) * 1.8;
        }
      }
    }

    const segsX = cols - 1,
      segsZ = rows - 1;
    const geo = new THREE.PlaneGeometry(L1_W, L1_D, segsX, segsZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let r = 0; r <= segsZ; r++) {
      for (let c = 0; c <= segsX; c++) {
        const idx = r * (segsX + 1) + c;
        const gridRow = Math.round((r / segsZ) * (rows - 1));
        const gridCol = Math.round((c / segsX) * (cols - 1));
        const h = workingGrid ? workingGrid[gridRow * cols + gridCol] : 0;
        pos.setY(idx, h);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    terrainMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0x001a0a,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
      }),
    );
    layer1.add(terrainMesh);

    const contourPoints: THREE.Vector3[] = [];
    const numLevels = 10;

    function getHeight(c: number, r: number) {
      if (!workingGrid) return 0;
      return workingGrid[r * cols + c];
    }
    function getPos(c: number, r: number) {
      const x = -L1_W / 2 + (c / segsX) * L1_W;
      const z = -L1_D / 2 + (r / segsZ) * L1_D;
      const y = getHeight(c, r);
      return new THREE.Vector3(x, y, z);
    }

    const levels: number[] = [];
    for (let l = 1; l <= numLevels; l++) {
      levels.push((l / (numLevels + 1)) * 2.2);
    }

    levels.forEach((iso) => {
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const bl_val = getHeight(c, r);
          const br_val = getHeight(c + 1, r);
          const tr_val = getHeight(c + 1, r + 1);
          const tl_val = getHeight(c, r + 1);

          const bl_pos = getPos(c, r);
          const br_pos = getPos(c + 1, r);
          const tr_pos = getPos(c + 1, r + 1);
          const tl_pos = getPos(c, r + 1);

          let state = 0;
          if (bl_val >= iso) state |= 1;
          if (br_val >= iso) state |= 2;
          if (tr_val >= iso) state |= 4;
          if (tl_val >= iso) state |= 8;

          function getIntersect(p1: THREE.Vector3, p2: THREE.Vector3, v1: number, v2: number) {
            if (Math.abs(v1 - v2) < 0.00001) return p1.clone();
            const tt = (iso - v1) / (v2 - v1);
            const p = new THREE.Vector3().lerpVectors(p1, p2, tt);
            p.y = iso;
            return p;
          }

          const A = getIntersect(bl_pos, br_pos, bl_val, br_val);
          const B = getIntersect(br_pos, tr_pos, br_val, tr_val);
          const C = getIntersect(tr_pos, tl_pos, tr_val, tl_val);
          const D = getIntersect(tl_pos, bl_pos, tl_val, bl_val);

          switch (state) {
            case 1: contourPoints.push(D, A); break;
            case 2: contourPoints.push(A, B); break;
            case 3: contourPoints.push(D, B); break;
            case 4: contourPoints.push(B, C); break;
            case 5: contourPoints.push(D, C, A, B); break;
            case 6: contourPoints.push(A, C); break;
            case 7: contourPoints.push(D, C); break;
            case 8: contourPoints.push(D, C); break;
            case 9: contourPoints.push(A, C); break;
            case 10: contourPoints.push(D, A, C, B); break;
            case 11: contourPoints.push(B, C); break;
            case 12: contourPoints.push(D, B); break;
            case 13: contourPoints.push(A, B); break;
            case 14: contourPoints.push(D, A); break;
          }
        }
      }
    });

    if (contourPoints.length > 0) {
      const gridLinesGeo = new THREE.BufferGeometry().setFromPoints(contourPoints);
      terrainWire = new THREE.LineSegments(
        gridLinesGeo,
        new THREE.LineBasicMaterial({ color: 0x00ff88 }),
      );
    } else {
      const fallbackGeo = new THREE.BufferGeometry();
      terrainWire = new THREE.LineSegments(
        fallbackGeo,
        new THREE.LineBasicMaterial({ color: 0x00ff88 }),
      );
    }
    layer1.add(terrainWire);
  }

  function buildPlaceholderRoads() {
    roadGroup.clear();
  }

  function buildLayer3() {
    if (!layer3) return;
    for (let i = layer3.children.length - 1; i >= 0; i--) {
      const child = layer3.children[i] as any;
      layer3.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
        else child.material.dispose();
      }
    }

    const COLS = L3_COLS;
    const ROWS = L3_ROWS;
    const cw = L3_W / COLS;
    const ch = L3_D / ROWS;

    for (let c = 0; c <= COLS; c++) {
      const x = -L3_W / 2 + cw * c;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, 0),
        new THREE.Vector3(x, 0.01, -L3_D),
      ]);
      layer3.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe600 })));
    }
    for (let r = 0; r <= ROWS; r++) {
      const z = -ch * r;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-L3_W / 2, 0.01, z),
        new THREE.Vector3(L3_W / 2, 0.01, z),
      ]);
      layer3.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe600 })));
    }
    const gridBorderGeo = new THREE.BufferGeometry().setFromPoints(
      [
        [-L3_W / 2, 0.01, 0],
        [L3_W / 2, 0.01, 0],
        [L3_W / 2, 0.01, -L3_D],
        [-L3_W / 2, 0.01, -L3_D],
        [-L3_W / 2, 0.01, 0],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    layer3.add(new THREE.Line(gridBorderGeo, new THREE.LineBasicMaterial({ color: 0xffe600 })));

    const sz = cw * 0.22;
    for (let c = 1; c < COLS; c += 2) {
      const cx = -L3_W / 2 + cw * c;
      for (let r = 0; r < ROWS; r++) {
        const cz = -ch * r - ch / 2;
        const geoTick = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(cx - sz, 0.02, cz),
          new THREE.Vector3(cx + sz, 0.02, cz),
        ]);
        layer3.add(new THREE.Line(geoTick, new THREE.LineBasicMaterial({ color: 0xffe600 })));
      }
    }
  }

  // Keep Layer 3 grid in sync with the live bbox size.
  $effect(() => {
    const cols = L3_COLS;
    const rows = L3_ROWS;
    if (layer3) buildLayer3();
  });

  async function fetchRoads(currentBbox: typeof bbox) {
    const res = await fetch("/api/map-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "roads", bbox: currentBbox }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Proxy HTTP ${res.status}`);
    }
    return res.json();
  }

  function renderRoads(data: any, currentBbox: typeof bbox) {
    roadGroup.clear();
    const ways = (data.elements || []).filter((e: any) => e.type === "way" && e.geometry);
    let rendered = 0;
    ways.forEach((way: any) => {
      const hw = way.tags && way.tags.highway;
      const style = ROAD_STYLE[hw] || { color: 0xaa3300, opacity: 0.4 };
      const localPts = way.geometry.map((n: any) => geoToLocal(n.lat, n.lon, currentBbox));
      const clipped = clipPolyline(localPts);
      clipped.forEach((pline) => {
        if (pline.length < 2) return;
        const geo = new THREE.BufferGeometry().setFromPoints(pline);
        const mat = new THREE.LineBasicMaterial({
          color: style.color,
          transparent: style.opacity < 1,
          opacity: style.opacity,
        });
        roadGroup.add(new THREE.Line(geo, mat));
        rendered++;
      });
    });
    return { ways: ways.length, rendered };
  }

  const ELEV_COLS = 20,
    ELEV_ROWS = 13;
  async function fetchElevation(currentBbox: typeof bbox) {
    const points: { lat: number; lon: number }[] = [];
    for (let r = 0; r < ELEV_ROWS; r++) {
      for (let c = 0; c < ELEV_COLS; c++) {
        const latitude =
          currentBbox.south + (r / (ELEV_ROWS - 1)) * (currentBbox.north - currentBbox.south);
        const longitude =
          currentBbox.west + (c / (ELEV_COLS - 1)) * (currentBbox.east - currentBbox.west);
        points.push({ lat: latitude, lon: longitude });
      }
    }

    const BATCH = 100;
    const elevations: number[] = [];
    for (let i = 0; i < points.length; i += BATCH) {
      const batch = points.slice(i, i + BATCH);
      const locStr = batch.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join("|");
      const res = await fetch("/api/map-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "elevation", locations: locStr }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Proxy HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status !== "OK") throw new Error(`OpenTopoData: ${data.error || data.status}`);
      data.results.forEach((r: any) => elevations.push(r.elevation ?? 0));
    }

    const raw = elevations;
    const minE = Math.min(...raw);
    const maxE = Math.max(...raw);
    const elevRange = maxE - minE || 1;
    const maxH = 2.2;
    const normalized = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      normalized[i] = ((raw[i] - minE) / elevRange) * maxH;
    }
    return { grid: normalized, cols: ELEV_COLS, rows: ELEV_ROWS, minElev: minE, maxElev: maxE };
  }

  // Public load method (callable via bind:this)
  export async function load() {
    if (isNaN(lat) || isNaN(lon) || isNaN(range) || range <= 0) {
      setStatus("input tidak valid", "err");
      return;
    }

    isFetching = true;
    const currentBbox = { ...bbox };
    buildLayer3();

    setStatus("mengambil data jalan (OSM)...", "loading");
    let roadResult = { ways: 0, rendered: 0 };
    try {
      const osmData = await fetchRoads(currentBbox);
      roadResult = renderRoads(osmData, currentBbox);
    } catch (e: any) {
      setStatus(`roads gagal: ${e.message}`, "err");
      buildPlaceholderRoads();
      isFetching = false;
      return;
    }

    setStatus(`mengambil data elevasi SRTM (${ELEV_COLS}×${ELEV_ROWS} pts)...`, "loading");
    try {
      const elevData = await fetchElevation(currentBbox);
      buildTerrain(elevData.grid, elevData.cols, elevData.rows);
      setStatus(
        `${roadResult.rendered} road segments | elev ${elevData.minElev.toFixed(0)}–${elevData.maxElev.toFixed(0)} m`,
        "ok",
      );
    } catch (e: any) {
      buildTerrain(null, 40, 40);
      setStatus(`roads OK | elevasi gagal: ${e.message}`, "err");
    }

    isFetching = false;
  }

  function handleResize() {
    if (!renderer || !camera) return;
    const w = canvasElement.clientWidth || 1;
    const h = canvasElement.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
  }

  onMount(() => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000c1a);
    scene.fog = new THREE.FogExp2(0x000c1a, 0.011);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    camera.position.set(-4, 18, 30);

    renderer = new THREE.WebGLRenderer({
      canvas: canvasElement,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    handleResize();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 3;
    controls.maxDistance = 120;
    controls.target.set(0, 4, -4);
    controls.update();

    scene.add(new THREE.AmbientLight(0x0a1530, 3));

    // LAYER 1: TERRAIN
    layer1 = new THREE.Group();
    scene.add(layer1);
    layer1.position.y = layer1Height;
    layer1.rotation.x = layer1Tilt;
    buildTerrain(null, 40, 40);

    const borderGeo = new THREE.BufferGeometry().setFromPoints(
      [
        [-L1_W / 2, 0, -L1_D / 2],
        [L1_W / 2, 0, -L1_D / 2],
        [L1_W / 2, 0, L1_D / 2],
        [-L1_W / 2, 0, L1_D / 2],
        [-L1_W / 2, 0, -L1_D / 2],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    layer1.add(new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: 0x00ff88 })));

    // LAYER 2: ROADS
    const L2_frontZ = L2_D / 2;
    layer2 = new THREE.Group();
    layer2.position.set(0, layer2Height, L2_frontZ);
    layer2.rotation.x = layer2Tilt;
    scene.add(layer2);

    const fg = new THREE.PlaneGeometry(L2_W, L2_D);
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, 0, -L2_D / 2);
    layer2.add(
      new THREE.Mesh(
        fg,
        new THREE.MeshBasicMaterial({ color: 0x1a0500, transparent: true, opacity: 0.68, side: THREE.DoubleSide }),
      ),
    );

    const roadBorderGeo = new THREE.BufferGeometry().setFromPoints(
      [
        [-L2_W / 2, 0.02, 0],
        [L2_W / 2, 0.02, 0],
        [L2_W / 2, 0.02, -L2_D],
        [-L2_W / 2, 0.02, -L2_D],
        [-L2_W / 2, 0.02, 0],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    layer2.add(new THREE.Line(roadBorderGeo, new THREE.LineBasicMaterial({ color: 0xff6600 })));

    roadGroup = new THREE.Group();
    layer2.add(roadGroup);
    buildPlaceholderRoads();

    // LAYER 3: GRID (bbox representation)
    const L3_frontZ = L3_D / 2;
    layer3 = new THREE.Group();
    layer3.position.set(0, layer3Height, L3_frontZ);
    layer3.rotation.x = layer3Tilt;
    scene.add(layer3);
    buildLayer3();

    // Point lights
    gl1 = new THREE.PointLight(0x00ff88, 1.8, 26);
    gl1.position.set(0, 1, 0);
    scene.add(gl1);
    gl2 = new THREE.PointLight(0xff6600, 1.4, 26);
    gl2.position.set(0, 3, -2);
    scene.add(gl2);
    gl3 = new THREE.PointLight(0xffe600, 1.1, 26);
    gl3.position.set(0, 7, -7);
    scene.add(gl3);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(new RenderPass(scene, camera));

    bokehPass = new BokehPass(scene, camera, {
      focus: bokehFocus,
      aperture: bokehAperture,
      maxblur: bokehMaxBlur,
    });
    composer.addPass(bokehPass);
    updateBokeh();
    updateLayers();

    composer.addPass(new OutputPass());

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      t += 0.013;
      if (gl1) gl1.intensity = 1.4 + 0.5 * Math.sin(t * 1.2);
      if (gl2) gl2.intensity = 1.1 + 0.4 * Math.sin(t * 1.7 + 1);
      if (gl3) gl3.intensity = 0.9 + 0.3 * Math.sin(t * 2.1 + 2);
      controls.update();
      if (composer) composer.render();
      else renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(handleResize);
    ro.observe(canvasElement);
    onDestroy(() => ro.disconnect());
  });

  $effect(() => {
    if (autoLoad && !isNaN(lat) && !isNaN(lon)) {
      load();
    }
  });

  onDestroy(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    if (scene) {
      scene.traverse((object: any) => {
        if (!object.isMesh && !object.isLine && !object.isPoints) return;
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((m: THREE.Material) => m.dispose());
          else object.material.dispose();
        }
      });
    }
  });
</script>

<div class="map3d-viewport" style="width:{width};height:{height};">
  <canvas bind:this={canvasElement}></canvas>
  {#if isFetching}
    <div class="map3d-loading-overlay">
      <span class="loader"></span>
    </div>
  {/if}
</div>

<style>
  .map3d-viewport {
    position: relative;
    overflow: hidden;
    background: #000c1a;
  }
  .map3d-viewport canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .map3d-loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 12, 26, 0.45);
    pointer-events: none;
    z-index: 2;
  }
  .map3d-loader {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(0, 255, 136, 0.4);
    border-top-color: #00ff88;
    border-radius: 50%;
    animation: map3d-spin 0.8s linear infinite;
  }
  @keyframes map3d-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
