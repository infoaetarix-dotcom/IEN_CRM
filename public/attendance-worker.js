/*
 * Attendance "still here" pings, run in a worker because browsers slow down
 * timers on a minimised or background tab far more than in a worker. The
 * page starts it while the agent is clocked in; each reply (the current
 * clock state) goes back to the page. See components/dashboard/attendance.
 */
let timer = null;
let url = null;

async function beat() {
  if (!url) return;
  try {
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('application/json')) {
      self.postMessage({ ok: false, status: res.status });
      return;
    }
    self.postMessage(await res.json());
  } catch {
    // Offline for a moment — the next beat tries again. Five minutes of
    // silence and the server clocks the agent out at the last good beat.
    self.postMessage({ ok: false, status: 0 });
  }
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'start') {
    url = msg.url;
    clearInterval(timer);
    timer = setInterval(beat, msg.intervalMs);
    if (msg.immediate) beat();
  } else if (msg.type === 'beat') {
    beat();
  } else if (msg.type === 'stop') {
    clearInterval(timer);
    timer = null;
  }
};
