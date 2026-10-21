(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 761px) and (pointer: fine)').matches && !reduced;

  // ---- nav border + phone call dock ----
  const nav = document.querySelector('[data-nav]');
  const dock = document.querySelector('[data-dock]');
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 12);
    if (dock) dock.classList.toggle('is-on', y > innerHeight * 0.7);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- mobile menu ----
  const btn = document.querySelector('[data-menu-btn]');
  const menu = document.querySelector('[data-menu]');
  const setMenu = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  btn?.addEventListener('click', () => setMenu(menu.hidden));
  menu?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); btn.focus(); } });

  // ---- videos: load only when near the screen, phone-sized file on phones, pause off-screen ----
  const small = matchMedia('(max-width: 760px)').matches;
  const vids = document.querySelectorAll('video[data-lazy-video]');
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const arm = (v) => {
    if (v.dataset.armed) return;
    v.dataset.armed = '1';
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.src = (small && v.dataset.srcM) || v.dataset.src;
    v.preload = 'auto';
    v.addEventListener('loadeddata', () => play(v), { once: true });
    // strict phones: retry on the first touch
    ['touchstart', 'pointerdown'].forEach((ev) => addEventListener(ev, () => play(v), { once: true, passive: true }));
  };
  if (!reduced && vids.length) {
    if ('IntersectionObserver' in window) {
      const vio = new IntersectionObserver((es) => es.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) { arm(v); play(v); } else if (v.dataset.armed) v.pause();
      }), { rootMargin: '300px 0px' });
      vids.forEach((v) => vio.observe(v));
    } else vids.forEach((v) => { arm(v); play(v); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) vids.forEach((v) => v.pause()); });
  }

  // ---- before / after toggles ----
  document.querySelectorAll('[data-compare]').forEach((c) => {
    const btns = c.querySelectorAll('[data-show]');
    btns.forEach((b) => b.addEventListener('click', () => {
      const which = b.dataset.show;
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      c.querySelectorAll('[data-shot]').forEach((s) => s.classList.toggle('is-on', s.dataset.shot === which));
    }));
  });

  // ---- before/after drag sliders (both photos lined up to the same angle) ----
  document.querySelectorAll('[data-slider]').forEach((s) => {
    const r = s.querySelector('.slider__range');
    const set = () => s.style.setProperty('--pos', `${r.value}%`);
    r.addEventListener('input', set);
    set();
  });

  // ---- services list swaps the big photo (desktop hover / focus) ----
  const list = document.querySelector('[data-svc-list]');
  if (list) {
    const rows = [...list.querySelectorAll('[data-svc]')];
    const shots = [...document.querySelectorAll('[data-art]')];
    const set = (i) => {
      rows.forEach((r, n) => r.classList.toggle('is-on', n === i));
      shots.forEach((s, n) => s.classList.toggle('is-on', n === i));
    };
    rows.forEach((r, i) => {
      r.addEventListener('pointerenter', () => set(i));
      r.addEventListener('focusin', () => set(i));
    });
    set(0);
  }

  // ---- kitchen gallery ----
  document.querySelectorAll('[data-gal]').forEach((g) => {
    const main = g.querySelector('.gal__main img');
    const thumbs = g.querySelectorAll('.gal__t');
    thumbs.forEach((t) => t.addEventListener('click', () => {
      main.src = t.dataset.src; main.srcset = t.dataset.srcset; main.alt = t.dataset.alt;
      thumbs.forEach((x) => x.classList.toggle('is-on', x === t));
    }));
  });

  // ---- free estimate builder: writes the text message for you ----
  const form = document.querySelector('[data-est]');
  if (form) {
    const msgEl = document.querySelector('[data-msg]');
    const sms = document.querySelector('[data-sms]');
    const copy = document.querySelector('[data-copy]');
    const job = new URLSearchParams(location.search).get('job');
    if (job) { const box = form.querySelector(`input[data-id="${CSS.escape(job)}"]`); if (box) box.checked = true; }
    const build = () => {
      const jobs = [...form.querySelectorAll('input[name=job]:checked')].map((i) => i.value.toLowerCase());
      const town = form.town.value.trim();
      const when = form.querySelector('input[name=when]:checked')?.value.toLowerCase();
      const notes = form.notes.value.trim();
      const name = form.name.value.trim();
      let what = jobs.length ? jobs.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'a project';
      let m = `Hi RI Construction, ${name ? `this is ${name}. ` : ''}I'd like a free estimate for ${what}`;
      m += town ? ` in ${town}.` : '.';
      if (when) m += ` Timing: ${when}.`;
      if (notes) m += `\n${notes}`;
      return m;
    };
    const paint = () => {
      const m = build();
      msgEl.textContent = m;
      // iOS uses "&body=", Android accepts "?body="; "?&body=" works on both
      sms.href = `sms:+14015627018?&body=${encodeURIComponent(m)}`;
    };
    form.addEventListener('input', paint);
    form.addEventListener('change', paint);
    form.addEventListener('submit', (e) => e.preventDefault());
    paint();
    copy?.addEventListener('click', async () => {
      const label = copy.querySelector('span');
      try { await navigator.clipboard.writeText(build()); label.textContent = 'Copied. Paste it in a text.'; }
      catch { const r = document.createRange(); r.selectNodeContents(msgEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); label.textContent = 'Selected. Copy it.'; }
      setTimeout(() => { label.textContent = 'Copy the message'; }, 2600);
    });
  }

  // ---- desktop only (DESIGN.md: phones get none of this) ----
  if (desktop) {
    // split headline: words rise in once
    document.querySelectorAll('[data-split]').forEach((h) => {
      const walk = (node) => [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach((w) => {
            if (!w.trim()) { frag.append(w); return; }
            const s = document.createElement('span'); s.className = 'sw'; s.textContent = w; frag.append(s);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1) walk(c);
      });
      walk(h);
      h.querySelectorAll('.sw').forEach((s, i) => { s.style.transitionDelay = `${120 + i * 55}ms`; });
      h.classList.add('is-split');
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('is-in')));
    });

    // floating collage drifts with the mouse (vanilla port of 21st.dev parallax-floating)
    const floating = document.querySelector('[data-floating]');
    if (floating) {
      const sens = parseFloat(floating.dataset.sensitivity || '1');
      const items = [...floating.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: parseFloat(el.dataset.depth), x: 0, y: 0 }));
      const mouse = { x: 0, y: 0 };
      addEventListener('mousemove', (e) => {
        const r = floating.getBoundingClientRect();
        mouse.x = e.clientX - r.left - r.width / 2; mouse.y = e.clientY - r.top - r.height / 2;
      }, { passive: true });
      let on = true;
      new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) requestAnimationFrame(tick); }).observe(floating);
      function tick() {
        for (const it of items) {
          const k = (it.depth * sens) / 20;
          it.x += (mouse.x * k - it.x) * 0.05; it.y += (mouse.y * k - it.y) * 0.05;
          it.el.style.transform = `translate3d(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px, 0)`;
        }
        if (on) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // cursor spotlight
    document.querySelectorAll('.fx, .ways a, .faq details, .est__out').forEach((el) => {
      el.classList.add('fx-spot');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
    // gentle 3D tilt (max 6deg)
    document.querySelectorAll('.fx-tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    // magnetic bronze buttons
    document.querySelectorAll('.btn--bronze').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
    // quote lights up word by word as it scrolls through
    document.querySelectorAll('[data-scrub] blockquote').forEach((q) => {
      const text = q.textContent.trim();
      q.setAttribute('aria-label', text);
      q.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
      const spans = [...q.querySelectorAll('.w')];
      const paint = () => {
        const r = q.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (innerHeight * 0.55)));
        const n = Math.round(p * spans.length);
        spans.forEach((s, i) => s.classList.toggle('is-lit', i < n));
      };
      addEventListener('scroll', paint, { passive: true });
      paint();
    });
    // fade-up reveal once
    if ('IntersectionObserver' in window) {
      const els = document.querySelectorAll('.head, .feat, .ba__copy, .slider, .bento__item, .demo__media, .demo__copy, .vet, .faq__list, .sv, .about__copy, .band__in > *, .pair, .quote-band figcaption');
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        const t = e.target; t.classList.add('is-in'); io.unobserve(t);
        setTimeout(() => { t.style.transitionDelay = ''; }, 1400);
      }), { rootMargin: '0px 0px -8% 0px' });
      els.forEach((el) => {
        const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
        el.classList.add('reveal'); el.style.transitionDelay = `${Math.min(i, 4) * 70}ms`;
        io.observe(el);
      });
    }
  }

  const yr = document.querySelector('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();
})();
