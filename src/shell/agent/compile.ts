export type CompileMode = "ask" | "edit" | "auto";

export type CompileResult = {
  name: string;
  summary: string;
  html: string | null;
  kind: string;
};

const MINI_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  font-family: ui-sans-serif, system-ui, sans-serif;
  background: #f3eee6;
  color: #1c1814;
  padding: 22px 16px 32px;
  line-height: 1.45;
}
h1 {
  font-family: "Iowan Old Style", Palatino, Georgia, serif;
  font-weight: 560;
  font-size: 34px;
  letter-spacing: -0.03em;
  margin: 0;
  line-height: 1.05;
}
.kicker {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #6f675c;
}
.sub { color: #6f675c; margin: 8px 0 0; }
.row { display: flex; gap: 8px; margin-top: 16px; align-items: stretch; }
.stack { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
input, textarea, select, button { font: inherit; color: inherit; }
.field, textarea, select {
  width: 100%;
  border: 1px solid #e4d9c8;
  background: #fffaf3;
  border-radius: 12px;
  padding: 12px 14px;
  outline: none;
  min-height: 44px;
}
textarea { min-height: 180px; resize: vertical; }
button.primary {
  border: 0;
  background: #a86b2a;
  color: #fffaf3;
  border-radius: 12px;
  padding: 12px 16px;
  min-height: 44px;
}
button.ghost {
  border: 0;
  background: transparent;
  color: #6f675c;
  min-height: 44px;
  padding: 8px 10px;
}
button.choice {
  border: 1px solid #e4d9c8;
  background: #fffaf3;
  border-radius: 12px;
  min-height: 44px;
  padding: 8px 12px;
}
button.choice.on, button.on {
  background: #a86b2a;
  color: #fffaf3;
  border-color: #a86b2a;
}
.list { list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; gap: 8px; }
.list li, .card {
  background: #fffaf3;
  border: 1px solid #e4d9c8;
  border-radius: 16px;
  padding: 12px 14px;
}
.list li { display: flex; align-items: center; gap: 10px; }
.grow { flex: 1; min-width: 0; }
.done { text-decoration: line-through; color: #6f675c; }
.empty { color: #6f675c; margin-top: 18px; }
.stat {
  font-family: Georgia, serif;
  font-size: 64px;
  letter-spacing: -0.04em;
  margin: 8px 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 16px; }
.days button { min-height: 56px; border-radius: 14px; border: 1px solid #e4d9c8; background: #fffaf3; padding: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cols { display: grid; gap: 10px; }
@media (min-width: 680px) { .cols.three { grid-template-columns: 1fr 1fr 1fr; } }
.flip {
  min-height: 180px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 24px;
  font-family: Georgia, serif;
  font-size: 28px;
  letter-spacing: -0.03em;
}
.meter { height: 10px; border-radius: 99px; background: #e4d9c8; overflow: hidden; }
.meter span { display: block; height: 100%; background: #a86b2a; }
`;

const RUNTIME = `
function uid(){return Math.random().toString(36).slice(2,9)}
async function loadState(fallback){
  for (var attempt = 0; attempt < 8; attempt++) {
    try {
      if (!window.shell) throw new Error("missing");
      var raw = await window.shell.storage.get("state");
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      await new Promise(function(resolve){ setTimeout(resolve, 40); });
    }
  }
  return fallback;
}
async function saveState(v){
  try { if (window.shell) await window.shell.storage.set("state", JSON.stringify(v)); } catch (e) {}
}
function iso(d){
  var y=d.getFullYear();
  var m=String(d.getMonth()+1).padStart(2,"0");
  var da=String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+da;
}
`;

function esc(value: string) {
  return value
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;")
    .replaceAll("'", "\u0026#39;");
}

function page(title: string, kicker: string, inner: string, script: string) {
  const safe = (RUNTIME + "\n(async function(){\n" + script + "\n})();").replace(
    /<\/script/gi,
    "<\\/script",
  );
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${MINI_CSS}</style></head><body><p class="kicker">${esc(kicker)}</p><h1>${esc(title)}</h1>${inner}<script>${safe}</script></body></html>`;
}

function clip(value: string, max = 28) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function detect(prompt: string) {
  const s = prompt.toLowerCase();
  if (/flash\s?card|vocab|study deck|quiz/.test(s)) return "cards";
  if (/pomodoro|focus session|25 minute/.test(s)) return "pomodoro";
  if (/countdown|days until|count down|until my/.test(s)) return "countdown";
  if (/scoreboard|score keeper|two player|points/.test(s)) return "score";
  if (/\btip\b|gratuity|split the bill|split a bill/.test(s)) return "tip";
  if (/convert|celsius|fahrenheit|miles|kilogram/.test(s)) return "convert";
  if (/expense|budget|spent|spend|money|receipt/.test(s)) return "money";
  if (/password|passphrase/.test(s)) return "password";
  if (/water|hydrat/.test(s)) return "water";
  if (/kanban|column board/.test(s)) return "kanban";
  if (/journal|diary|gratitude|mood/.test(s)) return "journal";
  if (/decide|choose between|decision|coin flip|pick one/.test(s)) return "decide";
  if (/habit|streak|every day|daily /.test(s)) return "habit";
  if (/timer|stopwatch|alarm/.test(s)) return "timer";
  if (/counter|tally|\bcount\b/.test(s)) return "counter";
  if (/grocery|shopping/.test(s)) return "todo";
  if (/todo|to-do|checklist|task list/.test(s)) return "todo";
  if (/note/.test(s)) return "journal";
  return "tracker";
}

function appName(prompt: string, kind: string) {
  const quoted = prompt.match(/["“]([^"”]+)["”]/);
  if (quoted?.[1]) return clip(quoted[1]);
  let s = prompt.replace(
    /^(please\s+)?(build|make|create|design|write|i want|i need|can you|give me)\s+(me\s+)?/i,
    "",
  );
  s = s.replace(/^(a|an|the)\s+/i, "");
  const forMatch = s.match(/\b(?:for|about)\s+(.+)/i);
  if (forMatch?.[1]) s = forMatch[1];
  else if (/countdown|timer/.test(prompt)) {
    const toMatch = s.match(/\bto\s+(?:a|an|the|my)?\s*(.+)/i);
    if (toMatch?.[1]) s = toMatch[1];
  } else {
    const ofMatch = s.match(/\bof\s+(.+)/i);
    if (ofMatch?.[1]) s = ofMatch[1];
  }
  s = s
    .replace(/\b(app|mini-app|tracker|tool|please|generator|calculator|board)\b/gi, " ")
    .replace(/\bin\s+\d+\s+days?\b/gi, " ")
    .replace(/[.?!].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.length < 2) {
    const fallback: Record<string, string> = {
      cards: "Cards",
      pomodoro: "Focus",
      countdown: "Countdown",
      score: "Scoreboard",
      tip: "Tip",
      convert: "Convert",
      money: "Spending",
      password: "Passphrase",
      water: "Water",
      kanban: "Board",
      journal: "Journal",
      decide: "Decide",
      habit: "Habit",
      timer: "Timer",
      counter: "Counter",
      todo: "List",
      tracker: "Log",
    };
    return fallback[kind] ?? "App";
  }
  return clip(titleCase(s));
}

function summaryFor(kind: string, name: string) {
  const lines: Record<string, string> = {
    todo: `${name} keeps a private checklist on this device.`,
    habit: `${name} marks the days you showed up and counts the streak.`,
    money: `${name} logs amounts and keeps a running total.`,
    countdown: `${name} counts the days to a date you choose.`,
    pomodoro: `${name} runs a 25-minute focus clock with short breaks.`,
    score: `${name} keeps score for two sides.`,
    tip: `${name} splits a bill and a tip.`,
    convert: `${name} converts temperature, length, and weight.`,
    cards: `${name} flips flashcards you write yourself.`,
    journal: `${name} is a page that saves as you type.`,
    decide: `${name} picks one option from a list you edit.`,
    counter: `${name} is a big tally you can step up or down.`,
    water: `${name} fills a day of glasses.`,
    kanban: `${name} is a three-column board.`,
    password: `${name} makes a passphrase and leaves it on screen to copy.`,
    timer: `${name} counts down from the minutes you set.`,
    tracker: `${name} logs entries you add by hand.`,
  };
  return lines[kind] ?? `${name} is a small tool that stays on this device.`;
}

function parseTarget(prompt: string) {
  const isoDate = prompt.match(/\d{4}-\d{2}-\d{2}/);
  if (isoDate) return isoDate[0];
  const inDays = prompt.match(/(\d+)\s+days?/i);
  const base = new Date();
  if (inDays) {
    base.setDate(base.getDate() + Number(inDays[1]));
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(base.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  base.setDate(base.getDate() + 30);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseOptions(prompt: string) {
  const quoted = [...prompt.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]?.trim() ?? "");
  if (quoted.length >= 2) return quoted.slice(0, 8);
  const parts = prompt
    .split(/,|\bor\b|\band\b|\//i)
    .map((part) =>
      part
        .replace(/^(please\s+)?(build|make|create|a|an|the|app|that|to|decide|choose|between|pick)\b/gi, "")
        .replace(/[.?!]/g, "")
        .trim(),
    )
    .filter((part) => part.length > 1 && part.length < 28);
  if (parts.length >= 2) return parts.slice(0, 8);
  return ["Stay in", "Go out", "Start small"];
}

function todoScript() {
  return `
var items = await loadState([]);
var list = document.getElementById("list");
var empty = document.getElementById("empty");
function draw(){
  list.innerHTML = "";
  empty.hidden = items.length > 0;
  items.forEach(function(item){
    var li = document.createElement("li");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.done;
    cb.addEventListener("change", async function(){
      item.done = cb.checked;
      await saveState(items);
      draw();
    });
    var span = document.createElement("span");
    span.className = "grow" + (item.done ? " done" : "");
    span.textContent = item.text;
    var del = document.createElement("button");
    del.className = "ghost";
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", async function(){
      items = items.filter(function(x){ return x.id !== item.id; });
      await saveState(items);
      draw();
    });
    li.append(cb, span, del);
    list.append(li);
  });
}
document.getElementById("f").addEventListener("submit", async function(e){
  e.preventDefault();
  var input = document.getElementById("q");
  var text = input.value.trim();
  if (!text) return;
  items.unshift({ id: uid(), text: text, done: false });
  input.value = "";
  await saveState(items);
  draw();
});
draw();
`;
}

function habitScript() {
  return `
var state = await loadState({ days: [] });
if (!state.days) state.days = [];
var wrap = document.getElementById("days");
var streakEl = document.getElementById("streak");
function weekStart(d){
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function streakOf(days){
  var set = {};
  days.forEach(function(day){ set[day] = true; });
  var d = new Date();
  if (!set[iso(d)]) d.setDate(d.getDate() - 1);
  var n = 0;
  while (set[iso(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function draw(){
  wrap.innerHTML = "";
  var start = weekStart(new Date());
  var labels = ["S","M","T","W","T","F","S"];
  for (var i = 0; i < 7; i++) {
    var day = new Date(start);
    day.setDate(start.getDate() + i);
    var key = iso(day);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = state.days.indexOf(key) >= 0 ? "on" : "";
    btn.innerHTML = "<div>" + labels[i] + "</div><div>" + day.getDate() + "</div>";
    btn.addEventListener("click", function(k){
      return async function(){
        if (state.days.indexOf(k) >= 0) state.days = state.days.filter(function(d){ return d !== k; });
        else state.days.push(k);
        await saveState(state);
        draw();
      };
    }(key));
    wrap.append(btn);
  }
  streakEl.textContent = String(streakOf(state.days));
}
draw();
`;
}

function moneyScript() {
  return `
var rows = await loadState([]);
var list = document.getElementById("list");
var total = document.getElementById("total");
function money(n){ return (Math.round(n * 100) / 100).toFixed(2); }
function draw(){
  var sum = rows.reduce(function(a, r){ return a + Number(r.amount || 0); }, 0);
  total.textContent = money(sum);
  list.innerHTML = "";
  document.getElementById("empty").hidden = rows.length > 0;
  rows.forEach(function(row){
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.className = "grow";
    span.textContent = row.note || "Entry";
    var amt = document.createElement("strong");
    amt.textContent = money(Number(row.amount));
    var del = document.createElement("button");
    del.className = "ghost";
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", async function(){
      rows = rows.filter(function(r){ return r.id !== row.id; });
      await saveState(rows);
      draw();
    });
    li.append(span, amt, del);
    list.append(li);
  });
}
document.getElementById("f").addEventListener("submit", async function(e){
  e.preventDefault();
  var amount = Number(document.getElementById("amt").value);
  var note = document.getElementById("note").value.trim();
  if (!amount) return;
  rows.unshift({ id: uid(), amount: amount, note: note });
  document.getElementById("amt").value = "";
  document.getElementById("note").value = "";
  await saveState(rows);
  draw();
});
draw();
`;
}

function countdownScript(target: string) {
  return `
var state = await loadState({ target: ${JSON.stringify(target)} });
var input = document.getElementById("when");
var big = document.getElementById("big");
var label = document.getElementById("label");
input.value = state.target;
function draw(){
  var target = new Date(state.target + "T00:00:00");
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  big.textContent = String(Math.abs(diff));
  label.textContent = diff === 0 ? "Today" : diff > 0 ? "days to go" : "days since";
}
input.addEventListener("change", async function(){
  state.target = input.value;
  await saveState(state);
  draw();
});
draw();
`;
}

function pomodoroScript() {
  return `
var left = 25 * 60;
var running = false;
var mode = "focus";
var timer = null;
var display = document.getElementById("display");
var modeEl = document.getElementById("mode");
function fmt(s){
  var m = Math.floor(s / 60);
  var r = s % 60;
  return String(m).padStart(2,"0") + ":" + String(r).padStart(2,"0");
}
function render(){ display.textContent = fmt(left); modeEl.textContent = mode === "focus" ? "Focus" : "Break"; }
function tick(){
  if (left <= 1) {
    mode = mode === "focus" ? "break" : "focus";
    left = mode === "focus" ? 25 * 60 : 5 * 60;
    if (window.shell) window.shell.toast(mode === "break" ? "Break started" : "Back to focus");
  } else left -= 1;
  render();
}
document.getElementById("start").onclick = function(){
  if (running) { clearInterval(timer); running = false; this.textContent = "Start"; return; }
  running = true;
  this.textContent = "Pause";
  timer = setInterval(tick, 1000);
};
document.getElementById("reset").onclick = function(){
  clearInterval(timer); running = false; mode = "focus"; left = 25 * 60;
  document.getElementById("start").textContent = "Start";
  render();
};
render();
`;
}

function scoreScript() {
  return `
var state = await loadState({ a: 0, b: 0, an: "Home", bn: "Away" });
var a = document.getElementById("a");
var b = document.getElementById("b");
function draw(){ a.textContent = state.a; b.textContent = state.b; }
async function bump(side, n){
  state[side] = Math.max(0, state[side] + n);
  await saveState(state);
  draw();
}
document.getElementById("ap").onclick = function(){ bump("a", 1); };
document.getElementById("am").onclick = function(){ bump("a", -1); };
document.getElementById("bp").onclick = function(){ bump("b", 1); };
document.getElementById("bm").onclick = function(){ bump("b", -1); };
document.getElementById("zero").onclick = async function(){ state.a = 0; state.b = 0; await saveState(state); draw(); };
draw();
`;
}

function tipScript() {
  return `
var bill = document.getElementById("bill");
var people = document.getElementById("people");
var out = document.getElementById("out");
var each = document.getElementById("each");
var pct = 18;
function render(){
  var b = Number(bill.value) || 0;
  var p = Math.max(1, Number(people.value) || 1);
  var tip = b * pct / 100;
  out.textContent = (b + tip).toFixed(2);
  each.textContent = ((b + tip) / p).toFixed(2);
}
document.getElementById("pcts").addEventListener("click", function(e){
  var btn = e.target.closest("button");
  if (!btn) return;
  pct = Number(btn.dataset.p);
  Array.prototype.forEach.call(document.querySelectorAll("#pcts button"), function(el){
    el.classList.toggle("on", el === btn);
  });
  render();
});
bill.addEventListener("input", render);
people.addEventListener("input", render);
render();
`;
}

function convertScript() {
  return `
var mode = "temp";
var input = document.getElementById("n");
var out = document.getElementById("out");
var from = document.getElementById("from");
var to = document.getElementById("to");
var sets = {
  temp: ["C","F"],
  length: ["km","mi"],
  weight: ["kg","lb"]
};
function fill(){
  from.innerHTML = ""; to.innerHTML = "";
  sets[mode].forEach(function(unit){
    var o1 = document.createElement("option"); o1.textContent = unit; from.append(o1);
    var o2 = document.createElement("option"); o2.textContent = unit; to.append(o2);
  });
  to.selectedIndex = 1;
}
function conv(n, a, b){
  if (a === b) return n;
  if (a === "C" && b === "F") return n * 9/5 + 32;
  if (a === "F" && b === "C") return (n - 32) * 5/9;
  if (a === "km" && b === "mi") return n * 0.621371;
  if (a === "mi" && b === "km") return n / 0.621371;
  if (a === "kg" && b === "lb") return n * 2.20462;
  if (a === "lb" && b === "kg") return n / 2.20462;
  return n;
}
function render(){
  var n = Number(input.value);
  if (input.value === "" || Number.isNaN(n)) { out.textContent = "—"; return; }
  out.textContent = conv(n, from.value, to.value).toFixed(2);
}
document.getElementById("modes").addEventListener("click", function(e){
  var btn = e.target.closest("button");
  if (!btn) return;
  mode = btn.dataset.m;
  Array.prototype.forEach.call(document.querySelectorAll("#modes button"), function(el){
    el.classList.toggle("on", el === btn);
  });
  fill(); render();
});
input.addEventListener("input", render);
from.addEventListener("change", render);
to.addEventListener("change", render);
fill(); render();
`;
}

function cardsScript(topic: string) {
  return `
var seed = ${JSON.stringify(topic)};
var state = await loadState({ i: 0, show: "front", cards: [] });
if (!state.cards.length && seed) {
  state.cards = [
    { id: uid(), front: "Term", back: "Write the meaning on the back." },
    { id: uid(), front: seed, back: "Add the fact you want to remember." }
  ];
}
var face = document.getElementById("face");
var count = document.getElementById("count");
function current(){ return state.cards[state.i] || null; }
function draw(){
  var card = current();
  if (!card) { face.textContent = "Add a card"; count.textContent = "0"; return; }
  face.textContent = state.show === "front" ? card.front : card.back;
  count.textContent = (state.i + 1) + " / " + state.cards.length;
}
document.getElementById("flip").onclick = function(){
  state.show = state.show === "front" ? "back" : "front";
  draw();
};
document.getElementById("next").onclick = async function(){
  if (!state.cards.length) return;
  state.i = (state.i + 1) % state.cards.length;
  state.show = "front";
  await saveState(state);
  draw();
};
document.getElementById("add").addEventListener("submit", async function(e){
  e.preventDefault();
  var front = document.getElementById("front").value.trim();
  var back = document.getElementById("back").value.trim();
  if (!front || !back) return;
  state.cards.push({ id: uid(), front: front, back: back });
  state.i = state.cards.length - 1;
  state.show = "front";
  document.getElementById("front").value = "";
  document.getElementById("back").value = "";
  await saveState(state);
  draw();
});
draw();
`;
}

function journalScript() {
  return `
var state = await loadState({ text: "" });
var box = document.getElementById("box");
box.value = state.text;
var saveTimer = null;
box.addEventListener("input", function(){
  state.text = box.value;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){ saveState(state); }, 200);
});
`;
}

function decideScript(options: string[]) {
  return `
var state = await loadState({ options: ${JSON.stringify(options)} });
var list = document.getElementById("opts");
var pick = document.getElementById("pick");
function draw(){
  list.innerHTML = "";
  state.options.forEach(function(opt, index){
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.className = "grow";
    span.textContent = opt;
    var del = document.createElement("button");
    del.className = "ghost";
    del.type = "button";
    del.textContent = "Remove";
    del.onclick = async function(){
      state.options.splice(index, 1);
      await saveState(state);
      draw();
    };
    li.append(span, del);
    list.append(li);
  });
}
document.getElementById("go").onclick = function(){
  if (!state.options.length) { pick.textContent = "Add an option"; return; }
  pick.textContent = state.options[Math.floor(Math.random() * state.options.length)];
};
document.getElementById("f").onsubmit = async function(e){
  e.preventDefault();
  var v = document.getElementById("q").value.trim();
  if (!v) return;
  state.options.push(v);
  document.getElementById("q").value = "";
  await saveState(state);
  draw();
};
draw();
`;
}

function counterScript() {
  return `
var state = await loadState({ n: 0, step: 1 });
var n = document.getElementById("n");
var step = document.getElementById("step");
function draw(){ n.textContent = String(state.n); step.value = state.step; }
document.getElementById("inc").onclick = async function(){ state.n += Number(state.step) || 1; await saveState(state); draw(); };
document.getElementById("dec").onclick = async function(){ state.n -= Number(state.step) || 1; await saveState(state); draw(); };
document.getElementById("zero").onclick = async function(){ state.n = 0; await saveState(state); draw(); };
step.addEventListener("change", async function(){ state.step = Math.max(1, Number(step.value) || 1); await saveState(state); draw(); });
draw();
`;
}

function waterScript() {
  return `
var state = await loadState({ day: "", count: 0, goal: 8 });
var today = iso(new Date());
if (state.day !== today) { state.day = today; state.count = 0; }
var grid = document.getElementById("grid");
var label = document.getElementById("label");
function draw(){
  grid.innerHTML = "";
  label.textContent = state.count + " of " + state.goal;
  for (var i = 0; i < state.goal; i++) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "choice" + (i < state.count ? " on" : "");
    b.textContent = String(i + 1);
    b.onclick = function(index){
      return async function(){
        state.count = state.count === index + 1 ? index : index + 1;
        state.day = iso(new Date());
        await saveState(state);
        draw();
      };
    }(i);
    grid.append(b);
  }
}
draw();
`;
}

function kanbanScript() {
  return `
var state = await loadState({ cards: [] });
var cols = { now: document.getElementById("now"), next: document.getElementById("next"), done: document.getElementById("done") };
function draw(){
  Object.keys(cols).forEach(function(key){ cols[key].innerHTML = ""; });
  state.cards.forEach(function(card){
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.className = "grow";
    span.textContent = card.text;
    var move = document.createElement("button");
    move.className = "ghost";
    move.type = "button";
    move.textContent = card.col === "done" ? "Back" : "Move";
    move.onclick = async function(){
      if (card.col === "done") card.col = "now";
      else if (card.col === "now") card.col = "next";
      else card.col = "done";
      await saveState(state);
      draw();
    };
    li.append(span, move);
    cols[card.col].append(li);
  });
}
document.getElementById("f").onsubmit = async function(e){
  e.preventDefault();
  var q = document.getElementById("q");
  var text = q.value.trim();
  if (!text) return;
  state.cards.unshift({ id: uid(), text: text, col: "now" });
  q.value = "";
  await saveState(state);
  draw();
};
draw();
`;
}

function passwordScript() {
  return `
var words = ["amber","harbor","cedar","paper","orbit","linen","quartz","meadow","signal","copper","velvet","north","quiet","maple","silver","garden","lantern","river"];
var out = document.getElementById("out");
function make(){
  var n = Number(document.getElementById("len").value) || 4;
  var parts = [];
  for (var i = 0; i < n; i++) parts.push(words[Math.floor(Math.random()*words.length)]);
  var pwd = parts.join("-") + "-" + Math.floor(10 + Math.random()*90);
  out.textContent = pwd;
  out.focus();
  var range = document.createRange();
  range.selectNodeContents(out);
  var sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
document.getElementById("go").onclick = make;
make();
`;
}

function timerScript() {
  return `
var left = 0;
var running = false;
var timer = null;
var display = document.getElementById("display");
function fmt(s){
  var m = Math.floor(s / 60);
  var r = s % 60;
  return String(m).padStart(2,"0") + ":" + String(r).padStart(2,"0");
}
function render(){ display.textContent = fmt(left); }
document.getElementById("presets").onclick = function(e){
  var btn = e.target.closest("button");
  if (!btn) return;
  left = Number(btn.dataset.m) * 60;
  render();
};
document.getElementById("start").onclick = function(){
  if (!left) left = (Number(document.getElementById("mins").value) || 5) * 60;
  if (running) { clearInterval(timer); running = false; this.textContent = "Start"; return; }
  running = true;
  this.textContent = "Pause";
  timer = setInterval(function(){
    if (left <= 1) {
      clearInterval(timer); running = false; left = 0;
      document.getElementById("start").textContent = "Start";
      if (window.shell) window.shell.toast("Timer finished");
    } else left -= 1;
    render();
  }, 1000);
};
render();
`;
}

function trackerScript() {
  return `
var rows = await loadState([]);
var list = document.getElementById("list");
function draw(){
  list.innerHTML = "";
  document.getElementById("empty").hidden = rows.length > 0;
  rows.forEach(function(row){
    var li = document.createElement("li");
    var span = document.createElement("span");
    span.className = "grow";
    span.textContent = row.text;
    var when = document.createElement("span");
    when.textContent = row.when;
    var del = document.createElement("button");
    del.className = "ghost";
    del.type = "button";
    del.textContent = "Remove";
    del.onclick = async function(){
      rows = rows.filter(function(r){ return r.id !== row.id; });
      await saveState(rows);
      draw();
    };
    li.append(span, when, del);
    list.append(li);
  });
}
document.getElementById("f").onsubmit = async function(e){
  e.preventDefault();
  var q = document.getElementById("q");
  var text = q.value.trim();
  if (!text) return;
  var d = new Date();
  rows.unshift({ id: uid(), text: text, when: iso(d) });
  q.value = "";
  await saveState(rows);
  draw();
};
draw();
`;
}

function build(kind: string, name: string, prompt: string) {
  switch (kind) {
    case "todo":
      return page(
        name,
        "List",
        `<form id="f" class="row"><input class="field" id="q" maxlength="140" placeholder="Add an item" aria-label="New item"><button class="primary" type="submit">Add</button></form><p id="empty" class="empty">Nothing on the list.</p><ul id="list" class="list"></ul>`,
        todoScript(),
      );
    case "habit":
      return page(
        name,
        "This week",
        `<p class="sub">Tap a day when you do it. The streak survives until the day is over.</p><p class="stat" id="streak">0</p><p class="sub">day streak</p><div id="days" class="days"></div>`,
        habitScript(),
      );
    case "money":
      return page(
        name,
        "Running total",
        `<p class="stat" id="total">0.00</p><form id="f" class="stack"><input class="field" id="amt" inputmode="decimal" placeholder="Amount" aria-label="Amount"><input class="field" id="note" maxlength="80" placeholder="What was it" aria-label="Note"><button class="primary" type="submit">Log it</button></form><p id="empty" class="empty">No entries yet.</p><ul id="list" class="list"></ul>`,
        moneyScript(),
      );
    case "countdown":
      return page(
        name,
        "Countdown",
        `<p class="stat" id="big">0</p><p class="sub" id="label">days</p><label class="stack">Date<input class="field" id="when" type="date"></label>`,
        countdownScript(parseTarget(prompt)),
      );
    case "pomodoro":
      return page(
        name,
        "Focus",
        `<p class="sub" id="mode">Focus</p><p class="stat" id="display">25:00</p><div class="row"><button class="primary" id="start" type="button">Start</button><button class="choice" id="reset" type="button">Reset</button></div>`,
        pomodoroScript(),
      );
    case "score":
      return page(
        name,
        "Match",
        `<div class="grid2"><div class="card"><p class="kicker">Home</p><p class="stat" id="a">0</p><div class="row"><button class="primary" id="ap" type="button">+1</button><button class="choice" id="am" type="button">−1</button></div></div><div class="card"><p class="kicker">Away</p><p class="stat" id="b">0</p><div class="row"><button class="primary" id="bp" type="button">+1</button><button class="choice" id="bm" type="button">−1</button></div></div></div><button class="ghost" id="zero" type="button">Reset both</button>`,
        scoreScript(),
      );
    case "tip":
      return page(
        name,
        "Bill",
        `<div class="stack"><input class="field" id="bill" inputmode="decimal" placeholder="Bill amount" aria-label="Bill"><input class="field" id="people" inputmode="numeric" value="2" aria-label="People"></div><div id="pcts" class="row"><button class="choice" type="button" data-p="15">15%</button><button class="choice on" type="button" data-p="18">18%</button><button class="choice" type="button" data-p="20">20%</button><button class="choice" type="button" data-p="25">25%</button></div><p class="sub">Total</p><p class="stat" id="out">0.00</p><p class="sub">Each person owes <strong id="each">0.00</strong></p>`,
        tipScript(),
      );
    case "convert":
      return page(
        name,
        "Convert",
        `<div id="modes" class="row"><button class="choice on" type="button" data-m="temp">Temp</button><button class="choice" type="button" data-m="length">Length</button><button class="choice" type="button" data-m="weight">Weight</button></div><div class="stack"><input class="field" id="n" inputmode="decimal" placeholder="Number" aria-label="Number"><div class="row"><select id="from" aria-label="From"></select><select id="to" aria-label="To"></select></div></div><p class="stat" id="out">—</p>`,
        convertScript(),
      );
    case "cards":
      return page(
        name,
        "Deck",
        `<p class="sub" id="count"></p><button class="card flip" id="face" type="button">Add a card</button><div class="row"><button class="primary" id="flip" type="button">Flip</button><button class="choice" id="next" type="button">Next</button></div><form id="add" class="stack"><input class="field" id="front" placeholder="Front" aria-label="Front"><input class="field" id="back" placeholder="Back" aria-label="Back"><button class="primary" type="submit">Add card</button></form>`,
        cardsScript(name),
      );
    case "journal":
      return page(
        name,
        "Page",
        `<p class="sub">Saved on this device as you type.</p><textarea id="box" placeholder="Start writing" aria-label="Journal"></textarea>`,
        journalScript(),
      );
    case "decide":
      return page(
        name,
        "Pick",
        `<p class="stat" id="pick">?</p><button class="primary" id="go" type="button">Choose</button><form id="f" class="row"><input class="field" id="q" placeholder="Add an option" aria-label="Option"><button class="choice" type="submit">Add</button></form><ul id="opts" class="list"></ul>`,
        decideScript(parseOptions(prompt)),
      );
    case "counter":
      return page(
        name,
        "Tally",
        `<p class="stat" id="n">0</p><div class="row"><button class="choice" id="dec" type="button">−</button><button class="primary" id="inc" type="button">+</button><button class="ghost" id="zero" type="button">Reset</button></div><label class="stack">Step<input class="field" id="step" inputmode="numeric" value="1"></label>`,
        counterScript(),
      );
    case "water":
      return page(
        name,
        "Today",
        `<p class="sub" id="label">0 of 8</p><div id="grid" class="grid3" style="margin-top:16px"></div>`,
        waterScript(),
      );
    case "kanban":
      return page(
        name,
        "Board",
        `<form id="f" class="row"><input class="field" id="q" placeholder="New card" aria-label="Card"><button class="primary" type="submit">Add</button></form><div class="cols three" style="margin-top:16px"><section><p class="kicker">Now</p><ul id="now" class="list"></ul></section><section><p class="kicker">Next</p><ul id="next" class="list"></ul></section><section><p class="kicker">Done</p><ul id="done" class="list"></ul></section></div>`,
        kanbanScript(),
      );
    case "password":
      return page(
        name,
        "Passphrase",
        `<p class="card" id="out" tabindex="0"></p><label class="stack">Words<input class="field" id="len" type="range" min="3" max="6" value="4"></label><button class="primary" id="go" type="button">Make another</button><p class="sub">Select the phrase and copy it. Nothing is stored.</p>`,
        passwordScript(),
      );
    case "timer":
      return page(
        name,
        "Timer",
        `<p class="stat" id="display">00:00</p><div id="presets" class="row"><button class="choice" type="button" data-m="1">1</button><button class="choice" type="button" data-m="5">5</button><button class="choice" type="button" data-m="15">15</button><button class="choice" type="button" data-m="25">25</button></div><div class="row"><input class="field" id="mins" inputmode="numeric" value="5" aria-label="Minutes"><button class="primary" id="start" type="button">Start</button></div>`,
        timerScript(),
      );
    default:
      return page(
        name,
        "Log",
        `<p class="sub">Add a line whenever it happens. It stays on this device.</p><form id="f" class="row"><input class="field" id="q" maxlength="140" placeholder="What happened" aria-label="Entry"><button class="primary" type="submit">Add</button></form><p id="empty" class="empty">No entries yet.</p><ul id="list" class="list"></ul>`,
        trackerScript(),
      );
  }
}

export function compileOffline(input: {
  prompt: string;
  mode: CompileMode;
  keepName?: string;
}): CompileResult {
  const prompt = input.prompt.trim();
  const kind = detect(prompt || "log");
  const name = input.keepName?.trim() || appName(prompt || "log", kind);
  const summary = summaryFor(kind, name);
  if (input.mode === "ask") return { name, summary, html: null, kind };
  return { name, summary, html: build(kind, name, prompt || name), kind };
}
