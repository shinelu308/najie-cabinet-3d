/* ══════════════════════════════════════════════════════════════════════
   美术级增强层 —— 程序化"堆料" + 镜面地板
   ──────────────────────────────────────────────────────────────────────
   目标：客户 demo，追美术效果，不追工程准确性。
   策略：真实感的短板是【几何信息密度】，所以直接把柜内堆满 ——
         二次端子排 / 继电器阵列 / 指示灯 / 走线束 / 支柱绝缘子 / 柜内灯管，
         全部程序化生成（尺寸近似即可，型号不必准确）。
         再加镜面地板（Reflector）提供倒影，这是产品渲染"高级感"的经典手法。

   ⚠️ 坐标依据：P = { W:0.80, D:1.00, H:2.20 }，柜体中心在 x/z 原点、y 从 0 到 2.20。
      器件一律放在【柜内前部】(z ≈ +0.36)，因为相机在 (0.60,0.27,0.74) 方向、
      前门是打开状态 —— 放后侧等于白做（相机看不到）。
   ══════════════════════════════════════════════════════════════════════ */
const D = window.__DBG;
if (!D) { console.warn('[art] 缺少 __DBG'); }
else {
  const T = D.THREE, S = D.scene;

  /* ── 材质 ── */
  const M = {
    rail:   new T.MeshStandardMaterial({ color: 0xA8B2BE, metalness: 0.80, roughness: 0.30 }),
    termA:  new T.MeshStandardMaterial({ color: 0xD2CCBE, metalness: 0.12, roughness: 0.62 }),
    termB:  new T.MeshStandardMaterial({ color: 0x9BA3AC, metalness: 0.52, roughness: 0.40 }),
    dark:   new T.MeshStandardMaterial({ color: 0x2C333C, metalness: 0.35, roughness: 0.52 }),
    label:  new T.MeshStandardMaterial({ color: 0xE6E2D6, metalness: 0.08, roughness: 0.66 }),
    epoxy:  new T.MeshStandardMaterial({ color: 0x8A4A3C, metalness: 0.14, roughness: 0.66 }),
    ledR:   new T.MeshStandardMaterial({ color: 0xFF3B30, emissive: 0xFF3B30, emissiveIntensity: 1.8 }),
    ledG:   new T.MeshStandardMaterial({ color: 0x30D158, emissive: 0x30D158, emissiveIntensity: 1.8 }),
    ledY:   new T.MeshStandardMaterial({ color: 0xFFCC00, emissive: 0xFFCC00, emissiveIntensity: 1.5 }),
    lamp:   new T.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xEAF2FF, emissiveIntensity: 2.2 }),
    wire: [
      new T.MeshStandardMaterial({ color: 0x181D24, metalness: 0.05, roughness: 0.86 }),
      new T.MeshStandardMaterial({ color: 0x1B4F9C, metalness: 0.05, roughness: 0.86 }),
      new T.MeshStandardMaterial({ color: 0xA83226, metalness: 0.05, roughness: 0.86 }),
      new T.MeshStandardMaterial({ color: 0xC8A31E, metalness: 0.05, roughness: 0.86 })
    ]
  };

  const G = new T.Group();
  G.name = '__artDetail';
  S.add(G);

  const put = (geo, m, x, y, z, rx, ry, rz) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.set(rx || 0, ry || 0, rz || 0);
    G.add(o);
    return o;
  };
  let n = 0;

  /* ── 1. 二次端子排：3 层 DIN 导轨 × 14 个端子模块（信息密度主力）── */
  for (let row = 0; row < 3; row++) {
    const y = 0.660 + row * 0.086;
    put(new T.BoxGeometry(0.62, 0.008, 0.030), M.rail, 0, y, 0.360); n++;
    for (let i = 0; i < 14; i++) {
      const x = -0.270 + i * 0.0415;
      put(new T.BoxGeometry(0.030, 0.062, 0.026), (i % 3 === 0) ? M.termB : M.termA, x, y + 0.004, 0.360); n++;
      put(new T.BoxGeometry(0.022, 0.005, 0.004), M.dark, x, y + 0.030, 0.3745); n++;   // 接线标识
    }
  }

  /* ── 2. 继电器阵列（4×2）+ 每只一颗运行指示灯 ── */
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const x = -0.278 + i * 0.073, y = 1.140 + j * 0.101;
      put(new T.BoxGeometry(0.058, 0.082, 0.046), M.dark, x, y, 0.360); n++;
      put(new T.BoxGeometry(0.048, 0.028, 0.004), M.label, x, y + 0.014, 0.384); n++;
      put(new T.CylinderGeometry(0.0055, 0.0055, 0.007, 8), M.ledG, x + 0.017, y + 0.036, 0.384, Math.PI / 2, 0, 0); n++;
    }
  }

  /* ── 3. 仪表室面板：3 只圆形仪表 + 指示灯 + 按钮 ── */
  put(new T.BoxGeometry(0.44, 0.20, 0.018), M.label, 0, 1.470, 0.400); n++;
  for (let i = 0; i < 3; i++) {
    const x = -0.135 + i * 0.135;
    put(new T.CylinderGeometry(0.040, 0.040, 0.014, 20), M.dark, x, 1.492, 0.410, Math.PI / 2, 0, 0); n++;
    put(new T.CylinderGeometry(0.033, 0.033, 0.004, 20), M.label, x, 1.492, 0.4185, Math.PI / 2, 0, 0); n++;
    put(new T.BoxGeometry(0.0025, 0.026, 0.002), M.ledR, x, 1.494, 0.4205, 0, 0, 0.5); n++;   // 指针
  }
  [-0.185, -0.155, 0.155, 0.185].forEach((x, k) => {
    put(new T.CylinderGeometry(0.010, 0.010, 0.010, 10),
        (k === 0 || k === 3) ? M.ledR : M.ledG, x, 1.436, 0.410, Math.PI / 2, 0, 0); n++;
  });

  /* ── 4. 支柱绝缘子：托住三层母排（A/B/C 相分别 x = +0.152 / 0 / -0.152）── */
  [0.152, 0, -0.152].forEach((x) => {
    [0.14, -0.16].forEach((z) => {
      put(new T.CylinderGeometry(0.021, 0.025, 0.078, 14), M.epoxy, x, 1.706, z); n++;
      put(new T.CylinderGeometry(0.040, 0.040, 0.009, 14), M.epoxy, x, 1.735, z); n++;
      put(new T.CylinderGeometry(0.040, 0.040, 0.009, 14), M.epoxy, x, 1.690, z); n++;
    });
  });

  /* ── 5. 走线束：从端子排 → 继电器 → 仪表室，沿左侧立柱上行 ── */
  const wireR = [0.0042, 0.0038, 0.0046, 0.0040];
  const runs = [
    [[-0.250, 0.70, 0.360], [-0.300, 0.95, 0.360], [-0.318, 1.20, 0.352], [-0.290, 1.44, 0.395]],
    [[-0.180, 0.66, 0.360], [-0.230, 0.92, 0.356], [-0.250, 1.22, 0.350], [-0.170, 1.44, 0.395]],
    [[0.230, 0.70, 0.360], [0.300, 0.98, 0.358], [0.316, 1.24, 0.350], [0.190, 1.44, 0.395]],
    [[0.150, 0.66, 0.360], [0.210, 0.90, 0.356], [0.240, 1.26, 0.348], [0.130, 1.45, 0.398]],
    [[-0.060, 0.86, 0.356], [-0.100, 1.05, 0.350], [-0.080, 1.30, 0.348], [-0.020, 1.46, 0.398]],
    [[0.060, 0.86, 0.356], [0.110, 1.06, 0.350], [0.090, 1.32, 0.346], [0.030, 1.47, 0.398]],
    [[-0.280, 0.40, 0.340], [-0.312, 0.58, 0.348], [-0.305, 0.74, 0.356], [-0.262, 0.86, 0.360]],
    [[0.268, 0.40, 0.340], [0.312, 0.60, 0.348], [0.305, 0.76, 0.356], [0.258, 0.88, 0.360]]
  ];
  runs.forEach((pts, i) => {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2])));
    put(new T.TubeGeometry(curve, 26, wireR[i % 4], 6, false), M.wire[i % 4], 0, 0, 0); n++;
  });

  /* ── 6b. 底部电缆束 + 顶部分支母排：补画面的"密实感" ── */
  // 进线电缆束（柜底 6 根，配电缆夹）
  [-0.150, -0.090, -0.030, 0.030, 0.090, 0.150].forEach((x, i) => {
    put(new T.CylinderGeometry(0.022, 0.022, 0.42, 12), M.wire[i % 2], x, 0.360, 0.300); n++;
    put(new T.BoxGeometry(0.062, 0.016, 0.062), M.dark, x, 0.180, 0.300); n++;   // 电缆夹
  });
  put(new T.BoxGeometry(0.42, 0.010, 0.090), M.rail, 0, 0.400, 0.300); n++;

  // 顶部出线分支母排（3 相 × 2 组，与主母排同高，往两侧分出）
  [0.152, 0, -0.152].forEach((x, k) => {
    const c = [0xE0B400, 0x1E9C46, 0xD13B2C][k];
    const mm = new T.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.32 });
    [0.30, -0.30].forEach((z) => {
      put(new T.BoxGeometry(0.034, 0.012, 0.20), mm, x, 1.881, z); n++;
      put(new T.BoxGeometry(0.034, 0.34, 0.012), mm, x, 1.700, z + (z > 0 ? 0.09 : -0.09)); n++;
    });
  });
  // 母排接头螺栓
  [0.152, 0, -0.152].forEach((x) => {
    [0.26, -0.26].forEach((z) => {
      put(new T.CylinderGeometry(0.007, 0.007, 0.020, 6), M.rail, x, 1.900, z); n++;
      put(new T.CylinderGeometry(0.010, 0.010, 0.004, 6), M.dark, x, 1.912, z); n++;
    });
  });

  /* ── 6. 柜内灯管（顶部两根，作为柜内照明光源的"视觉依据"）── */
  [-0.19, 0.19].forEach((x) => {
    put(new T.BoxGeometry(0.44, 0.014, 0.046), M.lamp, x, 2.062, 0.02); n++;
  });
  // 真实点光源：让新堆的器件有明暗，而不是靠环境光"平着亮"
  const lampL = new T.PointLight(0xE8F2FF, 1.10, 3.6, 1.7); lampL.position.set(-0.19, 2.02, 0.02); S.add(lampL);
  const lampR = new T.PointLight(0xE8F2FF, 1.10, 3.6, 1.7); lampR.position.set(0.19, 2.02, 0.02); S.add(lampR);
  const lampM = new T.PointLight(0xCFE4FF, 0.60, 2.8, 1.8); lampM.position.set(0, 1.05, 0.30); S.add(lampM);

  /* ── 7. 镜面地板（Reflector）：产品渲染"高级感"的经典手法 ──
     ⚠️ Reflector 会再渲染一遍场景 → swiftshader 下很慢，
        所以分辨率取屏宽的一半，够用且省一半时间。 */
  const { Reflector } = await import('three/addons/objects/Reflector.js');
  const mirror = new Reflector(new T.PlaneGeometry(16, 16), {
    clipBias: 0.004,
    textureWidth: Math.floor(innerWidth * 0.5),
    textureHeight: Math.floor(innerHeight * 0.5),
    color: 0x0B2036
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = 0.001;
  S.add(mirror);
  /* 压暗层：Reflector 的 color 是"乘法"，压不住柜体亮部形成的倒影，
     第一版整个地板像一片亮蓝水面、比柜体还抢眼。再盖一层半透明深色平面整体调暗。 */
  const dim = new T.Mesh(new T.PlaneGeometry(16, 16),
    new T.MeshBasicMaterial({ color: 0x06182E, transparent: true, opacity: 0.52, depthWrite: false }));
  dim.rotation.x = -Math.PI / 2;
  dim.position.y = 0.003;
  S.add(dim);
  // 原 ShadowMaterial 地面上移一点，叠在镜面上形成"接触暗部"
  S.traverse((o) => {
    if (o.material && o.material.isShadowMaterial) {
      o.position.y = 0.006;
      o.material.opacity = 0.46;
    }
  });

  window.__ART = { meshes: n, mirror: true };
  console.log('[art] 美术级堆料完成：新增 ' + n + ' 个器件网格 + 镜面地板');
}
