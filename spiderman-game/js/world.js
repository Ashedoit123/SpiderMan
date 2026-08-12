import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const GRAVITY = new THREE.Vector3(0, -16.5, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function windowTexture() {
  return canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 14) {
      for (let x = 6; x < w; x += 11) {
        if (Math.random() < 0.38) continue;
        const warm = Math.random() > 0.72;
        const a = 0.35 + Math.random() * 0.65;
        ctx.fillStyle = warm
          ? `rgba(255,196,110,${a})`
          : `rgba(150,198,255,${a})`;
        ctx.fillRect(x, y, 6, 8);
      }
    }
  });
}

function woodTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#6b4226";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(30,16,8,${0.08 + Math.random() * 0.15})`;
      ctx.lineWidth = 2 + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * h);
      ctx.bezierCurveTo(w * 0.3, Math.random() * h, w * 0.6, Math.random() * h, w, Math.random() * h);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(20,10,4,0.45)";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeRect(w / 2, 8, 1, h - 16);
  });
}

function webSplatTexture() {
  if (webSplatTexture._t) return webSplatTexture._t;
  webSplatTexture._t = canvasTex(256, 256, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.12;
      const r = 28 + Math.random() * 86;
      ctx.lineWidth = 1.2 + Math.random() * 1.6;
      ctx.globalAlpha = 0.55 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.2) * r * 0.45,
        Math.sin(a + 0.2) * r * 0.45,
        Math.cos(a) * r,
        Math.sin(a) * r
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let r = 36; r < 110; r += 22) {
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const rr = r + Math.sin(i * 1.7) * 6;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  return webSplatTexture._t;
}

function metalTexture(base = "#3a3f48") {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

const silkVert = `
varying vec2 vUv;
varying float vAlong;
void main() {
  vUv = uv;
  vAlong = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const silkFrag = `
uniform float uTime;
uniform float uTension;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uOpacity;
varying vec2 vUv;
varying float vAlong;
void main() {
  float core = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.6);
  float fiber = 0.55 + 0.45 * sin(vAlong * 90.0 + uTime * 8.0);
  fiber *= 0.7 + 0.3 * sin(vAlong * 220.0 - uTime * 14.0);
  float pulse = smoothstep(0.18, 0.0, abs(fract(vAlong * 0.55 - uTime * 1.35) - 0.5));
  vec3 col = mix(uColor, vec3(1.0), fiber * 0.35 + uTension * 0.35);
  col += uGlow * (pulse * (0.35 + uTension * 0.8) + core * 0.15);
  float alpha = (core * 0.85 + pulse * 0.25) * uOpacity;
  gl_FragColor = vec4(col, alpha);
}
`;

class ParticleField {
  constructor(scene, max = 500) {
    this.max = max;
    this.count = 0;
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(origin, n, opts = {}) {
    const color = opts.color || new THREE.Color(0xdef4ff);
    const speed = opts.speed ?? 3.5;
    const life = opts.life ?? 0.55;
    const size = opts.size ?? 0.09;
    const dir = opts.dir;
    for (let i = 0; i < n; i++) {
      const id = this.count % this.max;
      this.count++;
      this.pos[id * 3] = origin.x + rand(-0.04, 0.04);
      this.pos[id * 3 + 1] = origin.y + rand(-0.04, 0.04);
      this.pos[id * 3 + 2] = origin.z + rand(-0.04, 0.04);
      let vx, vy, vz;
      if (dir) {
        vx = dir.x + rand(-0.5, 0.5);
        vy = dir.y + rand(-0.5, 0.5);
        vz = dir.z + rand(-0.5, 0.5);
      } else {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(rand(-1, 1));
        vx = Math.sin(ph) * Math.cos(th);
        vy = Math.cos(ph);
        vz = Math.sin(ph) * Math.sin(th);
      }
      const s = speed * rand(0.4, 1.2);
      this.vel[id * 3] = vx * s;
      this.vel[id * 3 + 1] = vy * s;
      this.vel[id * 3 + 2] = vz * s;
      this.life[id] = life * rand(0.6, 1.15);
      this.maxLife[id] = this.life[id];
      this.col[id * 3] = color.r;
      this.col[id * 3 + 1] = color.g;
      this.col[id * 3 + 2] = color.b;
      this.size[id] = size;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= 4 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

class Body {
  constructor(mesh, opts) {
    this.mesh = mesh;
    this.mass = opts.mass ?? 10;
    this.invMass = this.mass > 0 ? 1 / this.mass : 0;
    this.restitution = opts.restitution ?? 0.22;
    this.friction = opts.friction ?? 0.78;
    this.half = opts.half.clone();
    this.vel = new THREE.Vector3();
    this.ang = new THREE.Vector3();
    this.awake = true;
    this.kind = opts.kind;
    this.label = opts.label;
    this.hover = opts.hover || 0;
    this.baseY = opts.baseY ?? 0;
    this.anchor = opts.anchor || null;
    this.anchorLen = opts.anchorLen || 0;
    this.spawn = mesh.position.clone();
    this.spawnQ = mesh.quaternion.clone();
    this.radius = this.half.length() * 0.72;
  }

  applyForce(f, dt) {
    if (!this.invMass) return;
    this.vel.addScaledVector(f, this.invMass * dt);
    this.awake = true;
  }

  applyImpulse(j) {
    if (!this.invMass) return;
    this.vel.addScaledVector(j, this.invMass);
    this.awake = true;
  }

  reset() {
    this.mesh.position.copy(this.spawn);
    this.mesh.quaternion.copy(this.spawnQ);
    this.vel.set(0, 0, 0);
    this.ang.set(0, 0, 0);
    this.awake = true;
  }
}

class SilkWeb {
  constructor(scene, id, type) {
    this.id = id;
    this.type = type;
    this.state = "fly";
    this.origin = new THREE.Vector3();
    this.head = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.speed = type === "impact" ? 78 : 68;
    this.target = null;
    this.localAttach = new THREE.Vector3();
    this.rest = 1;
    this.tension = 0;
    this.age = 0;
    this.fade = 1;
    this.n = 22;
    this.pts = Array.from({ length: this.n }, () => new THREE.Vector3());
    this.prev = Array.from({ length: this.n }, () => new THREE.Vector3());
    this.seg = 0.4;

    const col = type === "impact" ? new THREE.Color(0xffd36a) : new THREE.Color(0xdcecff);
    const glow = type === "impact" ? new THREE.Color(0xff4d4d) : new THREE.Color(0x6ef3ff);

    this.uniforms = {
      uTime: { value: 0 },
      uTension: { value: 0 },
      uColor: { value: col },
      uGlow: { value: glow },
      uOpacity: { value: 0.95 },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: silkVert,
      fragmentShader: silkFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const maxVerts = this.n * 2;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3));
    this.geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(maxVerts * 2), 2));
    const idx = [];
    for (let i = 0; i < this.n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.coreGeo = new THREE.BufferGeometry();
    this.coreGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    this.core = new THREE.Line(
      this.coreGeo,
      new THREE.LineBasicMaterial({
        color: type === "impact" ? 0xffe29a : 0xffffff,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.core.frustumCulled = false;
    scene.add(this.core);

    this.splash = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 28),
      new THREE.MeshBasicMaterial({
        color: type === "impact" ? 0xffc14b : 0xe8f3ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.splash.visible = false;
    scene.add(this.splash);

    this.group = scene;
  }

  launch(origin, dir) {
    this.origin.copy(origin);
    this.head.copy(origin);
    this.dir.copy(dir).normalize();
    this.state = "fly";
    this.age = 0;
    this.fade = 1;
    this.target = null;
    for (let i = 0; i < this.n; i++) {
      this.pts[i].copy(origin);
      this.prev[i].copy(origin);
    }
  }

  attachTo(body, worldPoint) {
    this.state = "hold";
    this.target = body;
    this.localAttach.copy(worldPoint).sub(body.mesh.position);
    _q.copy(body.mesh.quaternion).invert();
    this.localAttach.applyQuaternion(_q);
    this.rest = Math.max(0.85, this.origin.distanceTo(worldPoint));
    this.head.copy(worldPoint);
    this.splash.position.copy(worldPoint);
    this.splash.lookAt(this.origin);
    this.splash.visible = true;
    this.splash.material.opacity = 0.85;
    this.splash.scale.setScalar(0.2);
  }

  attachWorld(point, normal) {
    this.state = "stuck";
    this.target = null;
    this.head.copy(point);
    this.rest = Math.max(0.85, this.origin.distanceTo(point));
    this.splash.position.copy(point);
    if (normal) this.splash.lookAt(point.clone().add(normal));
    else this.splash.lookAt(this.origin);
    this.splash.visible = true;
    this.splash.material.opacity = 0.7;
    this.splash.scale.setScalar(0.15);
  }

  release() {
    this.state = "dead";
  }

  getAttachWorld(out) {
    if (this.target) {
      out.copy(this.localAttach).applyQuaternion(this.target.mesh.quaternion).add(this.target.mesh.position);
    } else {
      out.copy(this.head);
    }
    return out;
  }

  stepRope(dt, pinEnd) {
    const g = 18;
    for (let i = 1; i < this.n - (pinEnd ? 1 : 0); i++) {
      const p = this.pts[i];
      const pr = this.prev[i];
      const vx = p.x - pr.x;
      const vy = p.y - pr.y;
      const vz = p.z - pr.z;
      pr.copy(p);
      p.x += vx * 0.97;
      p.y += vy * 0.97 - g * dt * dt;
      p.z += vz * 0.97;
    }
    this.pts[0].copy(this.origin);
    this.prev[0].copy(this.origin);
    if (pinEnd) {
      this.pts[this.n - 1].copy(this.head);
      this.prev[this.n - 1].copy(this.head);
    }
    const total = this.origin.distanceTo(this.head);
    this.seg = Math.max(0.04, total / (this.n - 1));
    for (let k = 0; k < 8; k++) {
      for (let i = 0; i < this.n - 1; i++) {
        const a = this.pts[i];
        const b = this.pts[i + 1];
        _v.copy(b).sub(a);
        const d = _v.length() || 1e-6;
        const diff = (d - this.seg) / d;
        if (i === 0) {
          b.addScaledVector(_v, -diff);
        } else if (pinEnd && i === this.n - 2) {
          a.addScaledVector(_v, diff);
        } else {
          a.addScaledVector(_v, diff * 0.5);
          b.addScaledVector(_v, -diff * 0.5);
        }
      }
      this.pts[0].copy(this.origin);
      if (pinEnd) this.pts[this.n - 1].copy(this.head);
    }
  }

  writeMesh(camera) {
    const pos = this.geo.attributes.position;
    const uv = this.geo.attributes.uv;
    const cpos = this.coreGeo.attributes.position;
    const width = (this.type === "impact" ? 0.055 : 0.038) * (1 + this.tension * 0.35);
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i];
      const p2 = this.pts[Math.min(this.n - 1, i + 1)];
      const p0 = this.pts[Math.max(0, i - 1)];
      _v.copy(p2).sub(p0);
      if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
      else _v.normalize();
      _v2.copy(camera.position).sub(p).cross(_v);
      if (_v2.lengthSq() < 1e-6) _v2.set(1, 0, 0);
      else _v2.normalize();
      const wobble = Math.sin(this.age * 18 + i * 0.7) * 0.008 * (1 + this.tension * 2);
      const sx = _v2.x * (width + wobble);
      const sy = _v2.y * (width + wobble);
      const sz = _v2.z * (width + wobble);
      pos.setXYZ(i * 2, p.x - sx, p.y - sy, p.z - sz);
      pos.setXYZ(i * 2 + 1, p.x + sx, p.y + sy, p.z + sz);
      uv.setXY(i * 2, i / (this.n - 1), 0);
      uv.setXY(i * 2 + 1, i / (this.n - 1), 1);
      cpos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    cpos.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }

  dispose() {
    this.group.remove(this.mesh);
    this.group.remove(this.core);
    this.group.remove(this.splash);
    this.geo.dispose();
    this.coreGeo.dispose();
    this.mat.dispose();
    this.core.material.dispose();
    this.splash.geometry.dispose();
    this.splash.material.dispose();
  }
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.bodies = [];
    this.webs = new Map();
    this.events = [];
    this.score = 0;
    this.combo = 1;
    this.comboT = 0;
    this.shake = 0;
    this.fluid = { Left: 1, Right: 1 };
    this.aim = {
      hit: null,
      point: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
      body: null,
    };
    this.ray = new THREE.Raycaster();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.handPrev = new Map();
    this.handVelocities = new Map();
    this.gauntlets = {};
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060c);
    this.scene.fog = new THREE.FogExp2(0x050814, 0.016);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.08, 280);
    this.camera.position.set(0, 1.62, 9.2);
    this.camera.lookAt(0, 1.35, -2);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.42, 0.72);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this._lights();
    this._arena();
    this._props();
    this.particles = new ParticleField(this.scene, 520);
    this._gauntlets();
    this.resize();
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0x6b7cff, 0x1a0a08, 0.55));
    const moon = new THREE.DirectionalLight(0xc5d8ff, 1.15);
    moon.position.set(-18, 28, 10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 2;
    moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -28;
    moon.shadow.camera.right = 28;
    moon.shadow.camera.top = 28;
    moon.shadow.camera.bottom = -28;
    this.scene.add(moon);
    const red = new THREE.PointLight(0xff2a33, 3.2, 28, 1.6);
    red.position.set(-6, 3.2, -4);
    this.scene.add(red);
    const cyan = new THREE.PointLight(0x46f0ff, 2.8, 26, 1.6);
    cyan.position.set(6.5, 3.4, -2);
    this.scene.add(cyan);
    const gold = new THREE.PointLight(0xf0c14b, 2.2, 18, 2);
    gold.position.set(0, 4.4, 2);
    this.scene.add(gold);
  }

  _arena() {
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      roughness: 0.38,
      metalness: 0.42,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(42, 0.35, 36), floorMat);
    floor.position.y = -0.175;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(42, 42, 0x2b6cff, 0x152033);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    this.scene.add(grid);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 6.35, 80),
      new THREE.MeshBasicMaterial({ color: 0x6ef3ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 40),
      new THREE.MeshBasicMaterial({ color: 0xf0c14b, transparent: true, opacity: 0.14 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.025, 7.2);
    this.scene.add(pad);

    const winTex = windowTexture();
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    const bmat = new THREE.MeshStandardMaterial({
      map: winTex,
      emissive: 0x9ec6ff,
      emissiveMap: winTex,
      emissiveIntensity: 0.85,
      roughness: 0.55,
      metalness: 0.25,
      color: 0x0b101c,
    });
    for (let i = 0; i < 28; i++) {
      const w = rand(6, 14);
      const h = rand(18, 52);
      const d = rand(6, 12);
      const side = i % 2 === 0 ? -1 : 1;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      mesh.position.set(side * rand(22, 48), h * 0.5 - 2, -rand(8, 70) + (i % 5) * 4);
      this.scene.add(mesh);
    }
    for (let i = 0; i < 10; i++) {
      const w = rand(8, 16);
      const h = rand(22, 60);
      const d = rand(8, 14);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      mesh.position.set(rand(-30, 30), h * 0.5 - 2, -rand(36, 90));
      this.scene.add(mesh);
    }

    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(42, 0.7, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.7, metalness: 0.2 })
    );
    parapet.position.set(0, 0.35, -17.8);
    parapet.castShadow = true;
    this.scene.add(parapet);

    this._sign();
    this._stars();
    this._hoops();
  }

  _sign() {
    const g = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.4, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x080b12, metalness: 0.6, roughness: 0.3, emissive: 0x1a0508, emissiveIntensity: 0.4 })
    );
    g.add(board);
    const makeGlow = (w, color, x) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.12, 0.05),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
      );
      m.position.set(x, 0.45, 0.08);
      g.add(m);
    };
    makeGlow(8.6, 0xff2a33, 0);
    makeGlow(6.2, 0x6ef3ff, 0);
    g.position.set(-8.5, 4.6, -16.8);
    this.scene.add(g);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 5.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8, roughness: 0.25 })
    );
    pole.position.set(7.5, 2.6, -8);
    this.scene.add(pole);
    this.beamPoint = new THREE.Vector3(7.5, 5.15, -8);
  }

  _stars() {
    const n = 600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-120, 120);
      pos[i * 3 + 1] = rand(12, 80);
      pos[i * 3 + 2] = rand(-140, 20);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xb9d4ff, size: 0.12 })));
  }

  _hoops() {
    this.hoops = [];
    const spots = [
      [0, 3.2, -6],
      [-5.5, 2.6, -3],
      [5.2, 3.6, -1.5],
    ];
    for (const [x, y, z] of spots) {
      const t = new THREE.TorusGeometry(1.15, 0.045, 10, 40);
      const m = new THREE.Mesh(
        t,
        new THREE.MeshBasicMaterial({ color: 0x6ef3ff, transparent: true, opacity: 0.8 })
      );
      m.position.set(x, y, z);
      this.scene.add(m);
      this.hoops.push({ mesh: m, center: m.position.clone(), radius: 1.15, cool: 0 });
    }
  }

  _props() {
    const wood = woodTexture();
    const crateMat = new THREE.MeshStandardMaterial({
      map: wood,
      roughness: 0.82,
      metalness: 0.05,
      color: 0xc48a55,
    });
    const rust = new THREE.MeshStandardMaterial({
      map: metalTexture("#6a2b12"),
      color: 0xb85a22,
      roughness: 0.55,
      metalness: 0.45,
    });
    const steel = new THREE.MeshStandardMaterial({
      map: metalTexture("#2a3038"),
      color: 0x8a94a3,
      roughness: 0.35,
      metalness: 0.82,
    });
    const taxi = new THREE.MeshStandardMaterial({
      color: 0xffc107,
      roughness: 0.35,
      metalness: 0.45,
    });
    const dump = new THREE.MeshStandardMaterial({
      color: 0x1f4a32,
      roughness: 0.5,
      metalness: 0.4,
    });
    const droneMat = new THREE.MeshStandardMaterial({
      color: 0x10141c,
      metalness: 0.7,
      roughness: 0.28,
      emissive: 0x0b3a44,
      emissiveIntensity: 0.6,
    });

    const addBox = (sx, sy, sz, x, y, z, mat, opts) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      const body = new Body(mesh, {
        mass: opts.mass,
        half: new THREE.Vector3(sx / 2, sy / 2, sz / 2),
        kind: opts.kind,
        label: opts.label,
        hover: opts.hover,
        baseY: y,
        restitution: opts.restitution,
      });
      this.bodies.push(body);
      return body;
    };

    addBox(1.1, 1.1, 1.1, -2.2, 0.55, -2.4, crateMat, { mass: 9, kind: "crate", label: "CRATE · PINE" });
    addBox(1.1, 1.1, 1.1, -2.2, 1.65, -2.4, crateMat, { mass: 8, kind: "crate", label: "CRATE · PINE" });
    addBox(1.3, 1.3, 1.3, 2.8, 0.65, -4.2, crateMat, { mass: 14, kind: "crate", label: "CRATE · HEAVY" });
    addBox(0.9, 0.9, 0.9, 1.2, 0.45, -1.6, crateMat, { mass: 6, kind: "crate", label: "CRATE · LIGHT" });
    addBox(0.9, 1.25, 0.9, -4.6, 0.63, -5.2, rust, { mass: 18, kind: "barrel", label: "BARREL · CHEM" });
    addBox(0.9, 1.25, 0.9, -5.5, 0.63, -4.5, rust, { mass: 20, kind: "barrel", label: "BARREL · CHEM" });
    addBox(2.4, 1.5, 1.2, 6.4, 0.75, -6.8, dump, { mass: 85, kind: "dumpster", label: "DUMPSTER" });

    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 1.7), taxi);
    body.position.y = 0.55;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 1.55),
      new THREE.MeshStandardMaterial({ color: 0x9ad7ff, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.55 })
    );
    cabin.position.set(-0.2, 1.2, 0);
    car.add(cabin);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    for (const [x, z] of [[-1.2, 0.8], [-1.2, -0.8], [1.15, 0.8], [1.15, -0.8]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12), wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(x, 0.32, z);
      car.add(wh);
    }
    car.position.set(-7.2, 0.62, -8.4);
    this.scene.add(car);
    const carBody = new Body(car, {
      mass: 210,
      half: new THREE.Vector3(1.8, 0.7, 0.85),
      kind: "car",
      label: "TAXI · HEAVY",
    });
    this.bodies.push(carBody);

    for (const [x, z] of [[0.6, -8.5], [3.4, -10.2], [-1.8, -11]]) {
      const d = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), droneMat);
      d.add(hull);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x6ef3ff })
      );
      d.add(glow);
      d.position.set(x, 2.4 + Math.random(), z);
      this.scene.add(d);
      this.bodies.push(
        new Body(d, {
          mass: 4.5,
          half: new THREE.Vector3(0.35, 0.35, 0.35),
          kind: "drone",
          label: "DRONE · HOVER",
          hover: 2.5 + Math.random() * 0.6,
          baseY: d.position.y,
        })
      );
    }

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 18),
      steel
    );
    ball.position.set(7.5, 2.4, -8);
    ball.castShadow = true;
    this.scene.add(ball);
    const wreck = new Body(ball, {
      mass: 55,
      half: new THREE.Vector3(0.55, 0.55, 0.55),
      kind: "ball",
      label: "WRECKING BALL",
      anchor: this.beamPoint.clone(),
      anchorLen: 2.75,
    });
    this.bodies.push(wreck);

    this.chain = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([this.beamPoint, ball.position]),
      new THREE.LineBasicMaterial({ color: 0xb7c2cc })
    );
    this.scene.add(this.chain);
  }

  _gauntlets() {
    const make = (color) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.012, 8, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const ring2 = ring.clone();
      ring2.scale.setScalar(0.72);
      g.add(ring2);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      g.add(core);
      g.visible = false;
      this.scene.add(g);
      return g;
    };
    this.gauntlets.Left = make(0x6ef3ff);
    this.gauntlets.Right = make(0xf0c14b);
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  mapHand(hand) {
    if (!hand.palm) return null;
    const x = hand.palm.x * 2 - 1;
    const y = -(hand.palm.y * 2 - 1);
    const size = hand.size || 0.18;
    const depth = clamp(0.18 / size, 0.7, 3.2);
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.position
      .clone()
      .addScaledVector(fwd, 0.85)
      .addScaledVector(right, x * 1.55)
      .addScaledVector(up, y * 0.95 + 0.05)
      .addScaledVector(fwd, (2.2 - depth) * 0.15);

    this.ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const far = this.ray.ray.origin.clone().addScaledVector(this.ray.ray.direction, 42);
    const hits = this.ray.intersectObjects(
      this.bodies.map((b) => b.mesh),
      true
    );
    let aimPoint = far;
    let body = null;
    if (hits.length) {
      aimPoint = hits[0].point.clone();
      body = this._bodyFromMesh(hits[0].object);
    } else {
      const ground = this.ray.ray.intersectPlane(new THREE.Plane(UP, 0), this.tmp);
      if (ground && ground.z < this.camera.position.z - 0.5) aimPoint = ground.clone();
    }
    const dir = aimPoint.clone().sub(origin).normalize();
    return { origin, dir, aimPoint, body, ndc: { x, y } };
  }

  _bodyFromMesh(obj) {
    let o = obj;
    while (o) {
      const found = this.bodies.find((b) => b.mesh === o);
      if (found) return found;
      o = o.parent;
    }
    return null;
  }

  shoot(handId, mapped, type) {
    if (this.fluid[handId] < 0.08) {
      this.events.push({ kind: "dry", handId });
      return null;
    }
    this.fluid[handId] = Math.max(0, this.fluid[handId] - (type === "impact" ? 0.09 : 0.07));
    const existing = this.webs.get(handId);
    if (existing) {
      existing.dispose();
      this.webs.delete(handId);
    }
    const web = new SilkWeb(this.scene, handId, type);
    web.launch(mapped.origin, mapped.dir);
    this.webs.set(handId, web);
    this.particles.spawn(mapped.origin, 18, {
      color: new THREE.Color(type === "impact" ? 0xffc14b : 0xdef6ff),
      speed: 4,
      dir: mapped.dir,
      life: 0.35,
    });
    this.shake = Math.max(this.shake, 0.18);
    this.bloom.strength = 0.95;
    this.events.push({ kind: "shoot", type, handId });
    return web;
  }

  release(handId) {
    const web = this.webs.get(handId);
    if (!web) return;
    if (web.state === "hold" && web.target) {
      const attach = web.getAttachWorld(this.tmp);
      const toHand = web.origin.clone().sub(attach);
      const stretch = Math.max(0, toHand.length() - web.rest);
      if (stretch > 0.4) {
        web.target.applyImpulse(toHand.normalize().multiplyScalar(stretch * 14));
      }
    }
    this.particles.spawn(web.origin, 14, {
      color: new THREE.Color(0xffffff),
      speed: 2.2,
      life: 0.4,
    });
    web.release();
    this.events.push({ kind: "release", handId });
  }

  update(dt, hands) {
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 1;
    this.bloom.strength += (0.52 - this.bloom.strength) * 0.08;
    this.shake *= 0.86;

    for (const k of Object.keys(this.fluid)) {
      this.fluid[k] = Math.min(1, this.fluid[k] + dt * 0.07);
    }

    this._updateHands(hands, dt);
    this._updateWebs(dt);
    this._stepPhysics(dt);
    this._hoopCheck(dt);
    this.particles.update(dt);
    this._camera(dt);

    if (this.chain) {
      const wreck = this.bodies.find((b) => b.kind === "ball");
      const pos = this.chain.geometry.attributes.position;
      pos.setXYZ(0, this.beamPoint.x, this.beamPoint.y, this.beamPoint.z);
      pos.setXYZ(1, wreck.mesh.position.x, wreck.mesh.position.y, wreck.mesh.position.z);
      pos.needsUpdate = true;
    }
  }

  _updateHands(hands, dt) {
    const present = new Set();
    let bestAim = null;
    for (const hand of hands) {
      present.add(hand.id);
      const g = this.gauntlets[hand.id];
      if (!hand.palm || hand.lost) {
        if (g) g.visible = false;
        continue;
      }
      const mapped = this.mapHand(hand);
      hand.mapped = mapped;
      if (!mapped) continue;

      const prev = this.handPrev.get(hand.id);
      hand.velocity = prev
        ? mapped.origin.clone().sub(prev).multiplyScalar(1 / Math.max(dt, 1e-3))
        : new THREE.Vector3();
      this.handPrev.set(hand.id, mapped.origin.clone());
      this.handVelocities.set(hand.id, hand.velocity.clone());

      if (g) {
        g.visible = true;
        g.position.copy(mapped.origin);
        g.lookAt(mapped.origin.clone().add(mapped.dir));
        const s = hand.gesture.state === "HOLD" ? 1.35 : 1 + hand.gesture.charge * 0.4;
        g.scale.setScalar(s);
      }

      const web = this.webs.get(hand.id);
      if (web && (web.state === "fly" || web.state === "hold" || web.state === "stuck")) {
        web.origin.copy(mapped.origin);
      }

      if (!bestAim || (mapped.body && !bestAim.body)) bestAim = mapped;
    }
    for (const id of ["Left", "Right"]) {
      if (!present.has(id) && this.gauntlets[id]) this.gauntlets[id].visible = false;
    }
    if (bestAim) {
      this.aim.point.copy(bestAim.aimPoint);
      this.aim.body = bestAim.body;
      this.aim.ndc.set(bestAim.ndc.x, bestAim.ndc.y);
      this.aim.hit = true;
    } else {
      this.aim.hit = false;
      this.aim.body = null;
    }
  }

  _updateWebs(dt) {
    let peakTension = 0;
    for (const [id, web] of this.webs) {
      web.age += dt;
      web.uniforms.uTime.value = web.age;
      if (web.state === "fly") {
        const step = web.speed * dt;
        const next = web.head.clone().addScaledVector(web.dir, step);
        const hit = this._castSegment(web.head, next);
        if (hit) {
          web.head.copy(hit.point);
          if (hit.body) {
            web.attachTo(hit.body, hit.point);
            if (web.type === "impact") {
              const impulse = web.dir.clone().multiplyScalar(55 + 90 / Math.max(4, hit.body.mass * 0.15));
              hit.body.applyImpulse(impulse.multiplyScalar(hit.body.mass));
              hit.body.ang.add(new THREE.Vector3(rand(-4, 4), rand(-2, 2), rand(-4, 4)));
              this.shake = Math.max(this.shake, hit.body.mass > 60 ? 0.55 : 0.28);
              this.addScore(hit.body.mass > 60 ? 40 : 22, "IMPACT");
            } else {
              this.addScore(12, "ATTACH");
            }
            this.particles.spawn(hit.point, 28, {
              color: new THREE.Color(web.type === "impact" ? 0xff9a3c : 0xffffff),
              speed: 5,
              life: 0.5,
            });
            this.events.push({ kind: "attach", type: web.type, label: hit.body.label });
          } else {
            web.attachWorld(hit.point, hit.normal);
            this.particles.spawn(hit.point, 16, { color: new THREE.Color(0xffffff), speed: 3, life: 0.35 });
            this.events.push({ kind: "stick" });
          }
        } else {
          web.head.copy(next);
          if (web.age > 0.9) web.state = "dead";
        }
        this._initFlyPts(web);
        web.stepRope(dt, true);
      } else if (web.state === "hold" || web.state === "stuck") {
        web.getAttachWorld(web.head);
        web.stepRope(dt, true);
        const delta = web.origin.clone().sub(web.head);
        const dist = delta.length();
        const stretch = Math.max(0, dist - web.rest);
        web.tension = clamp(stretch / Math.max(1, web.rest), 0, 2);
        peakTension = Math.max(peakTension, web.tension);
        web.uniforms.uTension.value = web.tension;

        if (web.state === "hold" && web.target) {
          const dir = delta.normalize();
          const rel = web.target.vel.clone().sub(_v2.set(0, 0, 0));
          const hand = this.handPrev.has(id) ? this._handVel(id) : new THREE.Vector3();
          const pull = -hand.dot(web.head.clone().sub(web.origin).normalize());
          if (pull > 0.6) {
            web.rest = Math.max(0.7, web.rest - pull * dt * 1.8);
          }
          if (stretch > 0) {
            const k = web.type === "impact" ? 140 : 120;
            const force = dir.multiplyScalar(stretch * k - rel.dot(dir) * 18);
            web.target.applyForce(force, dt);
            const r = web.head.clone().sub(web.target.mesh.position);
            web.target.ang.add(r.cross(force.clone().multiplyScalar(dt * 0.02 * web.target.invMass)));
          }
          if (pull > 6.5) {
            web.target.applyImpulse(dir.multiplyScalar(pull * 7));
            this.shake = Math.max(this.shake, 0.32);
            this.addScore(8, "YANK");
            this.events.push({ kind: "yank" });
          }
        } else if (web.state === "stuck") {
          if (stretch > 10) web.rest = dist * 0.92;
        }

        if (web.splash.visible) {
          web.splash.material.opacity *= 0.985;
          web.splash.scale.setScalar(Math.min(1.4, web.splash.scale.x + dt * 3));
          if (web.splash.material.opacity < 0.05) web.splash.visible = false;
        }
      } else if (web.state === "dead") {
        web.fade -= dt * 2.4;
        web.uniforms.uOpacity.value = Math.max(0, web.fade);
        web.core.material.opacity = Math.max(0, web.fade * 0.7);
        web.stepRope(dt, false);
        if (web.fade <= 0) {
          web.dispose();
          this.webs.delete(id);
          continue;
        }
      }
      web.writeMesh(this.camera);
    }
    this.peakTension = peakTension;
  }

  _handVel(id) {
    return this.tmp2.set(0, 0, 0);
  }

  _initFlyPts(web) {
    for (let i = 0; i < web.n; i++) {
      const t = i / (web.n - 1);
      web.pts[i].lerpVectors(web.origin, web.head, t);
    }
  }

  _castSegment(a, b) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-4) return null;
    dir.multiplyScalar(1 / len);
    this.ray.set(a, dir);
    this.ray.far = len + 0.05;
    const meshes = this.bodies.map((bd) => bd.mesh);
    const hits = this.ray.intersectObjects(meshes, true);
    if (hits.length) {
      return { point: hits[0].point.clone(), body: this._bodyFromMesh(hits[0].object), normal: hits[0].face?.normal };
    }
    if (b.y <= 0.02 && a.y > 0.02) {
      const t = a.y / (a.y - b.y);
      const p = a.clone().lerp(b, t);
      p.y = 0.02;
      return { point: p, body: null, normal: UP.clone() };
    }
    if (b.z < -17.7 && a.z >= -17.7) {
      const t = (a.z + 17.7) / (a.z - b.z);
      return { point: a.clone().lerp(b, t), body: null, normal: new THREE.Vector3(0, 0, 1) };
    }
    return null;
  }

  _stepPhysics(dt) {
    const gdt = Math.min(dt, 0.033);
    for (const b of this.bodies) {
      if (!b.invMass) continue;

      if (b.kind === "drone") {
        const targetY = b.hover;
        const fy = (targetY - b.mesh.position.y) * 28 - b.vel.y * 6;
        b.vel.y += fy * gdt;
        b.mesh.rotation.y += gdt * 0.8;
      } else if (b.anchor) {
        // pendulum gravity only; constraint below
        b.vel.addScaledVector(GRAVITY, gdt);
      } else {
        b.vel.addScaledVector(GRAVITY, gdt);
      }

      b.vel.multiplyScalar(b.kind === "drone" ? 0.985 : 0.995);
      b.mesh.position.addScaledVector(b.vel, gdt);

      const angLen = b.ang.length();
      if (angLen > 1e-4) {
        _v.copy(b.ang).normalize();
        _q.setFromAxisAngle(_v, angLen * gdt);
        b.mesh.quaternion.premultiply(_q);
        b.ang.multiplyScalar(0.985);
      }

      if (b.anchor) {
        const to = b.mesh.position.clone().sub(b.anchor);
        const d = to.length() || 1e-6;
        const n = to.multiplyScalar(1 / d);
        if (d > b.anchorLen) {
          b.mesh.position.copy(b.anchor).addScaledVector(n, b.anchorLen);
          const vn = b.vel.dot(n);
          if (vn > 0) b.vel.addScaledVector(n, -vn * 1.05);
        }
      }

      const minY = b.half.y;
      if (b.mesh.position.y < minY) {
        b.mesh.position.y = minY;
        if (b.vel.y < 0) {
          const impact = -b.vel.y;
          b.vel.y = -b.vel.y * b.restitution;
          b.vel.x *= b.friction;
          b.vel.z *= b.friction;
          b.ang.multiplyScalar(0.7);
          if (impact > 3.5) this.events.push({ kind: "thud", heavy: b.mass > 40 });
        }
      }

      const limit = 19;
      if (Math.abs(b.mesh.position.x) > limit) {
        b.mesh.position.x = clamp(b.mesh.position.x, -limit, limit);
        b.vel.x *= -0.35;
      }
      if (b.mesh.position.z > 12 || b.mesh.position.z < -16.8) {
        b.mesh.position.z = clamp(b.mesh.position.z, -16.8, 12);
        b.vel.z *= -0.35;
      }

      if (b.mesh.position.y < -8) b.reset();
    }

    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this._resolve(this.bodies[i], this.bodies[j]);
      }
    }
  }

  _resolve(a, b) {
    const pa = a.mesh.position;
    const pb = b.mesh.position;
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const dz = pb.z - pa.z;
    const ox = a.half.x + b.half.x - Math.abs(dx);
    const oy = a.half.y + b.half.y - Math.abs(dy);
    const oz = a.half.z + b.half.z - Math.abs(dz);
    if (ox <= 0 || oy <= 0 || oz <= 0) return;
    let axis = "y";
    let pen = oy;
    if (ox < pen) { axis = "x"; pen = ox; }
    if (oz < pen) { axis = "z"; pen = oz; }
    const sign = axis === "x" ? Math.sign(dx) || 1 : axis === "y" ? Math.sign(dy) || 1 : Math.sign(dz) || 1;
    const inv = a.invMass + b.invMass;
    if (inv <= 0) return;
    const corr = pen / inv;
    if (axis === "x") {
      pa.x -= sign * corr * a.invMass;
      pb.x += sign * corr * b.invMass;
    } else if (axis === "y") {
      pa.y -= sign * corr * a.invMass;
      pb.y += sign * corr * b.invMass;
    } else {
      pa.z -= sign * corr * a.invMass;
      pb.z += sign * corr * b.invMass;
    }
    const va = a.vel[axis];
    const vb = b.vel[axis];
    const rel = vb - va;
    if (rel * sign > 0) return;
    const e = Math.min(a.restitution, b.restitution);
    const j = -(1 + e) * rel / inv;
    a.vel[axis] -= j * a.invMass;
    b.vel[axis] += j * b.invMass;
  }

  _hoopCheck(dt) {
    for (const h of this.hoops) {
      h.cool = Math.max(0, h.cool - dt);
      h.mesh.rotation.y += dt * 0.6;
      h.mesh.material.opacity = 0.45 + Math.sin(performance.now() * 0.004) * 0.2;
      if (h.cool > 0) continue;
      for (const b of this.bodies) {
        if (b.kind === "ball") continue;
        const d = b.mesh.position.distanceTo(h.center);
        if (d < h.radius + 0.35 && b.vel.length() > 2.2) {
          h.cool = 1.4;
          this.addScore(120, "RING");
          this.particles.spawn(h.center, 40, { color: new THREE.Color(0x6ef3ff), speed: 6, life: 0.6 });
          this.events.push({ kind: "ring", label: b.label });
          this.shake = Math.max(this.shake, 0.4);
        }
      }
    }
  }

  _camera(dt) {
    const base = new THREE.Vector3(0, 1.62, 9.2);
    if (this.shake > 0.01) {
      base.x += (Math.random() - 0.5) * this.shake * 0.35;
      base.y += (Math.random() - 0.5) * this.shake * 0.22;
    }
    this.camera.position.lerp(base, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(0, 1.35, -2);
  }

  addScore(n, why) {
    const got = Math.round(n * this.combo);
    this.score += got;
    if (why === "YANK") {
      this.combo = Math.min(8, this.combo + 0.15);
    } else if (why === "RING" || why === "IMPACT") {
      this.combo = Math.min(8, this.combo + 0.5);
    } else {
      this.combo = Math.min(8, this.combo + 0.1);
    }
    this.comboT = 4.5;
    return got;
  }

  reset() {
    for (const b of this.bodies) b.reset();
    for (const w of this.webs.values()) w.dispose();
    this.webs.clear();
    this.score = 0;
    this.combo = 1;
    this.events.push({ kind: "reset" });
  }

  project(v3) {
    _v.copy(v3).project(this.camera);
    return {
      x: (_v.x * 0.5 + 0.5) * innerWidth,
      y: (-_v.y * 0.5 + 0.5) * innerHeight,
      visible: _v.z < 1,
    };
  }

  render() {
    this.composer.render();
  }

  drainEvents() {
    const e = this.events.slice();
    this.events.length = 0;
    return e;
  }
}
lse if (why === "RING" || why === "IMPACT") {
      this.combo = Math.min(8, this.combo + 0.5);
    } else {
      this.combo = Math.min(8, this.combo + 0.1);
    }
    this.comboT = 4.5;
    return got;
  }

  reset() {
    for (const b of this.bodies) b.reset();
    for (const w of this.webs.values()) w.dispose();
    this.webs.clear();
    this.score = 0;
    this.combo = 1;
    this.events.push({ kind: "reset" });
  }

  project(v3) {
    _v.copy(v3).project(this.camera);
    return {
      x: (_v.x * 0.5 + 0.5) * innerWidth,
      y: (-_v.y * 0.5 + 0.5) * innerHeight,
      visible: _v.z < 1,
    };
  }

  render() {
    this.composer.render();
  }

  drainEvents() {
    const e = this.events.slice();
    this.events.length = 0;
    return e;
  }
}
