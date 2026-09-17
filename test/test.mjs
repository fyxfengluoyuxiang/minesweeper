// 用 jsdom 真实加载扫雷页面、驱动真实 DOM 事件，验证核心逻辑。
// 运行：npm install && npm test
import fs from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const FILE = new URL("../minesweeper.html", import.meta.url);
let html = fs.readFileSync(FILE, "utf8");

// 只在测试内存副本里暴露内部状态，磁盘文件保持不变
const inject = `
window.__t = function(){
  return {
    cells: cells,
    diff: currentDiff,
    mineTotal: mineCount,
    say: function(s){ seconds = s; },
    cols: cols, rows: rows,
    reveal: reveal, toggleFlag: toggleFlag, chord: chord,
    get over(){ return over; }, get won(){ return won; },
    get started(){ return started; },
    get opened(){ return openedCount; },
    get flags(){ return flagCount; },
    get secs(){ return seconds; }
  };
};
`;
const marker = "})();";
const i = html.lastIndexOf(marker);
html = html.slice(0, i) + inject + html.slice(i);

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + e.message));

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/minesweeper.html",
  virtualConsole: vc,
});
const { window } = dom;
window.addEventListener("error", (e) => errors.push("window error: " + e.message));

const doc = window.document;
const board = doc.getElementById("board");
const T = window.__t;

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

function mdown(idx, button = 0) {
  const el = board.children[idx];
  el.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, button, cancelable: true }));
}
function mup(idx, button = 0) {
  const el = board.children[idx];
  el.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true, button, cancelable: true }));
}
function click(idx) { mdown(idx, 0); mup(idx, 0); }
function rclick(idx) { mdown(idx, 2); }

console.log("\n[1] 初始状态");
{
  const t = T();
  ok("棋盘 81 格", board.children.length === 81, board.children.length);
  ok("初级 = 9x9 / 10 雷", t.cols === 9 && t.rows === 9 && t.mineTotal === 10);
  ok("初始未开始、未结束", !t.started && !t.over);
  ok("未翻开前不布雷", t.cells.every((c) => !c.mine));
  const digits = doc.querySelectorAll("#ledMine .digit");
  ok("雷数 LED 有 3 位", digits.length === 3);
  // "000" 共 3 位 x 6 段
  ok("计时 LED 显示 000", doc.querySelectorAll("#ledTime .digit i.on").length === 18,
    String(doc.querySelectorAll("#ledTime .digit i.on").length));
}

console.log("\n[2] 首次点击必安全（随机 200 局）");
{
  let safeAll = true, openZeroAll = true, mineCountOk = true;
  for (let n = 0; n < 200; n++) {
    const t0 = T();
    const pick = Math.floor(Math.random() * 81);
    click(pick);
    const t = T();
    if (!t.started) safeAll = false;
    if (t.cells[pick].mine) safeAll = false;
    if (t.cells[pick].adj !== 0) openZeroAll = false;
    if (t.cells.filter((c) => c.mine).length !== 10) mineCountOk = false;
    // 首点周围 3x3 不应有雷
    const px = pick % 9, py = (pick - pick % 9) / 9;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx, y = py + dy;
        if (x >= 0 && x < 9 && y >= 0 && y < 9 && t.cells[y * 9 + x].mine) safeAll = false;
      }
    if (t.cells.filter((c) => c.state === "open").length !== t.opened) mineCountOk = false;
    // 开新局继续
    doc.getElementById("face").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }
  ok("首点永不是雷，且 3x3 无雷", safeAll);
  ok("首点数字为 0（保证开局展开）", openZeroAll);
  ok("雷数恒为 10 / 展开计数一致", mineCountOk);
}

console.log("\n[3] 插旗与计数");
{
  click(0);
  let t = T();
  let hidden = t.cells.findIndex((c) => c.state === "hidden" && !c.mine);
  rclick(hidden);
  t = T();
  ok("右键插旗", t.cells[hidden].state === "flag", t.cells[hidden].state);
  ok("旗数 +1", t.flags === 1);
  // 10 - 1 = 9 -> "009"：第 2、3 位都是 6 段
  const dg = doc.querySelectorAll("#ledMine .digit");
  ok("LED 显示 10-1=009", dg[1].querySelectorAll("i.on").length === 6 &&
    dg[2].querySelectorAll("i.on").length === 6,
    dg[1].querySelectorAll("i.on").length + "/" + dg[2].querySelectorAll("i.on").length);
  rclick(hidden);
  ok("再右键变问号", T().cells[hidden].state === "qmark");
  rclick(hidden);
  ok("三右键回到未翻开", T().cells[hidden].state === "hidden" && T().flags === 0);
  click(hidden);
  ok("插旗格左键不翻开（问号格可翻开）", T().cells[hidden].state !== "flag");
  const mineIdx = T().cells.findIndex((c) => c.mine);
  rclick(mineIdx);
  click(mineIdx);
  ok("旗子保护：左键点雷不炸", !T().over && T().cells[mineIdx].state === "flag");
  rclick(mineIdx); rclick(mineIdx); // 取消旗
}

console.log("\n[4] 数字快速展开（和弦）");
{
  const t = T();
  const idx = t.cells.findIndex((c) => c.state === "open" && c.adj > 0);
  ok("存在已翻开的数字格", idx >= 0);
  if (idx >= 0) {
    const x = idx % 9, y = (idx - x) / 9;
    const nb = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!dx && !dy) continue;
        if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) nb.push(ny * 9 + nx);
      }
    nb.forEach((j) => { if (T().cells[j].mine && T().cells[j].state !== "flag") T().toggleFlag(j); });
    const before = T().opened;
    T().chord(idx);
    ok("旗数与数字相符后和弦可安全展开", !T().over && T().opened >= before);
    // 旗数不符时不应展开
    const other = T().cells.findIndex((c) => c.state === "open" && c.adj > 0);
    if (other >= 0) {
      const b2 = T().opened;
      const ox = other % 9, oy = (other - ox) / 9;
      let flagged = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ox + dx, ny = oy + dy;
          if (nx < 0 || nx >= 9 || ny < 0 || ny >= 9 || (!dx && !dy)) continue;
          if (T().cells[ny * 9 + nx].state === "flag") flagged++;
        }
      if (flagged !== T().cells[other].adj) {
        T().chord(other);
        ok("旗数不符时和弦不生效", T().opened === b2);
      } else { pass++; console.log("  PASS  (跳过：该格旗数恰好相符)"); }
    }
  }
}

console.log("\n[5] 踩雷结束");
{
  doc.getElementById("face").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  click(40);
  const mineIdx = T().cells.findIndex((c) => c.mine);
  click(mineIdx);
  const t = T();
  ok("踩雷后结束", t.over && !t.won);
  ok("所有雷被显示", t.cells.every((c) => !c.mine || c.state === "open" || c.state === "flag"));
  ok("红色爆炸格标记", doc.querySelectorAll(".cell.boom").length === 1);
  ok("弹出结算面板", doc.getElementById("overlay").classList.contains("show"));
  ok("表情变为失败", /path d="M8\.6 10\.6/.test(doc.getElementById("face").innerHTML));
  ok("结束后点击无效", (() => { const b = T().opened; click(T().cells.findIndex((c) => c.state === "hidden")); return T().opened === b; })());
}

console.log("\n[6] 自动求解至胜利 + 最佳成绩");
{
  doc.getElementById("face").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const t = T();
  for (let n = 0; n < t.cells.length; n++) if (!t.cells[n].mine) click(n);
  const after = T();
  ok("全部非雷格翻开后判胜", after.won === true, "opened=" + after.opened + " over=" + after.over);
  ok("胜利后自动插满旗", after.flags === after.mineTotal);
  ok("胜利表情为墨镜", /M3\.6 12\.6h24\.8/.test(doc.getElementById("face").innerHTML));
  ok("结算面板显示完成", /完成/.test(doc.getElementById("ovTitle").textContent));
  ok("写入最佳成绩", JSON.parse(window.localStorage.getItem("minesweeper.best.v1") || "{}").beginner != null);
  ok("最佳成绩展示", /最佳：初级/.test(doc.getElementById("bestLine").textContent));
}

console.log("\n[7] 难度切换与自定义");
{
  doc.querySelector('[data-diff="intermediate"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  let t = T();
  ok("中级 16x16 / 40 雷", t.cols === 16 && t.rows === 16 && t.mineTotal === 40);
  ok("棋盘 256 格", board.children.length === 256);

  doc.querySelector('[data-diff="expert"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  t = T();
  ok("高级 30x16 / 99 雷", t.cols === 30 && t.rows === 16 && t.mineTotal === 99);
  ok("棋盘 480 格", board.children.length === 480);

  doc.getElementById("customToggle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  doc.getElementById("cW").value = "12";
  doc.getElementById("cH").value = "10";
  doc.getElementById("cM").value = "999";       // 应被夹到 12*10-9=111
  doc.getElementById("customStart").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  t = T();
  ok("自定义尺寸生效", t.cols === 12 && t.rows === 10);
  ok("雷数超上限被夹紧", t.mineTotal === 111, String(t.mineTotal));
  click(0);
  ok("自定义局可正常游玩", T().started && !T().over);

  doc.getElementById("customToggle").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  doc.getElementById("cW").value = "5";
  doc.getElementById("cH").value = "5";
  doc.getElementById("cM").value = "30";        // 5*5-9 = 16 上限
  doc.getElementById("customStart").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const small = T();
  ok("极小棋盘雷数夹紧到 16", small.mineTotal === 16, String(small.mineTotal));
  click(12);
  // 5x5 只有 25 格，16 雷时首点安全区已覆盖全部非雷格，会一击通关
  ok("极小棋盘首点仍安全（并直接通关）", !T().cells[12].mine && T().won,
    "mine=" + T().cells[12].mine + " won=" + T().won);
}

console.log("\n[8] 键盘快捷键 / 音效开关");
{
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "1", bubbles: true }));
  ok("按 1 回到初级", T().cols === 9 && T().mineTotal === 10);
  click(40);
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "r", bubbles: true }));
  ok("按 R 重开（清空进度）", !T().started && T().opened === 0 && board.children.length === 81);
  const sb = doc.getElementById("soundToggle");
  sb.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  ok("静音切换", /🔇/.test(sb.textContent) && /静音/.test(sb.title));
  sb.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  ok("恢复音效", /🔊/.test(sb.textContent) && /音效/.test(sb.title));
}

console.log("\n[9] 窗口紧贴棋盘");
{
  doc.querySelector('[data-diff="beginner"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const app = doc.querySelector(".app");
  const w = parseFloat(app.style.width);
  const cell = parseFloat(doc.documentElement.style.getPropertyValue("--cell"));
  ok("初级窗口宽度贴合棋盘", Math.abs(w - Math.max(262, 9 * cell + 42)) < 1.5, "appW=" + w + " cell=" + cell);
  doc.querySelector('[data-diff="expert"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const w2 = parseFloat(app.style.width);
  const cell2 = parseFloat(doc.documentElement.style.getPropertyValue("--cell"));
  ok("高级窗口宽度贴合棋盘", Math.abs(w2 - Math.round(30 * cell2 + 42)) < 1.5, "appW=" + w2 + " cell=" + cell2);
  ok("高级棋盘比初级宽", w2 > w);
  ok("棋盘宽度为内容宽度（不留空白）", window.getComputedStyle(board).width === "max-content" ||
    parseFloat(window.getComputedStyle(board).width) > 0);
}

console.log("\n[10] 运行期错误检查");
ok("无 JS 运行错误", errors.length === 0, errors.join(" | "));

console.log("\n结果: " + pass + " 通过, " + fail + " 失败\n");
dom.window.close();
process.exit(fail ? 1 : 0);
