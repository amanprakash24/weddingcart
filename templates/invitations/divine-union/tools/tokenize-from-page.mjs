// Turns the finished Sudhanshu & Shreya page into the reusable template (run once).
import fs from "node:fs";
const [, , src, out] = process.argv;
let h = fs.readFileSync(src, "utf8");
const pairs = [
  ["https://maps.app.goo.gl/4YLEYV4PuoKeoCyJ9", "{{MAP_URL}}"],
  ["2026-12-05T17:00:00+05:30", "{{EVENT_START}}"],
  ["95255 55331", "{{CALL}}"], ["94728 58331", "{{WHATSAPP}}"],
  ["assets/chanakya-clip.mp3", "assets/{{MUSIC_FILE}}"],
  ["Music: “Chanakya” · Rishab Rikhiram Sharma", "{{MUSIC_CREDIT}}"],
  ["\"Chanakya\" by Rishab Rikhiram Sharma, from 0:41, used with permission (client confirmed)", "background music"],
  ["monogram-ss.png", "monogram.png"],
  ["05 December 2026", "{{DATE_LONG}}"], ["5:00 PM onwards", "{{TIME}}"],
  ["Jalsa Garden", "{{VENUE}}"], ["Ring Ceremony", "{{CEREMONY}}"], ["The Family", "{{FAMILY}}"],
  ["Sudhanshu", "{{GROOM}}"], ["Charlie", "{{GROOM_NICK}}"], ["Shreya", "{{BRIDE}}"],
  ["Saturday", "{{WEEKDAY}}"], [">December<", ">{{MONTH}}<"],
];
for (const [a, b] of pairs) h = h.split(a).join(b);
// the nickname is optional: wrap the bits that show it so the generator can drop them
fs.writeFileSync(out, h);
const left = (h.match(/Sudhanshu|Shreya|Charlie|Jalsa|95255|94728|chanakya/gi) || []);
console.log("template written; client words left:", left.length ? [...new Set(left)] : "none");
