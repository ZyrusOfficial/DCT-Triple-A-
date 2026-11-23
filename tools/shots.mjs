/**
 * Multi-view capture.
 *
 * tools/shoot.mjs re-navigates for every frame, which costs ~60-90 s per shot on
 * SwiftShader because the whole procedural world is rebuilt. This harness loads
 * the page ONCE and then hops the debug camera around to any number of views,
 * writing one PNG per view. A twelve-view contact set then takes about as long
 * as two single shots.
 *
 * Usage:
 *   node tools/shots.mjs <shotset.json> [--size 1280x720] [--quality low]
 *                        [--hour 15.5] [--wait 80000] [--hideui] [--scale 1]
 *
 * The shotset is a JSON array:
 *   [{ "name": "01-shrine", "cam": [-22,2.2,-51], "look": [-74,9,-51], "fov": 74,
 *      "hour": 16 }, ...]
 * Any per-shot key ("cam"/"look"/"fov"/"hour"/"quality") overrides the CLI value.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const setPath = args[0];
if (!setPath) { console.error('usage: node tools/shots.mjs <shotset.json>'); process.exit(1); }
const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));

function flag(name, def = null) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
const PORT = +(process.env.CDP_PORT || 9333);
const [W, H] = (flag('size', '1280x720')).split('x').map(Number);
const waitMs = +flag('wait', 80000);
const url = flag('url', 'http://127.0.0.1:5173/');
const baseHour = flag('hour');
const baseQuality = flag('quality');
const baseScale = flag('scale');
const hideui = args.includes('--hideui');
const outDir = flag('out', 'captures');

async function main() {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p || {}, sessionId);

  const logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (!sessionId) return;
    if (m.method === 'Log.entryAdded' && /error|warn/i.test(m.params.entry.level)) {
      logs.push(`[${m.params.entry.level}] ${m.params.entry.text}`);
    }
    if (m.method === 'Runtime.consoleAPICalled' && /error|warn/.test(m.params.type)) {
      logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push(`[EXCEPTION] ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    }
  });

  await S('Page.enable');
  await S('Runtime.enable');
  await S('Log.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url });

  const ev = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };

  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < waitMs) {
    await new Promise((r) => setTimeout(r, 400));
    try { if (await ev('!!window.__ready')) { ready = true; break; } } catch { /* loading */ }
  }
  console.log('READY:', ready, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  if (!ready) { console.log('LOGS:\n' + logs.slice(-20).join('\n')); process.exit(1); }

  if (baseQuality) {
    await ev(`document.getElementById('q-preset').value='${baseQuality}';document.getElementById('q-preset').dispatchEvent(new Event('change'))`);
  }
  if (baseScale) await ev(`window.__app.state.renderScale=${baseScale};window.dispatchEvent(new Event('resize'))`);
  if (hideui) await ev(`document.getElementById('hud').style.display='none'`);
  await new Promise((r) => setTimeout(r, 1200));

  fs.mkdirSync(outDir, { recursive: true });
  for (const s of set) {
    if (s.hour !== undefined) await ev(`window.setHour(${s.hour})`);
    else if (baseHour !== undefined) await ev(`window.setHour(${baseHour})`);
    if (s.quality) {
      await ev(`document.getElementById('q-preset').value='${s.quality}';document.getElementById('q-preset').dispatchEvent(new Event('change'))`);
    }
    const [cx, cy, cz] = s.cam;
    const [tx, ty, tz] = s.look;
    await ev(`window.setDebugCam(${cx},${cy},${cz},${tx},${ty},${tz},${s.fov ?? 55})`);
    if (s.exec) { const r = await ev(s.exec); if (r !== undefined) console.log('  EXEC:', r); }
    // two frames so the TAA/FXAA history and shadow matrix are warm
    await new Promise((r) => setTimeout(r, s.wait ?? 700));
    const shot = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = path.join(outDir, `${s.name}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const metric = await ev(`document.getElementById('s-fps')?.textContent + 'fps/' + document.getElementById('s-draws')?.textContent + 'd'`);
    console.log(`  ✓ ${file}  ${metric}`);
  }

  if (logs.length) console.log('LOGS:\n' + logs.slice(0, 25).join('\n'));
  await send('Target.closeTarget', { targetId });
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error('SHOTS FAILED', e.message); process.exit(1); });
