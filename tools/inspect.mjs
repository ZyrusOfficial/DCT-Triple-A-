/**
 * Scene inspector: loads the app, runs a JS expression, prints the result.
 * Usage: node tools/inspect.mjs "<expression returning JSON-able value>"
 */
const PORT = +(process.env.CDP_PORT || 9333);
const expr = process.argv[2] || 'typeof window.__app';
const waitMs = +(process.env.WAIT || 60000);

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const logs = [];
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
  } else if (m.method === 'Runtime.exceptionThrown') {
    logs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  } else if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
await new Promise((r) => (ws.onopen = r));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p || {}, sessionId);
await S('Page.enable');
await S('Runtime.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: 1, mobile: false });
await S('Page.navigate', { url: 'http://127.0.0.1:5173/' });

const t0 = Date.now();
while (Date.now() - t0 < waitMs) {
  await new Promise((r) => setTimeout(r, 300));
  const r = await S('Runtime.evaluate', { expression: '!!window.__ready', returnByValue: true });
  if (r.result?.value) break;
}
await new Promise((r) => setTimeout(r, 1200));

const r = await S('Runtime.evaluate', {
  expression: expr, returnByValue: true, awaitPromise: true, includeCommandLineAPI: true,
});
if (r.exceptionDetails) {
  console.log('EXCEPTION:', r.exceptionDetails.text, r.exceptionDetails.exception?.description);
} else {
  console.log('RESULT:', typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value, null, 1));
}
if (logs.length) console.log('LOGS:', logs.slice(-12).join('\n'));
await send('Target.closeTarget', { targetId });
ws.close();
process.exit(0);
