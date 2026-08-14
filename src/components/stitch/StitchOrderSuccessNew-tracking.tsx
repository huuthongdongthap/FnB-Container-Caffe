/**
 * StitchOrderSuccessNew-tracking — Three.js ring overlay + wait time display
 *
 * ThreeRingOverlay: rotating bronze torus matching original ANIMATION_64.
 * WaitTimeDisplay: estimated wait time with 3D ring background.
 */

'use client';

import type * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

/* ─── Three.js Ring Animation (matches original ANIMATION_64) ────────────── */

export function ThreeRingOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cnt = containerRef.current;
    if (!cnt) return;

    let animId = 0;
    let rendererInstance: THREE.WebGLRenderer | null = null;

    const script = document.createElement('script');
    script.src =
      'https://ajax.googleapis.com/ajax/libs/threejs/r125/three.min.js';
    script.onload = () => {
      const THREE = (window as unknown as { THREE: typeof import('three') })
        .THREE;

      const cnt2 = cnt;
      const width = cnt2.clientWidth || window.innerWidth;
      const height = cnt2.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      rendererInstance = renderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      cnt2.appendChild(renderer.domElement);

      // Main ring - thin bronze torus
      const geometry = new THREE.TorusGeometry(1.5, 0.01, 16, 100);
      const material = new THREE.MeshBasicMaterial({
        color: 0xd4a574,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(geometry, material);
      scene.add(ring);

      // Second ring for depth
      const geometry2 = new THREE.TorusGeometry(1.55, 0.005, 16, 100);
      const material2 = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
      });
      const ring2 = new THREE.Mesh(geometry2, material2);
      ring2.rotation.x = Math.PI / 2;
      scene.add(ring2);

      const c = cnt;
      function onWindowResize() {
        const w = c.clientWidth || window.innerWidth;
        const h = c.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer!.setSize(w, h);
      }
      window.addEventListener('resize', onWindowResize);

      function animate() {
        animId = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        ring.rotation.z += 0.005;
        ring.rotation.y = Math.sin(time * 0.5) * 0.2;

        const scale = 1.0 + Math.sin(time) * 0.05;
        ring.scale.set(scale, scale, scale);

        renderer.render(scene, camera);
      }
      animate();
    };
    document.head.appendChild(script);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', () => {});
      if (
        rendererInstance &&
        cnt.contains(rendererInstance.domElement)
      ) {
        cnt.removeChild(rendererInstance.domElement);
        rendererInstance.dispose();
      }
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

/* ─── Wait Time Display ──────────────────────────────────────────────────── */

interface WaitTimeDisplayProps {
  estimatedMinutes: number;
}

export function WaitTimeDisplay({ estimatedMinutes }: WaitTimeDisplayProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full relative aspect-square flex flex-col items-center justify-center overflow-hidden rounded-[40px]">
      {/* Three.js 3D ring overlay (matching HTML ANIMATION_64) */}
      <div
        className="absolute inset-0 w-full h-full -z-10 scale-125 opacity-40"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <ThreeRingOverlay />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center flex flex-col gap-1">
        <span className="text-[12px] leading-none font-bold uppercase tracking-[0.2em] text-[#c49271]">
          {t('stitch.orderSuccessNewEstimatedWait', {
            defaultValue: 'ESTIMATED WAIT',
          })}
        </span>

        <div
          className="flex items-baseline justify-center text-[84px] leading-none text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: "'EB Garamond', serif" }}
        >
          {estimatedMinutes}
          <span className="text-2xl font-medium ml-2 uppercase tracking-widest text-[var(--aura-chrome-bright)]">
            {t('stitch.orderSuccessNewMin', { defaultValue: 'min' })}
          </span>
        </div>

        {/* Live status badge */}
        <div className="mt-2 px-4 py-1.5 rounded-full border border-[color-mix(in_oklab,var(--aura-chrome-bright)_30%,transparent)] bg-[color-mix(in_oklab,var(--aura-chrome-bright)_10%,transparent)] inline-flex items-center gap-2 self-center">
          <div className="w-2 h-2 rounded-full bg-[var(--aura-chrome-bright)] animate-[pulse-bronze_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#c49271]">
            {t('stitch.orderSuccessNewPreparingBrew', {
              defaultValue: 'PREPARING YOUR BREW',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
