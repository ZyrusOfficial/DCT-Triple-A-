/**
 * Headless render harness.
 *
 * Talks to a Chromium started with --remote-debugging-port (see tools/chrome.sh)
 * and captures the actual WebGL frame, so model alignment and lighting can be
 * verified without a human in the loop.
 *
 * Usage:
 *   node tools/shoot.mjs <out.png> [--cam x,y,z] [--look x,y,z]
 *                        [--hour 9.5] [--size 1600x900] [--view gate|church|...]
 *                        [--wait 7000] [--quality balanced] [--scale 1]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const out = args[0] || 'captures/shot.png';
function flag(name, def = null) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
const PORT = +(process.env.CDP_PORT || 9333);
const [W, H] = (flag('size', '1600x900')).split('x').map(Number);
const waitMs = +flag('wait', 7000);
const cam = flag('cam');
const look = flag('look');
const view = flag('view');
const hour = flag('hour');
const quality = flag('quality');
const scale = flag('scale');
const url = flag('url', 'http://127.0.0.1:5173/');
const dcam = flag('dcam');           // "x,y,z,tx,ty,tz[,fov]" free camera
const dcamRaw = flag('dcam-raw');    // same but no lookAt transform
const exec = flag('exec');           // arbitrary JS, run after setup
const hideui = args.includes('--hideui');

async function main() {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
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
    } else events.push(m);
  };
  await new Promise((r) => (ws.onopen = r));

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p || {}, sessionId);

  const logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (!sessionId) return;
    if (m.method === 'Log.entryAdded') logs.push(`[${m.params.entry.level}] ${m.params.entry.text}`);
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`);
    }
  });

  await S('Page.enable');
  await S('Runtime.enable');
  await S('Log.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url });

  // Wait for the app to signal readiness (or time out).
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < waitMs) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const r = await S('Runtime.evaluate', { expression: '!!window.__ready', returnByValue: true });
      if (r.result.value) { ready = true; break; }
    } catch { /* still loading */ }
  }
  // Let the first frames settle (env map, shadows).
  await new Promise((r) => setTimeout(r, 900));

  const ev = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };

  if (quality) await ev(`document.getElementById('q-preset').value='${quality}'; document.getElementById('q-preset').dispatchEvent(new Event('change'))`);
  if (scale) await ev(`window.__app.state.renderScale=${scale}; window.dispatchEvent(new Event('resize'))`);
  if (hour) await ev(`window.setHour(${hour})`);
  if (dcam) {
    const p = dcam.split(',').map(Number);
    await ev(`window.setDebugCam(${p[0]},${p[1]},${p[2]},${p[3]},${p[4]},${p[5]},${p[6] ?? 55})`);
  }
  if (dcamRaw) {
    const p = dcamRaw.split(',').map(Number);
    await ev(`(()=>{const d=window.__app.debugCam;d.position.set(${p[0]},${p[1]},${p[2]});d.rotation.order='YXZ';d.rotation.set(${p[3]},${p[4]},${p[5]});d.fov=${p[6]??55};d.updateProjectionMatrix();d.updateMatrixWorld(true);window.__debugCamOn=true;})()`);
  }
  if (exec) {
    const r = await ev(exec);
    if (r !== undefined) console.log('EXEC:', typeof r === 'string' ? r : JSON.stringify(r));
  }
  if (hideui) await ev(`document.getElementById('hud').style.display='none'`);
  if (view) await ev(`window.gotoView(${view})`);
  if (cam) {
    const v = cam.split(',').map(Number);
    await ev(`window.__app.player.teleport([${v[0]},${v[1]},${v[2]}])`);
    if (look) {
      const l = look.split(',').map(Number);
      await ev(`window.__app.player.lookAt([${l[0]},${l[1]},${l[2]}])`);
    }
  }
  await new Promise((r) => setTimeout(r, 800));

  const shot = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));

  const diag = await ev(`JSON.stringify({
    ready: !!window.__ready,
    fps: document.getElementById('s-fps')?.textContent,
    draws: document.getElementById('s-draws')?.textContent,
    tris: document.getElementById('s-tris')?.textContent,
    buildMs: window.__app?.world?.stats?.buildMs,
    pos: window.__app?.player ? [__app.player.pos.x.toFixed(1), __app.player.pos.y.toFixed(1), __app.player.pos.z.toFixed(1)] : null,
    colliders: window.__app?.world?.colliders?.length,
    calls: window.__app?.renderer?.info?.render?.calls,
  })`);
  console.log('READY:', ready);
  console.log('DIAG:', diag);
  const warn = logs.filter((l) => /error|exception|warn|THREE/i.test(l));
  if (warn.length) console.log('LOGS:\n' + warn.slice(0, 40).join('\n'));
  await send('Target.closeTarget', { targetId });
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error('SHOOT FAILED', e.message); process.exit(1); });
