import { AudioBus } from "./audio.js";
import { HandTracker } from "./tracking.js";
import { World } from "./world.js";

const $ = (id) => document.getElementById(id);

const audio = new AudioBus();
const tracker = new HandTracker();
const world = new World($("scene"));

const state = {
  phase: "boot",
  started: 0,
  debug: false,
  mouse: { x: 0, y: 0, ndcX: 0, ndcY: 0, down: false },
  mouseMode: false,
  lastLog: 0,
};

const bootLines = [
  "STARK / PARKER COOPERATIVE  ·  WEB SYSTEMS OS 4.8.1",
  "> linking FRIDAY neural fabric ............... OK",
  "> linking KAREN tactical overlay ............. OK",
  "> spinning up photonic silk synthesizer ...... OK",
  "> loading hand-kinematic fire control ........",
  "> debounce lock: 320ms confirm / 200ms release",
  "> dual-web heavy pull enabled",
  "> waiting for operator biometrics...",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function typeBoot() {
  const el = $("boot-log");
  el.textContent = "";
  for (const line of bootLines) {
    el.textContent += line + "\n";
    audio.ui("tick");
    await sleep(140 + Math.random() * 90);
  }
  $("engage").disabled = false;
  $("engage").textContent = "ENGAGE WEB SYSTEMS";
  audio.ui("boot");
}

function log(msg, cls = "") {
  const ul = $("log");
  const li = document.createElement("li");
  if (cls) li.className = cls;
  const t = new Date();
  const stamp = `${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
  li.textContent = `${stamp}  ${msg}`;
  ul.prepend(li);
  while (ul.children.length > 8) ul.lastChild.remove();
}

function setPill(id, mode) {
  const el = $(id);
  el.classList.remove("on", "warn", "off");
  el.classList.add(mode);
}

function show(el, on = true) {
  el.classList.toggle("hidden", !on);
}

function setRing(svgCircle, t, circumference) {
  const c = circumference ?? 2 * Math.PI * Number(svgCircle.getAttribute("r"));
  svgCircle.style.strokeDasharray = `${c}`;
  svgCircle.style.strokeDashoffset = `${c * (1 - Math.max(0, Math.min(1, t)))}`;
}

async function engage() {
  $("engage").disabled = true;
  $("practice").disabled = true;
  $("engage").textContent = "REQUESTING OPTICS…";
  await audio.init();
  await audio.resume();
  audio.ui("ok");

  world.init();
  window.addEventListener("resize", () => world.resize());

  try {
    await tracker.startCamera();
    setPill("pill-cam", "on");
    $("engage").textContent = "LOADING KINEMATICS…";
    await tracker.init($("cam"));
    setPill("pill-track", "on");
    log("OPTICS ONLINE", "cyan");
    log("HAND MODEL LOCKED", "gold");
  } catch (err) {
    console.warn(err);
    state.mouseMode = true;
    setPill("pill-cam", "off");
    setPill("pill-track", "warn");
    log("CAMERA DENIED — MOUSE FALLBACK", "red");
  }

  show($("boot"), false);
  if (!state.mouseMode) {
    show($("calibrate"), true);
    show($("pip"), true);
    state.phase = "calibrate";
  } else {
    enterSim();
  }
  loop();
}

function enterSim() {
  state.phase = "play";
  state.started = performance.now();
  show($("calibrate"), false);
  show($("hud-top"), true);
  show($("hud-left"), true);
  show($("hud-right"), true);
  show($("hud-bot"), true);
  show($("pip"), !state.mouseMode);
  setPill("pill-web", "on");
  log("SIMULATOR LIVE", "gold");
  log("HOLD 🤟 TO FIRE — NO TWITCH SHOTS", "cyan");
  audio.ui("ok");
}

function fakeMouseHand() {
  const x = state.mouse.ndcX * 0.5 + 0.5;
  const y = -state.mouse.ndcY * 0.5 + 0.5;
  const holding = state.mouse.down;
  const g = tracker.locks.Right;
  const now = performance.now();
  if (holding && g.state === "IDLE") {
    g.state = "CHARGE";
    g.confirmStart = now;
  }
  if (holding && g.state === "CHARGE") {
    g.charge = Math.min(1, (now - g.confirmStart) / 280);
    g.score = 0.9;
    if (g.charge >= 1) {
      g.state = "HOLD";
      g.justLocked = true;
      g.type = state.mouse.alt ? "impact" : "grapple";
    }
  }
  if (!holding && g.state === "HOLD") {
    g.justReleased = true;
    g.state = "COOLDOWN";
    g.cooldownUntil = now + 300;
    g.charge = 0;
  }
  if (g.state === "COOLDOWN" && now > g.cooldownUntil) {
    g.state = "IDLE";
    g.justLocked = false;
    g.justReleased = false;
  }
  const palm = { x, y, z: 0 };
  const gesture = g.snapshot();
  g.justLocked = false;
  g.justReleased = false;
  return [
    {
      id: "Right",
      landmarks: null,
      wrist: palm,
      palm,
      size: 0.2,
      gesture,
      palmFacing: !!state.mouse.alt,
    },
  ];
}

function handleGestures(hands) {
  for (const hand of hands) {
    const g = hand.gesture;
    if (g.justLocked && hand.mapped) {
      world.shoot(hand.id, hand.mapped, g.type);
      audio.shoot(g.type, hand.id === "Left" ? -0.35 : 0.35);
      flash(hand.mapped.ndc.x, hand.mapped.ndc.y);
      log(`${g.type === "impact" ? "IMPACT" : "GRAPPLE"} // ${hand.id[0]}`, g.type === "impact" ? "red" : "cyan");
    }
    if (g.justReleased) {
      world.release(hand.id);
      audio.snap();
      audio.setTension(0);
    }
  }
}

function flash(nx, ny) {
  const el = $("fx-flash");
  const px = (nx * 0.5 + 0.5) * 100;
  const py = (-ny * 0.5 + 0.5) * 100;
  el.style.setProperty("--fx", `${px}% ${py}%`);
  el.style.opacity = "1";
  $("fx-chroma").classList.add("on");
  requestAnimationFrame(() => {
    el.style.transition = "opacity 280ms ease";
    el.style.opacity = "0";
    setTimeout(() => $("fx-chroma").classList.remove("on"), 180);
  });
}

function updateHud(hands, now) {
  const elapsed = state.phase === "play" ? (now - state.started) / 1000 : 0;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  $("clock").textContent = `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;

  $("tank-l").style.height = `${world.fluid.Left * 100}%`;
  $("tank-r").style.height = `${world.fluid.Right * 100}%`;
  $("fluid-readout").textContent = `${world.fluid.Left.toFixed(2)} · ${world.fluid.Right.toFixed(2)}`;

  for (const side of ["Left", "Right"]) {
    const hand = hands.find((h) => h.id === side && !h.lost);
    const row = $(side === "Left" ? "hand-l-row" : "hand-r-row");
    const st = $(side === "Left" ? "hand-l-state" : "hand-r-state");
    const ty = $(side === "Left" ? "hand-l-type" : "hand-r-type");
    const bar = $(side === "Left" ? "hand-l-bar" : "hand-r-bar");
    row.classList.remove("live", "lock", "gone");
    if (!hand) {
      row.classList.add("gone");
      st.textContent = "ABSENT";
      ty.textContent = "—";
      bar.style.width = "0%";
    } else {
      const g = hand.gesture;
      st.textContent = g.state;
      ty.textContent = `${g.type.toUpperCase()} · ${(g.score * 100) | 0}%`;
      bar.style.width = `${Math.max(g.charge, g.state === "HOLD" ? 1 : g.score) * 100}%`;
      row.classList.add(g.state === "HOLD" ? "lock" : "live");
    }
  }

  const locked = hands.find((h) => h.gesture.state === "HOLD");
  const charging = hands.find((h) => h.gesture.state === "CHARGE");
  const typed = locked || charging || hands.find((h) => !h.lost);
  const isImpact = typed?.gesture?.type === "impact";
  $("lo-grapple").classList.toggle("active", !isImpact);
  $("lo-impact").classList.toggle("active", !!isImpact);

  $("score").textContent = world.score.toLocaleString();
  $("combo").textContent = `x${world.combo.toFixed(1)} · ${world.comboT > 0 ? "HOT" : "WAITING"}`;
  $("tension-bar").style.width = `${Math.min(100, (world.peakTension || 0) * 55)}%`;
  audio.setTension(world.peakTension || 0);

  if (world.aim.body) {
    $("tgt-name").textContent = world.aim.body.label;
    $("tgt-meta").textContent = `MASS ${world.aim.body.mass.toFixed(0)} KG · V ${world.aim.body.vel.length().toFixed(1)}`;
    $("ret-label").textContent = "MASS LOCK";
    $("ret-mass").textContent = `${world.aim.body.mass | 0} KG`;
  } else if (world.aim.hit) {
    $("tgt-name").textContent = "ENVIRONMENT";
    $("tgt-meta").textContent = "HARD SURFACE";
    $("ret-label").textContent = "SURFACE";
    $("ret-mass").textContent = "";
  } else {
    $("tgt-name").textContent = "SEARCHING…";
    $("tgt-meta").textContent = "NO MASS LOCK";
    $("ret-label").textContent = "NO LOCK";
    $("ret-mass").textContent = "";
  }

  if (world.aim.hit) {
    const p = world.project(world.aim.point);
    show($("reticle"), p.visible);
    $("reticle").style.left = `${p.x}px`;
    $("reticle").style.top = `${p.y}px`;
    $("reticle").classList.toggle("lock", !!world.aim.body);
  } else {
    show($("reticle"), false);
  }

  const focus = charging || locked;
  if (focus && focus.mapped) {
    const p = world.project(focus.mapped.origin);
    show($("charge-ring"), true);
    $("charge-ring").style.left = `${p.x}px`;
    $("charge-ring").style.top = `${p.y}px`;
    setRing($("charge-arc"), focus.gesture.state === "HOLD" ? 1 : focus.gesture.charge);
    $("charge-txt").textContent = focus.gesture.state === "HOLD" ? "HOLD" : "LOCK";
  } else {
    show($("charge-ring"), false);
  }

  $("pip-fps").textContent = `${tracker.fps || 0} FPS`;

  if (state.fluidLow !== true && (world.fluid.Left < 0.15 || world.fluid.Right < 0.15)) {
    setPill("pill-web", "warn");
  } else if (world.fluid.Left > 0.2 && world.fluid.Right > 0.2) {
    setPill("pill-web", "on");
  }

  if (state.debug) {
    const lines = hands.map((h) => {
      const f = h.gesture.fingers;
      return `${h.id} ${h.gesture.state} sc=${h.gesture.score.toFixed(2)} ${h.gesture.type}\n  i${f ? f.index.toFixed(2) : "-"} m${f ? f.middle.toFixed(2) : "-"} r${f ? f.ring.toFixed(2) : "-"} p${f ? f.pinky.toFixed(2) : "-"}`;
    });
    $("debug").textContent = lines.join("\n") || "no hands";
  }
}

function consumeWorldEvents() {
  for (const ev of world.drainEvents()) {
    if (ev.kind === "attach") {
      audio.attach();
      log(`ATTACH ${ev.label || ""}`, "gold");
    } else if (ev.kind === "stick") {
      audio.attach();
      log("WEB ON CONCRETE", "cyan");
    } else if (ev.kind === "yank") {
      audio.impact(false);
      log(`YANK ${ev.label || ""}`, "gold");
    } else if (ev.kind === "thud") {
      audio.impact(ev.heavy);
    } else if (ev.kind === "ring") {
      audio.ui("ok");
      log(`STYLE RING · ${ev.label}`, "gold");
    } else if (ev.kind === "dry") {
      audio.ui("warn");
      log("CARTRIDGE DRY", "red");
    } else if (ev.kind === "reset") {
      log("ARENA RESET", "cyan");
    }
  }
}

function loop(now = performance.now()) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, world.clock.getDelta());

  let hands;
  if (state.mouseMode) {
    hands = fakeMouseHand();
  } else {
    hands = tracker.update(now);
    const ov = $("overlay");
    if (ov && $("cam").videoWidth) {
      if (ov.width !== $("cam").videoWidth) {
        ov.width = $("cam").videoWidth;
        ov.height = $("cam").videoHeight;
      }
      tracker.drawOverlay(ov, hands.filter((h) => h.landmarks));
    }
  }

  if (state.phase === "calibrate") {
    const live = hands.filter((h) => h.landmarks);
    const best = live.sort((a, b) => b.gesture.score - a.gesture.score)[0];
    const charge = best ? (best.gesture.state === "HOLD" ? 1 : best.gesture.charge) : 0;
    setRing($("cal-arc"), charge);
    if (!best) $("cal-status").textContent = "SEARCHING FOR HAND…";
    else if (best.gesture.state === "CHARGE") $("cal-status").textContent = "HOLD STILL — CONFIRMING 🤟";
    else if (best.gesture.state === "HOLD") $("cal-status").textContent = "LOCK ACQUIRED";
    else $("cal-status").textContent = `POSE ${Math.round(best.gesture.score * 100)}% — INDEX + PINKY UP`;
    if (best?.gesture.justLocked || best?.gesture.state === "HOLD") {
      audio.ui("ok");
      enterSim();
    }
    world.update(dt, hands);
    world.render();
    return;
  }

  world.update(dt, hands);
  handleGestures(hands);
  consumeWorldEvents();
  updateHud(hands, now);
  world.render();
}

async function engageMouse() {
  $("engage").disabled = true;
  $("practice").disabled = true;
  await audio.init();
  await audio.resume();
  try {
    world.init();
  } catch (err) {
    console.error(err);
    return;
  }
  window.addEventListener("resize", () => world.resize());
  state.mouseMode = true;
  setPill("pill-cam", "off");
  setPill("pill-track", "warn");
  show($("boot"), false);
  enterSim();
  log("MOUSE PRACTICE — HOLD CLICK TO CHARGE", "gold");
  loop();
}

$("engage").addEventListener("click", () => engage());
$("practice").addEventListener("click", () => engageMouse());
$("skip-cal").addEventListener("click", () => {
  enterSim();
  log("CALIBRATION SKIPPED — SHOOTER LIVE", "cyan");
});
$("help-close").addEventListener("click", () => show($("help"), false));

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyH") show($("help"), $("help").classList.contains("hidden"));
  if (e.code === "KeyR") world.reset();
  if (e.code === "KeyM") {
    const muted = audio.toggleMute();
    log(muted ? "AUDIO MUTED" : "AUDIO LIVE", "cyan");
  }
  if (e.code === "KeyD") {
    state.debug = !state.debug;
    show($("debug"), state.debug);
  }
  if (e.code === "Space" && state.mouseMode) {
    e.preventDefault();
    state.mouse.down = true;
  }
  if (e.code === "KeyF") state.mouse.alt = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") state.mouse.down = false;
  if (e.code === "KeyF") state.mouse.alt = false;
});
window.addEventListener("mousemove", (e) => {
  state.mouse.x = e.clientX;
  state.mouse.y = e.clientY;
  state.mouse.ndcX = (e.clientX / innerWidth) * 2 - 1;
  state.mouse.ndcY = -(e.clientY / innerHeight) * 2 + 1;
});
window.addEventListener("mousedown", (e) => {
  if (state.mouseMode) {
    state.mouse.down = true;
    state.mouse.alt = e.button === 2;
  }
});
window.addEventListener("mouseup", () => {
  state.mouse.down = false;
});
window.addEventListener("contextmenu", (e) => {
  if (state.mouseMode) e.preventDefault();
});

typeBoot();
