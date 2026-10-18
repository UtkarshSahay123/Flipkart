(() => {
  if (document.querySelector('roadguard-chitti')) return;
  document.getElementById('trafficaide-fab')?.remove();
  document.getElementById('trafficaide-overlay')?.remove();
  const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';
  const apiBase = isLocalHost
    ? `http://${['localhost', '127.0.0.1'].includes(location.hostname) ? location.hostname : 'localhost'}:8001`
    : location.origin;
  const widget = document.createElement('roadguard-chitti');
  document.body.appendChild(widget);
  const shadow = widget.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{font-family:Inter,system-ui,sans-serif;color:#0a2342}
      *{box-sizing:border-box}
      .launcher{position:fixed;z-index:1000;right:24px;bottom:24px;border:0;border-radius:999px;background:#0755c9;color:white;padding:15px 20px;font-weight:800;box-shadow:0 8px 28px #0a234255;cursor:pointer}
      .panel{position:fixed;z-index:1001;right:20px;bottom:88px;width:min(390px,calc(100vw - 24px));height:min(570px,calc(100vh - 115px));display:none;flex-direction:column;overflow:hidden;border:1px solid #d9e1ef;border-radius:18px;background:#fff;box-shadow:0 20px 60px #06152c44}
      .panel.open{display:flex}.head{display:flex;align-items:center;justify-content:space-between;padding:15px 17px;background:#0755c9;color:#fff}.head strong{font-size:15px}.head small{display:block;margin-top:3px;color:#dbeafe}.head button{border:0;background:transparent;color:white;font-size:22px;cursor:pointer}
      .messages{flex:1;overflow:auto;padding:14px;background:#f7f9fd}.message{width:fit-content;max-width:88%;margin:0 0 10px;padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #d9e1ef;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.message.user{margin-left:auto;background:#0755c9;border-color:#0755c9;color:white}
      .prompts{display:flex;gap:6px;overflow:auto;padding:8px;border-top:1px solid #e2e8f0}.prompts button{flex:none;border:1px solid #cbd5e1;border-radius:99px;background:#f8fafc;padding:6px 9px;color:#334155;font-size:11px;cursor:pointer}
      form{display:flex;gap:8px;padding:10px;border-top:1px solid #d9e1ef}input{min-width:0;flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:13px Inter,system-ui}form button{border:0;border-radius:10px;background:#0755c9;color:#fff;padding:0 15px;font-weight:700;cursor:pointer}
      @media(max-width:480px){.launcher{right:14px;bottom:14px}.panel{right:12px;bottom:75px}}
      .bug-backdrop{position:fixed;z-index:1002;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:#06101dcc}
      .bug-backdrop.open{display:flex}.bug-dialog{width:min(570px,100%);max-height:calc(100vh - 32px);overflow:auto;border:1px solid #253140;border-radius:16px;background:#0f1723;color:#e2e8f0;box-shadow:0 24px 70px #0009}
      .bug-head{display:flex;align-items:center;justify-content:space-between;padding:12px 24px 0}.bug-head strong{font-size:18px;font-weight:700}.bug-head button{border:0;background:transparent;color:#d6deea;font-size:24px;cursor:pointer;line-height:1}
      .bug-intro{margin:6px 24px 17px;color:#98a7bc;font-size:16px;line-height:1.5}
      .bug-form{display:grid;gap:14px;padding:0 24px 18px}.bug-form label{display:grid;gap:6px;font-size:15px;font-weight:700;color:#e2e8f0}.bug-form input,.bug-form select,.bug-form textarea{width:100%;border:1px solid #394554;border-radius:15px;background:#1b2430;padding:12px 15px;font:16px Inter,system-ui;color:#e2e8f0;outline:none}.bug-form input:focus,.bug-form select:focus,.bug-form textarea:focus{border-color:#00b9e8;box-shadow:0 0 0 4px #00b9e833}.bug-form input::placeholder,.bug-form textarea::placeholder{color:#77869a}.bug-form textarea{min-height:80px;resize:vertical;line-height:1.5}.bug-actions{display:flex;justify-content:flex-end;gap:12px;padding-top:3px}.bug-form .bug-cancel,.bug-form .bug-submit{border:1px solid #253140;border-radius:12px;padding:10px 16px;font:700 14px Inter,system-ui;cursor:pointer}.bug-form .bug-cancel{background:transparent;color:#e2e8f0}.bug-form .bug-submit{border-color:#00b9e8;background:#00b9e8;color:#06101d}.bug-form .bug-submit:disabled{opacity:.6;cursor:wait}.bug-status{margin:0;padding:0 24px 18px;color:#cbd5e1;font-size:13px;line-height:1.5}
      @media(prefers-reduced-motion:no-preference){.panel{animation:rise .16s ease-out}@keyframes rise{from{transform:translateY(8px);opacity:.7}to{transform:translateY(0);opacity:1}}}
    </style>
    <button class="launcher" type="button" aria-expanded="false">✦ Ask Chitti</button>
    <section class="panel" role="dialog" aria-label="Chitti assistant">
      <header class="head"><div><strong>Chitti Assistant</strong><small>Live road issue information</small></div><button type="button" aria-label="Close assistant">×</button></header>
      <div class="messages" aria-live="polite"></div>
      <div class="prompts"></div>
      <form><input aria-label="Ask Chitti" placeholder="Ask about road issues..." autocomplete="off" required><button type="submit">Send</button></form>
    </section>
    <div class="bug-backdrop" role="presentation"><section class="bug-dialog" role="dialog" aria-modal="true" aria-labelledby="bug-title"><header class="bug-head"><strong id="bug-title">Report a bug</strong><button type="button" aria-label="Close report form">×</button></header><p class="bug-intro">Tell us what went wrong. The current page is attached automatically.</p><form class="bug-form"><label>Title<input name="title" minlength="3" maxlength="160" required placeholder="Short summary"></label><label>What happened?<textarea name="description" minlength="10" maxlength="6000" required placeholder="Steps to reproduce, what you expected, what you saw"></textarea></label><label>Severity<select name="severity"><option value="MEDIUM" selected>MEDIUM</option><option value="LOW">LOW</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label><div class="bug-actions"><button class="bug-cancel" type="button">Cancel</button><button class="bug-submit" type="submit">Submit report</button></div></form><p class="bug-status" aria-live="polite"></p></section></div>`;
  const $ = selector => shadow.querySelector(selector);
  const launcher = $('.launcher'), panel = $('.panel'), messagesNode = $('.messages'), input = $('input');
  const bugBackdrop = $('.bug-backdrop'), bugForm = $('.bug-form'), bugStatus = $('.bug-status');
  const bugButtonStyle = document.createElement('style');
  bugButtonStyle.textContent = `
    .roadguard-bug-launcher{display:inline-flex;align-items:center;justify-content:center;flex:none;white-space:nowrap;margin-left:8px;padding:9px 13px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0a2342;font:700 12px Inter,system-ui,sans-serif;box-shadow:0 2px 8px #0a234211;cursor:pointer}
    .roadguard-bug-launcher:hover{border-color:#0755c9;color:#0755c9;background:#f7f9fd}
    .roadguard-bug-launcher:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
    @media(max-width:520px){.roadguard-bug-launcher{font-size:11px;padding:8px 9px;margin-left:5px}}
  `;
  document.head.appendChild(bugButtonStyle);
  const bugLauncher = document.createElement('button');
  bugLauncher.type = 'button'; bugLauncher.className = 'roadguard-bug-launcher'; bugLauncher.textContent = 'Report a bug';
  bugLauncher.setAttribute('aria-label', 'Report a bug');
  const mountBugLauncher = () => {
    if (bugLauncher.isConnected) return;
    const header = document.querySelector('header') || document.querySelector('nav');
    if (!header) return;
    const actionGroup = header.querySelector(':scope > .nav-links') || header.querySelector(':scope > div:last-child') || header;
    const profile = header.querySelector('#profile-dropdown-container') || (actionGroup !== header && !actionGroup.matches('.nav-links') ? actionGroup.lastElementChild : null);
    if (profile?.parentElement) profile.parentElement.insertBefore(bugLauncher, profile);
    else actionGroup.appendChild(bugLauncher);
  };
  mountBugLauncher();
  new MutationObserver(mountBugLauncher).observe(document.body, { childList: true, subtree: true });
  let history = [], issues = [], isBusy = false;
  const prompts = ['Show high-priority issues', 'Any issues unattended for two days?', 'Summarize current reports'];
  const promptsNode = $('.prompts');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const addMessage = (text, role = 'assistant') => {
    const node = document.createElement('div');
    node.className = `message${role === 'user' ? ' user' : ''}`;
    const parts = String(text ?? '').split(/(https:\/\/www\.openstreetmap\.org\/[^\s]+)/g);
    parts.forEach(part => {
      if (/^https:\/\/www\.openstreetmap\.org\//.test(part)) {
        const link = document.createElement('a'); link.href = part; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = part; link.style.color = role === 'user' ? 'white' : '#0755c9'; node.appendChild(link);
      } else node.appendChild(document.createTextNode(part));
    });
    messagesNode.appendChild(node);
    messagesNode.scrollTop = messagesNode.scrollHeight;
    return node;
  };
  addMessage('Namaste! I’m Chitti. Ask me about current road issues, priorities, and reported locations.');
  prompts.forEach(prompt => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = prompt;
    button.addEventListener('click', () => send(prompt)); promptsNode.appendChild(button);
  });
  const loadIssues = async () => {
    try {
      const response = await fetch(`${apiBase}/api/issues`);
      if (response.ok) { const result = await response.json(); issues = Array.isArray(result) ? result : (result.issues || []); }
    } catch { /* Chitti can still answer general questions if live issue data is unavailable. */ }
  };
  const send = async text => {
    if (isBusy || !text.trim()) return;
    isBusy = true; addMessage(text, 'user'); await loadIssues();
    let userCoords = null;
    if (/\b(near me|nearby|near my|around me|near here|close to me)\b/i.test(text) && navigator.geolocation) {
      userCoords = await new Promise(resolve => navigator.geolocation.getCurrentPosition(
        position => resolve([position.coords.latitude, position.coords.longitude]), () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      ));
    }
    const waiting = addMessage('Checking the latest RoadGuard information…');
    const now = Date.now();
    const context = { issues: issues.slice(0, 200).map(issue => ({
      id: issue.id, title: issue.title, category: issue.category, status: issue.status,
      priority: issue.priority, reportCount: issue.report_count || issue.reportCount,
      location: issue.location || issue.location_name || issue.locationName,
      reportedAt: issue.reported_at || issue.reportedAt
    })), source: 'Public RoadGuard website', checkedAt: new Date(now).toISOString() };
    try {
      const response = await fetch(`${apiBase}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, location: 'RoadGuard website', user_coords: userCoords, context, history: history.slice(-10) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Chitti is temporarily unavailable. Please try again shortly.');
      waiting.remove(); addMessage(result.reply || 'I could not prepare a response just now.');
      history.push({ role: 'user', text }, { role: 'assistant', text: result.reply || '' });
    } catch (error) { waiting.remove(); addMessage(error.message); }
    finally { isBusy = false; }
  };
  launcher.addEventListener('click', () => {
    const open = !panel.classList.contains('open'); panel.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', String(open)); if (open) { loadIssues(); input.focus(); }
  });
  $('.head button').addEventListener('click', () => { panel.classList.remove('open'); launcher.setAttribute('aria-expanded', 'false'); });
  bugLauncher.addEventListener('click', () => { bugBackdrop.classList.add('open'); bugStatus.textContent = ''; bugForm.querySelector('textarea').focus(); });
  $('.bug-head button').addEventListener('click', () => bugBackdrop.classList.remove('open'));
  $('.bug-cancel').addEventListener('click', () => { bugBackdrop.classList.remove('open'); bugForm.reset(); bugStatus.textContent = ''; });
  bugBackdrop.addEventListener('click', event => { if (event.target === bugBackdrop) bugBackdrop.classList.remove('open'); });
  bugForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('.bug-submit'), values = Object.fromEntries(new FormData(bugForm).entries());
    values.title = String(values.title || '').trim();
    values.description = String(values.description || '').trim();
    if (values.title.length < 3) { bugStatus.textContent = 'Please enter a title with at least 3 characters.'; return; }
    if (values.description.length < 10) { bugStatus.textContent = 'Please describe what happened in at least 10 characters.'; return; }
    submit.disabled = true; submit.textContent = 'Sending…'; bugStatus.textContent = 'Sending your report…';
    try {
      const response = await fetch(`${apiBase}/api/bug-reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, page_url: location.href.slice(0, 1000), user_agent: navigator.userAgent.slice(0, 500) }) });
      const result = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(result.detail)
          ? result.detail.map(item => `${item.loc?.slice(-1)[0] || 'Field'}: ${item.msg}`).join(' ')
          : result.detail;
        throw new Error(detail || 'Could not send your report. Please try again.');
      }
      bugStatus.textContent = 'Thanks. Your report was sent to the Road Guard team.'; bugForm.reset();
    } catch (error) { bugStatus.textContent = error.message || 'Could not send your report. Please try again.'; }
    finally { submit.disabled = false; submit.textContent = 'Send report'; }
  });
  $('form').addEventListener('submit', event => { event.preventDefault(); const text = input.value.trim(); input.value = ''; send(text); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); launcher.setAttribute('aria-expanded', 'false'); } });
})();
