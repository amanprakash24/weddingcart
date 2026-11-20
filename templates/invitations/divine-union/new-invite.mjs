// Shaadi Shopping · "Divine Union" invitation template
// Creates a new client invite from a details file.
//
//   node new-invite.mjs clients/rahul-priya.json
//
// Output: ../../<slug>/  (index.html + assets/ with the couple's monogram and WhatsApp preview image)
// Then publish with:  bash ../../build-for-site.sh <slug> <slug>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");                       // C:\Shaadi Shopping\Invitation Sample
const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find(p => fs.existsSync(p));

const file = process.argv[2];
if (!file) { console.error("Usage: node new-invite.mjs <client.json>"); process.exit(1); }
const c = JSON.parse(fs.readFileSync(file, "utf8"));
const need = ["slug", "groom", "bride", "ceremony", "eventStart", "time", "venue", "mapUrl", "call"];
const missing = need.filter(k => !c[k]);
if (missing.length) { console.error("Missing in " + file + ": " + missing.join(", ")); process.exit(1); }
if (!/^[a-z0-9-]+$/.test(c.slug)) { console.error("slug must be lowercase letters, numbers and dashes, e.g. rahul-priya"); process.exit(1); }

// ---- dates (India time) ----
const d = new Date(c.eventStart);
if (isNaN(d)) { console.error("eventStart must look like 2027-02-14T18:30:00+05:30"); process.exit(1); }
const part = o => new Intl.DateTimeFormat("en-IN", Object.assign({ timeZone: "Asia/Kolkata" }, o)).format(d);
const day = part({ day: "2-digit" }), month = part({ month: "long" }), year = part({ year: "numeric" });

// ---- music: use the client's licensed file if given, otherwise our own original track ----
let musicFile = "kashi-utsav.mp3", musicCredit = "";
if (c.music && c.music.file) {
  if (!fs.existsSync(c.music.file)) { console.error("Music file not found: " + c.music.file); process.exit(1); }
  if (!c.music.permission) { console.error('Add "permission": true in music only if the client has the right to use this song.'); process.exit(1); }
  musicFile = path.basename(c.music.file);
  musicCredit = c.music.credit || "";
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const T = {
  GROOM: c.groom, GROOM_NICK: c.groomNick || "", BRIDE: c.bride, CEREMONY: c.ceremony,
  VENUE: c.venue, TIME: c.time, MAP_URL: c.mapUrl, EVENT_START: c.eventStart,
  CALL: c.call, WHATSAPP: c.whatsapp || c.call,
  DATE_LONG: `${day} ${month} ${year}`, WEEKDAY: part({ weekday: "long" }), MONTH: month,
  MUSIC_FILE: musicFile, MUSIC_CREDIT: musicCredit,
};

let h = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
// no nickname → drop every place that shows one
if (!c.groomNick) {
  [
    `<span class="nickline">( <span data-f="groomNick">{{GROOM_NICK}}</span> )</span>`,
    `<div class="caps nick">( <span data-f="groomNick">{{GROOM_NICK}}</span> )</div>`,
    ` (<span data-f="groomNick">{{GROOM_NICK}}</span>)`,
    `<small>( <span data-f="groomNick">{{GROOM_NICK}}</span> )</small>`,
    ` ({{GROOM_NICK}})`,
    " (${INVITE.groomNick})",
  ].forEach(s => { h = h.split(s).join(""); });
}
// no separate WhatsApp number → the WhatsApp button uses the call number
if (!c.whatsapp) h = h.replace(`whatsapp: "{{WHATSAPP}}"`, `whatsapp: "{{CALL}}"`);
h = h.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in T ? esc(T[k]) : m));
const left = h.match(/\{\{[A-Z_]+\}\}/g);
if (left) { console.error("Unfilled fields: " + [...new Set(left)].join(", ")); process.exit(1); }

// ---- write the client folder ----
const OUT = path.join(ROOT, c.slug), A = path.join(OUT, "assets");
fs.mkdirSync(A, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), h);
for (const f of ["floral-arch.jpg", "rk-garden.jpg", "rk-lanterns.jpg", "ganesh.png"]) fs.copyFileSync(path.join(HERE, "assets", f), path.join(A, f));
fs.copyFileSync(c.music && c.music.file ? c.music.file : path.join(HERE, "assets", musicFile), path.join(A, musicFile));
for (const f of ["hand-krishna.png", "hand-bride.png"]) { const p = path.join(HERE, "assets", f); if (fs.existsSync(p)) fs.copyFileSync(p, path.join(A, f)); }

// ---- monogram + WhatsApp preview image, drawn in the browser ----
function shot(htmlFile, png, w, hgt, transparent){
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${w},${hgt}`, "--virtual-time-budget=4000", `--screenshot=${png}`];
  if (transparent) args.push("--default-background-color=00000000");
  args.push("file:///" + htmlFile.replace(/\\/g, "/"));
  execFileSync(EDGE, args, { stdio: "ignore" });
}
const tmp = fs.mkdtempSync(path.join(OUT, ".build-"));
const g0 = c.groom.trim()[0].toUpperCase(), b0 = c.bride.trim()[0].toUpperCase();
fs.writeFileSync(path.join(tmp, "mono.html"), fs.readFileSync(path.join(HERE, "tools", "monogram.html"), "utf8").replace("{{G}}", esc(g0)).replace("{{B}}", esc(b0)));
fs.copyFileSync(path.join(HERE, "assets", "floral-arch.jpg"), path.join(tmp, "floral-arch.jpg"));
if (c.logo && c.logo.trim()) {
  if (!fs.existsSync(c.logo)) { console.error("Logo file not found: " + c.logo); process.exit(1); }
  fs.copyFileSync(c.logo, path.join(A, "logo.png"));            // client's own logo (transparent PNG, ideally in gold)
}
if (EDGE) {
  if (!(c.logo && c.logo.trim())) shot(path.join(tmp, "mono.html"), path.join(A, "logo.png"), 900, 480, true);
  fs.copyFileSync(path.join(A, "logo.png"), path.join(tmp, "monogram.png"));
  const og = fs.readFileSync(path.join(HERE, "tools", "og.html"), "utf8")
    .replace("{{LABEL}}", esc(c.eventLabel || "Engagement Invitation"))
    .replace("{{NAMES}}", esc(`${c.groom} & ${c.bride}`))
    .replace("{{LINE}}", esc(`${T.WEEKDAY} · ${T.DATE_LONG} · ${c.venue}`));
  fs.writeFileSync(path.join(tmp, "og.html"), og);
  shot(path.join(tmp, "og.html"), path.join(tmp, "og.png"), 1200, 630, false);
  try { execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(tmp, "og.png"), "-q:v", "3", path.join(A, "og.jpg")]); }
  catch { fs.copyFileSync(path.join(tmp, "og.png"), path.join(A, "og.jpg")); }
} else {
  console.warn("No Edge/Chrome found: monogram.png and og.jpg were not drawn.");
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nCreated ${OUT}`);
console.log(`  ${c.groom}${c.groomNick ? " (" + c.groomNick + ")" : ""} & ${c.bride} · ${c.ceremony} · ${T.WEEKDAY} ${T.DATE_LONG}, ${c.time} · ${c.venue}`);
console.log(`  logo ${c.logo && c.logo.trim() ? path.basename(c.logo) + " (client's own)" : g0 + "♥" + b0 + " monogram"} · music ${musicFile}${musicCredit ? " (" + musicCredit + ")" : ""}`);
console.log(`\nNext: open ${path.join(OUT, "index.html")} to check it, then publish:`);
console.log(`  bash "${path.join(ROOT, "build-for-site.sh")}" ${c.slug} ${c.slug}`);
console.log(`  → https://www.shaadishopping.com/invitations/${c.slug}`);
