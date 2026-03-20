import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3002;
const sessionStore = [];
const GATEWAY_URL = 'https://gateway.maton.ai/google-mail/gmail/v1/users/me/messages/send';

app.use(express.json({ type: '*/*', limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

app.post('/api/track', (req, res) => {
  try {
    const session = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!session || !session.id) return res.sendStatus(400);

    const existingIndex = sessionStore.findIndex((item) => item.id === session.id);
    if (existingIndex >= 0) {
      sessionStore[existingIndex] = session;
    } else {
      sessionStore.push(session);
    }

    console.log(`[TRACK] Session from ${session.slug || 'unknown'} — ${session.events?.length || 0} events, ${session.totalDuration || 0}s`);
    return res.sendStatus(200);
  } catch (error) {
    console.error('[TRACK] Error:', error.message);
    return res.sendStatus(500);
  }
});

app.get('/api/report/preview', (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).send('Forbidden');
  if (!sessionStore.length) {
    return res.send('<p>No sessions recorded yet. Visit the demo site first, then come back here.</p>');
  }
  return res.send(buildWeeklyReportHTML([...sessionStore]));
});

app.get('/api/report/send-now', async (req, res) => {
  if (!isLocalRequest(req)) return res.status(403).send('Forbidden');
  if (!sessionStore.length) {
    return res.send('No sessions recorded yet.');
  }

  try {
    const html = buildWeeklyReportHTML([...sessionStore]);
    await sendWeeklyReport(html);
    return res.send('Report sent successfully.');
  } catch (error) {
    return res.status(500).send(`Failed: ${error.message}`);
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public/index.html'));
});

cron.schedule('0 8 * * 1', async () => {
  if (!sessionStore.length) {
    console.log('[REPORT] No sessions this week, skipping report.');
    return;
  }

  try {
    const html = buildWeeklyReportHTML([...sessionStore]);
    await sendWeeklyReport(html);
    sessionStore.length = 0;
    console.log('[REPORT] Session store cleared. Ready for next week.');
  } catch (error) {
    console.error('[REPORT] Failed to send weekly report:', error.message);
  }
}, { timezone: 'Europe/London' });

console.log('[CRON] Weekly report scheduled for Mondays at 08:00 London time');

app.listen(PORT, () => {
  console.log(`Raxion Demo running on http://localhost:${PORT}`);
});

function isLocalRequest(req) {
  const source = `${req.ip || ''} ${req.connection?.remoteAddress || ''} ${req.socket?.remoteAddress || ''}`;
  return source.includes('127.0.0.1') || source.includes('::1');
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatClock(value) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function mostCommonAction(events) {
  const counts = new Map();
  for (const event of events || []) {
    if (!event?.type || event.type === 'PAGE_VIEW') continue;
    counts.set(event.type, (counts.get(event.type) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : 'PAGE_VIEW';
}

function sanitise(text) {
  if (!text) return text;
  return String(text)
    .replace(/\*/g, '')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/#/g, '');
}

function buildWeeklyReportHTML(sessions) {
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const weekStart = getMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const uniqueSlugs = new Set(sortedSessions.map((session) => session.slug || 'Unknown'));
  const avgDuration = average(sortedSessions.map((session) => Number(session.totalDuration || 0)));
  const bookCallClicks = sortedSessions.reduce((sum, session) => sum + (session.events || []).filter((event) => /BOOK_CALL_CLICKED|BANNER_BOOK_CALL_CLICKED/.test(event.type)).length, 0);

  const slugSummary = [...uniqueSlugs].map((slug) => {
    const slugSessions = sortedSessions.filter((session) => (session.slug || 'Unknown') === slug);
    const durations = slugSessions.map((session) => Number(session.totalDuration || 0));
    const pagesVisited = new Set(slugSessions.flatMap((session) => (session.pages || []).map((page) => page.page)));
    const slugBookCalls = slugSessions.reduce((sum, session) => sum + (session.events || []).filter((event) => /BOOK_CALL_CLICKED|BANNER_BOOK_CALL_CLICKED/.test(event.type)).length, 0);
    const actions = slugSessions.flatMap((session) => session.events || []);
    return {
      slug,
      sessions: slugSessions.length,
      avgDuration: average(durations),
      pagesVisited: pagesVisited.size,
      bookCalls: slugBookCalls,
      commonAction: mostCommonAction(actions),
    };
  }).sort((a, b) => b.sessions - a.sessions || b.avgDuration - a.avgDuration);

  const pipelineDurations = sortedSessions.flatMap((session) => (session.pages || []).filter((page) => page.page === 'pipeline').map((page) => Number(page.duration || 0)));
  const trainVisits = sortedSessions.filter((session) => (session.events || []).some((event) => event.type === 'PAGE_VIEW' && event.detail === 'train-agent')).length;
  const suggestions = [];

  if (avgDuration < 60) {
    suggestions.push('Sessions are short — consider making the sourcing animation auto-trigger on first load so users see activity immediately without needing to launch a job.');
  }
  if (bookCallClicks === 0) {
    suggestions.push('No book-call clicks this week — consider testing a more prominent CTA placement or a sticky footer CTA.');
  }
  if (average(pipelineDurations) > 120) {
    suggestions.push('Users are spending significant time on the Pipeline page — this is the highest-engagement page. Consider adding a CTA card inline in the candidate table.');
  }
  if (sortedSessions.length && (trainVisits / sortedSessions.length) < 0.2) {
    suggestions.push('Train Agent is rarely visited — consider adding a prompt on the Controls page directing users there.');
  }

  const topSlug = slugSummary[0]?.slug || 'No dominant slug yet';
  suggestions.push(`Top performing slug this week: ${topSlug}.`);

  const summaryBoxes = [
    ['Total Sessions', sortedSessions.length],
    ['Unique Slugs', uniqueSlugs.size],
    ['Avg Session Duration', `${avgDuration}s`],
    ['Book Call Clicks', bookCallClicks],
  ].map(([label, value]) => (
    `<div class="stat-box"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`
  )).join('');

  const topSlugRows = slugSummary.map((row) => (
    `<tr><td>${escapeHtml(row.slug)}</td><td>${row.sessions}</td><td>${row.avgDuration}s</td><td>${row.pagesVisited}</td><td>${row.bookCalls}</td><td>${escapeHtml(row.commonAction)}</td></tr>`
  )).join('');

  const sessionBlocks = sortedSessions.map((session) => {
    const pages = (session.pages || []).map((page) => (
      `<li><strong>${escapeHtml(page.page)}</strong> — ${escapeHtml(page.duration || 0)}s</li>`
    )).join('') || '<li>No tracked page exits recorded.</li>';
    const events = (session.events || []).map((event) => (
      `<div class="event-row"><span class="event-time">${escapeHtml(formatClock(event.timestamp))}</span><span class="event-type">${escapeHtml(event.type)}</span><span class="event-detail">${escapeHtml(event.detail || '')}</span></div>`
    )).join('') || '<div class="event-row"><span class="event-detail">No events captured.</span></div>';

    return (
      `<section class="session-block">
        <div class="session-head">
          <div><strong>Slug:</strong> ${escapeHtml(session.slug || 'Unknown')}</div>
          <div><strong>Started:</strong> ${escapeHtml(formatDateTime(session.startedAt))}</div>
          <div><strong>Duration:</strong> ${escapeHtml(session.totalDuration || 0)}s</div>
          <div><strong>Referrer:</strong> ${escapeHtml(session.referrer || 'direct')}</div>
        </div>
        <div class="session-columns">
          <div>
            <h3>Pages visited</h3>
            <ul>${pages}</ul>
          </div>
          <div>
            <h3>Events timeline</h3>
            <div class="event-log">${events}</div>
          </div>
        </div>
      </section>`
    );
  }).join('');

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Try Raxion Weekly Report</title>
    <style>
      body { margin: 0; background: #f4f6f3; color: #18201b; font: 14px/1.6 "DM Sans", Arial, sans-serif; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
      .header { background: #1a2e1a; color: #fff; padding: 28px 32px; border-radius: 12px 12px 0 0; }
      .header h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.05; }
      .header p { margin: 0; color: rgba(255,255,255,0.8); }
      .body { background: #fff; border: 1px solid #dde4dc; border-top: 0; border-radius: 0 0 12px 12px; padding: 28px 32px 36px; }
      .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin: 0 0 28px; }
      .stat-box { border: 1px solid #dde4dc; border-radius: 10px; padding: 18px; background: #fcfdfb; }
      .stat-value { font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 8px; }
      .stat-label { color: #657067; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; }
      h2 { font-size: 20px; margin: 28px 0 14px; }
      table { width: 100%; border-collapse: collapse; background: #fff; }
      th, td { border: 1px solid #e6ece5; padding: 12px 14px; text-align: left; vertical-align: top; }
      th { background: #f7faf7; text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; color: #657067; }
      .session-block { border: 1px solid #dde4dc; border-radius: 10px; padding: 18px; margin-top: 18px; background: #fcfdfb; }
      .session-head { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
      .session-columns { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; }
      ul { margin: 0; padding-left: 18px; }
      .event-log { border: 1px solid #e6ece5; background: #ffffff; border-radius: 8px; padding: 12px; font: 12px/1.5 "DM Mono", monospace; }
      .event-row { display: grid; grid-template-columns: 84px 200px minmax(0, 1fr); gap: 12px; padding: 4px 0; border-bottom: 1px solid #f0f3ef; }
      .event-row:last-child { border-bottom: 0; }
      .event-type { font-weight: 700; color: #1f523c; }
      .suggestions { margin-top: 28px; padding: 18px 20px; border-radius: 10px; background: #f0f6f2; border: 1px solid #dbe8df; }
      .suggestions li { margin: 8px 0; }
      @media (max-width: 800px) {
        .stats, .session-head, .session-columns { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <h1>RAXION DEMO — WEEKLY PERFORMANCE REPORT</h1>
        <p>Week of ${escapeHtml(weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))} to ${escapeHtml(weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))}</p>
        <p>Generated ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
      </div>
      <div class="body">
        <div class="stats">${summaryBoxes}</div>
        <h2>Top slugs</h2>
        <table>
          <thead><tr><th>Slug</th><th>Sessions</th><th>Avg Duration</th><th>Pages Visited</th><th>Book Call Clicks</th><th>Most Common Action</th></tr></thead>
          <tbody>${topSlugRows || '<tr><td colspan="6">No sessions yet.</td></tr>'}</tbody>
        </table>
        <h2>Full session log</h2>
        ${sessionBlocks || '<p>No sessions captured.</p>'}
        <div class="suggestions">
          <h2>Optimisation suggestions</h2>
          <ul>${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

async function sendWeeklyReport(html) {
  const apiKey = process.env.MATON_API_KEY;
  const connectionId = process.env.MATON_GMAIL_CONNECTION_ID;
  const from = process.env.REPORT_SENDER;
  const fromName = process.env.REPORT_SENDER_NAME || 'Raxion';
  const to = process.env.REPORT_RECIPIENT;

  if (!apiKey) throw new Error('MATON_API_KEY is not set');
  if (!connectionId) throw new Error('MATON_GMAIL_CONNECTION_ID is not set');
  if (!from) throw new Error('REPORT_SENDER is not set');
  if (!to) throw new Error('REPORT_RECIPIENT is not set');

  const weekStart = getMonday(new Date());
  const subjectBase = process.env.REPORT_SUBJECT || 'Try Raxion Weekly Report';
  const subject = `${subjectBase} — w/c ${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const cleanSubject = sanitise(subject);
  const cleanHtml = sanitise(html);
  const rawMessage = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    cleanHtml,
  ].join('\r\n');

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Maton-Connection': connectionId,
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  const payload = await response.text();
  if (!response.ok) {
    console.error('[REPORT] Maton API error:', payload);
    throw new Error(`Maton API returned ${response.status}`);
  }

  console.log('[REPORT] Weekly report sent successfully');
  return payload;
}
