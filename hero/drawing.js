/* ══════════════════════════════════════════════════════════════════════════
   浅色工程制图风 —— 对齐《高低压开关柜三维剖切工程效果图》
   白底 + 浅灰面板 + 细深色描边 + 蓝色尺寸标注 + 深灰引线 + 表格化参数卡
   在 c4d-preview.js 之后注入：壳体材质是两台柜子共享的引用，
   所以这里改一次就等于把双柜一起改掉。
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const D = window.__DBG, T = D && D.THREE, S = D && D.scene;
  if (!D || !T) { console.warn('[drawing] 缺少 __DBG'); return; }
  const BLUE = '#1B4E9B', DIM = '#1F5FBF', INK = '#2A3138';

  /* ── 1. 白底（竖向极淡渐变，避免大面积纯白死板）────────────────────── */
  (function () {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    // 参照图是"死白"底：几乎纯白，只在最下面留一丝冷灰托住柜脚
    g.addColorStop(0.00, '#FFFFFF');
    g.addColorStop(0.72, '#FCFDFE');
    g.addColorStop(1.00, '#EDF2F6');
    x.fillStyle = g; x.fillRect(0, 0, 8, 256);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    S.background = t;
  })();

  /* ── 2. 清掉不属于制图风的元素 ─────────────────────────────────────── */
  const kill = [];
  S.traverse((o) => {
    if (o.type === 'GridHelper') o.visible = false;
    // 镜面地板 + 压暗层：都是 16×16 的 Plane，一次抓干净
    if (o.isMesh && o.geometry && o.geometry.parameters &&
        o.geometry.parameters.width === 16 && o.geometry.parameters.height === 16) kill.push(o);
    if (o.material && o.material.isShadowMaterial) o.material.opacity = 0.07;   // 参照图几乎无地面阴影
    if (o.isPointLight) { o.color.setHex(0xFFFFFF); o.intensity *= 0.40; }   // 深色层的冷色柜内补光要压掉
  });
  kill.forEach((o) => { if (o.parent) o.parent.remove(o); });

  /* ── 3. 壳体：哑光白漆实板 + 只留前门玻璃（照参照图的"剖切"逻辑）──────
     ⚠️ v1 把整套壳板都调成 30% 透明 → 整柜发灰、像幽灵。参照图根本不是这么做的：
        顶/底/左/右/后板都是**实心白漆钢板**，只把「前门」做成玻璃（或干脆剖开），
        透明感来自"看进去的那一面"，不是来自"每块板都半透明"。
        这也是"能否 1:1 还原贴图"的答案中，最关键的材质语言差异。 */
  const shells = ['top', 'bot', 'sideR', 'sideL', 'doorF', 'doorB', 'part', 'plate'];
  const SOLID = { top: 1, bot: 1, sideR: 1, sideL: 1, doorB: 1, plate: 1 };  // 实板白漆
  const GLASS = { doorF: 1 };                                                // 前门玻璃
  const SEMI = { part: 1 };                                                  // 隔板半透
  const edgeMat = new T.LineBasicMaterial({ color: 0x33414D, transparent: true, opacity: 0.50 });
  let edged = 0, glass = 0, solid = 0;
  shells.forEach((k) => {
    const g = D.G[k]; if (!g) return;
    g.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const m = o.material;
      o.castShadow = false; o.receiveShadow = false;
      if (GLASS[k]) {
        m.transparent = true; m.opacity = 0.17; m.depthWrite = false;
        if (m.color) m.color.setHex(0xE4EDF4);
        if (m.roughness !== undefined) m.roughness = 0.06;
        if (m.metalness !== undefined) m.metalness = 0.0;
        glass++;
      } else if (SEMI[k]) {
        m.transparent = true; m.opacity = 0.42; m.depthWrite = false;
        if (m.color) m.color.setHex(0xEDF1F5);
        if (m.roughness !== undefined) m.roughness = 0.55;
        if (m.metalness !== undefined) m.metalness = 0.02;
        glass++;
      } else {
        m.transparent = false; m.opacity = 1; m.depthWrite = true;
        if (m.color) m.color.setHex(0xFAFCFD);        // 哑光白漆
        if (m.roughness !== undefined) m.roughness = 0.66;
        if (m.metalness !== undefined) m.metalness = 0.03;
        if (m.emissive) { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
        solid++;
      }
      m.needsUpdate = true;
      if (!o.userData._drEdge) {
        o.userData._drEdge = true;
        try {
          const el = new T.LineSegments(new T.EdgesGeometry(o.geometry, 32), edgeMat);
          el.raycast = function () {}; o.add(el); edged++;
        } catch (e) { /* 个别几何无棱边 */ }
      }
    });
  });

  /* ── 4. 关掉旧的"发光球"电流粒子（用户反馈难看，改由 flow.js 接管）─── */
  const twg = S.getObjectByName('twinCurrent');
  if (twg) twg.children.forEach((o) => { if (o.isInstancedMesh) o.visible = false; });

  /* ── 5. 灯光：制图风要"亮、平、弱阴影"──────────────────────────────── */
  S.traverse((o) => {
    if (o.isHemisphereLight) { o.intensity = 1.20; o.color.setHex(0xFFFFFF); o.groundColor.setHex(0xE4EAF0); }
    if (o.isDirectionalLight) o.intensity = Math.min(o.intensity, 1.10);
  });
  const f2 = new T.DirectionalLight(0xFFFFFF, 0.45); f2.position.set(-4.5, 3.2, 4.6); S.add(f2);
  const f3 = new T.DirectionalLight(0xFFFFFF, 0.28); f3.position.set(0.5, 2.2, -6.0); S.add(f3);
  // 自发光的件在浅底上会显脏，统一压到很低
  S.traverse((o) => {
    if (o.isMesh && o.material && !Array.isArray(o.material)) {
      const m = o.material;
      if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) m.emissiveIntensity = 0.16;
    }
  });

  /* ── 6. HUD：照参照图的版面重排（左=结构细节 / 右上=参数表 / 右中=剖切说明 / 底=图标）── */
  const st = document.createElement('style');
  st.textContent = [
    '#dr{position:fixed;inset:0;pointer-events:none;z-index:80;',
    "font-family:'Microsoft YaHei',system-ui,-apple-system,sans-serif;color:#2A3138}",
    '.dr-top{position:absolute;left:0;right:0;top:0;height:74px;background:#fff;',
    'border-bottom:1px solid #D8DEE4;display:flex;align-items:center;padding:0 22px;gap:14px}',
    '.dr-logo{width:44px;height:44px;border-radius:6px;background:' + BLUE + ';color:#fff;flex:none;',
    'display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;letter-spacing:.04em}',
    '.dr-nm{font-size:15px;font-weight:700;letter-spacing:.06em}',
    '.dr-en{font-size:9.5px;color:#7C8894;letter-spacing:.10em}',
    '.dr-ttl{position:absolute;left:50%;top:0;height:74px;transform:translateX(-50%);',
    'display:flex;flex-direction:column;justify-content:center;align-items:center}',
    '.dr-ttl h1{margin:0;font-size:21px;font-weight:700;letter-spacing:.04em;color:#16202B}',
    '.dr-ttl p{margin:3px 0 0;font-size:11px;color:#6E7B88;letter-spacing:.10em}',
    '.dr-sub{position:absolute;right:22px;font-size:10.5px;color:#8A96A2;letter-spacing:.08em}',
    '.dr-spec{position:absolute;right:20px;top:92px;width:296px;background:#fff;',
    'border:1px solid #C9D2DA;border-radius:4px;overflow:hidden}',
    '.dr-spec h2{margin:0;padding:7px 12px;font-size:13px;font-weight:700;color:#fff;background:' + BLUE + '}',
    '.dr-spec table{width:100%;border-collapse:collapse;font-size:11.5px}',
    '.dr-spec td{padding:5px 10px;border-top:1px solid #E4E9ED}',
    '.dr-spec td:first-child{color:#5C6874;background:#F7F9FB;width:88px;border-right:1px solid #E4E9ED}',
    '.dr-spec td:last-child{font-weight:600;color:#1E2833}',
    '.dr-note{position:absolute;right:20px;width:296px;background:#fff;border:1px solid #C9D2DA;',
    'border-radius:4px;overflow:hidden}',
    '.dr-note h2{margin:0;padding:7px 12px;font-size:13px;font-weight:700;color:#fff;background:' + BLUE + '}',
    '.dr-note ul{margin:0;padding:8px 12px 8px 26px;font-size:11.5px;line-height:1.72;color:#3A454F}',
    '.dr-note li{margin:0 0 2px}',
    '.dr-feat{position:absolute;left:20px;top:92px;width:236px;background:#fff;border:1px solid #C9D2DA;',
    'border-radius:4px;overflow:hidden}',
    '.dr-feat h2{margin:0;padding:7px 12px;font-size:13px;font-weight:700;color:#fff;background:' + BLUE + '}',
    '.dr-feat .it{display:flex;gap:8px;padding:7px 11px;border-top:1px solid #E4E9ED}',
    '.dr-feat .no{width:17px;height:17px;flex:none;border-radius:50%;background:#EAF0F7;color:' + BLUE + ';',
    'font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}',
    '.dr-feat .tt{font-size:11.5px;font-weight:700;color:#1E2833;margin-bottom:2px}',
    '.dr-feat .dd{font-size:10.5px;color:#6B7784;line-height:1.55}',
    '.dr-foot{position:absolute;left:0;right:0;bottom:0;height:52px;background:#fff;',
    'border-top:1px solid #D8DEE4;display:flex;align-items:center;padding:0 22px;gap:26px}',
    '.dr-fg{display:flex;align-items:center;gap:7px;font-size:11.5px;color:#3A454F;font-weight:600}',
    '.dr-fg .ic{width:22px;height:22px;border-radius:50%;border:1.5px solid ' + BLUE + ';flex:none;',
    'display:flex;align-items:center;justify-content:center;color:' + BLUE + ';font-size:11px;font-weight:700}',
    '.dr-slog{margin-left:auto;font-size:14px;font-weight:700;color:' + BLUE + ';letter-spacing:.02em}',
    '.dr-slog i{font-style:normal;font-size:11px;color:#8A96A2;font-weight:400;margin-left:6px}'
  ].join('');
  document.head.appendChild(st);

  const FOOT_ICONS = ['高可靠性', '智能化', '模块化', '定制定化'];
  const dr = document.createElement('div'); dr.id = 'dr';
  dr.innerHTML =
    '<div class="dr-top">'
    + '<div class="dr-logo">NJA</div>'
    + '<div><div class="dr-nm">上海纳杰电气</div><div class="dr-en">SHANGHAI NAJIE ELECTRIC</div></div>'
    + '<div class="dr-ttl"><h1>高低压开关柜三维剖切工程效果图</h1>'
    +   '<p>专业电气成套 · 智能配电 · 可靠未来</p></div>'
    + '<div class="dr-sub">三维数字模型 / 半透明剖切</div>'
    + '</div>'
    + '<aside class="dr-feat"><h2>关键结构细节</h2>'
    +   [['1', '母排系统', 'T2 紫铜 · 热缩绝缘处理 · 立体布置，安全可靠'],
        ['2', '断路器', '真空断路器 / ABB 等品牌 · 智能控制单元 · 具备保护、测量、通讯功能'],
        ['3', '电缆连接', '进出线电缆 · 铜排接头 · 线缆桥架固定'],
        ['4', '低压元器件', '断路器、接触器、继电器 · 端子排、控制模块 · 排布整齐，标识清晰'],
        ['5', '柜体结构', '冷轧钢板 · 静电喷塑 · 模块化设计，易于安装维护']]
        .map((r) => '<div class="it"><span class="no">' + r[0] + '</span><div>'
                  + '<div class="tt">' + r[1] + '</div><div class="dd">' + r[2] + '</div></div></div>').join('')
    + '</aside>'
    + '<aside class="dr-spec"><h2>产品参数</h2><table>'
    + [['产品型号', 'KYN28-12 / GGD'],
       ['额定电压', '10kV / 0.4kV'],
       ['额定电流', '630A ~ 3150A'],
       ['分断能力', '31.5kA ~ 50kA'],
       ['防护等级', 'IP3X / IP4X'],
       ['柜体尺寸（宽×深×高）', '800 × 1000 × 2200 mm'],
       ['母排材质', 'T2 紫铜'],
       ['柜体材质', '冷轧钢板（喷塑）'],
       ['执行标准', 'GB/T 3906、DL/T 404、IEC 61439']]
        .map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('')
    + '</table></aside>'
    + '<aside class="dr-note" style="top:436px"><h2>三维剖切说明</h2><ul>'
    +   '<li>采用三维建模技术，真实还原高低压开关柜内部结构</li>'
    +   '<li>通过半剖切 / 半透明方式展示母排、断路器、电缆、元器件布局</li>'
    +   '<li>标注关键尺寸与主要参数，便于工程设计、方案汇报及生产制造参考</li>'
    +   '<li>图中为典型方案示意，具体配置可根据项目需求定制</li>'
    + '</ul></aside>'
    + '<div class="dr-foot">'
    +   FOOT_ICONS.map((t) => '<div class="dr-fg"><span class="ic">' + t[0] + '</span>' + t + '</div>').join('')
    +   '<span class="dr-slog">纳杰电气 <i>×</i> 让电能更安全 · 更高效</span>'
    + '</div>';
  document.body.appendChild(dr);

  window.__FOOT_TOP = dr.querySelector('.dr-foot').getBoundingClientRect().top;
  window.__DRAWING = { edged, glass, solid, blue: BLUE };
  console.log('[drawing] 浅色制图风就位：实板 ' + solid + ' 件 / 玻璃半透 ' + glass
              + ' 件 / 描边 ' + edged + ' 件，旧电流粒子已关');
})();
