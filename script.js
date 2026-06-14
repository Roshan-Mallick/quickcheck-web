(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.nav');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ——— 1. Scroll-based nav styling ——— */
    if (nav) {
      const SCROLL_THRESHOLD = 60;
      let ticking = false;

      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            nav.classList.toggle('scrolled', window.scrollY > SCROLL_THRESHOLD);
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }

    /* ——— 2. Smooth scroll for anchor links ——— */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', id);
      });
    });

    /* ——— 3. IntersectionObserver scroll-reveal with stagger ——— */
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
      );
      reveals.forEach(el => observer.observe(el));
    }

    /* ——— 4. Hero checklist onboarding animation ——— */
    (function animateHeroChecklist() {
      const visual = document.querySelector('.hero-visual');
      if (!visual) return;

      const items = visual.querySelectorAll('.hero-item');
      const fill = visual.querySelector('.hero-progress-fill');
      const text = visual.querySelector('.hero-progress-text');
      if (!items.length || !fill || !text) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const CHECK_ORDER = [0, 1, 2, 4, 5];
      const FINAL_MAP = [true, true, true, false, true, true, false];

      const START_PCT = 25, FINAL_PCT = 75;
      const START_NUM = 4, FINAL_NUM = 12, DENOM = 16;
      const DURATION = 3500, PAUSE = 4500;

      let raf = null, timer = null;

      function setChecked(item, checked) {
        item.classList.toggle('checked', checked);
        const cb = item.querySelector('.hero-checkbox');
        if (cb) cb.textContent = checked ? '✓' : '';
      }

      function reset() {
        items.forEach(i => setChecked(i, false));
        fill.style.width = START_PCT + '%';
        text.textContent = START_NUM + '/' + DENOM;
      }

      function finalize() {
        items.forEach((i, idx) => setChecked(i, FINAL_MAP[idx]));
        fill.style.width = FINAL_PCT + '%';
        text.textContent = FINAL_NUM + '/' + DENOM;
      }

      function loop() {
        if (raf) cancelAnimationFrame(raf);
        if (timer) clearTimeout(timer);
        reset();

        const ease = t => 1 - Math.pow(1 - t, 3);
        const start = performance.now();
        let step = 0;

        function tick(now) {
          const t = Math.min((now - start) / DURATION, 1);
          const e = ease(t);

          fill.style.width = (START_PCT + (FINAL_PCT - START_PCT) * e) + '%';
          text.textContent = Math.round(START_NUM + (FINAL_NUM - START_NUM) * e) + '/' + DENOM;

          const itemProgress = t * CHECK_ORDER.length;
          while (step < itemProgress) {
            setChecked(items[CHECK_ORDER[step]], true);
            step++;
          }

          if (t < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            finalize();
            timer = setTimeout(loop, PAUSE);
          }
        }

        raf = requestAnimationFrame(tick);
      }

      loop();
    })();

    /* ——— 5. Mobile nav toggle ——— */
    const toggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navBackdrop = document.querySelector('.nav-backdrop');

    if (toggle && navLinks) {
      const open = () => {
        navLinks.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        if (navBackdrop) navBackdrop.classList.add('visible');
        document.body.classList.add('menu-open');
      };

      const close = () => {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (navBackdrop) navBackdrop.classList.remove('visible');
        document.body.classList.remove('menu-open');
      };

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navLinks.classList.contains('open')) {
          close();
        } else {
          open();
        }
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('open')) close();
      });

      // Close on backdrop click
      if (navBackdrop) {
        navBackdrop.addEventListener('click', close);
      }

      // Close on link click (except mobile CTA uses its own href)
      navLinks.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', close)
      );

      // Set initial aria state
      toggle.setAttribute('aria-expanded', 'false');
    }

    /* ——— 6. Mobile accordion footer ——— */
    const accordion = document.querySelector('.fm-accordion');
    if (accordion) {
      accordion.addEventListener('click', (e) => {
        const trigger = e.target.closest('.fm-trigger');
        if (!trigger) return;

        const group = trigger.closest('.fm-group');
        if (!group) return;

        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        const content = trigger.nextElementSibling;

        // Close all groups first
        accordion.querySelectorAll('.fm-group').forEach(g => {
          const btn = g.querySelector('.fm-trigger');
          const panel = g.querySelector('.fm-content');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          if (panel) panel.classList.remove('is-open');
        });

        // If the clicked group was collapsed, open it
        if (!isExpanded) {
          trigger.setAttribute('aria-expanded', 'true');
          if (content && content.classList.contains('fm-content')) {
            content.classList.add('is-open');
          }
        }
      });
    }
  });
})();