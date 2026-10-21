/* =====================================================================
   AWS Cloud Monitoring Lab – EC2 CPU + CloudWatch alarm + SNS (simulation)
   #BuildwithCloudmessenger
   Everything runs locally. No AWS credentials, no network calls.

   File layout:
     1. CONTENT      – text for the nine steps and the legend
     2. PURE LOGIC   – alarm rules and helpers (no DOM, easy to test)
     3. STATE        – one object holding the whole simulation
     4. TRANSITIONS  – functions that change state
     5. RENDER       – functions that only read state and paint the page
     6. WIRING       – buttons, sliders, timers, starfield
   ===================================================================== */
"use strict";

/* ---------- 1. CONTENT ---------- */
const STEPS = [
  { title: "EC2 Instance", sub: "Aarthi launches his web server.",
    plain: "Aarthi rents a powerful computer in the cloud to run his online shop. Shoppers visit it all day, like customers walking into a store.",
    tech: "Amazon EC2 provides resizable virtual computing capacity. CPU utilization is the percentage of the instance's CPU capacity in use.",
    watch: "Shopper requests flow into the EC2 box and the CPU meter starts moving.",
    points: ["EC2 runs Aarthi's website.", "High CPU can mean a heavy workload; it does not automatically mean the server is failing."],
    event: "Aarthi's shop is online and serving customers." },
  { title: "CPU Metrics", sub: "CPU utilization becomes measurable.",
    plain: "Like a car's dashboard, the server reports how hard its engine is working, again and again.",
    tech: "EC2 publishes the CPUUtilization metric (a percentage) to CloudWatch in the AWS/EC2 namespace.",
    watch: "Purple metric packets travel from EC2 to CloudWatch.",
    points: ["Basic monitoring is free and, for most EC2 metrics, reports every 5 minutes.", "Detailed monitoring gives 1-minute intervals and may cost extra."],
    event: "EC2 started publishing CPUUtilization data points." },
  { title: "CloudWatch", sub: "Metrics appear in the monitoring dashboard.",
    plain: "CloudWatch is the monitoring officer: it writes down every reading and draws the graph so Aarthi can see the trend.",
    tech: "Amazon CloudWatch collects and stores metrics, shows graphs and dashboards, and evaluates alarms.",
    watch: "The CPU graph fills in and the dashboard below starts updating.",
    points: ["CloudWatch observes and alerts; it does not automatically fix performance problems."],
    event: "CloudWatch is graphing CPUUtilization." },
  { title: "Alarm Configuration", sub: "Set a CPU threshold and evaluation period.",
    plain: "Aarthi tells the officer: \"Warn me if the engine stays too hot for a while.\" He picks how hot and for how long.",
    tech: "A CloudWatch alarm watches one metric using a statistic, period, threshold, comparison operator and evaluation periods.",
    watch: "A gold dashed threshold line is drawn across the graph and the alarm box appears. Try the settings in Simulation controls.",
    points: ["Example: CPUUtilization > 80%.", "The settings together decide when the state changes. One sample does not necessarily trigger every configuration."],
    event: "Alarm configured: CPUUtilization above the threshold." },
  { title: "Threshold Breach", sub: "CPU usage rises above the threshold.",
    plain: "Lots of shoppers arrive at once and the engine runs hot.",
    tech: "A breach is a data point that violates the alarm condition. The alarm reacts to its configured evaluation, not to how tall the graph looks.",
    watch: "CPU climbs past the gold line. Use the slider or presets to change the load.",
    points: ["Normal 25%, Moderate 55%, High 85%, Critical 96%.", "With 2 evaluation periods, two consecutive breaching samples are needed in this simulation."],
    event: "CPU is rising above the threshold…" },
  { title: "Alarm State", sub: "The CloudWatch alarm changes state.",
    plain: "The officer's light changes: green means fine, red means trouble, amber means \"I can't see the readings\".",
    tech: "Alarm states: OK (condition not breached), ALARM (condition breached), INSUFFICIENT_DATA (not enough data to decide).",
    watch: "The ALARM pill lights up and an alarm signal moves toward SNS. Use \"Stop sending metrics\" to see INSUFFICIENT_DATA.",
    points: ["An alarm can publish to an SNS topic when it enters selected states."],
    event: "Alarm state changed to ALARM." },
  { title: "Amazon SNS", sub: "The alarm triggers a configured notification action.",
    plain: "SNS is the messenger. The officer hands him the message and he delivers it to everyone on the list.",
    tech: "Amazon Simple Notification Service topics distribute published messages to subscribed endpoints. Topic: aarthi-ec2-cpu-alerts.",
    watch: "The alarm message travels from CloudWatch to the SNS topic.",
    points: ["The SNS topic must be set as an alarm action for the relevant state.", "Email delivery needs a subscription that has been confirmed."],
    event: "CloudWatch published the alarm message to the SNS topic." },
  { title: "Email Alert", sub: "Aarthi receives a simulated notification.",
    plain: "The messenger puts an email in Aarthi's inbox so he can act before shoppers notice a slow site.",
    tech: "SNS delivers the message to the email subscription endpoint.",
    watch: "An envelope travels to the inbox. Then try Acknowledge alert and Recover server load.",
    points: ["This message is simulated. No email is sent."],
    event: "SNS is delivering the email to Aarthi." },
  { title: "Complete Architecture", sub: "Understand the entire monitoring workflow.",
    plain: "Server reports, officer watches, messenger tells Aarthi. Aarthi still decides what to do.",
    tech: "EC2 → CloudWatch metric → CloudWatch alarm → SNS topic → email subscription → Aarthi.",
    watch: "All components are visible and metrics, alarm signals and envelopes keep moving.",
    points: ["This design detects and notifies. It does not reduce CPU or repair the instance.", "Automatic remediation or scaling requires additional configuration."],
    event: "Complete monitoring workflow is active." }
];

const LEGEND = [
  { icon: "🟣", label: "Metric packet", desc: "A purple dot: one CPU reading travelling from EC2 to CloudWatch." },
  { icon: "⚠", label: "Alarm signal", desc: "A warning that travels when a CloudWatch alarm changes state." },
  { icon: "✉", label: "Envelope", desc: "The email notification that SNS delivers to Aarthi." },
  { icon: "🎚", label: "CPU gauge", desc: "The bar on the EC2 box showing the current simulated CPU percentage." },
  { icon: "✅", label: "Green check", desc: "Everything is normal, or the simulated notification was delivered." },
  { icon: "🔴", label: "Red warning", desc: "The alarm condition has been breached." },
  { icon: "┅", label: "Gold dashed line", desc: "The CPU threshold you configured. Crossing it for long enough triggers the alarm." },
  { icon: "📈", label: "Chart", desc: "The history of recent CPU readings." },
  { icon: "☁", label: "Cloud icon", desc: "Marks the AWS Cloud, where EC2, CloudWatch and SNS run." }
];

const PRESETS = { normal: 25, moderate: 55, high: 85, critical: 96 };
const SCENE_CPU = { 1: 25, 2: 76, 3: 76, 4: 76, 5: 76, 6: 92, 7: 92, 8: 92, 9: 92 };
const JITTER = [0, 1, 0, -1];   // deterministic tiny wobble so the line looks alive
const MAX_HISTORY = 40, CHART_POINTS = 30;

/* ---------- 2. PURE LOGIC (no DOM) ---------- */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function compare(value, op, threshold) {
  switch (op) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    default: return false;
  }
}

/* Simplified CloudWatch rule: look at the last N data points (null = missing).
   - fewer than N points, or any missing  -> INSUFFICIENT_DATA
   - all N breach the threshold           -> ALARM
   - otherwise                            -> OK                                */
function evaluate(history, cfg) {
  const last = history.slice(-cfg.n);
  if (last.length < cfg.n || last.some(v => v === null)) return "INSUFFICIENT_DATA";
  return last.every(v => compare(v, cfg.op, cfg.thr)) ? "ALARM" : "OK";
}

/* Build the sample history shown when a step is selected. */
function buildHistory(step) {
  const base = [];
  for (let i = 0; i < 16; i++) base.push(20 + (i % 5) * 2);
  const tail = step < 6 ? [24, 35, 48, 76] : [24, 35, 48, 76, 92, 92, 92, 92, 92];
  return base.concat(tail);
}

function chartPoints(history, x0, y0, w, h) {
  const win = history.slice(-CHART_POINTS);
  const dx = w / (CHART_POINTS - 1), out = [];
  win.forEach((v, i) => { if (v !== null) out.push([+(x0 + i * dx).toFixed(1), +(y0 + h * (1 - v / 100)).toFixed(1)]); });
  return out;
}
const toStr = pts => pts.map(p => p.join(",")).join(" ");

/* ---------- 3. STATE (single source of truth) ---------- */
const DEFAULTS = { name: "aarthi-ec2-high-cpu", thr: 80, op: ">", n: 2, period: "5 minutes", sampleMs: 1000 };
const s = {
  step: 1, playing: false, cpu: 25, history: [], alarm: "NONE",
  phase: "idle",            // idle | toSns | toEmail | delivered
  mail: null, acked: false, noData: false, event: STEPS[0].event,
  tickN: 0, theme: "dark", motionReduced: false,
  cfg: Object.assign({}, DEFAULTS)
};
const timers = { play: null, tick: null, notify: [], scene: null };

/* ---------- 4. TRANSITIONS ---------- */
function setEvent(text) { s.event = text; if (typeof document !== "undefined") $("live").textContent = text; }

function buildMail(isTest) {
  const seen = s.history.filter(v => v !== null);
  const observed = seen.length ? seen[seen.length - 1] : s.cpu;
  return {
    subject: (isTest ? "[TEST] " : "") + "ALERT — EC2 CPU Utilization High",
    body: "Your EC2 instance has exceeded the configured CPU utilization threshold.\n\n" +
      "Instance: i-example123\nMetric: CPUUtilization\nObserved CPU: " + observed + "%\n" +
      "Configured threshold: " + s.cfg.thr + "%\nAlarm state: " + (isTest ? "ALARM (test message)" : "ALARM") +
      "\n\nPlease investigate the workload and take appropriate action.\n\n(Simulated message. No real email was sent.)"
  };
}

function clearNotifyTimers() { timers.notify.forEach(clearTimeout); timers.notify = []; }

/* SNS flow: toSns -> toEmail -> delivered. Before step 8 the email endpoint is not
   on screen yet, so the flow pauses at the SNS topic. */
function notify() {
  clearNotifyTimers();
  s.phase = "toSns";
  setEvent("CloudWatch published the alarm message to the SNS topic.");
  if (s.step >= 8) {
    timers.notify.push(setTimeout(() => { s.phase = "toEmail"; setEvent("SNS is delivering the email to Aarthi."); render(); }, 1500));
    timers.notify.push(setTimeout(() => { s.phase = "delivered"; setEvent("Simulated email delivered to Aarthi's inbox."); render(); }, 3000));
  }
}

function onTransition(prev, next) {
  if (prev === "NONE") return;
  if (next === "ALARM") {
    setEvent("Alarm state changed " + prev + " → ALARM.");
    if (s.step >= 7) { s.acked = false; s.mail = buildMail(false); notify(); }
    else setEvent("Alarm is in ALARM, but no SNS alarm action is shown until step 7.");
  } else if (next === "OK") {
    setEvent("Alarm state changed " + prev + " → OK. (Notifying on OK needs its own alarm action.)");
  } else if (next === "INSUFFICIENT_DATA") {
    setEvent("Alarm state changed " + prev + " → INSUFFICIENT_DATA: not enough metric data.");
  }
}

function recomputeAlarm() {
  if (s.step < 4) { s.alarm = "NONE"; return; }
  const next = evaluate(s.history, s.cfg);
  if (next !== s.alarm) { const prev = s.alarm; s.alarm = next; onTransition(prev, next); }
}

/* One simulated metric sample. */
function tick() {
  if (s.step < 2) return;
  const v = s.noData ? null : clamp(s.cpu + JITTER[s.tickN % 4], 0, 100);
  s.tickN++;
  s.history.push(v);
  if (s.history.length > MAX_HISTORY) s.history.shift();
  recomputeAlarm();
  render();
}

function pushSamples(value, count) { for (let i = 0; i < count; i++) s.history.push(value); s.history = s.history.slice(-MAX_HISTORY); }

function setCpu(v, sampleNow) {
  s.cpu = clamp(Math.round(v), 0, 100);
  if (sampleNow) tick(); else render();
}

/* Apply the scripted scene for a step (used by step buttons, Play and Reset). */
function applyScene(n) {
  clearNotifyTimers(); clearTimeout(timers.scene);
  s.step = n; s.noData = false; s.acked = false; s.tickN = 0;
  s.cpu = SCENE_CPU[n];
  s.history = n >= 2 ? buildHistory(n) : [];
  s.alarm = n >= 4 ? evaluate(s.history, s.cfg) : "NONE";
  s.phase = n === 7 ? "toSns" : n === 8 ? "toEmail" : n >= 9 ? "delivered" : "idle";
  s.mail = n >= 7 && s.alarm === "ALARM" ? buildMail(false) : null;
  if (n >= 7 && !s.mail) s.phase = "idle";
  setEvent(STEPS[n - 1].event);
  if (n === 8 && s.mail) timers.notify.push(setTimeout(() => { s.phase = "delivered"; setEvent("Simulated email delivered to Aarthi's inbox."); render(); }, 1800));
  if (n === 5) timers.scene = setTimeout(() => setCpu(92, true), 1200);   // the shoppers arrive
}

function goToStep(n, scene) {
  n = clamp(n, 1, 9);
  if (scene === false) { s.step = n; recomputeAlarm(); } else applyScene(n);
  render();
  document.querySelectorAll('[data-step="' + n + '"]').forEach(el => {   // glow newly revealed parts
    el.classList.remove("glow"); void el.getBoundingClientRect(); el.classList.add("glow");
    setTimeout(() => el.classList.remove("glow"), 1400);
  });
}

function pause() { s.playing = false; clearInterval(timers.play); render(); }
function play() {
  if (s.step >= 9) goToStep(1);
  s.playing = true; clearInterval(timers.play);
  timers.play = setInterval(() => { if (s.step >= 9) pause(); else goToStep(s.step + 1); }, 5000);
  render();
}
function reset() {
  pause(); clearNotifyTimers();
  s.cfg = Object.assign({}, DEFAULTS);
  syncControls(); restartTick();
  goToStep(1);
}

function simulateAlarm() {
  if (s.step < 6) { goToStep(6); return; }
  s.noData = false; s.cpu = 96;
  pushSamples(96, s.cfg.n);
  setEvent("Simulated alarm: CPU set to 96% for " + s.cfg.n + " samples.");
  recomputeAlarm(); render();
}
function sendTest() {
  if (s.step < 8) { s.step = 8; }
  s.mail = buildMail(s.alarm !== "ALARM");
  s.acked = false;
  notify(); render();
}
function acknowledge() {
  if (s.mail && s.phase === "delivered") { s.acked = true; setEvent("Aarthi acknowledged the alert (simulated)."); }
  else setEvent("Nothing to acknowledge yet. Wait for the notification to be delivered.");
  render();
}
function recover() {
  s.noData = false; s.cpu = SCENE_CPU[1];
  pushSamples(25, s.cfg.n);
  setEvent("Server load restored to normal (25%).");
  recomputeAlarm(); render();
}

/* ---------- 5. RENDER (reads state, paints DOM) ---------- */
const $ = id => document.getElementById(id);
const COLORS = { green: "var(--green)", gold: "var(--gold)", red: "var(--red)" };
const STATE_INFO = {
  NONE: ["Not created", "gold", ""],
  OK: ["OK", "green", "Condition not breached"],
  ALARM: ["ALARM", "red", "Condition breached"],
  INSUFFICIENT_DATA: ["INSUFFICIENT_DATA", "gold", "Not enough data to decide"]
};

function cpuColor() { return s.cpu >= s.cfg.thr ? COLORS.red : s.cpu >= s.cfg.thr - 20 ? COLORS.gold : COLORS.green; }

function render() {
  const c = s.cfg, info = STATE_INFO[s.alarm];

  // Step navigation
  document.querySelectorAll(".stepbtn").forEach((b, i) => {
    b.classList.toggle("done", i + 1 < s.step);
    if (i + 1 === s.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
  });

  // Reveal diagram parts
  document.querySelectorAll("#diagram .rv").forEach(el => {
    const n = +el.dataset.step, full = +(el.dataset.full || 0);
    const visible = s.step >= n, ghost = full && s.step < full;
    el.classList.toggle("on", visible && !ghost);
    el.classList.toggle("ghost", visible && !!ghost);
  });

  // EC2 meter
  $("cpuFill").setAttribute("width", (146 * s.cpu / 100).toFixed(1));
  $("cpuFill").style.fill = cpuColor();
  $("cpuText").textContent = s.cpu + "%";

  // CloudWatch mini graph
  const gy = 305 - c.thr;
  $("gLine").setAttribute("points", s.step >= 2 ? toStr(chartPoints(s.history, 330, 205, 260, 100)) : "");
  $("gThr").setAttribute("y1", gy); $("gThr").setAttribute("y2", gy);
  $("gThrTxt").setAttribute("y", gy - 4); $("gThrTxt").textContent = c.thr + "%";
  $("waitTxt").style.display = s.step >= 3 ? "none" : "";

  // Alarm box
  $("alarmName").textContent = c.name || "(unnamed alarm)";
  $("alarmExpr").textContent = "CPUUtilization " + c.op + " " + c.thr + "% · " + c.n + " of " + c.n + " · " + c.period;
  [["OK", "pillOK"], ["ALARM", "pillALARM"], ["INSUFFICIENT_DATA", "pillINS"]].forEach(([st, id]) => {
    const r = $(id).querySelector("rect");
    r.setAttribute("class", "pill" + (s.alarm === st ? " pill-on-" + (st === "INSUFFICIENT_DATA" ? "INS" : st) : ""));
  });
  $("stateBig").textContent = info[0] === "Not created" ? "—" : info[0];
  $("stateBig").style.fill = COLORS[info[1]];
  $("stateNote").textContent = info[2];

  // SNS + email boxes
  const snsShort = { idle: "Idle", toSns: "Publishing…", toEmail: "Delivering…", delivered: "Delivered ✓" };
  $("snsStatusTxt").textContent = snsShort[s.phase];
  $("mailStatus").textContent = s.phase === "delivered" && s.mail ? (s.acked ? "Acknowledged ✓" : "New alert ✉") : s.phase === "toEmail" ? "Arriving…" : "No alert yet";

  // Moving objects
  $("pkReq").classList.toggle("show", s.step >= 1);
  $("pkMetric").classList.toggle("show", s.step >= 2 && !s.noData);
  $("pkAlarm").classList.toggle("show", s.step >= 6 && (s.phase === "toSns" || (s.alarm === "ALARM" && (s.phase === "idle" || s.step === 9))));
  $("pkMail").classList.toggle("show", s.phase === "toEmail" || (s.step === 9 && s.alarm === "ALARM"));
  $("pkInner").classList.toggle("show", s.step >= 4 && !s.noData);

  // Caption
  const st = STEPS[s.step - 1];
  $("capTitle").textContent = "Step " + s.step + ": " + st.title;
  $("capPlain").textContent = st.plain; $("capTech").textContent = st.tech; $("capWatch").textContent = st.watch;
  const ul = $("capPoints"); ul.textContent = "";
  st.points.forEach(p => { const li = document.createElement("li"); li.textContent = p; ul.appendChild(li); });
  $("readings").hidden = s.step !== 2;

  // Controls stay in sync with state
  $("cpuSlider").value = s.cpu; $("cpuVal").textContent = s.cpu + "%";
  $("thrSlider").value = c.thr; $("thrVal").textContent = c.thr + "%";
  $("playBtn").setAttribute("aria-pressed", String(s.playing)); $("pauseBtn").setAttribute("aria-pressed", String(!s.playing));
  $("noDataBtn").setAttribute("aria-pressed", String(s.noData));
  $("noDataBtn").textContent = s.noData ? "Resume sending metrics" : "Stop sending metrics";

  // Dashboard
  $("dCpu").textContent = s.cpu + "%"; $("dCpu").style.color = cpuColor();
  $("dThr").textContent = c.op + " " + c.thr + "%";
  $("dState").textContent = info[0]; $("dState").style.color = COLORS[info[1]];
  $("dHealth").textContent = s.cpu >= 95 ? "Running · heavily loaded" : "Running · healthy";
  $("dEvent").textContent = s.event;
  const snsLong = s.step < 7 ? "No alarm action configured yet" :
    { idle: "Topic ready · waiting for an alarm", toSns: "Published to aarthi-ec2-cpu-alerts…", toEmail: "Delivering to email subscriber…",
      delivered: "Delivered (simulated)" + (s.acked ? " · acknowledged" : "") }[s.phase];
  $("dSns").textContent = snsLong;
  const dp = chartPoints(s.history, 30, 10, 360, 150);
  $("dLine").setAttribute("points", s.step >= 2 ? toStr(dp) : "");
  $("dArea").setAttribute("points", s.step >= 2 && dp.length > 1 ? toStr(dp) + " " + dp[dp.length - 1][0] + ",160 " + dp[0][0] + ",160" : "");
  const dy = 160 - 1.5 * c.thr;
  $("dThrLine").setAttribute("y1", dy); $("dThrLine").setAttribute("y2", dy);
  $("dThrLine").style.display = s.step >= 4 ? "" : "none";
  $("gThrG").style.display = "";

  // Inbox + summary
  const showMail = !!s.mail && s.phase === "delivered" && s.step >= 8;
  $("inbox").hidden = !showMail;
  $("inboxBadge").textContent = showMail ? (s.acked ? "acknowledged" : "1 new") : "empty";
  if (showMail) { $("mailSubject").textContent = s.mail.subject; $("mailBody").textContent = s.mail.body; }
  $("summary").hidden = s.step !== 9;
}

/* ---------- 6. WIRING ---------- */
function syncControls() {
  const c = s.cfg;
  $("nameIn").value = c.name; $("opSel").value = c.op; $("nSel").value = String(c.n);
  $("periodSel").value = c.period; $("sampleSel").value = String(c.sampleMs);
}
function restartTick() { clearInterval(timers.tick); timers.tick = setInterval(tick, s.cfg.sampleMs); }

function applyMotion() {
  document.documentElement.dataset.motion = s.motionReduced ? "reduce" : "full";
  const svg = $("diagram");
  if (svg.pauseAnimations) { if (s.motionReduced) svg.pauseAnimations(); else svg.unpauseAnimations(); }
  $("motionBtn").textContent = "Motion: " + (s.motionReduced ? "reduced" : "on");
  $("motionBtn").setAttribute("aria-pressed", String(s.motionReduced));
}

function buildNav() {
  const ol = $("stepNav");
  STEPS.forEach((st, i) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.className = "stepbtn"; b.setAttribute("aria-label", "Step " + (i + 1) + ": " + st.title + ". " + st.sub);
    const n = document.createElement("span"); n.className = "n"; n.textContent = i + 1;
    const d = document.createElement("div"), t = document.createElement("b"), sm = document.createElement("small");
    t.textContent = st.title; sm.textContent = st.sub; d.append(t, sm); b.append(n, d);
    b.addEventListener("click", () => { pause(); goToStep(i + 1); });
    li.appendChild(b); ol.appendChild(li);
  });
  ol.addEventListener("keydown", e => {   // arrow keys move between steps
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault(); pause(); goToStep(s.step + dir);
    ol.querySelectorAll(".stepbtn")[s.step - 1].focus();
  });
}

function buildLegend() {
  const ul = $("legend");
  LEGEND.forEach(item => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-pressed", "false"); b.textContent = item.icon + " " + item.label;
    b.addEventListener("click", () => {
      ul.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true"); $("legendDesc").textContent = item.label + ": " + item.desc;
    });
    li.appendChild(b); ul.appendChild(li);
  });
}

function buildReadings() {
  const box = $("readings");
  [24, 35, 48, 76].forEach(v => { const c = document.createElement("span"); c.className = "chip"; c.textContent = v + "%"; box.appendChild(c); });
  const note = document.createElement("small"); note.className = "muted"; note.textContent = "Simulated educational data"; box.appendChild(note);
}

function startSky() {   // gentle glowing particles; skipped when motion is reduced
  const cv = $("sky"), ctx = cv.getContext("2d"); let W, H;
  const dots = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97 % 100) / 100, y: (i * 61 % 100) / 100, r: 0.6 + (i % 4) * 0.5, v: 0.00004 + (i % 5) * 0.00002 }));
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  size(); addEventListener("resize", size);
  (function frame() {
    ctx.clearRect(0, 0, W, H);
    if (!s.motionReduced && s.theme === "dark") {
      ctx.fillStyle = "rgba(170,200,255,.7)";
      dots.forEach(d => { d.y -= d.v * 16; if (d.y < 0) d.y = 1; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r, 0, 6.283); ctx.fill(); });
    }
    requestAnimationFrame(frame);
  })();
}

function init() {
  s.motionReduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  buildNav(); buildLegend(); buildReadings(); syncControls(); applyMotion(); startSky();

  $("playBtn").addEventListener("click", play);
  $("pauseBtn").addEventListener("click", pause);
  $("resetBtn").addEventListener("click", reset);
  $("themeBtn").addEventListener("click", () => {
    s.theme = s.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = s.theme;
    $("themeBtn").textContent = s.theme === "dark" ? "☀ Light theme" : "☾ Dark theme";
    $("themeBtn").setAttribute("aria-pressed", String(s.theme === "light"));
  });
  $("motionBtn").addEventListener("click", () => { s.motionReduced = !s.motionReduced; applyMotion(); });

  $("cpuSlider").addEventListener("input", e => setCpu(+e.target.value, false));
  $("cpuSlider").addEventListener("change", e => setCpu(+e.target.value, true));
  document.querySelectorAll(".preset").forEach(b => b.addEventListener("click", () => {
    setCpu(PRESETS[b.dataset.preset], true);
  }));
  $("thrSlider").addEventListener("input", e => { s.cfg.thr = +e.target.value; recomputeAlarm(); render(); });
  $("nameIn").addEventListener("input", e => { s.cfg.name = e.target.value; render(); });
  $("opSel").addEventListener("change", e => { s.cfg.op = e.target.value; recomputeAlarm(); render(); });
  $("nSel").addEventListener("change", e => { s.cfg.n = +e.target.value; recomputeAlarm(); render(); });
  $("periodSel").addEventListener("change", e => { s.cfg.period = e.target.value; render(); });
  $("sampleSel").addEventListener("change", e => { s.cfg.sampleMs = +e.target.value; restartTick(); });

  $("simAlarmBtn").addEventListener("click", simulateAlarm);
  $("testBtn").addEventListener("click", sendTest);
  $("ackBtn").addEventListener("click", acknowledge);
  $("recoverBtn").addEventListener("click", recover);
  $("noDataBtn").addEventListener("click", () => {
    s.noData = !s.noData;
    setEvent(s.noData ? "Metrics stopped. The alarm needs data to decide." : "Metrics are flowing again.");
    render();
  });

  restartTick();
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearInterval(timers.tick); else restartTick(); });
  goToStep(1);
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
if (typeof module !== "undefined") module.exports = { evaluate, compare, buildHistory, chartPoints, clamp };
