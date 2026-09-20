/* ══════════════════════════════════════════════════════════════════════════
   双柜 + 工程标注（浅色制图风）
   ① 双柜并排（高压进线柜 KYN28-12 + 低压出线柜 GGD）
   ② 蓝色尺寸标注 2200 / 800 / 1000（细线 + 双向箭头，对齐参照图）
   ③ 深灰引线标注（投影定位，不依赖 CSS2DRenderer）
   ④ 柜顶蓝色型号铭牌
   在 twin-art.js 之后注入（这样能把 __artDetail 堆料一并克隆给第二台柜），
   drawing.js 随后做浅色化 —— 壳体材质是共享引用，改一次两台都变。
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const D = window.__DBG, T = D && D.THREE;
  if (!D || !T) { console.warn('[c4d] 缺少 __DBG'); return; }
  const cv = document.getElementById('c');
  const BLUE = 0x1F5FBF, LINE = 0x8894A2;

  /* ── 0. 清掉不属于"成品帧"的东西 ─────────────────────────────────────
     ⚠️ 只设 display:none 不够：CSS2DRenderer 每帧会把 element.style.display 复位成 ''，
        必须同时把 CSS2DObject 从场景里摘掉，DOM 才不会又冒出来。 */
  document.querySelectorAll('.extag').forEach((el) => { el.style.display = 'none'; });
  const tags = [];
  D.scene.traverse((o) => { if (o.isCSS2DObject) tags.push(o); });
  tags.forEach((o) => { if (o.parent) o.parent.remove(o); });
  const tw = document.getElementById('tw');            // 网页交互层 HUD，不属于成品帧
  if (tw) tw.style.display = 'none';

  /* ── 1. 零件组命名（克隆之后要靠名字找得到）───────────────────────── */
  D.EXPLODE.forEach((e) => { if (!e.g.name) e.g.name = 'EX|' + e.name; });

  /* ── 2. 克隆出低压柜 ──────────────────────────────────────────────── */
  const HV = D.root;
  const LV = HV.clone(true);
  const junk = [];
  LV.traverse((o) => { if (o.isCSS2DObject) junk.push(o); });   // 否则引注翻倍成两套
  junk.forEach((o) => { if (o.parent) o.parent.remove(o); });
  D.scene.add(LV);

  const CABW = D.P.W, GAP = 0.40, DX = (CABW + GAP) / 2;        // 800 柜宽 + 400 展示间隙
  HV.position.set(-DX, 0, 0);
  LV.position.set(+DX, 0, 0);
  const ctg = LV.getObjectByName('EX|互感器 (CT)');              // GGD 是低压柜，无电流互感器
  if (ctg) ctg.visible = false;

  // 程序化堆料（__artDetail）是独立分组、不挂在 root 下，不会被上面那次克隆带上，
  // 所以这里单独平移一份给低压柜 —— 否则右侧柜子内部会明显比左边空。
  const art = D.scene.getObjectByName('__artDetail');
  if (art) {
    art.position.x = -DX;
    const a2 = art.clone(true); a2.position.x = +DX; D.scene.add(a2);
  }

  /* ── 3. 量柜体包络（只用外壳件，避免把粒子/地板算进去）─────────────── */
  HV.updateMatrixWorld(true); LV.updateMatrixWorld(true);
  const box = new T.Box3();
  ['top', 'bot', 'sideR', 'sideL', 'doorF', 'doorB', 'part', 'plate'].forEach((k) => {
    if (D.G[k]) box.expandByObject(D.G[k]);
  });
  const xL = box.min.x, yB = box.min.y, yT = box.max.y, zF = box.max.z;

  /* ── 4. 相机：长焦压缩透视，接近工程效果图的正交观感 ────────────────
     fov 36→26 同时把距离按 tan 比例放大 → 画幅不变、但柜子不再"向外倒"。
     ⚠️ 平视机位下地面被严重透视压缩：目标点压低，画框下方才腾得出标注带。 */
  D.controls.autoRotate = false;
  D.controls.enableDamping = false;
  const TARGET = new T.Vector3(0, 0.98, 0);
  const DIR = new T.Vector3(0.30, 0.15, 0.94).normalize();
  const DIST = 6.75;                                 // = 4.80 × tan18°/tan13°
  D.camera.fov = 26;
  D.camera.updateProjectionMatrix();
  D.controls.target.copy(TARGET);
  D.camera.position.copy(TARGET).addScaledVector(DIR, DIST);
  D.camera.lookAt(TARGET);
  D.camera.updateMatrixWorld(true);
  D.controls.update();

  /* ── 5. 三维尺寸线（蓝色细线 + 两端箭头，参照图的画法）─────────────── */
  const matDim = new T.LineBasicMaterial({ color: BLUE });
  const matArrow = new T.MeshBasicMaterial({ color: BLUE });
  const arrowGeo = new T.ConeGeometry(0.019, 0.055, 10);
  const dimG = new T.Group(); dimG.name = '__cpDim'; D.scene.add(dimG);
  const V = (a) => new T.Vector3(a[0], a[1], a[2]);
  const UP = new T.Vector3(0, 1, 0);
  function seg(a, b) {
    dimG.add(new T.Line(new T.BufferGeometry().setFromPoints([V(a), V(b)]), matDim));
  }
  function dim(a, b) {
    const A = V(a), B = V(b), d = B.clone().sub(A).normalize();
    dimG.add(new T.Line(new T.BufferGeometry().setFromPoints([A, B]), matDim));
    [[A, d.clone().negate()], [B, d.clone()]].forEach(([p, dir]) => {
      const m = new T.Mesh(arrowGeo, matArrow);
      m.position.copy(p).addScaledVector(dir, -0.0275);       // 锥尖落在端点上
      m.quaternion.setFromUnitVectors(UP, dir);
      dimG.add(m);
    });
  }
  const TK = 0.05;

  // 高度 2200：柜体左侧竖线（要比引线标签再往外让 0.36，否则数字会被引线压住）
  const dx = xL - 0.66;
  dim([dx, yB, 0], [dx, yT, 0]);
  seg([xL, yB, 0], [dx, yB, 0]); seg([xL, yT, 0], [dx, yT, 0]);
  // 宽度 800：柜前地面横线
  const dz = zF + 0.06;
  dim([xL, 0.02, dz], [xL + CABW, 0.02, dz]);
  seg([xL, 0.02, dz], [xL, 0.02, dz - TK]); seg([xL + CABW, 0.02, dz], [xL + CABW, 0.02, dz - TK]);
  // 深度 1000：高压柜左前地面纵线（沿 z 走，投影成斜线 —— 这才是"深度"该有的样子）
  const ex = xL - 0.02;
  dim([ex, 0.02, dz], [ex, 0.02, dz - D.P.D]);
  seg([ex, 0.02, dz], [ex - TK, 0.02, dz]); seg([ex, 0.02, dz - D.P.D], [ex - TK, 0.02, dz - D.P.D]);

  /* ── 6. 标注层（DOM + 手动投影）────────────────────────────────────── */
  const st = document.createElement('style');
  st.textContent = [
    '#cp{position:fixed;inset:0;pointer-events:none;z-index:70;',
    "font-family:'Microsoft YaHei',system-ui,-apple-system,sans-serif}",
    '.cp-dim{position:absolute;color:#1F5FBF;font-size:12.5px;font-weight:700;letter-spacing:.02em;',
    'white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff}',
    '.cp-call{position:absolute;display:flex;align-items:center;white-space:nowrap}',
    '.cp-call .ln{width:150px;height:1px;flex:none;background:#8894A2}',
    '.cp-call .dt{width:7px;height:7px;border-radius:50%;flex:none;background:#fff;',
    'border:1.5px solid #1F5FBF}',
    '.cp-call .tx{font-size:11.5px;color:#2A3138;padding:2px 8px;border-radius:3px;',
    'background:rgba(255,255,255,.94);border:1px solid #C9D2DA}',
    '.cp-call.R{transform:translate(-100%,-50%)}',
    '.cp-call.L{transform:translate(0,-50%)}',
    '.cp-tab{position:absolute;transform:translate(-50%,-50%);font-size:12px;font-weight:700;',
    'color:#fff;background:#1B4E9B;padding:4px 12px;border-radius:3px;white-space:nowrap;',
    'letter-spacing:.02em}'
  ].join('');
  document.head.appendChild(st);
  const cp = document.createElement('div'); cp.id = 'cp'; document.body.appendChild(cp);

  const cw = () => cv.clientWidth || innerWidth;
  const ch = () => cv.clientHeight || innerHeight;
  const proj = (x, y, z) => {
    const v = new T.Vector3(x, y, z).project(D.camera);
    return { x: (v.x * 0.5 + 0.5) * cw(), y: (-v.y * 0.5 + 0.5) * ch() };
  };

  /* 标注先登记成作业，相机定稿后统一 layout() 投影。
     ⚠️ 只投影不够：平视机位下地面标注会掉出画框、被页脚压住，所以再收一道安全区 ——
        量真实矩形，把越界量折回偏移。改机位 / 改分辨率都不用重新手调坐标。 */
  const JOBS = [];
  const put = (html, cls, w, off, tf) => {
    const d = document.createElement('div');
    d.className = cls; d.innerHTML = html; cp.appendChild(d);
    JOBS.push({ el: d, w, off: (off || [0, 0]).slice(), base: (off || [0, 0]).slice(), tf: tf || '' });
    return d;
  };
  function layout() {
    const footTop = window.__FOOT_TOP ||
      (document.querySelector('.dr-foot') || document.querySelector('.tw-foot') || { getBoundingClientRect: () => ({ top: ch() - 62 }) })
        .getBoundingClientRect().top;
    const SAFE = { l: 26, r: cw() - 26, t: 96, b: footTop - 8 };
    fitLeaders();                                                     // ⚠️ 必须先定引线长度，再算安全区
    JOBS.forEach((j) => { j.off[0] = j.base[0]; j.off[1] = j.base[1]; });   // ⚠️ 每次从基准重算，避免叠加
    for (let pass = 0; pass < 2; pass++) {
      JOBS.forEach((j) => {
        const p = proj(j.w[0], j.w[1], j.w[2]);
        j.el.style.left = (p.x + j.off[0]) + 'px';
        j.el.style.top = (p.y + j.off[1]) + 'px';
        if (j.tf) j.el.style.transform = j.tf;
      });
      JOBS.forEach((j) => {
        const r = j.el.getBoundingClientRect();
        let dx2 = 0, dy2 = 0;
        if (r.left < SAFE.l) dx2 = SAFE.l - r.left;
        else if (r.right > SAFE.r) dx2 = SAFE.r - r.right;
        if (r.top < SAFE.t) dy2 = SAFE.t - r.top;
        else if (r.bottom > SAFE.b) dy2 = SAFE.b - r.bottom;
        j.off[0] += dx2; j.off[1] += dy2;
      });
    }
    window.__SAFE_B = SAFE.b;
  }

  // 尺寸数字
  put('2200 mm', 'cp-dim', [dx, (yB + yT) / 2, 0], [-9, 0], 'translate(-100%,-50%)');
  put('800 mm', 'cp-dim', [xL + CABW / 2, 0.02, dz], [0, -15], 'translate(-50%,-100%)');
  put('1000 mm', 'cp-dim', [ex, 0.02, dz - D.P.D / 2], [-11, 0], 'translate(-100%,-50%)');

  // 部件引线：高压柜向左引、低压柜向右引（与参照图的左右分栏一致）
  // ⚠️ 偏移必须给 0：`.cp-call.R` 用 translate(-100%) 把整块挪到锚点左侧，
  //    靠 `.ln` 的宽度把标签推出去。若再给负偏移，圆点会脱离元器件挂到半米外。
  const HV_CALL = [
    ['仪表室板', -0.62, 2.00], ['二次控制室', -0.62, 1.72],
    ['手车式断路器', -0.62, 1.32], ['通风散热口', -0.62, 0.30]
  ];
  const LV_CALL = [
    ['母线系统', 0.62, 1.78], ['母线隔离开关', 0.62, 1.50],
    ['断路器', 0.62, 1.10], ['电缆进出线', 0.62, 0.52]
  ];
  const CALLS = [];
  HV_CALL.forEach(([t, x, y]) => {
    const w = [x, y, 0.18];
    CALLS.push({ el: put('<span class="tx">' + t + '</span><span class="ln"></span>'
                       + '<span class="dt"></span>', 'cp-call R', w), w, side: 'R' });
  });
  LV_CALL.forEach(([t, x, y]) => {
    const w = [x, y, 0.18];
    CALLS.push({ el: put('<span class="dt"></span><span class="ln"></span>'
                       + '<span class="tx">' + t + '</span>', 'cp-call L', w), w, side: 'L' });
  });

  /* 引线长度自适应 —— 标签必须整体落在柜体外侧。
     ⚠️ 写死 `.ln` 宽度不管用：机位、分辨率、锚点高度一变，标签就又压回柜体和柜顶铭牌上。
        这里按「锚点屏幕 x」与「柜体边缘屏幕 x」的差值反算引线该多长，永远贴着柜边外侧。
     ⚠️ 别再减去文字宽度：块结构是 [文字][引线][圆点]（R 型）或 [圆点][引线][文字]（L 型），
        靠 translate(-100%) 把整块钉在锚点上。要让"文字远离柜体"，约束的是**文字的外侧边**
        —— 多减一个 tw 等于把文字又推回柜体里（v2 第一版就是这么错的）。 */
  const CAB_R = DX + CABW / 2;                       // 低压柜右边缘世界 x
  function fitLeaders() {
    CALLS.forEach((c) => {
      const tx = c.el.querySelector('.tx'), ln = c.el.querySelector('.ln');
      if (!tx || !ln) return;
      const a = proj(c.w[0], c.w[1], c.w[2]);
      const pad = 14, DOT = 7;
      const edge = c.side === 'R' ? proj(xL, c.w[1], zF).x : proj(CAB_R, c.w[1], zF).x;
      // R 型：文字右边缘 = 锚点 − 引线宽，要求 ≤ 柜体左边缘 − pad
      // L 型：文字左边缘 = 锚点 + 圆点宽 + 引线宽，要求 ≥ 柜体右边缘 + pad
      const want = c.side === 'R' ? (a.x - (edge - pad)) : ((edge + pad) - a.x - DOT);
      ln.style.width = Math.max(20, Math.round(want)) + 'px';
    });
  }

  // 柜顶蓝色型号铭牌（参照图是蓝底白字贴在柜顶内侧）
  put('高压进线柜 KYN28-12', 'cp-tab', [-DX, yT - 0.16, zF], [0, 0]);
  put('低压出线柜 GGD', 'cp-tab', [+DX, yT - 0.16, zF], [0, 0]);

  layout();
  window.addEventListener('resize', layout);

  window.__CP = {
    hv: HV, lv: LV, box, dist: DIST, layout, fitLeaders,
    dimParts: dimG.children.length, calls: HV_CALL.length + LV_CALL.length,
    cam: [+D.camera.position.x.toFixed(3), +D.camera.position.y.toFixed(3), +D.camera.position.z.toFixed(3)],
    env: [+xL.toFixed(3), +box.max.x.toFixed(3), +yB.toFixed(3), +yT.toFixed(3), +zF.toFixed(3)]
  };
  console.log('[c4d] 双柜 + 尺寸标注 + 引线就位：尺寸件 ' + dimG.children.length +
              ' 个，引线 ' + (HV_CALL.length + LV_CALL.length) + ' 处');
})();
