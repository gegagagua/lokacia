import type { ScanPlan } from '@lokacia/contracts';

/**
 * Minimal glTF 2.0 helpers for V5: read the bounding box from GLB/GLTF/OBJ/PLY (floor-plan generation) and
 * build a demo room GLB (floor + walls extruded from a plan outline).
 */

type Bounds = { min: [number, number, number]; max: [number, number, number] };

function merge(a: Bounds | null, b: Bounds): Bounds {
  if (!a) return b;
  return { min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])], max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])] };
}

type GltfJson = {
  accessors?: { min?: number[]; max?: number[]; count: number; bufferView?: number; byteOffset?: number; componentType?: number }[];
  bufferViews?: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
  nodes?: { mesh?: number; scale?: number[]; name?: string }[];
};

/** If the model has a node named "floor" with a small vertex ring (as our capture pipeline exports), use it as the outline. */
function floorOutline(json: GltfJson, bin: Buffer): [number, number][] | null {
  const node = json.nodes?.find((n) => n.name?.toLowerCase() === 'floor' && n.mesh !== undefined);
  const acc = node ? json.accessors?.[json.meshes?.[node.mesh!]?.primitives[0]?.attributes.POSITION ?? -1] : undefined;
  if (!acc || acc.componentType !== 5126 || acc.count < 3 || acc.count > 64 || acc.bufferView === undefined) return null;
  const view = json.bufferViews?.[acc.bufferView];
  if (!view) return null;
  const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? 12;
  const out: [number, number][] = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * stride;
    if (o + 12 > bin.length) return null;
    out.push([Math.round(bin.readFloatLE(o) * 100) / 100, Math.round(bin.readFloatLE(o + 8) * 100) / 100]);
  }
  return out;
}

function polygonArea(pts: [number, number][]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function boundsFromGltfJson(json: GltfJson): Bounds | null {
  let b: Bounds | null = null;
  for (const [mi, mesh] of (json.meshes ?? []).entries()) {
    const scale = json.nodes?.find((n) => n.mesh === mi)?.scale ?? [1, 1, 1];
    for (const prim of mesh.primitives) {
      const acc = json.accessors?.[prim.attributes.POSITION ?? -1];
      if (!acc?.min || !acc.max) continue;
      b = merge(b, { min: [acc.min[0]! * scale[0]!, acc.min[1]! * scale[1]!, acc.min[2]! * scale[2]!], max: [acc.max[0]! * scale[0]!, acc.max[1]! * scale[1]!, acc.max[2]! * scale[2]!] });
    }
  }
  return b;
}

function parseGlb(buf: Buffer): { json: GltfJson; bin: Buffer } | null {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) return null; // 'glTF'
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) return null; // 'JSON'
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as GltfJson;
  const binStart = 20 + jsonLen;
  const bin = buf.length >= binStart + 8 ? buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart)) : Buffer.alloc(0);
  return { json, bin };
}

function boundsFromPoints(text: string, lineRe: RegExp): Bounds | null {
  let b: Bounds | null = null;
  for (const line of text.split('\n')) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const p: [number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (p.some((v) => !Number.isFinite(v))) continue;
    b = merge(b, { min: p, max: [...p] as [number, number, number] });
  }
  return b;
}

/** Derives a rectangular floor plan (metres) from a scan. Y is up (glTF convention), plan uses X × Z. */
export function planFromScan(format: string, buf: Buffer): ScanPlan | null {
  let b: Bounds | null = null;
  try {
    if (format === 'glb') {
      const glb = parseGlb(buf);
      if (glb) {
        b = boundsFromGltfJson(glb.json);
        const ring = floorOutline(glb.json, glb.bin);
        if (ring && b) {
          const minX = Math.min(...ring.map((p) => p[0]));
          const minZ = Math.min(...ring.map((p) => p[1]));
          const outline = ring.map(([x, z]) => [Math.round((x - minX) * 100) / 100, Math.round((z - minZ) * 100) / 100] as [number, number]);
          const widthM = Math.round((b.max[0] - b.min[0]) * 100) / 100;
          const depthM = Math.round((b.max[2] - b.min[2]) * 100) / 100;
          return { outline, widthM, depthM, areaM2: Math.round(polygonArea(outline) * 10) / 10 };
        }
      }
    } else if (format === 'gltf') b = boundsFromGltfJson(JSON.parse(buf.toString('utf8')) as GltfJson);
    else if (format === 'obj') b = boundsFromPoints(buf.toString('utf8'), /^v\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/);
    else if (format === 'ply') {
      const text = buf.toString('latin1');
      if (text.startsWith('ply') && text.includes('format ascii')) {
        const body = text.slice(text.indexOf('end_header') + 10);
        b = boundsFromPoints(body, /^\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/);
      }
    }
  } catch {
    return null;
  }
  if (!b) return null;
  const widthM = Math.round((b.max[0] - b.min[0]) * 100) / 100;
  const depthM = Math.round((b.max[2] - b.min[2]) * 100) / 100;
  if (!(widthM > 0.5 && depthM > 0.5 && widthM < 500 && depthM < 500)) return null;
  return { outline: [[0, 0], [widthM, 0], [widthM, depthM], [0, depthM]], widthM, depthM, areaM2: Math.round(widthM * depthM * 10) / 10 };
}

/** Builds a binary glTF of a room: triangulated floor (fan from vertex 0) as node "floor" + walls of `height` metres. */
export function roomGlb(outline: [number, number][], height = 3.2): Buffer {
  const fPos: number[] = [];
  const fNor: number[] = [];
  const fIdx: number[] = [];
  const wPos: number[] = [];
  const wNor: number[] = [];
  const wIdx: number[] = [];
  for (const [x, z] of outline) {
    fPos.push(x, 0, z);
    fNor.push(0, 1, 0);
  }
  for (let i = 1; i < outline.length - 1; i++) fIdx.push(0, i + 1, i);
  for (let i = 0; i < outline.length; i++) {
    const [x1, z1] = outline[i]!;
    const [x2, z2] = outline[(i + 1) % outline.length]!;
    const len = Math.hypot(x2 - x1, z2 - z1) || 1;
    const base = wPos.length / 3;
    wPos.push(x1, 0, z1, x2, 0, z2, x2, height, z2, x1, height, z1);
    for (let k = 0; k < 4; k++) wNor.push(-(z2 - z1) / len, 0, (x2 - x1) / len);
    wIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const pad4 = (b: Buffer) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b);
  const chunks = [
    { buf: Buffer.from(new Float32Array(fPos).buffer), target: 34962 },
    { buf: Buffer.from(new Float32Array(fNor).buffer), target: 34962 },
    { buf: Buffer.from(new Uint16Array(fIdx).buffer), target: 34963 },
    { buf: Buffer.from(new Float32Array(wPos).buffer), target: 34962 },
    { buf: Buffer.from(new Float32Array(wNor).buffer), target: 34962 },
    { buf: Buffer.from(new Uint16Array(wIdx).buffer), target: 34963 },
  ];
  let offset = 0;
  const bufferViews = chunks.map((c) => {
    const v = { buffer: 0, byteOffset: offset, byteLength: c.buf.length, target: c.target };
    offset += pad4(c.buf).length;
    return v;
  });
  const bin = Buffer.concat(chunks.map((c) => pad4(c.buf)));
  const minmax = (arr: number[]) => {
    const axis = (k: number) => arr.filter((_, i) => i % 3 === k);
    return { min: [0, 1, 2].map((k) => Math.min(...axis(k))), max: [0, 1, 2].map((k) => Math.max(...axis(k))) };
  };
  const json = {
    asset: { version: '2.0', generator: 'lokacia.ge scan pipeline' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ mesh: 0, name: 'floor' }, { mesh: 1, name: 'walls' }],
    materials: [
      { name: 'floor', pbrMetallicRoughness: { baseColorFactor: [0.82, 0.8, 0.74, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true },
      { name: 'walls', pbrMetallicRoughness: { baseColorFactor: [0.93, 0.94, 0.92, 1], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: true },
    ],
    meshes: [
      { name: 'floor', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] },
      { name: 'walls', primitives: [{ attributes: { POSITION: 3, NORMAL: 4 }, indices: 5, material: 1 }] },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews,
    accessors: [
      { bufferView: 0, componentType: 5126, count: fPos.length / 3, type: 'VEC3', ...minmax(fPos) },
      { bufferView: 1, componentType: 5126, count: fNor.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: fIdx.length, type: 'SCALAR' },
      { bufferView: 3, componentType: 5126, count: wPos.length / 3, type: 'VEC3', ...minmax(wPos) },
      { bufferView: 4, componentType: 5126, count: wNor.length / 3, type: 'VEC3' },
      { bufferView: 5, componentType: 5123, count: wIdx.length, type: 'SCALAR' },
    ],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jsonBuf, bh, bin]);
}

export const DEMO_OUTLINE: [number, number][] = [[0, 0], [9.2, 0], [9.2, 6.5], [5.1, 6.5], [5.1, 8.4], [0, 8.4]];
