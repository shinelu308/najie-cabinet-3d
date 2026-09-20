/* ══════════════════════════════════════════════════════════════
   数字孪生 · 三维电流流光 + 工况仿真（试装版）
   路径点全部取自 index.html 中 buildComponents() 的真实几何公式
   ══════════════════════════════════════════════════════════════ */
(function () {
  const D = window.__DBG;
  if (!D) { console.warn('[twin] 未找到 __DBG 出口'); return; }
  const { THREE, scene } = D;
  const $ = (s) => document.querySelector(s);

  /* ────────── 1. 电气拓扑（真实坐标，见 nodes.js 推导）────────── */
  const BUS_Y  = { A: 1.9630, B: 1.8810, C: 1.7990 };   // 主母排三相标高
  const X_CABLE = { A: 0.1520, B: 0.0000, C: -0.1520 };  // 电缆 / CT 穿心
  const X_POLE  = { A: 0.1488, B: 0.0000, C: -0.1488 };  // 极柱 / 触臂
  const HEX     = { A: 0xC99A00, B: 0x17803D, C: 0xC0392B };

  // 索引含义：0 电缆终端 → 4 电缆末端 → 5~7 下引线与极柱
  //           8 上触臂/静触头盒 → 9~10 引线上升 → 11 接入母排 → 12 出线
  function pathPoints(n) {
    const xc = X_CABLE[n], xp = X_POLE[n], by = BUS_Y[n];
    return [
      new THREE.Vector3(xc, 0.1150, -0.1000),   // 0 电缆热缩头
      new THREE.Vector3(xc, 0.4000, -0.1700),   // 1
      new THREE.Vector3(xc, 0.6270, -0.1900),   // 2 CT 穿心
      new THREE.Vector3(xc, 0.8000, -0.1200),   // 3
      new THREE.Vector3(xc, 0.9470,  0.0300),   // 4 电缆末端（原模型接口）
      new THREE.Vector3(xp, 1.0300,  0.0700),   // 5 下引线【孪生新增】
      new THREE.Vector3(xp, 1.1700,  0.1600),   // 6
      new THREE.Vector3(xp, 1.3116,  0.1720),   // 7 极柱中心
      new THREE.Vector3(xp, 1.3116, -0.0830),   // 8 上触臂 → 静触头盒
      new THREE.Vector3(xp, 1.5200, -0.1500),   // 9 引线上升【孪生新增】
      new THREE.Vector3(xp, 1.7200, -0.2300),   // 10
      new THREE.Vector3(xp, by,     -0.2600),   // 11 接入主母排
      new THREE.Vector3(-0.2450, by, -0.2600)   // 12 沿主母排流向相邻柜（贯穿全长）
    ];
  }

  const CURVES = {};
  Object.keys(BUS_Y).forEach((n) => {
    CURVES[n] = new THREE.CatmullRomCurve3(pathPoints(n), false, 'catmullrom', 0.35);
  });

  // 把"路径节点索引"换算成曲线参数 t（最近点采样）。
  // 导览要"只让这一段亮"，靠手估 t 会串到隔壁段；按节点反查才落得准。
  const NODE_T = {};
  Object.keys(CURVES).forEach((n) => {
    const cur = CURVES[n], pts = pathPoints(n), arr = [];
    for (let i = 0; i < pts.length; i++) {
      let bt = 0, bd = Infinity;
      for (let k = 0; k <= 240; k++) {
        const t = k / 240;
        const d = cur.getPointAt(t).distanceToSquared(pts[i]);
        if (d < bd) { bd = d; bt = t; }
      }
      arr.push(bt);
    }
    NODE_T[n] = arr;
  });
  const tAt = (i) => (NODE_T.A[i] + NODE_T.B[i] + NODE_T.C[i]) / 3;

  /* ────────── 2. 新增引线导体（实物为穿墙套管 + 引线铜排）────────── */
  const copper = new THREE.MeshStandardMaterial({ color: 0xC98A46, metalness: 0.90, roughness: 0.26 });
  const twGroup = new THREE.Group();
  twGroup.name = 'twinCurrent';
  scene.add(twGroup);

  Object.keys(CURVES).forEach((n) => {
    const pts = pathPoints(n);
    // 下引线：电缆末端 → 断路器极柱
    const segA = new THREE.CatmullRomCurve3([pts[4], pts[5], pts[6], pts[7]], false, 'catmullrom', 0.4);
    const a = new THREE.Mesh(new THREE.TubeGeometry(segA, 22, 0.0115, 8, false), copper);
    a.castShadow = true; twGroup.add(a);
    // 上引线：静触头盒 → 主母排
    const segB = new THREE.CatmullRomCurve3([pts[8], pts[9], pts[10], pts[11]], false, 'catmullrom', 0.4);
    const b = new THREE.Mesh(new THREE.TubeGeometry(segB, 26, 0.0115, 8, false), copper);
    b.castShadow = true; twGroup.add(b);
  });

  /* ────────── 3. 沿路径流动的电流粒子 ────────── */
  const SPARKS = { N: 26 };                     // 每相粒子数
  const sparkGeo = new THREE.SphereGeometry(0.0205, 8, 6);
  const sparkMat = {};
  const inst = {};
  Object.keys(CURVES).forEach((n) => {
    sparkMat[n] = new THREE.MeshBasicMaterial({ color: HEX[n] });
    const m = new THREE.InstancedMesh(sparkGeo, sparkMat[n], SPARKS.N);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    inst[n] = m; twGroup.add(m);
  });

  /* ────────── 4. 原始材质发光 + 失电压暗（记录待还原）────────── */
  const matBackup = [];
  function armEmissive(mat, hex) {
    if (!mat || matBackup.some((r) => r.mat === mat)) return;
    // 同一几何可能被多相共用 → 只登记一次，取首个相色
    matBackup.push({ mat, hex: mat.emissive ? mat.emissive.getHex() : 0,
                     on: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 0,
                     color0: mat.color ? mat.color.getHex() : 0xffffff });
    if (mat.emissive) mat.emissive.setHex(hex);
    if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
    mat.needsUpdate = true;
  }
  // 按"颜色"从场景里抓真实在用的材质，避免依赖硬编码变量名
  {
    const seen = new Set();
    D.scene.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const c = o.material.color;
      if (!c) return;
      const key = c.getHex();
      if (seen.has(key)) return;
      seen.add(key);
      if (key === 0xE0B400) armEmissive(o.material, 0xC99A00);      // A 相套管
      else if (key === 0x1E9C46) armEmissive(o.material, 0x17803D); // B 相套管
      else if (key === 0xD13B2C) armEmissive(o.material, 0xC0392B); // C 相套管
      else if (key === 0xB87333) armEmissive(o.material, 0x8A5A22); // 铜排 / 触臂
    });
    armEmissive(copper, 0x8A5A22);
  }

  // 通电提亮 / 失电压暗 —— 孪生讲"有没有电流"，靠这个一眼看出来
  let liveOn = null;
  const _c = new THREE.Color();
  function applyLive(on) {
    if (liveOn === on) return;
    liveOn = on;
    matBackup.forEach((r) => {
      if (!r.mat.color) return;
      _c.setHex(r.color0);
      if (!on) _c.multiplyScalar(0.55);
      r.mat.color.copy(_c);
    });
    document.querySelectorAll('#tw .sl-wire.hot').forEach((el) => {
      el.setAttribute('stroke', on ? (el.dataset.hot || '#C98A46') : '#B8C0CC');
      el.style.filter = on ? 'drop-shadow(0 0 2px rgba(201,138,70,.55))' : 'none';
    });
  }

  /* ────────── 5. 工况仿真（确定性模型，不接真实数据）────────── */
  const SIM = {
    rated: 630, load: 0.75, closed: true, fault: 0, step: 0,
    U: 10.35, f: 50.01, amb: 26.4,
    tripAt: 0,
    tripDelay: 3000,   // 保护动作延时。真实速断 < 60 ms，这里放慢是为了让人看清"故障→跳闸"
    hold: false,       // true = 冻结保护动作，便于截"故障尚未切除"那一帧（headless 计时不可靠）
    tripped: false,    // 由保护动作跳闸（区别于手动分闸），徽章文案不同
    Urms: 10.35,
    I: { A: 468.2, B: 471.5, C: 465.7 }, T: { A: 49.2, B: 50.8, C: 48.5 },
    ph: 0, P: 0, pf: 0
  };
  const FAULT_NAME = { 0: '正常运行', 1: '过负荷', 2: '三相短路', 3: '单相接地' };

  let logSeq = 0;
  function pushLog(kind, cls, text) {
    const box = $('#twLog'); if (!box) return;
    const d = new Date();
    const t = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((v) => String(v).padStart(2, '0')).join(':');
    const el = document.createElement('div');
    el.innerHTML = '<time>' + t + '</time><i class="' + cls + '">' + kind + '</i>' + text;
    box.prepend(el);
    while (box.children.length > 14) box.lastChild.remove();
    logSeq++;
  }

  function computeLoad(dt) {
    let base = SIM.rated * SIM.load;
    if (SIM.fault === 1) base *= 1.35;          // 过负荷
    if (SIM.fault === 2) base *= 8.2;           // 三相短路
    if (!SIM.closed) base = 0;
    const t = SIM.ph;
    const j = (k) => 1 + k * 0.014 * Math.sin(t * 1.7 + k * 2.1) + k * 0.006 * Math.sin(t * 0.63);
    let a = base * j(0.8), b = base * j(1.0), c = base * j(0.9);
    if (SIM.fault === 3 && SIM.closed) { c *= 2.6; a *= 1.08; b *= 1.08; }  // 单相接地
    SIM.I.A = a; SIM.I.B = b; SIM.I.C = c;

    // 温升 ∝ I²，但受两个物理约束约束：
    // ① 短路是暂态（<1 s），母排热时间常数以分钟计，根本来不及升温 —— 故障电流不参与温升，
    //    否则会算出 1000 ℃ 这种物理上不可能的数（早在几百度就熔断/绝缘失效了）
    // ② 加一阶惯性（热时间常数 15 s），温度才有"跟随"的滞后感
    const ith = Math.min(base, SIM.rated * 1.25);
    const kt = Math.pow(ith / SIM.rated, 2) * 26;
    const tgt = { A: SIM.amb + kt * 0.94, B: SIM.amb + kt * 1.02, C: SIM.amb + kt * 0.90 };
    const kk = Math.min(1, dt / 15);
    SIM.T.A += (tgt.A - SIM.T.A) * kk;
    SIM.T.B += (tgt.B - SIM.T.B) * kk;
    SIM.T.C += (tgt.C - SIM.T.C) * kk;

    // 短路 → 母线残压崩溃；同时短路电流以感性无功为主，cosφ 极低。
    // 不体现这两点的话，"10.35 kV / 70 MW" 反而把工况讲反了。
    SIM.Urms = (SIM.fault === 2 && SIM.closed) ? SIM.U * 0.12 : SIM.U;
    SIM.pf = SIM.closed ? (SIM.fault === 2 ? 0.15 : 0.98 - (SIM.fault === 1 ? 0.03 : 0)) : 0;
    const avg = (a + b + c) / 3;
    const uu = SIM.closed ? SIM.Urms : 0;
    SIM.P = Math.sqrt(3) * uu * (avg / 1000) * SIM.pf;     // MW
  }

  /* ────────── 6. 面板刷新 ────────── */
  const trend = [];
  let lastTrend = 0, lastDom = 0;

  function fmt(v, d) { return v.toFixed(d === undefined ? 1 : d); }

  function paintTrend() {
    const W = 260, H = 56, N = trend.length;
    if (N < 2) return;
    // 固定量程（额定 ×1.3）：常态落在 58% 处，短路冲顶截断
    // —— 若按"当前最大值"自适应，平时曲线会贴顶、跳闸后又全压到 0 线，看不出工况
    const max = SIM.rated * 1.30;
    let dLine = '';
    trend.forEach((v, i) => {
      const x = (i / (N - 1)) * W;
      const y = H - Math.min(1, v / max) * (H - 6) - 3;
      dLine += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    const dArea = dLine + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    const ln = $('#twLine'), ar = $('#twArea');
    if (ln) ln.setAttribute('d', dLine);
    if (ar) ar.setAttribute('d', dArea);
  }

  function paintDom() {
    const I = SIM.I, T = SIM.T, avg = (I.A + I.B + I.C) / 3;
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('#twIA', fmt(I.A)); set('#twIB', fmt(I.B)); set('#twIC', fmt(I.C));
    ['A', 'B', 'C'].forEach((n) => {
      const bar = $('#twB' + n);
      if (bar) bar.style.width = Math.max(0, Math.min(100, (I[n] / SIM.rated) * 100)) + '%';
    });
    set('#twU', fmt(SIM.Urms, 2)); set('#twF', fmt(SIM.f, 2));
    set('#twP', fmt(SIM.P, 2)); set('#twPF', fmt(SIM.pf, 3));
    if ($('#twTA')) $('#twTA').textContent = fmt(T.A) + ' ℃';
    if ($('#twTB')) $('#twTB').textContent = fmt(T.B) + ' ℃';
    if ($('#twTC')) $('#twTC').textContent = fmt(T.C) + ' ℃';
    const leg = $('#twLegI');
    if (leg) leg.textContent = SIM.closed ? '带电：I ≈ ' + Math.round(avg) + ' A' : '停电：I = 0 A';
    const slI = $('#twSlI');
    if (slI) slI.textContent = SIM.closed ? Math.round(avg) + ' A' : '0 A';

    // 徽章
    const bd = $('#twBadge');
    if (bd) {
      let cls = '', txt = '', sub = '';
      if (SIM.closed && SIM.fault === 0) { txt = '运行中 · 合闸'; sub = '已储能'; }
      else if (SIM.closed && SIM.fault === 1) { cls = 'warn'; txt = '过负荷运行'; sub = '已储能'; }
      else if (SIM.closed && SIM.fault === 2) { cls = 'bad'; txt = '三相短路 · 保护出口'; sub = '速断出口'; }
      else if (SIM.closed && SIM.fault === 3) { cls = 'bad'; txt = '单相接地'; sub = '告警'; }
      else if (SIM.tripped) { cls = 'bad'; txt = '保护跳闸 · 故障已切除'; sub = '待复位'; }
      else { cls = 'warn'; txt = '分闸 · 热备用'; sub = '已储能'; }
      bd.className = 'tw-badge ' + cls;
      bd.innerHTML = '<i></i>' + txt + '<b>' + sub + '</b>';
    }
    set('#twPos', SIM.closed ? '合闸' : '分闸');
    set('#twSpr', '已储能');
    set('#twCar', '工作位');
    set('#twLock', SIM.closed ? '禁止摇动手车' : '允许操作');
  }

  /* ────────── 7. 导览步骤（范围按路径节点反查，不手估 t）────────── */
  const STEPS = {
    0: { t: [0, 1], title: '全路径通电',
         text: '三相电流沿「电缆 → CT → 断路器 → 主母排」持续流动。' },
    1: { t: [0, tAt(4)], title: '进线',
         text: '10 kV 电源经电缆 3×YJV22 引入柜内，先经电缆终端（热缩头 + 铜鼻压接）固定。' },
    2: { t: [tAt(2) - 0.035, tAt(4) + 0.015], title: '计量与保护',
         text: '电流互感器（CT 600/5A）穿心取流，二次侧送保护与计量回路 —— 一次与二次在此分界。' },
    3: { t: [tAt(4) + 0.005, tAt(9)], title: '开断',
         text: '电流经下静触头进入手车式真空断路器，由真空灭弧室完成合分闸；上静触头把电流送出断路器室。' },
    4: { t: [tAt(9) - 0.005, 1], title: '分配',
         text: '穿墙套管引线铜排把三相电流送上主母排，再沿母排分配到相邻开关柜。' }
  };

  function setStep(s) {
    SIM.step = s;
    const el = STEPS[s] || STEPS[0];
    const narr = $('#twNarr');
    if (narr) {
      if (s === 0) { narr.hidden = true; }
      else {
        narr.hidden = false;
        narr.querySelector('b').textContent = 'STEP ' + s;
        narr.querySelector('span').textContent = el.title + ' —— ' + el.text;
      }
    }
    document.querySelectorAll('#twSteps button').forEach((b) =>
      b.classList.toggle('on', +b.dataset.s === s));
    // 三维里同步聚焦该段
    focusStep(s);
  }

  /* ────────── 8. 聚焦框（标出当前步骤对应的部件）────────── */
  const focusBox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x1B4F9C, wireframe: true,
                                  transparent: true, opacity: 0.42 }));
  focusBox.visible = false;
  scene.add(focusBox);
  const focusPad = { 1: [0.46, 0.30, 0.40], 2: [0.30, 0.26, 0.34],
                     3: [0.62, 0.34, 0.56], 4: [0.62, 0.30, 0.30] };
  const focusCtr = () => ({ A: [0.152, 0.53, -0.16], B: [0, 0.53, -0.16], C: [-0.152, 0.53, -0.16] });
  function focusStep(s) {
    if (!s) { focusBox.visible = false; return; }
    const pad = focusPad[s] || [0.5, 0.3, 0.4];
    const c = focusCtr();
    const xs = [c.A[0], c.B[0], c.C[0]];
    const x0 = Math.min(...xs) - pad[0] / 2, x1 = Math.max(...xs) + pad[0] / 2;
    let y0, y1, z0, z1;
    if (s === 1) { y0 = 0.06; y1 = 0.72; z0 = -0.32; z1 = 0.14; }
    else if (s === 2) { y0 = 0.50; y1 = 0.78; z0 = -0.34; z1 = -0.02; }
    else if (s === 3) { y0 = 0.92; y1 = 1.42; z0 = -0.20; z1 = 0.40; }
    else { y0 = 1.42; y1 = 2.04; z0 = -0.38; z1 = -0.14; }
    focusBox.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    focusBox.scale.set(x1 - x0, y1 - y0, z1 - z0);
    focusBox.visible = true;
  }

  /* ────────── 9. 每帧推进 ────────── */
  const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), V3 = new THREE.Vector3();
  const SC = new THREE.Vector3();
  let started = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - started) / 1000);
    started = now;
    SIM.ph += dt;

    // 保护动作：三相短路后经 tripDelay 跳闸（hold 时冻结，供截图稳定取帧）
    if (SIM.fault === 2 && SIM.closed && !SIM.hold) {
      if (!SIM.tripAt) SIM.tripAt = now + SIM.tripDelay;
      else if (now >= SIM.tripAt) {
        SIM.closed = false; SIM.tripped = true; SIM.tripAt = 0;
        pushLog('跳闸', 'r', '速断保护动作，断路器跳闸，故障电流切除');
      }
    } else if (SIM.fault !== 2) { SIM.tripAt = 0; }

    computeLoad(dt);

    // 电流为零 → 粒子静止且收缩（"没电流就不流动"）
    const avg = Math.max(0, (SIM.I.A + SIM.I.B + SIM.I.C) / 3);
    const speed = Math.min(1, avg / SIM.rated) * 0.085;       // 每秒推进的弧长比例
    const on = avg > 1;
    const st = STEPS[SIM.step] || STEPS[0];
    const size = on ? Math.min(1.45, 0.62 + avg / SIM.rated * 0.75) : 0;

    Object.keys(CURVES).forEach((n) => {
      const mesh = inst[n], cur = CURVES[n];
      if (on) SIM['ph_' + n] = (SIM['ph_' + n] || n.charCodeAt(0) * 0.07) + speed * dt;
      const off = SIM['ph_' + n] || 0;
      for (let i = 0; i < SPARKS.N; i++) {
        let t = (off + i / SPARKS.N) % 1;
        const inStep = t >= st.t[0] && t <= st.t[1];
        const k = (on && inStep) ? size : 0;
        cur.getPointAt(t, V3);
        SC.set(k, k, k);
        M4.compose(V3, QT, SC);
        mesh.setMatrixAt(i, M4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = on;
    });

    // 导体：通电时按电流大小发光，失电时整体压暗
    const glow = on ? Math.min(0.85, 0.18 + (avg / SIM.rated) * 0.55) : 0;
    matBackup.forEach((r) => {
      if (r.mat.emissiveIntensity !== undefined) r.mat.emissiveIntensity = glow;
    });
    applyLive(on);

    // 面板（限流到 ~12 Hz，省 DOM 开销）
    if (now - lastDom > 80) { lastDom = now; paintDom(); }
    if (now - lastTrend > 500) {
      lastTrend = now;
      trend.push(avg);
      while (trend.length > 60) trend.shift();
      if (trend.length > 1) paintTrend();
    }
    requestAnimationFrame(tick);
  }

  /* ────────── 10. 交互接线 ────────── */
  function bind() {
    const on = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
    on('#twClose', 'click', () => {
      if (SIM.closed) return;
      SIM.closed = true; SIM.fault = 0; SIM.tripped = false; SIM.tripAt = 0;
      const f = $('#twFault'); if (f) f.value = '0';
      pushLog('合闸', 'g', '断路器合闸成功，进入运行');
      setStep(0);
    });
    on('#twOpen', 'click', () => {
      if (!SIM.closed) return;
      SIM.closed = false; SIM.tripAt = 0; SIM.tripped = false;
      pushLog('分闸', 'y', '手动分闸，断路器进入热备用');
    });
    on('#twReset', 'click', () => {
      SIM.fault = 0; SIM.closed = true; SIM.tripped = false; SIM.tripAt = 0;
      const f = $('#twFault'); if (f) f.value = '0';
      const l = $('#twLoad'); if (l) { l.value = '75'; SIM.load = 0.75; }
      const lv = $('#twLoadV'); if (lv) lv.textContent = '75%';
      pushLog('复位', 'g', '工况复位，恢复正常运行');
      setStep(0);
    });
    on('#twLoad', 'input', (e) => {
      SIM.load = +e.target.value / 100;
      const lv = $('#twLoadV'); if (lv) lv.textContent = e.target.value + '%';
    });
    on('#twFault', 'change', (e) => {
      const v = +e.target.value;
      SIM.fault = v;
      if (v === 2) {
        SIM.closed = true; SIM.tripAt = 0;
        pushLog('故障', 'r', '检测到三相短路，速断保护启动');
      } else if (v === 1) pushLog('告警', 'y', '电流超过额定值 1.35 倍，过负荷运行');
      else if (v === 3) pushLog('告警', 'r', 'C 相接地电流异常，接地保护告警');
      else pushLog('恢复', 'g', '工况恢复正常');
    });
    document.querySelectorAll('#twSteps button').forEach((b) =>
      b.addEventListener('click', () => setStep(+b.dataset.s)));
    document.querySelectorAll('.tw-modes button').forEach((b) =>
      b.addEventListener('click', () => {
        document.querySelectorAll('.tw-modes button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      }));
    // 单线图元件点击 → 聚焦对应步骤
    const map = { 'sl-cable': 1, 'sl-ct': 2, 'sl-vcb': 3, 'sl-bus': 4 };
    Object.keys(map).forEach((cls) => {
      document.querySelectorAll('.' + cls).forEach((el) =>
        el.addEventListener('click', () => setStep(map[cls])));
    });
  }

  /* ────────── 10.5 孪生取景：柜体幽灵化 + 清掉干扰标注 ────────── */
  function ghostShell() {
    // 板件半透明 —— 数字孪生的标准做法：看不见内部导体就讲不了电流
    const shells = ['top', 'bot', 'sideR', 'sideL', 'doorF', 'doorB', 'part', 'plate'];
    shells.forEach((k) => {
      const g = D.G[k];
      if (!g) return;
      g.traverse((o) => {
        if (!o.isMesh || !o.material || o.userData._twGhost) return;
        o.userData._twGhost = true;
        const m = o.material.clone();
        m.transparent = true;
        m.opacity = 0.13;
        m.depthWrite = false;
        o.material = m;
        o.castShadow = false;      // 半透明件投实心影会把柜内压暗，粒子就看不见了
        o.receiveShadow = false;
      });
    });
    // 尺寸标注 / 引注 / 安全净距盒：孪生模式下全是干扰，数据都在 HUD 里
    if (D.dimGroup) D.dimGroup.visible = false;
    if (D.leaderGroup) D.leaderGroup.visible = false;
    const lb = document.getElementById('labels');
    if (lb) lb.style.display = 'none';
    D.scene.traverse((o) => { if (o.isMesh && o.userData.noStat) o.visible = false; });
    // 品牌条换文案
    const h1 = document.querySelector('.brand h1');
    if (h1) h1.innerHTML = '高低压开关柜<span class="h1x"> · 数字孪生</span>';
    const bp = document.querySelector('.brand p');
    if (bp) bp.textContent = '上海纳杰电气 · KYN28A-12 中置式 · 实时工况与电流路径';
  }

  /* ────────── 11. 启动 ────────── */
  bind();
  ghostShell();
  // 让原面板沉下去，突出孪生 HUD（试装期用）
  const op = document.getElementById('panel');
  if (op) op.style.display = 'none';
  const of = document.querySelector('.foot');
  if (of) of.style.display = 'none';

  // 历史负荷：带起伏才像真实工况（恒定值画出来是一条直线）
  for (let i = 0; i < 40; i++) {
    const base = SIM.rated * SIM.load;
    trend.push(base * (1 + 0.035 * Math.sin(i * 0.55) + 0.018 * Math.sin(i * 1.9 + 1.1)));
  }
  paintTrend();
  paintDom();
  // 启动时的历史工况（按真实时钟生成，最早的在最下）
  pushLog('上电', 'g', '装置启动，工况采集就绪');
  pushLog('提示', 'y', '二次回路自检正常');
  pushLog('提示', 'y', '五防联锁校验通过');
  pushLog('手车', 'g', '由试验位摇入至工作位');
  pushLog('储能', 'g', '弹簧操动机构储能完成');
  pushLog('合闸', 'g', '断路器合闸成功，进入运行');
  requestAnimationFrame(tick);

  window.__TWIN = { SIM, CURVES, NODE_T, tAt, setStep, pushLog, paintDom,
                    applyLive, SPARKS, trendLength: () => trend.length };
  console.log('[twin] 电流流光已挂载：3 相 × ' + SPARKS.N + ' 粒子，路径节点 13，'
            + '导览分段 t = ' + [1, 2, 3, 4].map((i) => STEPS[i].t.map((v) => v.toFixed(3)).join('~')).join(' | '));
})();
