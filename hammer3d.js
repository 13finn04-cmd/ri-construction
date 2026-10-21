// Scroll-driven 3D hammer for the "How a job goes" section (same engine as the JT Boxing glove).
// Desktop only (fine pointer, wider than 760px, motion allowed). Phones and
// reduced-motion visitors keep the static hammer image; see DESIGN.md "Motion".
const section = document.querySelector('[data-process]');
const ok = section
  && window.matchMedia('(min-width: 761px) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (section) {
  const phases = [...section.querySelectorAll('[data-phase]')];
  const ticks = [...section.querySelectorAll('[data-tick]')];
  let progress = 0, active = -1;

  const setPhase = (i) => {
    if (i === active) return;
    active = i;
    phases.forEach((el, n) => el.classList.toggle('is-on', n === i));
    ticks.forEach((el, n) => el.classList.toggle('is-on', n <= i));
  };

  const measure = () => {
    const r = section.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    progress = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    setPhase(Math.min(phases.length - 1, Math.floor(progress * phases.length)));
  };

  if (ok) {
    section.classList.add('is-live');
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    start().catch(() => { section.classList.remove('is-3d'); section.querySelector('canvas')?.remove(); });
  } else {
    setPhase(0);
  }

  async function start() {
    const stage = section.querySelector('[data-stage]');
    const { THREE, GLTFLoader, RoomEnvironment } = await import(new URL('./engine3d.js', import.meta.url).href);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    // warm workshop light: key from upper right, bronze rim behind
    const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(2.5, 3, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xd18a3c, 2.6); rim.position.set(-3, 1.5, -2.5); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xfff6ea, 0.3));

    const pivot = new THREE.Group(); scene.add(pivot);
    const [gltf, tex] = await Promise.all([
      new GLTFLoader().loadAsync(stage.dataset.model),
      new THREE.TextureLoader().loadAsync(stage.dataset.tex),
    ]);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.scale.setScalar(2.2 / size);
    model.traverse((o) => {
      if (o.isMesh && o.material) { o.material.map = tex; o.material.envMapIntensity = 1; o.material.needsUpdate = true; }
    });
    pivot.add(model);
    let shown = false;

    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    const mouse = { x: 0, y: 0 };
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    let visible = false, raf = 0;
    const t0 = performance.now();
    const rot = { y: 0, x: 0, z: 0 };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    }, { rootMargin: '200px' }).observe(section);

    function tick(now) {
      raf = 0;
      if (!visible) return;
      const t = (now - t0) / 1000;
      // the hammer turns through the steps and swings once in the middle of each one
      const phaseT = (progress * phases.length) % 1;
      const strike = Math.sin(Math.min(1, Math.max(0, (phaseT - 0.4) / 0.25)) * Math.PI);
      const targetY = -0.7 + progress * Math.PI * 1.25 + mouse.x * 0.45;
      const targetX = 0.1 + mouse.y * 0.3;
      const targetZ = -0.25 - strike * 0.55;
      rot.y += (targetY - rot.y) * 0.08;
      rot.x += (targetX - rot.x) * 0.08;
      rot.z += (targetZ - rot.z) * 0.18;
      pivot.rotation.set(rot.x, rot.y, rot.z);
      pivot.position.y = Math.sin(t * 1.1) * 0.04;
      renderer.render(scene, camera);
      if (!shown) { shown = true; section.classList.add('is-3d'); }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }
}
