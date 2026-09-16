'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { ScanDto } from '@lokacia/contracts';

/** V5: three.js viewer (client only, loaded via next/dynamic). Calls onError when WebGL/model fails. */
export default function ScanViewer({ scan, onError }: { scan: ScanDto; onError: () => void }) {
  const t = useTranslations('v2.tour');
  const ref = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const canvasTest = document.createElement('canvas');
        if (!canvasTest.getContext('webgl2') && !canvasTest.getContext('webgl')) throw new Error('no webgl');
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h);
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-hidden', 'true');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.05, 500);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8a968f, 2.2));
        const dir = new THREE.DirectionalLight(0xffffff, 1.4);
        dir.position.set(5, 10, 7);
        scene.add(dir);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        controls.autoRotate = !reduced;
        controls.autoRotateSpeed = 0.6;

        let object: import('three').Object3D;
        const url = scan.url;
        if (scan.format === 'glb' || scan.format === 'gltf') {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          object = (await new GLTFLoader().loadAsync(url)).scene;
        } else if (scan.format === 'obj') {
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          object = await new OBJLoader().loadAsync(url);
        } else if (scan.format === 'ply') {
          const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
          const geo = await new PLYLoader().loadAsync(url);
          geo.computeVertexNormals();
          object = geo.hasAttribute('color') && !geo.index ? new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.02, vertexColors: true })) : new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xedf0eb, vertexColors: geo.hasAttribute('color') }));
        } else throw new Error('unsupported');
        if (disposed) return;
        // Cadastral-drawing look: dark outlines on every mesh so light models read against the page.
        const ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#17201D';
        const edgesToAdd: [import('three').Object3D, import('three').LineSegments][] = [];
        object.traverse((child) => {
          const mesh = child as import('three').Mesh;
          if (mesh.isMesh && mesh.geometry) edgesToAdd.push([mesh, new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color: new THREE.Color(ink) }))]);
        });
        edgesToAdd.forEach(([mesh, edges]) => mesh.add(edges));
        scene.add(object);
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) || 1;
        camera.position.set(center.x + radius * 0.9, center.y + radius * 0.8, center.z + radius * 1.1);
        const grid = new THREE.GridHelper(Math.ceil(radius * 2), Math.ceil(radius * 2), 0x8a968f, 0x8a968f);
        grid.position.set(center.x, box.min.y - 0.001, center.z);
        (grid.material as import('three').Material).opacity = 0.25;
        (grid.material as import('three').Material).transparent = true;
        scene.add(grid);
        controls.target.copy(center);
        controls.update();
        setLoading(false);
        // First frame immediately (rAF does not run in background tabs).
        renderer.render(scene, camera);

        let raf = 0;
        const loop = () => {
          controls.update();
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        loop();
        const onResize = () => {
          const nw = el.clientWidth;
          const nh = el.clientHeight;
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(el);
        const stopAuto = () => (controls.autoRotate = false);
        renderer.domElement.addEventListener('pointerdown', stopAuto);
        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (!disposed) onError();
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [scan, onError]);

  return (
    <div ref={ref} className="relative h-[320px] w-full overflow-hidden rounded-photo border border-border bg-[radial-gradient(ellipse_at_center,var(--surface),var(--surface-2))] md:h-[440px]" role="img" aria-label={t('viewerLabel')}>
      {loading && <p className="absolute inset-0 grid place-items-center text-small text-muted">{t('loading')}</p>}
    </div>
  );
}
