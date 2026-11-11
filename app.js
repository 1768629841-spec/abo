/* 信息素档案 · ABO 第二性别鉴定 —— 引擎 */
(function () {
  var D = window.ABO_DATA, S = window.ABO_SCORE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = {
    answers: new Array(D.QUESTIONS.length).fill(null),
    idx: 0,
    locked: false,
    result: null,
    jitter: null,
    sample: false
  };

  /* ---------- 屏幕切换 ---------- */
  function show(id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('on', s.id === 'sc-' + id); });
    window.scrollTo(0, 0);
  }

  /* ---------- 雷达图 ---------- */
  function radarSVG(vals, accent, size, opts) {
    opts = opts || {};
    var cx = size / 2, cy = size / 2, R = size * 0.355;
    var keys = ['d', 'v', 'b', 'a', 'c'];
    var labels = opts.labels === false ? null : ['支配', '波动', '边界', '吸引', '隐藏'];
    function pt(i, r) {
      var ang = (-90 + i * 72) * Math.PI / 180;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    }
    var s = '';
    // 环
    for (var g = 1; g <= 4; g++) {
      var rr = R * g / 4, p = [];
      for (var i = 0; i < 5; i++) { var q = pt(i, rr); p.push(q[0].toFixed(1) + ',' + q[1].toFixed(1)); }
      s += '<polygon points="' + p.join(' ') + '" fill="none" stroke="' +
        (g === 4 ? 'rgba(201,169,106,.30)' : 'rgba(201,169,106,.11)') + '" stroke-width="1"/>';
    }
    // 轴
    for (var j = 0; j < 5; j++) {
      var e = pt(j, R);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) +
        '" stroke="rgba(201,169,106,.14)" stroke-width="1"/>';
    }
    // 数据面
    var dp = [];
    for (var k = 0; k < 5; k++) {
      var v = Math.max(6, Math.min(100, vals[keys[k]])) / 100;
      var pp = pt(k, R * v);
      dp.push(pp[0].toFixed(1) + ',' + pp[1].toFixed(1));
    }
    s += '<polygon points="' + dp.join(' ') + '" fill="' + hexA(accent, .22) +
      '" stroke="' + accent + '" stroke-width="1.6" stroke-linejoin="round"/>';
    // 顶点
    for (var m = 0; m < 5; m++) {
      var vp = dp[m].split(',');
      s += '<circle cx="' + vp[0] + '" cy="' + vp[1] + '" r="2.6" fill="' + accent + '"/>';
    }
    // 标签
    if (labels) {
      for (var n = 0; n < 5; n++) {
        var lp = pt(n, R + size * 0.085);
        s += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3.5).toFixed(1) +
          '" font-size="' + (size * 0.052).toFixed(1) + '" fill="rgba(185,178,198,.85)" text-anchor="middle" ' +
          'font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif" letter-spacing="1">' + labels[n] + '</text>';
      }
    }
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" height="100%" style="max-width:' + size + 'px">' + s + '</svg>';
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------- 五维抖动：同类型每次数值略有不同，截图不撞图 ---------- */
  function makeJitter() {
    var j = {};
    ['d', 'v', 'b', 'a', 'c'].forEach(function (k) {
      j[k] = Math.floor(Math.random() * 15) - 7;
    });
    return j;
  }
  function applyJitter(radar, j) {
    var o = {};
    Object.keys(radar).forEach(function (k) {
      o[k] = Math.max(8, Math.min(99, radar[k] + (j[k] || 0)));
    });
    return o;
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    $('#home-radar').innerHTML = radarSVG(
      { d: 75, v: 65, b: 80, a: 85, c: 70 }, '#C9A96A', 118, { labels: false });
  }

  /* ---------- 答题 ---------- */
  function renderQuiz() {
    var q = D.QUESTIONS[state.idx];
    var total = D.QUESTIONS.length;
    $('#q-num').textContent = (state.idx + 1 < 10 ? '0' : '') + (state.idx + 1);
    $('#q-count').textContent = (state.idx + 1) + ' / ' + total;
    $('#q-text').textContent = q.text;
    $('#q-bar').style.width = ((state.idx) / total * 100) + '%';

    var box = $('#opts');
    box.innerHTML = '';
    q.options.forEach(function (o, i) {
      var b = document.createElement('button');
      b.className = 'opt' + (state.answers[state.idx] === i ? ' sel' : '');
      b.type = 'button';
      b.innerHTML = '<span class="k">' + 'ABCD'[i] + '</span><span>' + o.text + '</span>';
      b.addEventListener('click', function () { choose(i, b); });
      box.appendChild(b);
    });

    $('#q-back').disabled = state.idx === 0;
    var wrap = $('#sc-quiz');
    wrap.classList.remove('on');
    void wrap.offsetWidth;
    wrap.classList.add('on');
  }

  function choose(i, btn) {
    if (state.locked) return;
    state.locked = true;
    state.answers[state.idx] = i;
    $$('#opts .opt').forEach(function (b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
    setTimeout(function () {
      state.locked = false;
      if (state.idx < D.QUESTIONS.length - 1) {
        state.idx++;
        renderQuiz();
      } else {
        finish();
      }
    }, 320);
  }

  function finish() {
    show('loading');
    var msgs = ['正在读取信息素读数', '正在比对档案库', '正在计算五维偏移', '正在生成档案编号'];
    var mi = 0;
    $('#load-msg').textContent = msgs[0];
    var t = setInterval(function () { mi = (mi + 1) % msgs.length; $('#load-msg').textContent = msgs[mi]; }, 560);
    setTimeout(function () {
      clearInterval(t);
      var r = S.score(state.answers, D);
      state.result = r;
      state.jitter = makeJitter();
      state.sample = false;
      renderResult();
      show('result');
    }, 2250);
  }

  /* ---------- 结果 ---------- */
  function renderResult() {
    var r = state.result;
    var res = D.RESULTS[r.code];
    var radar = applyJitter(res.radar, state.jitter || {});
    var acc = res.accent;
    document.documentElement.style.setProperty('--accent', acc);

    var root = $('#sc-result');
    root.querySelector('.wrap').innerHTML = resultHTML(res, radar, state.sample);
    bindResult(res, radar);

    // 条形动画
    setTimeout(function () {
      $$('.bar-row .t i', root).forEach(function (el) {
        el.style.width = el.dataset.v + '%';
      });
    }, 60);
  }

  function resultHTML(res, radar, isSample) {
    var acc = res.accent;
    var d = D.DIMS;
    var bars = d.map(function (x) {
      return '<div class="bar-row"><div class="lbl"><span>' + x.label + '</span><b style="color:' + acc + '">' +
        radar[x.key] + '</b></div><div class="t"><i data-v="' + radar[x.key] +
        '" style="background:linear-gradient(90deg,' + hexA(acc, .55) + ',' + acc + ')"></i></div></div>';
    }).join('');

    var pheroLine;
    if (res.identity === 'Alpha' || res.identity === 'Omega') {
      pheroLine = '<div class="kv"><span>信息素味道</span><span style="color:' + acc + '">' + res.pheromone + '</span></div>';
    } else if (res.identity === 'Enigma') {
      pheroLine = '<div class="kv"><span>信息素状态</span><span>' + res.status + '</span></div>' +
        '<div class="kv"><span>信息素味道</span><span style="color:' + acc + '">' + res.pheromone + '</span></div>';
    } else {
      pheroLine = '<div class="kv"><span>信息素状态</span><span>' + res.status + '</span></div>' +
        '<div class="kv"><span>气质识别</span><span style="color:' + acc + '">' + res.temperament + '</span></div>';
    }

    var paras = res.analysis.map(function (t) { return '<p>' + t + '</p>'; }).join('');

    return '' +
      '<div class="res-head"><span>DOSSIER · 第二性别档案</span><span class="mono">ABO-' + res.code + '</span></div>' +
      '<div class="card" style="margin-top:16px">' +
        '<div class="badge-row">' +
          '<span class="id-badge">' + res.identity + '</span>' +
          '<span class="res-pop"><small>人群占比</small><b>' + res.population + '%</b></span>' +
        '</div>' +
        '<h2 class="res-name">' + res.name + '</h2>' +
        pheroLine +
        '<div class="tags" style="margin-top:12px">' +
          res.keywords.map(function (k) {
            return '<span class="tag" style="border-color:' + hexA(acc, .35) + ';color:' + acc + '">' + k + '</span>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h3 class="sec-title"><i></i>五维读数</h3>' +
        '<div class="radar-box">' + radarSVG(radar, acc, 230) + '</div>' +
        '<div class="bars">' + bars + '</div>' +
      '</div>' +

      '<div class="card"><h3 class="sec-title"><i></i>人格分析</h3><div class="prose">' + paras + '</div></div>' +
      '<div class="card"><h3 class="sec-title"><i></i>关系模式</h3><div class="prose"><p>' + res.relationship + '</p></div></div>' +
      '<div class="card"><h3 class="sec-title"><i></i>危险提示</h3><div class="prose"><p>' + res.danger + '</p></div></div>' +
      '<div class="card"><h3 class="sec-title"><i></i>适配对象</h3><div class="prose"><p>' + res.partner + '</p></div></div>' +
      '<div class="card" style="border-color:' + hexA(acc, .34) + '">' +
        (isSample ? '<div class="stamp">样<br>例</div>' : '<div class="stamp">已<br>归<br>档</div>') +
        '<h3 class="sec-title"><i></i>档案批注</h3>' +
        '<div class="quote">「' + res.quote + '」</div>' +
      '</div>' +

      '<div class="res-actions">' +
        '<button class="btn" id="btn-sheet">生成档案长图</button>' +
        '<button class="btn btn-ghost" id="btn-again">重新鉴定</button>' +
      '</div>' +
      '<div class="foot">本档案为幻想系人格设定，仅供娱乐，不代表现实性别、真实身份或任何医学判断。</div>';
  }

  function bindResult(res, radar) {
    $('#btn-sheet').addEventListener('click', function () {
      var url = buildSheet(res, radar);
      showSheet(url);
    });
    $('#btn-again').addEventListener('click', function () {
      state.answers = new Array(D.QUESTIONS.length).fill(null);
      state.idx = 0;
      state.result = null;
      state.sample = false;
      show('home');
    });
  }

  /* ---------- 档案长图（canvas 直绘，750px 宽，无第三方依赖） ---------- */
  function buildSheet(res, radar) {
    var W = 750, PAD = 56, acc = res.accent;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');

    function F(size, weight, serif) {
      return (weight || 400) + ' ' + size + 'px ' + (serif
        ? '"Songti SC","STSong","SimSun","Noto Serif CJK SC",serif'
        : '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif');
    }

    // 先量高度
    var measure = function (text, font, maxW, lh) {
      ctx.font = font;
      var lines = wrapText(ctx, text, maxW);
      return lines.length * lh;
    };

    var innerW = W - PAD * 2;
    var h = 0;
    h += 118;                       // 头部
    h += 40;                        // 编号区
    h += 92;                        // 类型名
    h += 46;                        // 信息素
    if (res.identity !== 'Alpha' && res.identity !== 'Omega') h += 32;
    h += 46;                        // 标签
    h += 26;
    h += 300;                       // 雷达
    h += 5 * 46;                    // 五条
    h += 40;
    h += 46;                        // 人格分析标题
    res.analysis.forEach(function (t) { h += measure(t, F(19), innerW, 36) + 18; });
    ['关系模式', '危险提示', '适配对象'].forEach(function (label, i) {
      h += 40;
      h += 46;
      h += measure([res.relationship, res.danger, res.partner][i], F(19), innerW, 36) + 10;
    });
    h += 40;
    h += measure('「' + res.quote + '」', F(22, 700, true), innerW - 40, 42) + 64;
    h += 90;                        // 页脚

    cv.width = W;
    cv.height = Math.ceil(h);
    ctx = cv.getContext('2d');

    // 背景
    var bg = ctx.createLinearGradient(0, 0, 0, cv.height);
    bg.addColorStop(0, '#0C0A11');
    bg.addColorStop(.55, '#15111E');
    bg.addColorStop(1, '#0C0A11');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, cv.height);

    // 顶部光
    var glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * .9);
    glow.addColorStop(0, hexA(acc, .20));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 420);

    var y = 0;

    // 头部
    ctx.fillStyle = hexA(acc, .9);
    ctx.fillRect(PAD, 62, 40, 2);
    ctx.font = F(15, 400, true);
    ctx.fillStyle = 'rgba(201,169,106,.9)';
    ctx.fillText('信息素档案 · 第二性别鉴定', PAD, 96);
    ctx.font = F(15);
    ctx.fillStyle = 'rgba(185,178,198,.6)';
    ctx.textAlign = 'right';
    ctx.fillText('ABO-' + res.code, W - PAD, 96);
    ctx.textAlign = 'left';
    y = 128;

    // 类型
    ctx.font = F(17);
    ctx.fillStyle = hexA(acc, .85);
    ctx.fillText(res.identity, PAD, y + 20);
    ctx.textAlign = 'right';
    ctx.font = F(15);
    ctx.fillStyle = 'rgba(185,178,198,.65)';
    ctx.fillText('人群占比', W - PAD, y + 12);
    ctx.font = F(30, 700, true);
    ctx.fillStyle = acc;
    ctx.fillText(res.population + '%', W - PAD, y + 48);
    ctx.textAlign = 'left';
    y += 66;

    ctx.font = F(46, 700, true);
    ctx.fillStyle = acc;
    ctx.fillText(res.name, PAD, y + 34);
    y += 92;

    // 信息素
    ctx.font = F(19);
    ctx.fillStyle = 'rgba(185,178,198,.7)';
    var isAO = (res.identity === 'Alpha' || res.identity === 'Omega');
    if (isAO) {
      ctx.fillText('信息素味道', PAD, y);
      ctx.fillStyle = acc;
      ctx.fillText(res.pheromone, PAD + ctx.measureText('信息素味道').width + 16, y);
    } else {
      ctx.fillStyle = 'rgba(185,178,198,.7)';
      ctx.fillText('信息素状态', PAD, y);
      ctx.fillStyle = '#EDE9F2';
      ctx.fillText(res.status, PAD + ctx.measureText('信息素状态').width + 16, y);
      y += 32;
      var l2 = (res.identity === 'Enigma') ? '信息素味道' : '气质识别';
      var v2 = (res.identity === 'Enigma') ? res.pheromone : res.temperament;
      ctx.fillStyle = 'rgba(185,178,198,.7)';
      ctx.fillText(l2, PAD, y);
      ctx.fillStyle = acc;
      ctx.fillText(v2, PAD + ctx.measureText(l2).width + 16, y);
    }
    y += 46;

    // 标签
    ctx.font = F(16);
    var tx = PAD;
    res.keywords.forEach(function (k) {
      var w = ctx.measureText(k).width + 34;
      if (tx + w > W - PAD) { tx = PAD; y += 40; }
      roundRect(ctx, tx, y - 20, w, 34, 17);
      ctx.fillStyle = hexA(acc, .12);
      ctx.fill();
      ctx.strokeStyle = hexA(acc, .38);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = acc;
      ctx.fillText(k, tx + 17, y + 2);
      tx += w + 10;
    });
    y += 44;

    // 分隔
    line(ctx, PAD, y, W - PAD, y, 'rgba(201,169,106,.18)');
    y += 40;

    // 五维标题
    ctx.font = F(22, 700, true);
    ctx.fillStyle = '#EDE9F2';
    ctx.fillText('五维读数', PAD + 14, y);
    ctx.fillStyle = acc;
    ctx.fillRect(PAD, y - 15, 4, 20);
    y += 40;

    // 雷达
    drawRadar(ctx, W / 2, y + 118, 112, radar, acc);
    y += 258;

    // 五条
    D.DIMS.forEach(function (dim) {
      ctx.font = F(16);
      ctx.fillStyle = 'rgba(185,178,198,.8)';
      ctx.fillText(dim.label, PAD, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = acc;
      ctx.font = F(16, 700);
      ctx.fillText(String(radar[dim.key]), W - PAD, y);
      ctx.textAlign = 'left';
      var bw = innerW, bh = 5;
      roundRect(ctx, PAD, y + 10, bw, bh, 3);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fill();
      roundRect(ctx, PAD, y + 10, Math.max(6, bw * radar[dim.key] / 100), bh, 3);
      ctx.fillStyle = acc;
      ctx.fill();
      y += 46;
    });

    y += 10;

    // 人格分析
    y = section(ctx, PAD, y, innerW, '人格分析', acc);
    res.analysis.forEach(function (t) {
      y = para(ctx, t, PAD, y, innerW, acc);
      y += 18;
    });

    [['关系模式', res.relationship], ['危险提示', res.danger], ['适配对象', res.partner]].forEach(function (pair) {
      y += 20;
      y = section(ctx, PAD, y, innerW, pair[0], acc);
      y = para(ctx, pair[1], PAD, y, innerW, acc);
    });

    // 批注
    y += 34;
    line(ctx, PAD, y, W - PAD, y, hexA(acc, .3));
    y += 40;
    ctx.font = F(23, 700, true);
    ctx.fillStyle = acc;
    ctx.textAlign = 'center';
    wrapText(ctx, '「' + res.quote + '」', innerW - 20).forEach(function (ln) {
      ctx.fillText(ln, W / 2, y);
      y += 40;
    });
    ctx.textAlign = 'left';

    // 页脚
    y += 26;
    ctx.font = F(14);
    ctx.fillStyle = 'rgba(139,131,153,.7)';
    ctx.textAlign = 'center';
    ctx.fillText('幻想系人格设定 · 仅供娱乐 · 不代表现实性别或医学判断', W / 2, y);
    y += 28;
    ctx.fillStyle = hexA(acc, .8);
    ctx.fillText('信息素档案 · ABO 第二性别鉴定', W / 2, y);
    ctx.textAlign = 'left';

    return cv.toDataURL('image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function line(ctx, x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + .5);
    ctx.lineTo(x2, y2 + .5);
    ctx.stroke();
  }

  function section(ctx, x, y, w, title, acc) {
    ctx.fillStyle = acc;
    ctx.fillRect(x, y - 15, 4, 20);
    ctx.font = '700 22px "Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';
    ctx.fillStyle = '#EDE9F2';
    ctx.fillText(title, x + 14, y);
    return y + 38;
  }

  function para(ctx, text, x, y, w, acc) {
    ctx.font = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif 19px';
    ctx.font = '19px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(200,194,212,.92)';
    wrapText(ctx, text, w).forEach(function (ln) {
      ctx.fillText(ln, x, y);
      y += 36;
    });
    return y;
  }

  function wrapText(ctx, text, maxW) {
    var out = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { out.push(cur); cur = ''; continue; }
      if (ctx.measureText(cur + ch).width > maxW && cur.length) {
        out.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function drawRadar(ctx, cx, cy, R, vals, acc) {
    var keys = ['d', 'v', 'b', 'a', 'c'];
    function pt(i, r) {
      var ang = (-90 + i * 72) * Math.PI / 180;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    }
    for (var g = 1; g <= 4; g++) {
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var p = pt(i, R * g / 4);
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = g === 4 ? 'rgba(201,169,106,.30)' : 'rgba(201,169,106,.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (var j = 0; j < 5; j++) {
      var e = pt(j, R);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(e[0], e[1]);
      ctx.strokeStyle = 'rgba(201,169,106,.14)';
      ctx.stroke();
    }
    ctx.beginPath();
    for (var k = 0; k < 5; k++) {
      var v = Math.max(8, Math.min(100, vals[keys[k]])) / 100;
      var q = pt(k, R * v);
      k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.closePath();
    ctx.fillStyle = hexA(acc, .20);
    ctx.fill();
    ctx.strokeStyle = acc;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (var m = 0; m < 5; m++) {
      var vv = Math.max(8, Math.min(100, vals[keys[m]])) / 100;
      var cp = pt(m, R * vv);
      ctx.beginPath();
      ctx.arc(cp[0], cp[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = acc;
      ctx.fill();
    }
    var labels = ['支配', '波动', '边界', '吸引', '隐藏'];
    ctx.font = '15px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(185,178,198,.85)';
    ctx.textAlign = 'center';
    for (var n = 0; n < 5; n++) {
      var lp = pt(n, R + 30);
      ctx.fillText(labels[n], lp[0], lp[1] + 5);
    }
    ctx.textAlign = 'left';
  }

  /* ---------- 长图预览 ---------- */
  function showSheet(url) {
    var mask = $('#sheet-mask');
    $('#sheet-img').src = url;
    mask.classList.add('on');
    var dl = $('#sheet-dl');
    dl.href = url;
    dl.download = 'ABO档案.png';
  }

  /* ---------- 事件 ---------- */
  function bindGlobal() {
    $('#btn-start').addEventListener('click', function () {
      state.answers = new Array(D.QUESTIONS.length).fill(null);
      state.idx = 0;
      show('intro');
    });
    $('#btn-intro-go').addEventListener('click', function () {
      state.idx = 0;
      show('quiz');
      renderQuiz();
    });
    $('#btn-sample').addEventListener('click', function () {
      state.sample = true;
      state.jitter = makeJitter();
      state.result = { code: 'O2', raw: {}, hits: {}, norm: {}, order: [] };
      renderResult();
      show('result');
    });
    $('#q-back').addEventListener('click', function () {
      if (state.idx > 0) { state.idx--; renderQuiz(); }
    });
    $('#sheet-mask').addEventListener('click', function (e) {
      if (e.target.id === 'sheet-mask' || e.target.classList.contains('close')) {
        $('#sheet-mask').classList.remove('on');
      }
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    renderHome();
    bindGlobal();
    show('home');
    /* 内部用：?type=O2 直接渲染指定档案（做笔记配图用） */
    var q = new URLSearchParams(location.search).get('type');
    if (q && D.RESULTS[q]) {
      state.sample = true;
      state.jitter = makeJitter();
      state.result = { code: q, raw: {}, hits: {}, norm: {}, order: [] };
      renderResult();
      show('result');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
