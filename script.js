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
    /* ——— 4. Mobile accordion footer ——— */
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