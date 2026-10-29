/* Approved affiliate design reference. All prototype state stays here; no account/API writes. */
(function () {
  'use strict';
  const P = '../assets/';
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    agents:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 4a4 4 0 0 1 0 7M22 21v-2a5 5 0 0 0-3-4.6"/>',
    money:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5a2 2 0 0 1 2-2h12M17 11h4v6h-4a3 3 0 0 1 0-6Z"/><path d="M17 14h.01"/>',
    me:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
    right:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m6 9 6 6 6-6"/>', back:'<path d="m12 19-7-7 7-7M5 12h14"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    share:'<path d="M12 16V3m-5 5 5-5 5 5M5 12H3v9h18v-9h-2"/>', store:'<path d="m3 7 3-4h12l3 4v4a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM5 14v7h14v-7M10 21v-6h4v6"/>',
    sales:'<path d="M5 3h14v19l-3-2-4 2-4-2-3 2Z M8 7h8M8 11h8M8 15h4"/>', page:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 8h18M8 8v13"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    send:'<path d="m22 2-7 20-4-9-9-4Z M22 2 11 13"/>', plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12 4 4L19 6"/>',
    edit:'<path d="m16 3 5 5-12 12-6 1 1-6Z M13 6l5 5"/>', help:'<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01"/>', settings:'<path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', out:'<path d="M10 3H4v18h6M9 12h13m-5-5 5 5-5 5"/>'
  };
  const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const php = value => '₱' + value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
  const face = (key, size, name) => CL.face(key, size, name);
  const chevron = icon('right', 'ar-chevron');
  const go = (view, label, cls = '', attrs = '') => `<button type="button" data-go="${view}" class="${cls}" ${attrs}>${label}</button>`;
  const action = (name, label, cls = '', attrs = '') => `<button type="button" data-action="${name}" class="${cls}" ${attrs}>${label}</button>`;
  const button = (view, label, secondary = false) => go(view, label, 'ar-btn' + (secondary ? ' ar-secondary' : ''));
  const back = (view, title) => `<div class="ar-backbar">${go(view, icon('back'), 'ar-round', 'aria-label="Back" data-back="true"')}<b>${title}</b><span></span></div>`;
  const help = text => `<p class="ar-help">${icon('info')}<span>${text}</span></p>`;
  const track = (months, label) => `<span class="ar-track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="12" aria-valuenow="${months}"><i style="--progress:${months / 12 * 100}%"></i></span>`;
  const samples = {
    oct: { month: 'October', total: 4950, direct: 4250, team: 700 },
    sep: { month: 'September', total: 3000, direct: 2000, team: 1000 },
    agents: [
      { key:'paolo', name:'Paolo Reyes', amount:250, months:9, until:'27 Jul 2028', joined:'27 Jul 2027', lifetime:1000 },
      { key:'joy', name:'Joy Dizon', amount:200, months:6, until:'27 Apr 2028', joined:'27 Apr 2027', lifetime:1200 },
      { key:'rina', name:'Rina Villanueva', amount:150, months:3, until:'27 Jan 2028', joined:'27 Jan 2027', lifetime:1500 },
      { key:'carlo', name:'Carlo Bautista', amount:100, months:0, until:'22 Oct 2027', joined:'22 Oct 2026', lifetime:2000 }
    ],
    sales: [
      {name:'Kalan Kitchen',price:4999,commission:2500,date:'27 Oct',status:'Paid',asset:'people/15-carinderia.jpg'},
      {name:'Héla Hair Studio',price:3499,commission:1750,date:'24 Oct',status:'Paid',asset:'people/12-salon.jpg'},
      {name:'Panaderya Sunrise',price:2499,commission:1250,date:'22 Oct',status:'Awaiting payment',asset:'people/02-panaderya.jpg'}
    ]
  };
  const monthShare = (s,a) => s.month==='sep' ? ({paolo:400,joy:300,rina:200,carlo:100}[a.key]||0) : a.amount;
  const tabs = active => `<nav class="ar-tabs" aria-label="Creator navigation">${[['home','Home'],['agents','Agents'],['money','Money'],['me','Me']].map(([key,label]) => go(key, `<i>${icon(key)}</i><span>${label}</span>`, active === key ? 'is-on' : '', `aria-label="${label}"${active === key ? ' aria-current="page"' : ''}`)).join('')}</nav>`;
  const footer = (content, pushed = false) => `<div class="ar-action${pushed ? ' ar-action-pushed' : ''}">${content}</div>`;
  const body = (content, extra = '') => `<div class="ar-body ${extra}">${content}</div>`;
  const menu = rows => `<div class="ar-card ar-menu">${rows.map(([view,label,ic,meta]) => go(view, `${icon(ic)}<span>${label}</span>${meta ? `<small>${meta}</small>` : ''}${chevron}`)).join('')}</div>`;
  const ledger = (name, sub, amount, type = 'store', transfer = false) => `<div class="ar-ledger-row"><span class="ar-ledger-icon${transfer ? ' ar-transfer' : ''}">${icon(type)}</span><span class="ar-ledger-info"><b>${name}</b><span>${sub}</span></span><strong class="ar-ledger-value">${amount}</strong></div>`;
  const empty = (title, copy, label, dest) => `<div class="ar-empty">${icon('agents')}<h2>${title}</h2><p>${copy}</p>${label ? button(dest,label) : ''}</div>`;
  function home(s) {
    const m = samples[s.month];
    return body(`<div class="ar-topline"><div class="ar-greeting">${face('mika',42,'Mika Santos')}<div><p>Your creator account</p><b>Hi, Mika</b></div></div>${go('notifications', icon('bell'), 'ar-round', 'aria-label="Notifications"')}</div>
      <div class="ar-earn-card">${action('month',`${m.month} ${icon('down')}`,'ar-month-switch','aria-label="Change earnings month"')}<span class="ar-number">${php(m.total)}</span><span class="ar-lab">${m.month} earnings</span></div>
      <div class="ar-source-grid">${go('sales',`<span class="ar-source-icon">${icon('link')}Your link</span><strong>${php(m.direct)}</strong><small>Paid website sales</small>`)}${go('agents',`<span class="ar-source-icon">${icon('agents')}Your agents</span><strong>${php(m.team)}</strong><small>5% team commission</small>`)}</div>
      <div class="ar-shortcuts">${go('sales',`Sales ${chevron}`)}${go('page',`My page ${chevron}`)}</div>
      <div class="ar-url">${icon('link')}<span>tendso.com/v2/a/mika</span>${action('copy',icon('copy'),'','aria-label="Copy shop link"')}</div>`, 'ar-has-action') + footer(action('share',`${icon('share')}Share my shop link`,'ar-btn')) + tabs('home');
  }
  function agents(s) {
    const rows = samples.agents.filter(a => s.agentFilter !== 'ended' || a.months === 0);
    return body(`<div class="ar-topline"><h1>Your agents</h1>${action('invite',icon('plus'),'ar-round','aria-label="Invite an agent"')}</div>
      <div class="ar-team-summary"><div><span class="ar-lab">Your 5% share · ${samples[s.month].month}</span><strong>${php(samples[s.month].team)}</strong></div><span>4 agents</span></div>
      <div class="ar-chip-row">${action('agents-all','All','','aria-pressed="'+(s.agentFilter==='all')+'"')}${action('agents-ended','Period ended','','aria-pressed="'+(s.agentFilter==='ended')+'"')}</div>
      <div class="ar-team-list">${rows.map(a => action('agent-'+a.key,`<span class="ar-agent-line">${face(a.key,40,a.name)}<span class="ar-agent-name">${a.name}</span><strong class="ar-agent-value">${php(monthShare(s,a))}</strong></span><span class="ar-agent-time">${track(a.months,`${a.name}, ${a.months} months remaining`)}<span class="ar-time">${a.months ? `${a.months} months left` : 'Period ended'}</span></span>`,'ar-agent',`aria-label="View ${a.name}"`)).join('')}</div>
      `, 'ar-has-action') + footer(action('invite', `${icon('agents')}Invite a field agent`, 'ar-btn')) + tabs('agents');
  }
  function agent(s) {
    const a = samples.agents.find(row => row.key === s.agent) || samples.agents[0];
    return body(`${back('agents','Agent details')}<div class="ar-profile-head">${face(a.key,83,a.name)}<h1>${a.name}</h1><p>Recruited ${a.joined}</p></div>
      <div class="ar-card ar-detail-amount"><span class="ar-lab">Your share · ${samples[s.month].month}</span><span class="ar-number">${php(monthShare(s,a))}</span></div>
      <div class="ar-card ar-mt"><div class="ar-data-rows"><div class="ar-data-row"><span>Your commission rate</span><b>5%</b></div><div class="ar-data-row"><span>Earned through this agent</span><b>${php(a.lifetime)}</b></div><div class="ar-data-row"><span>Commission ${a.months ? 'ends' : 'ended'}</span><b>${a.until}</b></div></div><div class="ar-detail-track"><p><b>${a.months ? a.months+' months left' : 'Period ended'}</b><span class="ar-muted">of 12 months</span></p>${track(a.months,'Commission time remaining')}</div></div>
      ${help('Commission is credited after the shop pays in full.')}`, 'ar-pushed');
  }
  function money(s) {
    const available=7200-s.requestedAmount;
    return body(`<div class="ar-topline"><h1>Your money</h1>${go('history',icon('clock'),'ar-round','aria-label="Payout and earning history"')}</div>
      <div class="ar-card ar-balance"><span class="ar-lab">Available to cash out</span><strong class="ar-number">${php(available)}</strong><div class="ar-totals"><div><strong>₱13,700</strong><span>Total earned</span></div><div><strong>₱6,500</strong><span>Cashed out</span></div></div></div>
      <div class="ar-balance-note"><span>Awaiting shop payment</span><b>₱1,250</b></div>
      ${s.requested?`<div class="ar-balance-note"><span>Cash-out request pending</span><b>${php(s.requestedAmount)}</b></div>`:''}
      <div class="ar-section-line"><strong>Latest activity</strong>${go('history','See all','ar-textlink')}</div>
      <div class="ar-card ar-ledger">${ledger('Kalan Kitchen','Link sale · 27 Oct','+₱2,500')}${ledger('To Wise','Completed · 26 Oct','−₱1,750','send',true)}${ledger('Paolo Reyes','Agent commission · 25 Oct','+₱250','agents')}</div>`, 'ar-has-action') + footer(go(s.requested?'history':'cashout', s.requested?'View cash-out request':'Cash out to Wise', 'ar-btn')) + tabs('money');
  }
  function cashout(s) {
    if(s.requested)return requestResult(s);
    return money(s) + `<div class="ar-sheet-dim"></div><section class="ar-sheet" aria-label="Cash out to Wise"><div class="ar-sheet-grip"></div><div class="ar-sheet-heading"><div><h2>Cash out to Wise</h2><p>₱7,200 available</p></div>${go('money',icon('close'),'ar-round','aria-label="Close cash out" data-back="true"')}</div><div class="ar-amount-entry"><label class="ar-lab" for="${s.uid}-amount">Amount</label><div class="ar-amount-input"><span>₱</span><input id="${s.uid}-amount" name="cashout-amount" inputmode="decimal" aria-label="Cash-out amount" value="${s.amount.toLocaleString('en-PH',{maximumFractionDigits:2})}" autocomplete="off"></div><div class="ar-quick">${[1000,2000,7200].map(n=>action('amount-'+n,n===7200?'All · ₱7,200':php(n),s.amount===n?'is-on':'')).join('')}</div>${s.amountError ? `<p class="ar-inline-error">${s.amountError}</p>`:''}</div>
      <div class="ar-wise"><b>Your Wise email</b>${go('wise','Change','ar-textlink')}</div><div class="ar-email">${icon('mail')}<span>${esc(s.wiseEmail)}</span></div>${help('We’ll show the transfer status in your payout history.')}${action('review-cashout','Review cash out','ar-btn')}</section>`;
  }
  function cashReview(s) {
    return body(`${back('cashout','Review cash out')}<h1>Ready to request?</h1><div class="ar-card ar-mt ar-detail-amount"><span class="ar-lab">Cash-out amount</span><strong class="ar-number">${php(s.amount)}</strong></div><div class="ar-card ar-mt ar-data-rows"><div class="ar-data-row"><span>To</span><b>Wise</b></div><div class="ar-data-row"><span>Email</span><b>${esc(s.wiseEmail)}</b></div><div class="ar-data-row"><span>Available after request</span><b>${php(7200-s.amount)}</b></div></div>${help('Your request will be pending until the transfer is processed.')}`, 'ar-pushed ar-has-action') + footer(action('request-cashout',`Request ${php(s.amount)}`,'ar-btn'),true);
  }
  function requestResult(s) {
    return body(`${back('money','Cash-out request')}<div class="ar-empty">${icon('clock')}<h1>Request received</h1><p>${php(s.requestedAmount)} to Wise</p><span class="ar-badge ar-warn">Pending</span></div><div class="ar-card ar-mt"><p class="ar-caption">Your money is reserved. Check history for transfer updates.</p></div>`, 'ar-pushed ar-has-action') + footer(button('history','View payout history'),true);
  }
  function history(s) {
    const showEarned = s.historyFilter !== 'out', showOut = s.historyFilter !== 'earned';
    return body(`${back('money','Activity')}<div class="ar-card ar-history-stats"><div><strong>₱13,700</strong><span>Earned</span></div><div><strong>₱6,500</strong><span>Cashed out</span></div><div><strong>${php(7200-s.requestedAmount)}</strong><span>Available</span></div></div>
      <div class="ar-chip-row">${[['all','All'],['earned','Earned'],['out','Cash outs']].map(([key,label])=>action('history-'+key,label,'',`aria-pressed="${s.historyFilter===key}"`)).join('')}</div><div class="ar-section-line"><strong>October</strong></div>
      <div class="ar-card ar-ledger">${showOut?`${s.requested?ledger('To Wise','Pending · just now','−'+php(s.requestedAmount),'clock',true):''}${ledger('To Wise','Completed · 26 Oct','−₱1,750','send',true)}${ledger('Wise cash out','Failed · funds returned','₱750','info')}`:''}${showEarned?`${ledger('Kalan Kitchen','Link sale · 27 Oct','+₱2,500')}${ledger('Héla Hair Studio','Link sale · 24 Oct','+₱1,750')}${ledger('Agent commission','October total','+₱700','agents')}`:''}</div><div class="ar-section-line"><strong>September</strong></div><div class="ar-card ar-ledger">${showOut?ledger('To Wise','Completed · 26 Sep','−₱3,250','send',true):''}${showEarned?ledger('September earnings','Links, agents & earlier bonus','+₱4,000'):''}</div><div class="ar-section-line"><strong>Earlier</strong></div><div class="ar-card ar-ledger">${showOut?ledger('To Wise','Completed · 26 Jul','−₱1,500','send',true):''}${showEarned?ledger('Earlier earnings','May–August','+₱4,750'):''}</div>`, 'ar-pushed');
  }
  function sales(s) {
    const monthSales=s.month==='sep'?[{name:'Repair & Services',price:3999,commission:2000,date:'24 Sep',status:'Paid',asset:'people/06-agent.jpg'}]:samples.sales;
    const list = monthSales.filter(row => s.salesFilter !== 'paid' || row.status === 'Paid');
    return body(`${back('home','Your sales')}<div class="ar-topline"><h1>From your link</h1></div><p class="ar-caption">${samples[s.month].month}</p><div class="ar-chip-row">${action('sales-all','All','','aria-pressed="'+(s.salesFilter==='all')+'"')}${action('sales-paid','Paid','','aria-pressed="'+(s.salesFilter==='paid')+'"')}</div>
      ${list.map(row=>`<article class="ar-card ar-sale"><div class="ar-sale-heading"><img src="${P+row.asset}" alt=""><div><h3>${row.name}</h3><p>${row.date}</p></div></div><div class="ar-mt"><span class="ar-badge ${row.status==='Paid'?'ar-ok':'ar-warn'}">${row.status}</span></div><div class="ar-sale-money"><div><span>Website price</span><strong>${php(row.price)}</strong></div><div><span>Your commission</span><strong>${php(row.commission)}</strong>${row.status!=='Paid'?'<em>Not credited yet</em>':''}</div></div></article>`).join('')}`, 'ar-pushed');
  }
  function page(s) {
    return body(`${back('home','My creator page')}<div class="ar-page-preview"><div class="ar-page-cover"><img src="${P}people/09-cafe.jpg" alt="A local café"></div><div class="ar-page-info">${face('mika',62,'Mika Santos')}<h2>${esc(s.displayName)}</h2><p>${esc(s.pageMessage)}</p><div class="ar-page-offer"><div><span>Website price</span><strong>${php(s.savedPrice)}</strong></div>${s.savedPrice<4999?`<span class="ar-badge ar-ok">Save ${php(4999-s.savedPrice)}</span>`:''}</div></div></div>
      <div class="ar-url">${icon('link')}<span>tendso.com/v2/a/mika</span>${action('copy',icon('copy'),'','aria-label="Copy creator page link"')}</div>
      <div class="ar-mt">${menu([['editpage','Edit page','edit'],['offer','Your price','store'],['poster','Share QR & poster','share']])}</div>`, 'ar-pushed ar-has-action') + footer(action('share','Share my shop link','ar-btn'),true);
  }
  function me(s) {
    return body(`<div class="ar-topline"><h1>Me</h1></div><div class="ar-profile-info">${face('mika',64,'Mika Santos')}<div><h1>Mika Santos</h1><p>Creator · Code MIKA</p></div></div>
      ${menu([['profile','Edit profile','me'],['page','My creator page','page'],['sales','Your sales','sales']])}
      <div class="ar-mt">${menu([['wise','Payout details','money'],['notifications','Notifications','bell'],['help','Help & account','help']])}</div>${action('signout',icon('out')+' Sign out','ar-signout')}`) + tabs('me');
  }
  function editPage(s) {
    return body(`${back('page','Edit your page')}<h1>Make it yours.</h1><div class="ar-mt"><label class="ar-edit-field"><span>Display name</span><input name="display-name" maxlength="60" value="${esc(s.displayName)}"></label><label class="ar-edit-field"><span>Message to shop owners</span><textarea name="page-message" maxlength="200">${esc(s.pageMessage)}</textarea></label><div class="ar-card"><span class="ar-caption">Your link stays tendso.com/v2/a/mika</span></div></div>`, 'ar-pushed ar-has-action') + footer(action('save-page','Save page','ar-btn'),true);
  }
  function offer(s) {
    return body(`${back('page','Your price')}<h1>One price. Paid once.</h1><div class="ar-card ar-mt ar-detail-amount"><label class="ar-lab" for="${s.uid}-price">Website price</label><div class="ar-amount-input"><span>₱</span><input id="${s.uid}-price" name="website-price" aria-label="Website price" inputmode="numeric" value="${s.price}"></div></div><div class="ar-quick">${[999,3499,4999].map(n=>action('price-'+n,php(n),s.price===n?'is-on':'')).join('')}</div><div class="ar-card ar-mt ar-data-rows"><div class="ar-data-row"><span>You earn per paid website</span><b>${php(Math.round(s.price/2))}</b></div><div class="ar-data-row"><span>The shop saves</span><b>${php(4999-s.price)}</b></div></div>${help('₱999–₱4,999. New prices apply to future orders only.')}`, 'ar-pushed ar-has-action') + footer(action('save-price','Save price','ar-btn'),true);
  }
  function wise(s) {
    return body(`${back(s.previous==='cashout'?'cashout':'me','Payout details')}<h1>Your Wise email.</h1><p class="ar-caption ar-mt">Use the email linked to your Wise account.</p><label class="ar-edit-field ar-mt"><span>Wise email</span><input type="email" name="wise-email" value="${esc(s.wiseEmail)}"></label>`, 'ar-pushed ar-has-action') + footer(action('save-wise','Save Wise email','ar-btn'),true);
  }
  function invite(s) {
    return body(`${back('agents','Invite field agents')}<h1>Grow your team.</h1><p class="ar-caption ar-mt">Earn 5% of their paid website sales for 12 months.</p><div class="ar-card ar-detail-amount ar-mt"><span class="ar-lab">Your invitation code</span><span class="ar-number" style="font-size:38px;letter-spacing:2px">MIKA</span></div><div class="ar-url">${icon('link')}<span>tendso.com/v2/a/mika/earn</span>${action('copy-invite',icon('copy'),'','aria-label="Copy agent invitation"')}</div>${help('One level only. Commission starts after a shop pays in full.')}`, 'ar-pushed ar-has-action') + footer(action('share-invite','Share agent invite','ar-btn'),true);
  }
  function notifications() {
    return body(`${back('me','Notifications')}<h1>You’re up to date.</h1><div class="ar-card ar-mt"><h3>Paolo joined your team</h3><p class="ar-caption ar-mt">His commission period is shown in Agents.</p></div><div class="ar-card ar-mt"><h3>Your cash out completed</h3><p class="ar-caption ar-mt">₱1,750 · 26 October</p></div>`, 'ar-pushed');
  }
  function profile(s) {
    return body(`${back('me','Edit profile')}<div class="ar-profile-head">${face('mika',83,'Mika Santos')}</div><label class="ar-edit-field"><span>First name</span><input name="first-name" value="Mika"></label><label class="ar-edit-field"><span>Last name</span><input name="last-name" value="Santos"></label><label class="ar-edit-field"><span>Mobile</span><input name="mobile" inputmode="tel" value="0917 000 0000"></label>`, 'ar-pushed ar-has-action')+footer(action('save-profile','Save profile','ar-btn'),true);
  }
  function helpScreen() {
    return body(`${back('me','Help & account')}<h1>How can we help?</h1><div class="ar-mt">${menu([['support','Contact support','help'],['terms','Terms & privacy','page']])}</div>`, 'ar-pushed');
  }
  function poster() {
    return body(`${back('page','Share your page')}<h1>Put your link<br>in their hands.</h1><div class="ar-card ar-detail-amount ar-mt"><img src="${P}brand/mark-ink-256.png" alt="Tendso" style="height:72px;width:72px;margin:0 auto 20px"><h2>Mika Santos</h2><p class="ar-caption ar-mt">tendso.com/v2/a/mika</p></div>${help('The app can share your saved QR image or printable poster.')}`, 'ar-pushed ar-has-action')+footer(action('poster','Share QR or poster','ar-btn'),true);
  }
  const screens = {
    home:{title:'Home',group:'overview',render:home,note:'One monthly total, two clear sources, and visible shortcuts to Sales and My page. Sharing stays the main action.'},
    agents:{title:'Your agents',group:'team',render:agents,note:'Your commission appears beside each name. Remaining months are written out; the track explains time, not performance.'},
    agent:{title:'Agent details',group:'team',render:agent,note:'Owned-agent details show credited totals and exact dates. Commission expiry and the 5% rule sit together.'},
    money:{title:'Your money',group:'money',render:money,note:'Available cash leads. Lifetime totals and uncredited commission stay separate, with a floating cash-out action.'},
    cashout:{title:'Cash out',group:'money',render:cashout,note:'A focused Wise sheet: amount, quick picks and saved email. Review comes before requesting; nothing sends from this board.'},
    history:{title:'Activity & payouts',group:'money',render:history,note:'Filter earned income and cash outs. Pending, completed and failed transfers have distinct, readable labels.'},
    sales:{title:'Your sales',group:'overview',render:sales,note:'Website price and your commission are explicitly labelled. Awaiting payment stays visible and is not counted as available.'},
    page:{title:'My creator page',group:'overview',render:page,note:'A preview of the saved offer, with page editing, pricing and QR sharing in one familiar place.'},
    me:{title:'Me',group:'overview',render:me,note:'A dedicated fourth tab makes profile, page, sales, payout details and help easy to find.'}
  };
  const extra = { editpage:editPage, offer, wise, invite, notifications, profile, help:helpScreen, poster, 'cash-review':cashReview, 'request-result':requestResult };
  const keys = Object.keys(screens), hosts = new Map();
  let hero, serial=0, toastTimer;
  const toast = message => { const node=document.getElementById('ar-toast');clearTimeout(toastTimer);node.textContent=message;node.hidden=false;toastTimer=setTimeout(()=>{node.hidden=true;},4200); };
  function state(view) { return {uid:'ar-'+serial++,view,previous:'home',stack:({agent:['agents'],cashout:['money'],history:['money'],sales:['home'],page:['home']}[view]||[]).slice(),month:'oct',agent:'paolo',agentFilter:'all',historyFilter:'all',salesFilter:'all',amount:7200,amountError:'',wiseEmail:'mika.santos@gmail.com',displayName:'Mika Santos',pageMessage:'Let’s put your shop online.',price:3499,savedPrice:3499,requested:false,requestedAmount:0}; }
  function mount(parent, view) { const phone=T.phone({size:'lg'});parent.appendChild(phone.el);hosts.set(phone.screen,state(view));render(phone.screen);return phone.screen; }
  function render(host) {
    const s=hosts.get(host), renderer=screens[s.view]?.render||extra[s.view]||home;
    host.innerHTML=`<div class="ar-app" data-proposed="false" data-view="${s.view}">${T.statusBar(false)}${renderer(s)}<div class="ar-home-indicator"></div></div>`;
    if(host===hero){const key=screens[s.view]?s.view:s.previous;document.getElementById('ar-screen-picker').value=keys.includes(key)?key:'home';document.getElementById('ar-current').textContent=screens[s.view]?(String(keys.indexOf(s.view)+1).padStart(2,'0')+' / '+screens[s.view].title):'Explore / '+(s.view==='cash-review'?'Review':s.view.replace(/-/g,' '));}
  }
  const navigate=(host,view,reset=false)=>{const s=hosts.get(host);if(view==='support'){toast('Prototype: contact the Tendso support team.');return;}if(view==='terms'){toast('Prototype: Terms of Service and Privacy Policy open here.');return;}if(reset)s.stack=[];else if(view!==s.view)s.stack.push(s.view);s.previous=s.view;s.view=view;render(host);};
  const backTo=(host,fallback)=>{const s=hosts.get(host);s.view=s.stack.pop()||fallback;s.previous=s.stack.at(-1)||'home';render(host);};
  function handle(host,name) {
    const s=hosts.get(host);
    if(name==='month'){s.month=s.month==='oct'?'sep':'oct';render(host);}
    else if(name==='invite')navigate(host,'invite');
    else if(name.startsWith('agent-')){s.agent=name.slice(6);navigate(host,'agent');}
    else if(name.startsWith('agents-')){s.agentFilter=name.slice(7);render(host);}
    else if(name.startsWith('history-')){s.historyFilter=name.slice(8);render(host);}
    else if(name.startsWith('sales-')){s.salesFilter=name.slice(6);render(host);}
    else if(name.startsWith('amount-')){s.amount=Number(name.slice(7));s.amountError='';render(host);}
    else if(name==='review-cashout'){
      const raw=host.querySelector('[name="cashout-amount"]').value.trim();const amount=Number(raw.replace(/,/g,''));
      if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/.test(raw)||!Number.isFinite(amount)||amount<=0||amount>7200){s.amountError='Enter an amount from ₱0.01 to ₱7,200.';render(host);return;}
      s.amount=amount;s.amountError='';navigate(host,'cash-review');
    }
    else if(name==='request-cashout'){if(s.requested){navigate(host,'history',true);return;}s.requested=true;s.requestedAmount=s.amount;navigate(host,'request-result',true);toast('Prototype only. No withdrawal was created or sent.');}
    else if(name==='save-page'){const field=host.querySelector('[name="display-name"]');if(!field.value.trim()){field.focus();return;}s.displayName=field.value.trim();s.pageMessage=host.querySelector('[name="page-message"]').value;backTo(host,'page');toast('Preview saved in this board only. Your real page is unchanged.');}
    else if(name.startsWith('price-')){s.price=Number(name.slice(6));render(host);}
    else if(name==='save-price'){const input=host.querySelector('[name="website-price"]'),value=Number(input.value);if(!Number.isInteger(value)||value<999||value>4999){toast('Choose a whole-peso price from ₱999 to ₱4,999.');input.focus();return;}s.price=value;s.savedPrice=value;backTo(host,'page');toast('Prototype price selected. Existing orders are unchanged.');}
    else if(name==='save-wise'){const field=host.querySelector('[name="wise-email"]');if(!field.value.includes('@')||!field.validity.valid){field.reportValidity();return;}s.wiseEmail=field.value.trim();backTo(host,'me');toast('Wise details changed in the prototype only.');}
    else if(name==='save-profile'){backTo(host,'me');toast('Prototype only. No account details were changed.');}
    else if(name==='copy'||name==='copy-invite')toast('Sample link: tendso.com/v2/a/mika'+(name==='copy-invite'?'/earn':''));
    else if(name==='share'||name==='share-invite')toast('Prototype: share your saved '+(name==='share'?'shop link.':'agent invitation.'));
    else if(name==='poster')toast('Prototype: choose the QR image or printable poster.');
    else if(name==='signout')toast('Prototype only. You remain signed in to your real account.');
  }
  document.getElementById('ar-screen-picker').innerHTML=keys.map((key,i)=>`<option value="${key}">${String(i+1).padStart(2,'0')} · ${screens[key].title}</option>`).join('');
  hero=mount(document.getElementById('ar-live-phone'),'home');
  keys.forEach((key,i)=>{const data=screens[key],figure=document.createElement('figure');figure.className='ar-tile';figure.dataset.group=data.group;figure.dataset.screen=key;figure.innerHTML=`<div class="ar-tile-top"><span>${String(i+1).padStart(2,'0')} / ${data.title}</span><span>Reference</span></div><div class="ar-tile-phone"></div><figcaption><span>${String(i+1).padStart(2,'0')}</span><div><h3>${data.title}</h3><p>${data.note}</p></div></figcaption>`;document.getElementById('ar-gallery').appendChild(figure);mount(figure.querySelector('.ar-tile-phone'),key);});
  document.addEventListener('click',event=>{
    const control=event.target.closest('button');if(!control)return;
    if(control.dataset.filter){const filter=control.dataset.filter;document.querySelectorAll('[data-filter]').forEach(node=>node.setAttribute('aria-pressed',String(node===control)));document.querySelectorAll('.ar-tile').forEach(tile=>{tile.hidden=filter!=='all'&&tile.dataset.group!==filter;});T.fitPhones();return;}
    if(control.dataset.cycle){const current=keys.indexOf(hosts.get(hero).view),next=(Math.max(0,current)+Number(control.dataset.cycle)+keys.length)%keys.length;navigate(hero,keys[next],true);return;}
    const host=control.closest('.screen-root');if(!host||!hosts.has(host))return;
    if(control.dataset.back)backTo(host,control.dataset.go);else if(control.dataset.go)navigate(host,control.dataset.go,!!control.closest('.ar-tabs'));else if(control.dataset.action)handle(host,control.dataset.action);
  });
  document.getElementById('ar-screen-picker').addEventListener('change',event=>navigate(hero,event.target.value,true));
  T.fitPhones();
  window.AffiliateProposal={ready:true,screens:keys,show:key=>{if(screens[key])navigate(hero,key);}};
})();
