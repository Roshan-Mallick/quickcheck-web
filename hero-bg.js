(function () {
  var canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w, h;

  function resize() {
    var hero = canvas.parentElement;
    w = hero.offsetWidth;
    h = hero.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    draw();
  }

  function drawRibbon(yOffset, height, color1, color2, alpha) {
    var mid = h * yOffset;
    var amp = h * height;
    var segments = 6;
    var segW = w / segments;

    ctx.save();
    ctx.globalAlpha = alpha;

    var grad = ctx.createLinearGradient(0, mid - amp, w, mid + amp);
    grad.addColorStop(0, 'rgba(' + color1[0] + ',' + color1[1] + ',' + color1[2] + ',0.12)');
    grad.addColorStop(0.3, 'rgba(' + color1[0] + ',' + color1[1] + ',' + color1[2] + ',0.08)');
    grad.addColorStop(0.5, 'rgba(' + color2[0] + ',' + color2[1] + ',' + color2[2] + ',0.06)');
    grad.addColorStop(0.7, 'rgba(' + color1[0] + ',' + color1[1] + ',' + color1[2] + ',0.08)');
    grad.addColorStop(1, 'rgba(' + color2[0] + ',' + color2[1] + ',' + color2[2] + ',0.10)');

    ctx.beginPath();
    ctx.moveTo(0, mid);

    for (var i = 0; i < segments; i++) {
      var x1 = i * segW;
      var x2 = (i + 0.5) * segW;
      var x3 = (i + 1) * segW;
      var phase = i * 1.2;
      var cpx = (x1 + x2) / 2;
      var cpy = mid + Math.sin(phase) * amp;
      var cpx2 = (x2 + x3) / 2;
      var cpy2 = mid + Math.sin(phase + 1.2) * amp;
      ctx.bezierCurveTo(cpx, cpy, cpx2, cpy2, x3, mid + Math.sin(phase + 1.2) * amp * 0.5);
    }

    ctx.lineTo(w, h + 50);
    ctx.lineTo(0, h + 50);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function drawRibbons() {
    drawRibbon(0.55, 0.18, [233,199,104], [201,162,39], 0.7);
    drawRibbon(0.50, 0.25, [201,162,39], [180,140,50], 0.5);
    drawRibbon(0.60, 0.12, [160,120,40], [200,170,80], 0.4);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawRibbons();
  }

  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  window.addEventListener('resize', onResize);
  resize();
})();
