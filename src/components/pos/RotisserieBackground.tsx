import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Fondo 3D del inicio de sesión: un horno asadero con filas de pollos
 * girando en sus varillas, fuego que ilumina desde abajo, brasas y humo.
 * Se carga solo en la pantalla de login (import dinámico) y se libera al salir.
 */

// ---------- Texturas generadas (sin archivos externos) ----------

function skinTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#b8692a');
  grad.addColorStop(0.5, '#8f4a18');
  grad.addColorStop(1, '#5e2d0d');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Manchas de dorado y tostado de la piel
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 7 + 1;
    const dark = Math.random() < 0.55;
    g.fillStyle = dark
      ? `rgba(${70 + Math.random() * 40},${28 + Math.random() * 20},8,${0.12 + Math.random() * 0.25})`
      : `rgba(255,${170 + Math.random() * 50},${70 + Math.random() * 40},${0.08 + Math.random() * 0.18})`;
    g.beginPath();
    g.ellipse(x, y, r * 1.6, r, Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Puntitos de especias
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(40,18,6,${0.3 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function softTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function smokeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 40; i++) {
    const x = 128 + (Math.random() - 0.5) * 120;
    const y = 128 + (Math.random() - 0.5) * 120;
    const r = 30 + Math.random() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(c);
}

// ---------- Pollo asado ----------

const SPHERE = new THREE.SphereGeometry(1, 28, 18);
const LEG = new THREE.CapsuleGeometry(0.2, 0.55, 6, 12);

function makeChicken(skin: THREE.Material): THREE.Group {
  const chicken = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, skin);
    m.position.set(...pos);
    m.scale.set(...scale);
    m.rotation.set(...rot);
    chicken.add(m);
    return m;
  };
  const sphere = SPHERE;
  // Cuerpo (amarrado, como en el asadero) y pechuga
  add(sphere, [0, 0, 0], [1.3, 0.92, 0.98]);
  add(sphere, [0.2, 0.3, 0.24], [1.05, 0.68, 0.6]);
  add(sphere, [0.2, 0.3, -0.24], [1.05, 0.68, 0.6]);
  // Muslos pegados al cuerpo
  add(sphere, [-0.5, -0.22, 0.6], [0.7, 0.55, 0.4], [0, 0, 0.35]);
  add(sphere, [-0.5, -0.22, -0.6], [0.7, 0.55, 0.4], [0, 0, 0.35]);
  // Piernas recogidas hacia atrás
  const leg = LEG;
  add(leg, [-1.05, 0.05, 0.36], [0.95, 0.85, 0.95], [0, 0, 1.35]);
  add(leg, [-1.05, 0.05, -0.36], [0.95, 0.85, 0.95], [0, 0, 1.35]);
  // Alas pegadas al cuerpo
  add(sphere, [0.55, -0.15, 0.86], [0.6, 0.32, 0.18], [0.25, 0, -0.35]);
  add(sphere, [0.55, -0.15, -0.86], [0.6, 0.32, 0.18], [-0.25, 0, -0.35]);
  chicken.scale.setScalar(0.72);
  return chicken;
}

export function RotisserieBackground() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      return; // Sin WebGL: queda el fondo en CSS
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0705');
    scene.fog = new THREE.Fog('#120804', 9, 24);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 0.3, 11);

    // ----- Luces: fuego abajo, calor ámbar y un brillo de borde -----
    scene.add(new THREE.AmbientLight('#3a1d0e', 0.6));
    const fireLights = [-6, -2, 2, 6].map(x => {
      const l = new THREE.PointLight('#ff7a1a', 24, 16, 1.6);
      l.position.set(x, -4.2, 2.5);
      scene.add(l);
      return l;
    });
    const key = new THREE.DirectionalLight('#ffe2bd', 1.5);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#ff9b4a', 1.4);
    rim.position.set(-6, 2, -6);
    scene.add(rim);

    // ----- Pared del horno con resplandor -----
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 30),
      new THREE.MeshStandardMaterial({ color: '#1a0d07', roughness: 0.95, metalness: 0.2 }),
    );
    wall.position.z = -5;
    scene.add(wall);
    const glowTex = softTexture('rgba(255,120,30,0.9)', 'rgba(255,60,0,0)');
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
    glow.scale.set(30, 12, 1);
    glow.position.set(0, -6.5, -2);
    scene.add(glow);

    // ----- Llamas y carbón al fondo del horno -----
    const flameTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 128;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 110, 2, 32, 90, 70);
      grad.addColorStop(0, 'rgba(255,240,180,1)');
      grad.addColorStop(0.25, 'rgba(255,170,50,0.9)');
      grad.addColorStop(0.6, 'rgba(230,70,10,0.45)');
      grad.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(32, 0);
      g.bezierCurveTo(60, 50, 64, 100, 32, 128);
      g.bezierCurveTo(0, 100, 4, 50, 32, 0);
      g.fill();
      return new THREE.CanvasTexture(c);
    })();
    const flames: { s: THREE.Sprite; base: number; ph: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      const base = 0.9 + Math.random() * 1.1;
      s.position.set(-13 + i * 1.04 + Math.random() * 0.5, -3.5, 3 + Math.random() * 1.2);
      s.scale.set(base * 0.7, base * 1.6, 1);
      scene.add(s);
      flames.push({ s, base, ph: Math.random() * 10 });
    }
    const coals = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 3),
      new THREE.MeshBasicMaterial({ map: softTexture('rgba(255,90,20,1)', 'rgba(60,10,0,1)'), color: '#ff6a1a' }),
    );
    coals.position.set(0, -4.1, 3.2);
    coals.rotation.x = -Math.PI / 2.4;
    scene.add(coals);

    // ----- Varillas con pollos -----
    const skinTex = skinTexture();
    const skin = new THREE.MeshPhysicalMaterial({
      map: skinTex,
      roughness: 0.62,
      bumpMap: skinTex,
      bumpScale: 0.6,
      metalness: 0.05,
      clearcoat: 0.3,
      clearcoatRoughness: 0.5,
      sheen: 0.25,
      sheenColor: new THREE.Color('#ffb347'),
    });
    const steel = new THREE.MeshStandardMaterial({ color: '#9a9a9a', metalness: 0.95, roughness: 0.25 });
    const rows = [
      { y: 2.6, z: -1.6, count: 5, speed: 0.7, offset: 0 },
      { y: 0.2, z: -0.4, count: 4, speed: -0.85, offset: 1.4 },
      { y: -2.3, z: 0.6, count: 5, speed: 0.6, offset: 0.7 },
    ];
    const spits: { group: THREE.Group; speed: number }[] = [];
    rows.forEach(row => {
      const spit = new THREE.Group();
      spit.position.set(0, row.y, row.z);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 26, 12), steel);
      rod.rotation.z = Math.PI / 2;
      spit.add(rod);
      const spacing = 3.3;
      for (let i = 0; i < row.count; i++) {
        const c = makeChicken(skin);
        c.position.x = (i - (row.count - 1) / 2) * spacing + row.offset;
        c.rotation.x = Math.random() * Math.PI * 2;
        spit.add(c);
        // Horquillas que sujetan cada pollo
        const fork = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 24, Math.PI), steel);
        fork.position.x = c.position.x + 0.95;
        fork.rotation.y = Math.PI / 2;
        spit.add(fork);
      }
      scene.add(spit);
      spits.push({ group: spit, speed: row.speed });
    });

    // ----- Brasas que suben -----
    const EMBERS = 420;
    const emberGeo = new THREE.BufferGeometry();
    const ePos = new Float32Array(EMBERS * 3);
    const eVel = new Float32Array(EMBERS);
    const resetEmber = (i: number, anywhere: boolean) => {
      ePos[i * 3] = (Math.random() - 0.5) * 22;
      ePos[i * 3 + 1] = anywhere ? Math.random() * 12 - 6 : -6 - Math.random() * 2;
      ePos[i * 3 + 2] = Math.random() * 6 - 3;
      eVel[i] = 0.6 + Math.random() * 1.6;
    };
    for (let i = 0; i < EMBERS; i++) resetEmber(i, true);
    emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    const embers = new THREE.Points(
      emberGeo,
      new THREE.PointsMaterial({
        size: 0.09,
        map: softTexture('rgba(255,220,140,1)', 'rgba(255,90,0,0)'),
        color: '#ffae42',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(embers);

    // ----- Humo -----
    const smokeMap = smokeTexture();
    const puffs: { s: THREE.Sprite; vy: number; vr: number; life: number; max: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, color: '#c9b8a8', transparent: true, depthWrite: false, opacity: 0 }));
      const p = { s, vy: 0, vr: 0, life: 0, max: 1 };
      const spawn = (initial: boolean) => {
        s.position.set((Math.random() - 0.5) * 20, initial ? Math.random() * 10 - 5 : -5.5, Math.random() * 5 - 1.5);
        p.vy = 0.35 + Math.random() * 0.45;
        p.vr = (Math.random() - 0.5) * 0.25;
        p.max = 9 + Math.random() * 7;
        p.life = initial ? Math.random() * p.max : 0;
      };
      spawn(true);
      (p as any).spawn = spawn;
      scene.add(s);
      puffs.push(p);
    }

    // ----- Tamaño y movimiento -----
    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // En celular acercamos para que los pollos llenen la pantalla
      camera.position.z = w / h < 0.8 ? 14 : 11;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    // Calidad adaptable: si el equipo no da ~40 cuadros por segundo, bajamos resolución y humo
    let frames = 0;
    let qualityChecked = false;
    const frame = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      frames++;
      if (!qualityChecked && t > 2.5) {
        qualityChecked = true;
        if (frames / t < 40) {
          renderer.setPixelRatio(1);
          resize();
          puffs.forEach((p, i) => { if (i % 2) p.s.visible = false; });
          skin.clearcoat = 0;
        }
      }

      spits.forEach(sp => sp.group.children.forEach(ch => {
        if (ch instanceof THREE.Group) ch.rotation.x += sp.speed * dt;
      }));

      // Fuego que parpadea
      fireLights.forEach((l, i) => {
        l.intensity = 22 + Math.sin(t * 7 + i * 1.7) * 4 + Math.sin(t * 13.3 + i) * 3 + Math.random() * 2;
      });
      glow.material.opacity = 0.75 + Math.sin(t * 3.1) * 0.08;
      flames.forEach(f => {
        const k = 1 + Math.sin(t * 9 + f.ph) * 0.18 + Math.sin(t * 15.7 + f.ph * 2) * 0.1;
        f.s.scale.set(f.base * 0.7 * (2 - k) * 0.9, f.base * 1.6 * k, 1);
        f.s.material.opacity = 0.65 + Math.sin(t * 11 + f.ph) * 0.15;
      });

      for (let i = 0; i < EMBERS; i++) {
        ePos[i * 3 + 1] += eVel[i] * dt;
        ePos[i * 3] += Math.sin(t * 1.3 + i) * 0.006;
        if (ePos[i * 3 + 1] > 7) resetEmber(i, false);
      }
      emberGeo.attributes.position.needsUpdate = true;

      puffs.forEach(p => {
        p.life += dt;
        if (p.life > p.max) (p as any).spawn(false);
        const k = p.life / p.max;
        p.s.position.y += p.vy * dt;
        p.s.position.x += Math.sin(t * 0.4 + p.max) * 0.004;
        p.s.material.rotation += p.vr * dt;
        const size = 2.5 + k * 6;
        p.s.scale.set(size, size, 1);
        p.s.material.opacity = Math.sin(Math.PI * k) * 0.22;
      });

      camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.03;
      camera.position.y += (0.3 - pointer.y * 0.35 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) {
        clock.getDelta();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse(obj => {
        const o = obj as THREE.Mesh;
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach(m => {
          Object.values(m).forEach(v => (v instanceof THREE.Texture ? v.dispose() : null));
          m.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mount} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}

export default RotisserieBackground;
