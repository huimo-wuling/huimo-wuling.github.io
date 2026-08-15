/* 昼雨暗夜 —— 背景雨滴效果
 * 全屏固定 canvas,位于内容之下(z-index:0,内容为 1),绘制两层雨:
 *   1) 斜落的细雨丝 —— 营造"正在下雨"的整体氛围;
 *   2) 缓慢滑落的近景水珠 —— 带尾迹水痕,模拟雨滴在玻璃/镜头上的滑落感。
 * 尊重 prefers-reduced-motion:减少动画时仅渲染一帧静态雨丝,不做持续动画。
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 画布(固定定位,铺满视口,置于内容之下)----
  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  var cs = canvas.style;
  cs.position = 'fixed';
  cs.top = '0';
  cs.left = '0';
  cs.width = '100%';
  cs.height = '100%';
  cs.pointerEvents = 'none';
  cs.zIndex = '0';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');

  var width = 0;
  var height = 0;

  // ---- 可调参数 ----
  var WIND = -0.35;              // 风向(负值:雨向左斜落)
  var RAIN_COLOR = '173, 202, 226'; // 雨色 rgb,偏冷蓝灰,贴合暗色主题

  var streaks = [];   // 雨丝
  var droplets = [];  // 滑落水珠

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeStreak(fromTop) {
    return {
      x: Math.random() * (width + 120) - 60,
      y: fromTop ? rand(-220, -20) : Math.random() * height,
      speed: rand(900, 1600),   // 下落速度 px/s
      len: rand(14, 44),        // 雨丝长度
      alpha: rand(0.08, 0.30),  // 透明度
      lw: rand(0.6, 1.4)        // 线宽
    };
  }

  function makeDroplet(fromTop) {
    return {
      x: Math.random() * width,
      y: fromTop ? rand(-40, -6) : Math.random() * height,
      r: rand(0.9, 2.7),        // 水珠半径
      vy: rand(20, 60),         // 初始下落速度
      drift: 0,                 // 横向漂移
      trail: []                 // 尾迹点(用于水痕)
    };
  }

  function buildScene() {
    streaks.length = 0;
    droplets.length = 0;

    // 雨丝数量按屏幕面积缩放
    var streakCount = Math.round((width * height) / 9000);
    for (var i = 0; i < streakCount; i++) streaks.push(makeStreak(false));

    // 滑落水珠数量(少量,避免干扰)
    var dropletCount = Math.min(10, Math.max(4, Math.round(width / 220)));
    for (var j = 0; j < dropletCount; j++) droplets.push(makeDroplet(false));
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildScene();
  }

  function updateStreaks(dt) {
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      s.y += s.speed * dt;
      s.x += s.speed * dt * WIND;
      if (s.y - s.len > height || s.x < -60) {
        streaks[i] = makeStreak(true);
      }
    }
  }

  function updateDroplets(dt) {
    for (var i = 0; i < droplets.length; i++) {
      var d = droplets[i];

      // 重力加速,模拟水珠聚集成股后加速下滑
      d.vy += 220 * dt;
      if (d.vy > 240) d.vy = 240;

      // 轻微横向随机漂移,模拟不规则滑落
      d.drift += rand(-40, 40) * dt;
      d.drift *= 0.96;
      d.x += d.drift * dt;
      d.y += d.vy * dt;

      d.trail.push({ x: d.x, y: d.y });
      if (d.trail.length > 16) d.trail.shift();

      if (d.y - 24 > height) {
        droplets[i] = makeDroplet(true);
      }
    }
  }

  function drawStreaks() {
    ctx.lineCap = 'round';
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      var dx = s.len * WIND;
      ctx.strokeStyle = 'rgba(' + RAIN_COLOR + ', ' + s.alpha + ')';
      ctx.lineWidth = s.lw;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - dx, s.y - s.len);
      ctx.stroke();
    }
  }

  function drawDroplets() {
    ctx.lineCap = 'round';
    for (var i = 0; i < droplets.length; i++) {
      var d = droplets[i];

      // 尾迹水痕(越新的点越明显)
      if (d.trail.length > 1) {
        for (var j = 1; j < d.trail.length; j++) {
          var p0 = d.trail[j - 1];
          var p1 = d.trail[j];
          var f = j / d.trail.length;
          ctx.strokeStyle = 'rgba(' + RAIN_COLOR + ', ' + (0.18 * f).toFixed(3) + ')';
          ctx.lineWidth = d.r * 0.9 * f + 0.3;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }

      // 水滴本体 + 高光
      var g = ctx.createRadialGradient(
        d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.1,
        d.x, d.y, d.r
      );
      g.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      g.addColorStop(0.55, 'rgba(190, 214, 235, 0.32)');
      g.addColorStop(1, 'rgba(140, 170, 200, 0.04)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var last = 0;
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // 防止切回标签页后跳变

    ctx.clearRect(0, 0, width, height);
    updateStreaks(dt);
    updateDroplets(dt);
    drawStreaks();
    drawDroplets();

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();

  if (reduceMotion) {
    // 仅渲染一帧静态氛围,不启动持续动画
    drawStreaks();
    drawDroplets();
  } else {
    requestAnimationFrame(frame);
  }
})();
