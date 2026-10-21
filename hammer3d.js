// Scroll-driven 3D hammer for the "How a job goes" section (same engine as the JT Boxing glove).
// Desktop (fine pointer, wider than 760px): the section pins and the hammer turns through 4 steps.
// Phones: no pinning; the hammer turns and swings as the section scrolls past, and a finger drag spins it.
// The 3D engine and model only download when the section gets close. Reduced motion keeps the still image.
const section = document.querySelector('[data-process]');
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ok = section && !still && window.matchMedia('(min-width: 761px) and (pointer: fine)').matches;
const phone = section && !still && !ok;

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

  const fail = () => { section.classList.remove('is-3d'); section.querySelector('canvas')?.remove(); };
  if (ok) {
    section.classList.add('is-live');
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    start().catch(fail);
  } else if (phone) {
    // progress = how far the section has travelled through the screen
    const track = () => {
      const r = section.getBoundingClientRect();
      progress = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
    };
    window.addEventListener('scroll', track, { passive: true });
    track();
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      start().catch(fail);
    }, { rootMargin: '700px 0px' });
    near.observe(section);
  } else {
    setPhase(0);
  }

  async function start() {
    const stage = section.querySelector('[data-stage]');
    const { THREE, GLTFLoader, RoomEnvironment } = await import(new URL('./engine3d.js', import.meta.url).href);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 2));
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
    let spin = 0, spinV = 0, dragX = null;
    if (ok) {
      window.addEventListener('pointermove', (e) => {
        mouse.x = e.clientX / window.innerWidth - 0.5;
        mouse.y = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });
    } else {
      // finger drag spins the hammer; vertical swipes still scroll the page (touch-action: pan-y)
      stage.addEventListener('pointerdown', (e) => { dragX = e.clientX; spinV = 0; });
      stage.addEventListener('pointermove', (e) => {
        if (dragX == null) return;
        const dx = e.clientX - dragX; dragX = e.clientX;
        spin += dx * 0.012; spinV = dx * 0.012;
      });
      const up = () => { dragX = null; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up); stage.addEventListener('pointerleave', up);
    }

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
      if (dragX == null) { spin += spinV; spinV *= 0.94; }
      const targetY = -0.7 + progress * Math.PI * 1.25 + mouse.x * 0.45 + spin;
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
