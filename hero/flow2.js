/* ══════════════════════════════════════════════════════════════════════════
   电流表现 v2 · 制图风三方案      window.__FLOW = 'A' | 'B' | 'C'
                                  window.__FLOW_MODE = 'accent'（默认）| 'phase'
   ---------------------------------------------------------------------------
   v1 为什么"难看"（实测结论，别再犯）：
     ① 元素太细 —— 整柜取景下 px/m 只有 ~350，按实物半径 10mm 做的锥体投出来才 7px；
     ② 没有描边 —— 白底 + 浅灰柜 + 同相色母排，元素整个"溶"进背景；
     ③ 只有跑动的颗粒，没有"路径"本身 —— 看不出电流走的是哪条路，像一根飘着的头发。
   v2 三条对策（隔离图实测过，有效）：
     ① 一律放大到 ≥18px（轮廓管半径 26mm）；
     ② 一律加「深墨色 BackSide 描边」—— 白底图里描边 >> 发光，能把元素从白板
        和相色母排上同时剥出来；
     ③ 先铺一条**常亮**的路径管，再让元素在上面跑 —— 路径永远可读，方向永远可读。
   ⚠️ 颜色策略：默认不用相色。
      柜内母排本来就是红/黄/绿，电流再重复一遍相色 = 撞色隐身（实测隔离图能看到、
      叠回柜体就找不到）。改用"电光青"这一个柜内不存在的专属色，一眼就跳出来。
      相色是母排自己的信息，不需要电流再喊一遍。要回相色：__FLOW_MODE = 'phase'。
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const D = window.__DBG, T = D && D.THREE, S = D && D.scene, TW = window.__TWIN;
  if (!D || !T || !TW) { console.warn('[flow2] 缺少 __DBG / __TWIN'); return; }

  // 允许反复注入做方案对比：先停掉上一轮的动画循环，再清场景
  if (window.__FLOW_STOP) { try { window.__FLOW_STOP(); } catch (e) { /* 忽略 */ } }

  const V = (window.__FLOW || 'A').toUpperCase();
  const MODE = (window.__FLOW_MODE || 'accent').toLowerCase();
  const CURVES = TW.CURVES, KEYS = Object.keys(CURVES);
  const CABS = [-0.60, +0.60];                 // 与 c4d-preview.js 的双柜 x 偏移一致
  const UP = new T.Vector3(0, 1, 0);
  const INK = 0x16222E;                        // 描边墨色
  const ACCENT = 0x00A2DC;                     // 电光青：柜内不存在这个色，天然跳出来
  const PALE = 0xCFF1FF;                       // 激活态的浅青（比纯白好，白底上纯白会消失）
  const PHASE = { A: 0xFFC61A, B: 0x1FC162, C: 0xFF5236 };
  const pick = (n) => (MODE === 'phase' ? PHASE[n] : ACCENT);

  ['__flow', 'twinCurrent2'].forEach((n) => { const o = S.getObjectByName(n); if (o) S.remove(o); });
  const G = new T.Group(); G.name = '__flow'; S.add(G);

  /* 引线铜排（twinCurrent 是 scene 直挂）跟着柜子走，否则电流跑到两台柜子中间 */
  const twg = S.getObjectByName('twinCurrent');
  if (twg) {
    twg.position.x = CABS[0];
    const t2 = twg.clone(true); t2.position.x = CABS[1]; t2.name = 'twinCurrent2'; S.add(t2);
  }

  const outlineMat = new T.MeshBasicMaterial({ color: INK, side: T.BackSide });

  /* ── 路径必须落在"内部元器件之前、玻璃门之后"那一段 ──────────────────────
     ⚠️ v2 第一版最大的坑：曲线本来就贴着元器件走，于是路径管在综合视图里被安装板 /
        断路器 / 程序化堆料整条吃掉 —— **隔离图和综合图看起来完全两回事**。
        这条经验对所有"往现成模型里插演示元素"的场景都成立。
     ⚠️ 也不能推到柜体最前面：离相机近 1m，同样的半径会放大 1.4~1.5 倍，
        3 根管直接把柜内设备全挡住。所以要"刚刚好越过去"。
     做法：量出内部元器件（root 下非柜壳件 + 程序化堆料）的 z 上限，再往前 12cm。 */
  const ZF = (window.__CP && window.__CP.env) ? window.__CP.env[4] : 0.5;
  const DZ = (window.__FLOW_DZ !== undefined) ? window.__FLOW_DZ : (function () {
    const SHELL = ['frame', 'top', 'bot', 'sideR', 'sideL', 'doorF', 'doorB', 'part', 'plate'];
    const shellSet = new Set();
    SHELL.forEach((k) => { if (D.G[k]) D.G[k].traverse((o) => shellSet.add(o)); });
    const inner = new T.Box3();
    if (D.root) D.root.traverse((o) => {
      if (o.isMesh && !shellSet.has(o)) inner.expandByObject(o);
    });
    const art = S.getObjectByName('__artDetail');
    if (art) inner.expandByObject(art);
    let cmax = -1e9;
    KEYS.forEach((n) => {
      for (let i = 0; i <= 24; i++) cmax = Math.max(cmax, CURVES[n].getPointAt(i / 24).z);
    });
    const zFront = inner.isEmpty() ? (ZF - 0.18) : inner.max.z + 0.12;
    return zFront - cmax;
  })();
  const PATH = {};
  KEYS.forEach((n) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const p = CURVES[n].getPointAt(i / 60);
      pts.push(new T.Vector3(p.x, p.y, p.z + DZ));
    }
    PATH[n] = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
  });

  /* ── 常亮路径管：深墨外筒（轮廓） + 彩色内芯（路径本身）───────────────
     ⚠️ 内芯必须常亮 —— 只有"跑动的元素"、没有常亮的路径线，读者不知道电流沿哪走。
     ⚠️ 尺寸踩过的坑：路径前移到柜体前部后，离相机近了 ~1m，同样的半径会**放大 1.4~1.5 倍**。
        第一版用 26mm 半径 → 综合图里单柜 3 根管吃掉 25% 柜宽，把设备全挡了。
        目标：一根管子 ≈ 10~13px（1920 宽画幅），是"线"而不是"管"。 */
  function conduit(c, cx, col) {
    const out = new T.Mesh(new T.TubeGeometry(c, 200, 0.0130, 8, false), outlineMat);
    const inn = new T.Mesh(new T.TubeGeometry(c, 200, 0.0072, 8, false),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.68, depthWrite: false }));
    out.position.x = cx; inn.position.x = cx;
    out.renderOrder = 0; inn.renderOrder = 1;
    G.add(out); G.add(inn);
  }
  function subCurve(c, u0, u1, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(c.getPointAt(u0 + (u1 - u0) * (i / n)));
    return new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
  }

  const dummy = new T.Object3D();
  let dead = false;
  let update = function () {};

  /* ─────────── A. 流向线：常亮路径管 + 深墨箭头沿线游走（方向最明确）──────── */
  if (V === 'A') {
    const N = 9;
    const coneIn = new T.ConeGeometry(0.0290, 0.0800, 12);   // 比路径管略大，箭头才压得住线
    const sets = [];
    KEYS.forEach((n) => CABS.forEach((cx) => {
      conduit(PATH[n], cx, pick(n));
      const m = new T.InstancedMesh(coneIn, new T.MeshBasicMaterial({ color: INK }), N);
      m.frustumCulled = false; m.renderOrder = 4;
      G.add(m);
      sets.push({ c: PATH[n], m, cx });
    }));
    update = (dt) => {
      sets.forEach((s) => {
        for (let i = 0; i < N; i++) {
          const t = (i / N + dt * 0.135) % 1;
          dummy.position.copy(s.c.getPointAt(t)); dummy.position.x += s.cx;
          dummy.quaternion.setFromUnitVectors(UP, s.c.getTangentAt(t).normalize());
          dummy.updateMatrix(); s.m.setMatrixAt(i, dummy.matrix);
        }
        s.m.instanceMatrix.needsUpdate = true;
      });
    };
  }

  /* ─────────── B. 流动光带：一条浅青亮带在常亮路径管里跑（动态感最强）──────── */
  if (V === 'B') {
    const pulses = [];
    KEYS.forEach((n) => {
      const h = PALE, r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;
      const cv2 = document.createElement('canvas'); cv2.width = 256; cv2.height = 8;  // ⚠️ 别用 h=1，mipmap 会退化
      const x = cv2.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 256, 0);
      gr.addColorStop(0.00, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      gr.addColorStop(0.38, 'rgba(' + r + ',' + g + ',' + b + ',0.30)');
      gr.addColorStop(0.80, 'rgba(' + r + ',' + g + ',' + b + ',0.95)');
      gr.addColorStop(1.00, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 8);

      CABS.forEach((cx) => {
        conduit(PATH[n], cx, pick(n));
        const t = new T.CanvasTexture(cv2);
        t.colorSpace = T.SRGBColorSpace;
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(1.20, 1);                            // 尾迹拉长，整柜取景下才读得出
        t.offset.x = cx > 0 ? 0.45 : 0;                   // 两台柜子错相，避免机械同步
        pulses.push(t);
        const band = new T.Mesh(new T.TubeGeometry(PATH[n], 240, 0.0158, 12, false),
          new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
        band.position.x = cx; band.renderOrder = 4;
        G.add(band);
      });
    });
    update = (dt) => { pulses.forEach((t) => { t.offset.x -= dt * 0.42; }); };
  }

  /* ─────────── C. 分段通电：回路切 5 段，亮段依次扫过（节拍感最强）────────── */
  if (V === 'C') {
    const NCUT = 5, segs = [];
    const colOn = new T.Color(PALE), colOff = new T.Color(ACCENT);
    KEYS.forEach((n) => CABS.forEach((cx) => {
      const col = pick(n);
      conduit(PATH[n], cx, col);
      const off = new T.Color(col);
      for (let k = 0; k < NCUT; k++) {
        const sub = subCurve(PATH[n], k / NCUT, (k + 1) / NCUT, 18);
        const mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0,
                                             depthWrite: false });
        const m = new T.Mesh(new T.TubeGeometry(sub, 22, 0.0082, 10, false), mat);
        m.position.x = cx; m.renderOrder = 4;
        G.add(m);
        segs.push({ mat, mid: (k + 0.5) / NCUT, on: colOn, off });
      }
    }));
    update = (dt) => {
      const t = (dt * 0.40) % 1;
      segs.forEach((s) => {
        const d = (((t - s.mid) % 1) + 1.5) % 1 - 0.5;      // 环形距离 ∈ [-0.5,0.5)
        const b = Math.max(0, 1 - Math.abs(d) * 7.0);
        s.mat.opacity = b;
        s.mat.color.copy(s.off).lerp(s.on, b);              // 亮段同时变浅青，不只是变亮
      });
    };
  }

  const t0 = performance.now();
  (function raf() {
    if (dead) return;
    update((performance.now() - t0) / 1000);
    requestAnimationFrame(raf);
  })();
  window.__FLOW_STOP = () => { dead = true; };

  window.__FLOW_API = { variant: V, mode: MODE, dz: +DZ.toFixed(3),
                        curves: KEYS.length, cabinets: CABS.length, v: 2 };
  console.log('[flow2] 电流表现 = ' + V + ' ｜ 取色 = ' + MODE + ' ｜ ' + KEYS.length + ' 相 × '
              + CABS.length + ' 柜 ｜ 常亮路径管 + 墨色描边 ｜ 前移 ' + DZ.toFixed(3) + 'm 避遮挡');
})();
