(function () {
  const BOOKING_URL = 'https://calendly.com/bode-libdr/30min';
  const SOURCE_MESSAGES = [
    'Scanning LinkedIn for matching profiles...',
    'Applying seniority and skills filters...',
    'Running fit scoring...',
    'Enriching contacts via KASPR...',
    'Verifying emails...',
    'Queuing shortlisted candidates...',
  ];
  const FIRST_NAMES = [
    'James', 'Sophie', 'Marcus', 'Priya', 'Tom', 'Charlotte', 'Daniel', 'Aisha', 'Ryan', 'Emily',
    'Connor', 'Natasha', 'Lauren', 'Declan', 'Amelia', 'Ethan', 'Grace', 'Noah', 'Isabella', 'Leo',
    'Hannah', 'Oscar', 'Maya', 'Samir', 'Olivia', 'Jack', 'Ava', 'Mason', 'Layla', 'Freddie',
    'Nina', 'Harvey', 'Sana', 'Callum', 'Imogen', 'Theo', 'Zara', 'Arjun', 'Mila', 'Isaac',
  ];
  const LAST_NAMES = [
    'Williams', 'Chen', 'Okafor', 'Patel', 'Roberts', 'Thompson', 'Kim', 'Hassan', 'Murphy', 'Davies',
    'Anderson', 'Kovac', 'Park', 'Sullivan', 'Frith', 'Miller', 'Bailey', 'Reyes', 'Singh', 'Lewis',
    'Foster', 'Mason', 'Ahmed', 'Brooks', 'Young', 'Mitchell', 'Ward', 'Bennett', 'Campbell', 'Cook',
  ];
  const TITLES = [
    'Senior Recruiter',
    'Principal Consultant',
    'Recruitment Manager',
    'Senior Consultant',
    'Associate Director',
    'Talent Acquisition Partner',
    'Team Lead',
    'Business Development Manager',
    'Senior Recruitment Consultant',
    'Managing Consultant',
  ];
  const COMPANIES = [
    'Hays', 'Randstad', 'Michael Page', 'Reed', 'Robert Half', 'Manpower', 'Adecco', 'SThree',
    'Gartner', 'Capita', 'Harvey Nash', 'Marks Sattin', 'Selby Jennings', 'Korn Ferry',
    'Morgan McKinley', 'PageGroup', 'Spencer Ogden', 'Phaidon', 'Goodman Masson', 'Salt',
    'La Fosse', 'Trinnovo', 'Venturi', 'Franklin Fitch',
  ];
  const LOCATIONS = [
    'London, UK', 'Manchester, UK', 'Bristol, UK', 'New York, US', 'Austin, TX', 'Chicago, IL',
    'Boston, MA', 'Amsterdam, NL', 'Dublin, IE', 'Toronto, CA',
  ];
  const ACTIVITY_POOL = [
    'CANDIDATE_SOURCED',
    'CANDIDATE_SCORED',
    'INVITE_SENT',
    'INVITE_ACCEPTED',
    'MESSAGE_DRAFTED',
    'ENRICHMENT_COMPLETE',
    'OUTSIDE_SENDING_WINDOW',
  ];
  const PIPELINE_TABS = [
    ['all', 'All'],
    ['shortlisted', 'Shortlisted'],
    ['outreach', 'Outreach'],
    ['replies', 'Replies'],
    ['archived', 'Archived'],
    ['activity', 'Activity'],
  ];
  const TRAIN_DEFAULTS = {
    outreach: {
      voiceRules: 'Write concise, senior-to-senior messages. Keep the tone commercially sharp, credible, and low-friction. Lead with role relevance, not hype, and avoid sounding like a templated recruiter blast.',
      replyHandling: 'If the candidate is passive, lower friction and offer a short intro call. If they ask for more detail, answer directly and keep momentum. If they are clearly not a fit, close politely and avoid long back-and-forth.',
    },
    sourcing: {
      fitCriteria: 'Must have 5+ years billing experience, strong desk ownership, outbound business development confidence, and evidence of operating in competitive permanent recruitment markets.',
      exclusions: 'Exclude candidates with repeated sub-12-month moves, purely internal TA backgrounds, no evidence of BD, or current roles too junior to credibly step into a senior consultant or principal remit.',
    },
  };

  const app = document.getElementById('app');
  const drawerRoot = document.getElementById('drawer-root');
  const toastRoot = document.getElementById('toast-root');
  const overlayRoot = document.getElementById('overlay-root');
  const sidebar = document.getElementById('sidebar');
  const company = slugToCompany(window.location.pathname);
  const STATE = {
    view: (window.location.hash || '#overview').slice(1) || 'overview',
    selectedJobId: null,
    selectedPipelineTab: 'all',
    trainTab: 'outreach',
    jobs: [],
    candidates: [],
    approvals: [],
    activityLog: [],
    trainAgent: JSON.parse(JSON.stringify(TRAIN_DEFAULTS)),
    sourcingActive: false,
    sourcingJobId: null,
    sourcingCount: 0,
    sourcingMessageIndex: 0,
    metrics: {
      totalSourced: 0,
      shortlisted: 0,
      outreachSent: 0,
      replies: 0,
      queuedApprovals: 0,
      activeJobs: 0,
    },
    inboxDrafts: {},
    candidatePanelId: null,
    welcomeOpen: false,
    sourcingTimer: null,
    sourcingCompleteTimer: null,
    activityTicker: null,
  };

  const STAGE_META = {
    sourced: { cls: 'stage-sourced', label: 'Sourced' },
    shortlisted: { cls: 'stage-shortlisted', label: 'Shortlisted' },
    outreach: { cls: 'stage-enriched', label: 'Queued for Outreach' },
    replied: { cls: 'stage-replied', label: 'Replied' },
    archived: { cls: 'stage-archived', label: 'Archived' },
    approved: { cls: 'stage-qualified', label: 'Approved' },
  };

  function slugToCompany(pathname) {
    const raw = String(pathname || '/').replace(/^\/+|\/+$/g, '');
    if (!raw) return 'Your Agency';
    const normalized = raw
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    const suffixes = ['global', 'group', 'partners', 'holdings', 'talent', 'search', 'recruitment', 'recruit', 'agency', 'solutions', 'ventures', 'arnold'];
    let spaced = normalized;
    if (!/\s/.test(normalized)) {
      const lower = normalized.toLowerCase();
      const suffix = suffixes.find((item) => lower.endsWith(item) && lower !== item);
      if (suffix) {
        spaced = `${normalized.slice(0, normalized.length - suffix.length)} ${suffix}`;
      }
    }
    return spaced
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function slugify(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function randomFrom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function activeJobs() {
    return STATE.jobs.filter((job) => job.status === 'ACTIVE');
  }

  function selectedJob() {
    return STATE.jobs.find((job) => job.id === STATE.selectedJobId) || STATE.jobs[0] || null;
  }

  function selectedJobCandidates() {
    const job = selectedJob();
    if (!job) return [];
    return STATE.candidates.filter((candidate) => candidate.jobId === job.id);
  }

  function selectedJobActivity() {
    const job = selectedJob();
    if (!job) return [];
    return STATE.activityLog.filter((item) => item.jobId === job.id).slice(0, 50);
  }

  function stageInfo(stage) {
    return STAGE_META[stage] || { cls: 'stage-default', label: stage };
  }

  function stageChip(stage) {
    const meta = stageInfo(stage);
    return `<span class="stage-chip ${meta.cls}">${esc(meta.label)}</span>`;
  }

  function scoreClass(score) {
    if (score >= 85) return 'score-high';
    if (score >= 70) return 'score-mid';
    return 'score-low';
  }

  function scorePill(score) {
    return `<span class="score-pill ${scoreClass(score)}">${esc(score)}</span>`;
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }

  function percent(value, total) {
    if (!total) return 0;
    return `${Math.round((value / total) * 100)}%`;
  }

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(diff / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function toast(message, tone) {
    const node = document.createElement('div');
    node.className = `toast${tone ? ` ${tone}` : ''}`;
    node.textContent = message;
    toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function pushActivity(type, text, jobId) {
    STATE.activityLog.unshift({
      id: `activity_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type,
      text,
      jobId: jobId || null,
      createdAt: nowIso(),
    });
    STATE.activityLog = STATE.activityLog.slice(0, 50);
  }

  function recomputeMetrics() {
    const active = activeJobs();
    const activeJobIds = new Set(active.map((job) => job.id));
    const relevant = STATE.candidates.filter((candidate) => activeJobIds.has(candidate.jobId));
    STATE.metrics.totalSourced = relevant.length;
    STATE.metrics.shortlisted = relevant.filter((candidate) => candidate.tier !== 'COLD' && candidate.stage !== 'archived').length;
    STATE.metrics.outreachSent = relevant.filter((candidate) => candidate.stage === 'outreach').length;
    STATE.metrics.replies = relevant.filter((candidate) => candidate.hasReplied).length;
    STATE.metrics.queuedApprovals = STATE.approvals.filter((item) => item.status === 'pending').length;
    STATE.metrics.activeJobs = active.length;
    active.forEach((job) => {
      const candidates = STATE.candidates.filter((candidate) => candidate.jobId === job.id);
      job.sourcedCount = candidates.length;
      job.shortlistedCount = candidates.filter((candidate) => candidate.tier !== 'COLD' && candidate.stage !== 'archived').length;
    });
  }

  function demoBanner() {
    return (
      '<div class="surface demo-banner">' +
        '<div class="demo-banner-top">🎯 This is a personalised demo for <strong data-company>' + esc(company) + '</strong> — no real data is connected. <a href="' + esc(BOOKING_URL) + '" target="_blank" rel="noreferrer">Book a call to see the live system →</a></div>' +
        '<div class="demo-banner-sub">Autonomous outbound sourcing · Inbound application screening · Interview scheduling · All on autopilot.</div>' +
      '</div>'
    );
  }

  function metricCard(label, value, foot) {
    return (
      '<div class="metric-card strip-card">' +
        '<div class="metric-number">' + esc(value) + '</div>' +
        '<div class="metric-caption">' + esc(label) + '</div>' +
        '<div class="metric-foot">' + esc(foot) + '</div>' +
      '</div>'
    );
  }

  function renderOverview() {
    const rows = activeJobs().map((job) => (
      '<tr>' +
        `<td><strong>${esc(job.title)}</strong></td>` +
        `<td>${stageChip('approved')}</td>` +
        `<td>${esc(job.sourcedCount || 0)}</td>` +
        `<td>${esc(job.shortlistedCount || 0)}</td>` +
        `<td><div class="button-row"><button class="btn btn-primary btn-sm" data-action="open-job" data-id="${esc(job.id)}">View</button><button class="btn btn-secondary btn-sm" data-action="source-now" data-id="${esc(job.id)}">Source Now</button></div></td>` +
      '</tr>'
    )).join('') || '<tr><td colspan="5">No active pipelines. Launch a job to begin.</td></tr>';
    const activityRows = renderActivityRows(STATE.activityLog.slice(0, 10));

    return (
      '<section class="view-section">' +
        demoBanner() +
        '<div class="metric-strip">' +
          metricCard('Candidates Sourced', STATE.metrics.totalSourced, 'Total sourced so far') +
          metricCard('Shortlisted', STATE.metrics.shortlisted, 'Above threshold') +
          metricCard('Outreach Sent', STATE.metrics.outreachSent, 'Active outbound actions') +
          metricCard('Replies', STATE.metrics.replies, 'Positive signal') +
          metricCard('Queued Approvals', STATE.metrics.queuedApprovals, 'Awaiting action') +
          metricCard('Active Jobs', STATE.metrics.activeJobs, activeJobs()[0]?.title || '') +
        '</div>' +
        '<div class="overview-grid">' +
          '<div class="surface">' +
            '<div class="section-head"><div><div class="label-caps">Pipelines</div><h2 class="section-title">Open Pipelines</h2></div></div>' +
            '<div class="table-shell"><table><thead><tr><th>Job Title</th><th>Status</th><th>Sourced</th><th>Shortlisted</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '</div>' +
          '<div class="surface">' +
            '<div class="section-head"><div><div class="label-caps">Live Activity</div><h2 class="section-title">Latest Events</h2></div></div>' +
            '<div class="activity-feed">' + activityRows + '</div>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderJobs() {
    const cards = activeJobs().map((job) => (
      '<article class="job-card job-border-active">' +
        `<div class="job-card-head"><div><h3 class="job-card-title">${esc(job.title)}</h3><div class="job-card-sub">${esc(job.client)} · ${esc(job.location || 'No location')}</div></div>${stageChip('approved')}</div>` +
        '<div class="job-bars">' +
          `<div class="job-bar-row"><span class="mini-progress"><span class="mini-progress-segment" style="width:${Math.min(100, (job.sourcedCount || 0) * 4)}%;background:var(--gray-fg);"></span></span><strong>${esc(job.sourcedCount || 0)} sourced</strong></div>` +
          `<div class="job-bar-row"><span class="mini-progress"><span class="mini-progress-segment" style="width:${Math.min(100, (job.shortlistedCount || 0) * 10)}%;background:var(--blue-fg);"></span></span><strong>${esc(job.shortlistedCount || 0)} shortlisted</strong></div>` +
        '</div>' +
        `<div class="button-row"><button class="btn btn-primary btn-sm" data-action="open-job" data-id="${esc(job.id)}">View Pipeline</button><button class="btn btn-secondary btn-sm" data-action="source-now" data-id="${esc(job.id)}">Source Now</button></div>` +
      '</article>'
    )).join('');

    return (
      '<section class="view-section">' +
        demoBanner() +
        '<form id="job-create-form" class="surface form-grid create-job-form">' +
          '<div class="form-span-2"><div class="label-caps">Launch Job</div><h2 class="section-title">Create New Pipeline</h2><div class="job-detail-sub">Add the brief here, then Raxion can source and sequence from this pipeline immediately.</div></div>' +
          '<div class="form-span-2"><span>Job Mode</span><div class="tab-row">' +
            '<button class="tab-button active" type="button">Outbound Only</button>' +
            '<button class="tab-button" type="button" disabled>Inbound Only</button>' +
            '<button class="tab-button" type="button" disabled>Both</button>' +
          '</div></div>' +
          '<label><span>Job Title</span><input class="input" name="job_title" placeholder="Senior Recruitment Consultant"></label>' +
          `<label><span>Client</span><input class="input" name="client" value="${esc(company)}"></label>` +
          '<label><span>Location</span><input class="input" name="location" placeholder="United Kingdom"></label>' +
          '<label><span>Sector</span><input class="input" name="sector" placeholder="Recruitment"></label>' +
          '<label><span>Seniority</span><input class="input" name="seniority" placeholder="Senior"></label>' +
          '<label><span>Must-have Skills</span><input class="input" name="skills" placeholder="Recruitment, BD, LinkedIn outreach"></label>' +
          '<label><span>Timezone</span><input class="input" name="timezone" value="Europe/London"></label>' +
          '<label><span>Send Window Start</span><input class="input" name="send_start" type="time" value="09:00"></label>' +
          '<label><span>Send Window End</span><input class="input" name="send_end" type="time" value="17:00"></label>' +
          '<label><span>LinkedIn Daily Limit</span><input class="input" name="linkedin_limit" type="number" min="1" value="28"></label>' +
          '<label class="form-span-2"><span>Role Notes</span><textarea class="input textarea" name="notes" placeholder="Any additional context for Raxion..."></textarea></label>' +
          '<label class="form-span-2"><span>Qualified Candidate Criteria</span><textarea class="input textarea" name="criteria" placeholder="e.g. Minimum 5 years billing experience, must have placed in financial services..."></textarea></label>' +
          '<div class="form-span-2 button-row"><button class="btn btn-primary" type="submit">Launch Pipeline</button></div>' +
        '</form>' +
        (cards ? '<div class="jobs-grid">' + cards + '</div>' : '') +
      '</section>'
    );
  }

  function candidateFitsTab(candidate) {
    if (candidate.jobId !== selectedJob()?.id) return false;
    const tab = STATE.selectedPipelineTab;
    if (tab === 'all') return candidate.stage !== 'archived';
    if (tab === 'shortlisted') return candidate.stage === 'shortlisted' || candidate.stage === 'outreach' || candidate.stage === 'replied';
    if (tab === 'outreach') return candidate.stage === 'outreach';
    if (tab === 'replies') return candidate.hasReplied;
    if (tab === 'archived') return candidate.stage === 'archived';
    return true;
  }

  function renderPipeline() {
    const job = selectedJob();
    if (!job) {
      return (
        '<section class="view-section">' +
          demoBanner() +
          '<div class="surface empty-hero"><div><div class="label-caps">Pipeline</div><h2 class="section-title">No Pipeline Yet</h2><div class="job-detail-sub">Launch your first pipeline to start the demo sourcing flow.</div></div><button class="btn btn-primary" data-action="goto-jobs">Launch your first pipeline</button></div>' +
        '</section>'
      );
    }

    const tabs = PIPELINE_TABS.map(([id, label]) => `<button class="tab-button${STATE.selectedPipelineTab === id ? ' active' : ''}" data-action="set-pipeline-tab" data-id="${esc(id)}">${esc(label)}</button>`).join('');
    if (STATE.selectedPipelineTab === 'activity') {
      return (
        '<section class="view-section">' +
          demoBanner() +
          '<div class="surface"><div class="job-detail-header"><div><div class="label-caps">Pipeline</div><h2 class="section-title">' + esc(job.title) + '</h2><div class="job-detail-sub">' + esc(job.client) + ' · ' + esc(job.location) + '</div></div><div class="button-row"><button class="btn btn-secondary btn-sm" data-action="source-now" data-id="' + esc(job.id) + '">Source Now</button></div></div>' +
          '<div class="tab-row pipeline-tabs">' + tabs + '</div><div class="activity-feed">' + renderActivityRows(selectedJobActivity()) + '</div></div></section>'
      );
    }

    const candidates = selectedJobCandidates().filter(candidateFitsTab);
    const rows = candidates.map((candidate) => (
      '<tr data-action="open-candidate" data-id="' + esc(candidate.id) + '">' +
        `<td><strong>${esc(candidate.name)}</strong></td>` +
        `<td>${esc(candidate.title)} / ${esc(candidate.company)}</td>` +
        `<td>${esc(candidate.experience)} yrs</td>` +
        `<td><span class="fit-score-text ${scoreClass(candidate.fitScore)}">${esc(candidate.fitScore)}</span></td>` +
        `<td>${tierChip(candidate.tier)}</td>` +
        `<td>${stageChip(candidate.stage)}</td>` +
        `<td>${esc(candidate.lastAction)}</td>` +
      '</tr>'
    )).join('') || '<tr><td colspan="7">No candidates in this view.</td></tr>';

    return (
      '<section class="view-section">' +
        demoBanner() +
        '<div class="surface">' +
          '<div class="job-detail-header"><div><div class="label-caps">Pipeline</div><h2 class="section-title">' + esc(job.title) + '</h2><div class="job-detail-sub">' + esc(job.client) + ' · ' + esc(job.location) + '</div></div><div class="button-row"><button class="btn btn-secondary btn-sm" data-action="source-now" data-id="' + esc(job.id) + '">Source Now</button></div></div>' +
          '<div class="tab-row pipeline-tabs">' + tabs + '</div>' +
          '<div class="table-shell"><table><thead><tr><th>Name</th><th>Current Role / Company</th><th>Experience</th><th>Fit Score</th><th>Tier</th><th>Stage</th><th>Last Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderArchived() {
    const candidates = STATE.candidates.filter((candidate) => candidate.stage === 'archived');
    const rows = candidates.map((candidate) => (
      '<tr data-action="open-candidate" data-id="' + esc(candidate.id) + '">' +
        `<td><strong>${esc(candidate.name)}</strong></td>` +
        `<td>${esc(candidate.title)} / ${esc(candidate.company)}</td>` +
        `<td>${esc(candidate.experience)} yrs</td>` +
        `<td><span class="fit-score-text ${scoreClass(candidate.fitScore)}">${esc(candidate.fitScore)}</span></td>` +
        `<td>${tierChip(candidate.tier)}</td>` +
        `<td>${esc(candidate.lastAction)}</td>` +
      '</tr>'
    )).join('') || '<tr><td colspan="6">No archived candidates.</td></tr>';
    return '<section class="view-section">' + demoBanner() + '<div class="surface"><div class="section-head"><div><div class="label-caps">Archived</div><h2 class="section-title">Archived Candidates</h2></div></div><div class="table-shell"><table><thead><tr><th>Name</th><th>Current Role / Company</th><th>Experience</th><th>Fit Score</th><th>Tier</th><th>Last Action</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></section>';
  }

  function renderInbox() {
    const replies = STATE.candidates.filter((candidate) => candidate.hasReplied);
    const cards = replies.map((candidate) => {
      const draft = STATE.inboxDrafts[candidate.id] || `Thanks ${candidate.name.split(' ')[0]} — appreciate the reply. The role is a ${selectedJob()?.title || 'senior recruitment position'} with clear desk ownership, BD responsibility, and strong growth potential. Happy to send over a short summary or set up a quick call if easier.`;
      return (
        '<article class="thread-card surface">' +
          `<div class="section-head"><div><div class="label-caps">Inbox</div><h2 class="section-title small">${esc(candidate.name)}</h2><div class="candidate-sub">${esc(candidate.title)} · ${esc(candidate.company)}</div></div><button class="btn btn-secondary btn-sm" data-action="toggle-draft" data-id="${esc(candidate.id)}">Draft Reply</button></div>` +
          `<div class="thread-preview">Hi, thanks for reaching out — I'd be open to hearing more about the opportunity. What does the role involve?</div>` +
          '<div class="reply-draft-block hidden" id="draft-' + esc(candidate.id) + '">' +
            `<textarea class="input textarea" data-draft-id="${esc(candidate.id)}">${esc(draft)}</textarea>` +
          '</div>' +
        '</article>'
      );
    }).join('') || '<div class="surface empty-state">No replies yet.</div>';
    return '<section class="view-section">' + demoBanner() + cards + '</section>';
  }

  function renderActivity() {
    return '<section class="view-section">' + demoBanner() + '<div class="surface"><div class="section-head"><div><div class="label-caps">Activity</div><h2 class="section-title">Global Activity Feed</h2></div></div><div class="activity-feed">' + renderActivityRows(STATE.activityLog) + '</div></div></section>';
  }

  function renderApprovals() {
    const cards = STATE.approvals.map((item) => {
      if (item.removed) return '';
      const approved = item.status === 'approved';
      return (
        '<article class="approval-card' + (approved ? ' approval-success' : '') + '" data-approval-id="' + esc(item.id) + '">' +
          '<div class="approval-card-head"><div class="approval-person-wrap"><div class="candidate-avatar avatar-' + esc(item.tier.toLowerCase()) + '">' + esc(initials(item.name)) + '</div><div><div class="approval-person">' + esc(item.name) + '</div><div class="candidate-sub">' + esc(item.title) + ' · ' + esc(item.jobTitle) + '</div></div></div><div class="approval-meta">' + scorePill(item.fitScore) + ' ' + tierChip(item.tier) + '</div></div>' +
          '<div class="approval-channel-row"><span class="approval-type ' + (item.channel === 'LinkedIn DM' ? 'approval-dm' : 'approval-email') + '">' + esc(item.channel) + '</span></div>' +
          '<blockquote class="approval-message"><em>' + esc(item.message) + '</em></blockquote>' +
          (approved
            ? '<div class="approval-confirmation">Approved — queued for sending window ✓</div>'
            : '<div class="button-row approval-actions"><button class="btn btn-success btn-sm" data-action="approve-approval" data-id="' + esc(item.id) + '">Approve</button><button class="btn btn-secondary btn-sm" data-action="skip-approval" data-id="' + esc(item.id) + '">Skip</button></div>') +
        '</article>'
      );
    }).join('') || '<div class="surface empty-state">No messages awaiting approval.</div>';
    return '<section class="view-section">' + demoBanner() + '<div class="approvals-stack">' + cards + '</div></section>';
  }

  function renderControls() {
    const cards = [
      ['Autonomous Sourcing', 'Raxion searches LinkedIn 24/7 using your job brief. It finds candidates, scores them against your criteria, and shortlists only those above your fit threshold. No manual searching, no browsing profiles.'],
      ['Smart Scoring', 'Every candidate gets a fit score from 0 to 100. HOT candidates (85+) match your must-haves and exceed your minimum experience. WARM candidates (70-84) are worth a look. COLD candidates are automatically archived.'],
      ['Inbound Application Screening', 'Launch a job post and Raxion pulls every applicant every morning, scores them, and drafts personalised replies to the best ones. Your team wakes up to ranked applicants and drafted responses before their first coffee.'],
      ['Telegram Approval Flow', 'Every outreach message is drafted by Raxion and sent to your Telegram for review before anything reaches a real person. Approve, edit, or skip from your phone, anywhere.'],
      ['Interview Scheduling', 'When a candidate is qualified, Raxion coordinates interview scheduling directly with your ATS. Your team gets a notification. The candidate gets booked. You never touch a calendar.'],
      ['Train Your Agent', 'Raxion learns your voice, your scoring criteria, and your reply style. Changes take effect on the next cycle. Update the guidance, press Save, and Raxion immediately works differently.'],
    ].map(([title, copy]) => '<div class="surface control-card"><div class="label-caps">Controls</div><h3 class="section-title small">' + esc(title) + '</h3><p>' + esc(copy) + '</p></div>').join('');
    return (
      '<section class="view-section">' +
        demoBanner() +
        '<div class="surface"><div class="section-head"><div><div class="label-caps">Controls</div><h2 class="section-title">How Raxion Works</h2></div></div><div class="controls-grid">' + cards + '</div></div>' +
        '<div class="surface controls-cta"><div><div class="label-caps">Deploy</div><h2 class="section-title">Ready to deploy Raxion at <span data-company>' + esc(company) + '</span>?</h2><p>Your recruiters close more. Your team does less admin. Raxion runs the rest.</p></div><div><a class="btn btn-primary" href="' + esc(BOOKING_URL) + '" target="_blank" rel="noreferrer">Book a call with LIBDR →</a><div class="candidate-sub cta-sub">Free 30-minute strategy session. We\'ll show you what Raxion would look like on your desk.</div></div></div>' +
      '</section>'
    );
  }

  function renderTrainAgent() {
    const tab = STATE.trainTab;
    const tabFields = tab === 'outreach'
      ? (
        '<div class="train-agent-grid">' +
          '<section class="surface train-agent-section"><div class="section-head"><div><div class="label-caps">Outreach</div><h3 class="section-title small">Voice Rules</h3></div></div><textarea class="input textarea" name="voiceRules">' + esc(STATE.trainAgent.outreach.voiceRules) + '</textarea></section>' +
          '<section class="surface train-agent-section"><div class="section-head"><div><div class="label-caps">Replies</div><h3 class="section-title small">Reply Handling</h3></div></div><textarea class="input textarea" name="replyHandling">' + esc(STATE.trainAgent.outreach.replyHandling) + '</textarea></section>' +
        '</div>'
      )
      : (
        '<div class="train-agent-grid">' +
          '<section class="surface train-agent-section"><div class="section-head"><div><div class="label-caps">Sourcing</div><h3 class="section-title small">Fit Criteria</h3></div></div><textarea class="input textarea" name="fitCriteria">' + esc(STATE.trainAgent.sourcing.fitCriteria) + '</textarea></section>' +
          '<section class="surface train-agent-section"><div class="section-head"><div><div class="label-caps">Sourcing</div><h3 class="section-title small">Exclusions</h3></div></div><textarea class="input textarea" name="exclusions">' + esc(STATE.trainAgent.sourcing.exclusions) + '</textarea></section>' +
        '</div>'
      );
    return (
      '<section class="view-section">' +
        demoBanner() +
        '<div class="metric-strip train-summary-grid">' +
          metricCard('Training Status', 'Live', 'Guidance active') +
          metricCard('Outreach', 'Voice', 'Voice + positioning') +
          metricCard('Replies', 'Closure', 'Closure + escalation') +
          metricCard('Sourcing', 'Fit', 'Fit + exclusions') +
        '</div>' +
        '<form id="train-agent-form" class="view-section">' +
          '<div class="tab-row"><button class="tab-button' + (tab === 'outreach' ? ' active' : '') + '" type="button" data-action="set-train-tab" data-id="outreach">Outreach</button><button class="tab-button' + (tab === 'sourcing' ? ' active' : '') + '" type="button" data-action="set-train-tab" data-id="sourcing">Sourcing</button></div>' +
          tabFields +
          '<div class="button-row"><button class="btn btn-primary" type="submit">Save & Apply</button></div>' +
        '</form>' +
      '</section>'
    );
  }

  function renderActivityRows(items) {
    return (items || []).map((item) => (
      '<div class="activity-event-row">' +
        '<div class="activity-timestamp">' + esc(relativeTime(item.createdAt)) + '</div>' +
        '<div class="activity-chip ' + esc(activityChip(item.type)) + '">' + esc(item.type) + '</div>' +
        '<div class="activity-description">' + esc(item.text) + '</div>' +
      '</div>'
    )).join('') || '<div class="empty-state">No activity yet.</div>';
  }

  function activityChip(type) {
    if (/MESSAGE|INVITE/.test(type)) return 'chip-message';
    if (/ENRICHMENT/.test(type)) return 'chip-enrichment';
    if (/REPLY/.test(type)) return 'chip-reply';
    if (/WINDOW/.test(type)) return 'chip-window';
    return 'chip-default';
  }

  function tierChip(tier) {
    const cls = tier === 'HOT' ? 'stage-replied' : tier === 'WARM' ? 'stage-dm' : 'stage-archived';
    return `<span class="stage-chip ${cls}">${esc(tier)}</span>`;
  }

  function renderCandidatePanel() {
    const candidate = STATE.candidates.find((item) => item.id === STATE.candidatePanelId);
    if (!candidate) return '';
    const history = candidate.stageHistory.map((item) => (
      '<div class="conversation-card"><div class="conversation-meta">' + esc(relativeTime(item.at)) + '</div><div><strong>' + esc(item.label) + '</strong><div>' + esc(item.text) + '</div></div></div>'
    )).join('');
    return (
      '<div class="drawer-backdrop" data-action="close-candidate"></div>' +
      '<aside class="drawer">' +
        '<div class="drawer-head"><div><div class="label-caps">Candidate</div><h2 class="section-title">' + esc(candidate.name) + '</h2><div class="candidate-sub">' + esc(candidate.title) + ' · ' + esc(candidate.company) + '</div></div><button class="btn btn-secondary btn-sm" data-action="close-candidate">Close</button></div>' +
        '<div class="drawer-body">' +
          '<div class="panel-block"><div class="panel-grid"><div><span class="panel-label">LinkedIn</span><strong><a href="' + esc(candidate.linkedinUrl) + '" target="_blank" rel="noreferrer">' + esc(candidate.linkedinHandle) + '</a></strong></div><div><span class="panel-label">Fit Score</span>' + scorePill(candidate.fitScore) + '</div><div><span class="panel-label">Tier</span>' + tierChip(candidate.tier) + '</div><div><span class="panel-label">Stage</span>' + stageChip(candidate.stage) + '</div></div></div>' +
          '<div class="panel-block"><div class="panel-label">Score rationale</div><p>' + esc(candidate.rationale) + '</p></div>' +
          '<div class="panel-block"><div class="panel-label">Stage history</div>' + history + '</div>' +
          (candidate.stage === 'shortlisted'
            ? '<div class="button-row"><button class="btn btn-primary btn-sm" data-action="queue-outreach" data-id="' + esc(candidate.id) + '">Queue for Outreach</button></div>'
            : '') +
        '</div>' +
      '</aside>'
    );
  }

  function renderSourcingOverlay() {
    if (!STATE.sourcingActive) return '';
    return (
      '<div class="sourcing-card">' +
        '<div class="sourcing-head"><div class="sourcing-spinner"></div><div><strong>Raxion is sourcing...</strong><div class="candidate-sub">' + esc(SOURCE_MESSAGES[STATE.sourcingMessageIndex]) + '</div></div></div>' +
        '<div class="sourcing-count">' + esc(STATE.sourcingCount) + ' candidates found</div>' +
        '<div class="mini-progress"><span class="mini-progress-segment" style="width:' + esc(Math.min(100, STATE.sourcingCount * 4)) + '%;background:var(--accent);"></span></div>' +
      '</div>'
    );
  }

  function renderWelcomeModal() {
    if (!STATE.welcomeOpen) return '';
    return (
      '<div class="modal-backdrop welcome-backdrop"></div>' +
      '<div class="modal-shell welcome-shell">' +
        '<div class="surface modal-card welcome-card">' +
          '<button class="welcome-close" type="button" data-action="dismiss-welcome" aria-label="Close">×</button>' +
          '<div class="label-caps">Welcome</div>' +
          '<h2 class="section-title">Welcome to Raxion for ' + esc(company) + '</h2>' +
          '<p class="welcome-copy">This demo is set up to show how Raxion sources, scores, drafts outreach, handles approvals, and trains to your operating style. Start with Controls to see exactly what the system does.</p>' +
          '<div class="button-row"><button class="btn btn-primary" type="button" data-action="dismiss-welcome">See How Raxion Works</button></div>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    recomputeMetrics();
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.view === STATE.view);
    });
    const views = {
      overview: renderOverview,
      jobs: renderJobs,
      pipeline: renderPipeline,
      archived: renderArchived,
      inbox: renderInbox,
      activity: renderActivity,
      approvals: renderApprovals,
      controls: renderControls,
      'train-agent': renderTrainAgent,
    };
    app.innerHTML = (views[STATE.view] || renderOverview)();
    drawerRoot.innerHTML = renderCandidatePanel();
    overlayRoot.innerHTML = renderSourcingOverlay() + renderWelcomeModal();
    document.querySelectorAll('[data-company]').forEach((node) => {
      node.textContent = company;
    });
    document.querySelectorAll('[data-draft-id]').forEach((node) => {
      node.addEventListener('input', (event) => {
        STATE.inboxDrafts[event.target.dataset.draftId] = event.target.value;
      });
    });
  }

  function addStageHistory(candidate, label, text) {
    candidate.stageHistory.unshift({ label, text, at: nowIso() });
  }

  function createCandidate(job) {
    const first = randomFrom(FIRST_NAMES);
    const last = randomFrom(LAST_NAMES);
    const fitBucket = Math.random();
    let fitScore = 0;
    if (fitBucket < 0.3) fitScore = rand(80, 95);
    else if (fitBucket < 0.7) fitScore = rand(65, 79);
    else fitScore = rand(40, 64);
    const tier = fitScore >= 80 ? 'HOT' : fitScore >= 65 ? 'WARM' : 'COLD';
    const stage = tier === 'HOT' ? 'shortlisted' : tier === 'WARM' ? 'sourced' : 'archived';
    const name = `${first} ${last}`;
    const title = randomFrom(TITLES);
    const employer = randomFrom(COMPANIES);
    const experience = rand(3, 15);
    const linkedinHandle = `linkedin.com/in/${slugify(name)}`;
    const rationale = `${first} is currently a ${title} at ${employer} with ${experience} years of relevant experience. Their background maps cleanly to ${job.title} because it combines delivery ownership, commercial credibility, and direct market overlap.`;
    const candidate = {
      id: `candidate_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      jobId: job.id,
      name,
      title,
      company: employer,
      experience,
      fitScore,
      tier,
      stage,
      lastAction: stage === 'archived' ? 'Auto-archived after scoring' : stage === 'shortlisted' ? 'Shortlisted just now' : 'Sourced just now',
      rationale,
      linkedinUrl: `https://${linkedinHandle}`,
      linkedinHandle,
      hasReplied: tier === 'HOT' && Math.random() < 0.1,
      location: randomFrom(LOCATIONS),
      stageHistory: [
        { label: 'Profile Found', text: `Matched ${name} to ${job.title}`, at: nowIso() },
        { label: 'Fit Scored', text: `${fitScore}/100 · ${tier}`, at: nowIso() },
      ],
    };
    if (candidate.hasReplied) {
      candidate.stage = 'replied';
      candidate.lastAction = 'Positive reply received';
      addStageHistory(candidate, 'Reply Received', `${name} replied positively to the outreach.`);
    }
    return candidate;
  }

  function createApproval(candidate, job) {
    return {
      id: `approval_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      candidateId: candidate.id,
      jobId: job.id,
      jobTitle: job.title,
      name: candidate.name,
      title: `${candidate.title} · ${candidate.company}`,
      fitScore: candidate.fitScore,
      tier: candidate.tier,
      channel: Math.random() < 0.75 ? 'LinkedIn DM' : 'Email',
      message: `${candidate.name.split(' ')[0]}, noticed your work as ${candidate.title} at ${candidate.company}. We're building a ${job.title} search for ${job.client} and your background looked especially relevant. Open to a brief conversation if the timing is right?`,
      status: 'pending',
    };
  }

  function completeSourcing(job) {
    clearInterval(STATE.sourcingTimer);
    clearTimeout(STATE.sourcingCompleteTimer);
    const count = rand(18, 27);
    const created = Array.from({ length: count }, () => createCandidate(job));
    created.forEach((candidate) => STATE.candidates.push(candidate));
    const hot = created.filter((candidate) => candidate.tier === 'HOT').slice(0, rand(3, 5));
    hot.forEach((candidate) => {
      candidate.stage = candidate.hasReplied ? 'replied' : 'outreach';
      candidate.lastAction = candidate.hasReplied ? 'Positive reply received' : 'Queued for approval';
      addStageHistory(candidate, 'Queued for Outreach', `Drafted outreach for ${candidate.name}.`);
      STATE.approvals.push(createApproval(candidate, job));
    });
    pushActivity('SOURCING_COMPLETE', `Sourcing complete — ${count} candidates found, ${created.filter((item) => item.tier !== 'COLD').length} shortlisted, ${hot.length} queued for approval`, job.id);
    STATE.sourcingActive = false;
    STATE.sourcingJobId = null;
    STATE.sourcingCount = 0;
    STATE.sourcingMessageIndex = 0;
    STATE.view = 'pipeline';
    STATE.selectedJobId = job.id;
    STATE.selectedPipelineTab = 'all';
    render();
  }

  function startSourcing(job) {
    if (STATE.sourcingActive) return;
    STATE.sourcingActive = true;
    STATE.sourcingJobId = job.id;
    STATE.sourcingCount = 0;
    STATE.sourcingMessageIndex = 0;
    render();
    STATE.sourcingTimer = setInterval(() => {
      STATE.sourcingCount += rand(1, 3);
      STATE.sourcingMessageIndex = (STATE.sourcingMessageIndex + 1) % SOURCE_MESSAGES.length;
      render();
    }, 350);
    STATE.sourcingCompleteTimer = setTimeout(() => completeSourcing(job), 10000);
  }

  function launchJob(form) {
    const titleField = form.querySelector('[name="job_title"]');
    if (!titleField.value.trim()) {
      titleField.classList.add('input-error');
      setTimeout(() => titleField.classList.remove('input-error'), 600);
      return;
    }
    const job = {
      id: `job_${Date.now()}`,
      title: titleField.value.trim(),
      client: form.querySelector('[name="client"]').value.trim() || company,
      location: form.querySelector('[name="location"]').value.trim() || 'United Kingdom',
      sector: form.querySelector('[name="sector"]').value.trim() || 'Recruitment',
      seniority: form.querySelector('[name="seniority"]').value.trim() || 'Senior',
      skills: form.querySelector('[name="skills"]').value.trim(),
      mode: 'Outbound Only',
      timezone: form.querySelector('[name="timezone"]').value.trim() || 'Europe/London',
      sendWindowStart: form.querySelector('[name="send_start"]').value || '09:00',
      sendWindowEnd: form.querySelector('[name="send_end"]').value || '17:00',
      linkedinLimit: Number(form.querySelector('[name="linkedin_limit"]').value || 28),
      notes: form.querySelector('[name="notes"]').value.trim(),
      qualifiedCriteria: form.querySelector('[name="criteria"]').value.trim(),
      status: 'ACTIVE',
      sourcedCount: 0,
      shortlistedCount: 0,
      createdAt: nowIso(),
    };
    STATE.jobs.unshift(job);
    STATE.selectedJobId = job.id;
    pushActivity('JOB_LAUNCHED', `Pipeline launched: ${job.title} for ${job.client}`, job.id);
    STATE.view = 'pipeline';
    render();
    startSourcing(job);
  }

  function queueOutreach(candidateId) {
    const candidate = STATE.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const job = STATE.jobs.find((item) => item.id === candidate.jobId);
    candidate.stage = 'outreach';
    candidate.lastAction = 'Queued for approval';
    addStageHistory(candidate, 'Queued for Outreach', 'Candidate manually queued from drawer.');
    STATE.approvals.unshift(createApproval(candidate, job));
    pushActivity('MESSAGE_DRAFTED', `DM drafted for ${candidate.name} — awaiting approval`, candidate.jobId);
    render();
  }

  function approveApproval(id) {
    const approval = STATE.approvals.find((item) => item.id === id);
    if (!approval) return;
    approval.status = 'approved';
    pushActivity('APPROVAL_ACTIONED', `DM to ${approval.name} approved — queued for sending window`, approval.jobId);
    toast('Message approved and queued.', 'success');
    render();
  }

  function skipApproval(id) {
    const approval = STATE.approvals.find((item) => item.id === id);
    if (!approval) return;
    pushActivity('APPROVAL_SKIPPED', `DM to ${approval.name} skipped`, approval.jobId);
    const node = document.querySelector(`[data-approval-id="${id}"]`);
    if (node) node.classList.add('approval-faded');
    setTimeout(() => {
      approval.removed = true;
      render();
    }, 220);
  }

  function autoActivityTick() {
    if (!activeJobs().length) return;
    const job = randomFrom(activeJobs());
    const candidates = STATE.candidates.filter((item) => item.jobId === job.id);
    if (!candidates.length) return;
    const candidate = randomFrom(candidates);
    const type = randomFrom(ACTIVITY_POOL);
    const messages = {
      CANDIDATE_SOURCED: `Sourced ${candidate.name} for ${job.title}`,
      CANDIDATE_SCORED: `${candidate.name} scored ${candidate.fitScore} — ${candidate.tier} (${job.title})`,
      INVITE_SENT: `LinkedIn connection request sent to ${candidate.name}`,
      INVITE_ACCEPTED: `${candidate.name} accepted connection request — DM drafted`,
      MESSAGE_DRAFTED: `DM drafted for ${candidate.name} — awaiting approval`,
      ENRICHMENT_COMPLETE: `Email found for ${candidate.name} via KASPR — verified`,
      OUTSIDE_SENDING_WINDOW: `Outside sending window for ${job.title} — sourcing and scoring continue`,
    };
    pushActivity(type, messages[type], job.id);
    render();
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action], .nav-link');
      if (!trigger) return;

      if (trigger.classList.contains('nav-link')) {
        event.preventDefault();
        STATE.view = trigger.dataset.view;
        window.location.hash = STATE.view;
        render();
        return;
      }

      const action = trigger.dataset.action;
      const id = trigger.dataset.id;
      if (action === 'goto-jobs') {
        STATE.view = 'jobs';
        render();
      } else if (action === 'open-job') {
        STATE.selectedJobId = id;
        STATE.view = 'pipeline';
        render();
      } else if (action === 'source-now') {
        const job = STATE.jobs.find((item) => item.id === id);
        if (job) startSourcing(job);
      } else if (action === 'set-pipeline-tab') {
        STATE.selectedPipelineTab = id;
        render();
      } else if (action === 'open-candidate') {
        STATE.candidatePanelId = id || trigger.closest('tr')?.dataset.id;
        render();
      } else if (action === 'close-candidate') {
        STATE.candidatePanelId = null;
        render();
      } else if (action === 'queue-outreach') {
        queueOutreach(id);
      } else if (action === 'approve-approval') {
        approveApproval(id);
      } else if (action === 'skip-approval') {
        skipApproval(id);
      } else if (action === 'set-train-tab') {
        STATE.trainTab = id;
        render();
      } else if (action === 'toggle-draft') {
        const el = document.getElementById(`draft-${id}`);
        if (el) el.classList.toggle('hidden');
      } else if (action === 'dismiss-welcome') {
        STATE.welcomeOpen = false;
        STATE.view = 'controls';
        window.location.hash = 'controls';
        render();
      }
    });

    document.addEventListener('submit', (event) => {
      if (event.target.id === 'job-create-form') {
        event.preventDefault();
        launchJob(event.target);
      }
      if (event.target.id === 'train-agent-form') {
        event.preventDefault();
        const form = event.target;
        if (STATE.trainTab === 'outreach') {
          STATE.trainAgent.outreach.voiceRules = form.querySelector('[name="voiceRules"]').value;
          STATE.trainAgent.outreach.replyHandling = form.querySelector('[name="replyHandling"]').value;
        } else {
          STATE.trainAgent.sourcing.fitCriteria = form.querySelector('[name="fitCriteria"]').value;
          STATE.trainAgent.sourcing.exclusions = form.querySelector('[name="exclusions"]').value;
        }
        pushActivity('AGENT_TRAINING_UPDATED', 'Train Agent guidance updated — changes live on next cycle');
        toast('Guidance saved. Raxion updated.', 'success');
        render();
      }
    });

    document.getElementById('refresh-dashboard').addEventListener('click', () => {
      toast('Dashboard refreshed.', 'success');
      render();
    });

    document.getElementById('launch-job').addEventListener('click', () => {
      STATE.view = 'jobs';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('toggle-sidebar').addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    window.addEventListener('hashchange', () => {
      STATE.view = (window.location.hash || '#overview').slice(1) || 'overview';
      render();
    });
  }

  function init() {
    pushActivity('DEMO_READY', `Mission Control demo initialised for ${company}`);
    bindEvents();
    STATE.activityTicker = setInterval(autoActivityTick, 8000);
    render();
    showWelcomeModal();
  }

  function showWelcomeModal() {
    const storageKey = `raxion-demo-welcome:${window.location.pathname || '/'}`;
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, '1');
    STATE.welcomeOpen = true;
    render();
  }

  init();
})();
