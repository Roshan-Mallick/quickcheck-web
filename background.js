(function () {
  const c = document.getElementById('bg-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, stars = [], flow = [];
  let centerX, beamTopY, prefersReduced = false;
  let animId = null;

  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqMobile = window.matchMedia('(max-width: 768px)');
  prefersReduced = mqReduced.matches;

<<<<<<< HEAD
  ctx.fillStyle='rgba(201,168,108,.4)';
  ctx.fillRect(d.x,d.y,1.5,1.5);
 }
 requestAnimationFrame(loop);
}
resize();loop();
=======
  mqReduced.addEventListener('change', function (e) { prefersReduced = e.matches; });

  function resize() {
    W = c.width = window.innerWidth;
    H = c.height = window.innerHeight;
    centerX = W / 2;
    beamTopY = H * 0.12;
    initStars();
    initFlow();
  }

  function initStars() {
    stars = [];
    const maxStars = mqMobile.matches ? 400 : 1800;
    const count = Math.min(Math.floor((W * H) / 1200), maxStars);
    for (let i = 0; i < count; i++) {
      const h = 220 + Math.random() * 60;
      const o = Math.random() * 0.15 + 0.04;
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: Math.random() * 1.0 + 0.2,
        o: o,
        h: h,
        fill: 'hsla(' + h + ',40%,65%,' + o + ')',
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function initFlow() {
    flow = [];
    const count = prefersReduced ? 0 : 28;
    for (let i = 0; i < count; i++) {
      flow.push(makeFlowParticle());
    }
  }

  function makeFlowParticle() {
    const tx = centerX + (Math.random() - 0.5) * 100;
    const ty = beamTopY + (Math.random() - 0.5) * 60;
    const h = 230 + Math.random() * 50;
    const o = Math.random() * 0.025 + 0.008;
    return {
      x: Math.random() * W,
      y: H + 10 + Math.random() * 80,
      s: Math.random() * 0.8 + 0.3,
      o: o,
      h: h,
      fill: 'hsla(' + h + ',40%,65%,' + o + ')',
      tx: tx,
      ty: ty,
    };
  }

  function drawStars(time) {
    for (let i = 0; i < stars.length; i++) {
      const p = stars[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fillStyle = p.fill;
      ctx.fill();
      if (!prefersReduced) {
        p.x += Math.sin(time * 0.00006 + p.phase) * 0.04;
        p.y += Math.cos(time * 0.00006 + p.phase + 1) * 0.04;
      }
    }
  }

  function drawFlow(time) {
    if (prefersReduced) return;
    for (let i = 0; i < flow.length; i++) {
      const p = flow[i];
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        p.x += (dx / dist) * 0.12;
        p.y += (dy / dist) * 0.12;
      }
      p.y -= 0.08;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fillStyle = p.fill;
      ctx.fill();

      if (p.y < -10 || dist < 15) {
        const fp = makeFlowParticle();
        p.x = fp.x;
        p.y = fp.y;
        p.s = fp.s;
        p.o = fp.o;
        p.h = fp.h;
        p.fill = fp.fill;
        p.tx = fp.tx;
        p.ty = fp.ty;
      }
    }
  }

  function loop(time) {
    ctx.clearRect(0, 0, W, H);
    drawStars(time);
    drawFlow(time);
    animId = requestAnimationFrame(loop);
  }

  function start() {
    if (animId === null) {
      animId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  animId = requestAnimationFrame(loop);
>>>>>>> 48ae549 (feat: release Quickcheck v0.9.4-beta foundation release)
})();
