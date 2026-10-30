/* Approved affiliate design reference. All prototype state stays here; no account/API writes. */
(function () {
  'use strict';
  const P = '../assets/';
  const CODE_PRICE = 3499, CODE_LIST_PRICE = 4999, CODE_PERCENT_OFF = 30;
  const icons = {
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    receipt:'<path d="M6 3 4 5v16l3-2 3 2 3-2 3 2 3-2V3l-3 2-3-2-3 2-3-2Z"/><path d="M8 9h7M8 13h7"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
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
  const platforms = [
    {key:'messenger', label:'Messenger', placeholder:'https://m.me/yourname', hosts:['messenger.com','m.me']},
    {key:'facebook', label:'Facebook', placeholder:'https://www.facebook.com/yourname', hosts:['facebook.com']},
    {key:'instagram', label:'Instagram', placeholder:'https://www.instagram.com/yourname', hosts:['instagram.com']},
    {key:'tiktok', label:'TikTok', placeholder:'https://www.tiktok.com/@yourname', hosts:['tiktok.com']},
    {key:'youtube', label:'YouTube', placeholder:'https://www.youtube.com/@yourname', hosts:['youtube.com','youtu.be']}
  ];
  const savedPage = () => ({displayName:'Mika Santos', photo:'sample', message:'Let’s put your shop online. I’ll help you get started.', socialLinks:{messenger:'https://m.me/mika.santos',instagram:'https://www.instagram.com/mika.santos',tiktok:'https://www.tiktok.com/@mika.santos'}});
  const draftPage = saved => ({...saved,socialLinks:{...saved.socialLinks},showPhoto:!!saved.photo,showMessage:!!saved.message,showSocialLinks:Object.keys(saved.socialLinks).length>0});
  const effectivePage = draft => ({displayName:draft.displayName.trim(),photo:draft.showPhoto?draft.photo:'',message:draft.showMessage?draft.message.trim():'',socialLinks:draft.showSocialLinks?Object.fromEntries(platforms.flatMap(({key})=>draft.socialLinks[key]?.trim()?[[key,draft.socialLinks[key].trim()]]:[])):{}});
  const pageDirty = s => JSON.stringify(effectivePage(s.pageDraft))!==JSON.stringify(s.pageSaved);
  const pageStatus = s => s.pageError || (pageDirty(s)?'Unsaved changes.':s.pageWasSaved?'Page saved.':'');
  const pagePhoto = (photo,name,size) => photo==='sample'?face('mika',size,name):photo?`<img class="ar-page-avatar" src="${esc(photo)}" alt="${esc(name)}" style="--sz:${size}px">`:`<span class="cl-face cl-face--txt" role="img" aria-label="${esc(name)}" style="--sz:${size}px">${esc((name.trim()||'M')[0].toUpperCase())}</span>`;
  const sampleNotices = () => [
    {id:'team',title:'Paolo joined your team',body:'Paolo Reyes joined using your invitation code.\n\nOpen Agents to see his commission period and the share credited from his paid website sales. You earn 5% of his sales for 12 months, after each shop has paid in full.\n\nA new account joining your team does not add money to your balance. Commission appears after an eligible shop payment is completed.',time:'Today · 9:15 AM',icon:'agents',read:false},
    {id:'payout',title:'Your cash out completed',body:'Your ₱1,750 cash out to Wise is complete.\n\nCheck your Wise account for the transfer. You can review the amount and status in your payout history.\n\nIf you need help finding this transfer, contact the Tendso team with the date and amount.',time:'26 October · 2:30 PM',icon:'money',read:false},
    {id:'sale',title:'Your shop link made a sale',body:'Héla Hair Studio paid for its website. Your ₱1,750 commission has been credited.\n\nYour sales show the website price and your commission separately. Your available balance is shown in Money.',time:'24 October · 10:20 AM',icon:'store',read:true}
  ];
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
  const homeTools = (held = '') => `<nav class="ar-home-tools" aria-label="Your tools">${go('sales',`<span class="ar-home-tool-icon">${icon('receipt')}</span><span class="ar-home-tool-copy"><strong>Sales</strong><small>Track shops and payments</small></span>${chevron}`,'ar-home-tool-row'+(held==='sales'?' ar-held-pressed':''),'aria-label="Sales"')}<span class="ar-home-tool-divider" aria-hidden="true"></span>${go('page',`<span class="ar-home-tool-icon">${icon('edit')}</span><span class="ar-home-tool-copy"><strong>My page</strong><small>Edit and preview your page</small></span>${chevron}`,'ar-home-tool-row'+(held==='page'?' ar-held-pressed':''),'aria-label="My page"')}</nav>`;
  function home(s) {
    const m = samples[s.month];
    return body(`<div class="ar-topline"><div class="ar-greeting">${pagePhoto(s.pageSaved.photo,s.pageSaved.displayName||'Mika Santos',48)}<div><p>Creator home</p><b>Hi, Mika</b></div></div>${go('notifications', icon('bell'), 'ar-round', 'aria-label="Notifications"')}</div>
      <section class="ar-earn-card" aria-label="${m.month} earnings, ${php(m.total)}"><div class="ar-home-earn-heading"><span>Your earnings</span>${action('month',`${m.month} 2027 ${icon('down')}`,'ar-month-switch','aria-label="Change earnings month"')}</div><strong class="ar-number">${php(m.total)}</strong><p class="ar-earn-caption">From your link and agents</p><div class="ar-source-grid">${go('sales',`<span class="ar-source-icon">${icon('link')}<span>Your link</span></span><strong aria-label="From your link, ${php(m.direct)}">${php(m.direct)}</strong><small>Paid website sales</small>`,'','aria-label="View your link earnings"')}${go('agents',`<span class="ar-source-icon">${icon('agents')}<span>Your agents</span></span><strong aria-label="From your agents, ${php(m.team)}">${php(m.team)}</strong><small>5% team commission</small>`,'','aria-label="View your agents earnings"')}</div></section>
      <p class="ar-home-tools-label">Your tools</p>${homeTools()}
      <section class="ar-home-link" aria-labelledby="${s.uid}-share-title"><h2 id="${s.uid}-share-title">Share with shop owners</h2><p>Your link gives ${CODE_PERCENT_OFF}% off.</p><div class="ar-url">${icon('link')}<span>tendso.com/v2/a/mika</span>${action('copy',icon('copy'),'','aria-label="Copy shop link"')}</div>${action('share',`${icon('share')}Share link`,'ar-btn ar-home-share-action','aria-label="Share my shop link"')}<p class="ar-home-share-status" data-home-share-status role="status" aria-live="polite">${esc(s.homeStatus||'')}</p></section>`) + tabs('home');
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
    return editPage(s,'My page');
  }
  function me(s) {
    return body(`<div class="ar-topline"><h1>Me</h1></div><div class="ar-profile-info">${pagePhoto(s.pageSaved.photo,'Mika Santos',64)}<div><h1>Mika Santos</h1><p>Creator · Code MIKA</p></div></div>
      ${menu([['profile','Edit profile','me'],['page','My creator page','page'],['sales','Your sales','sales']])}
      <div class="ar-mt">${menu([['wise','Payout details','money'],['notifications','Notifications','bell'],['help','Help & account','help']])}</div>${action('signout',icon('out')+' Sign out','ar-signout')}`) + tabs('me');
  }
  function editorTabs(s) {
    const views=`<div class="ar-chip-row" role="tablist" aria-label="Page editor view">${[['edit','Edit'],['preview','Preview']].map(([key,label])=>action('editor-view-'+key,label,s.pageView===key?'is-on':'',`role="tab" aria-selected="${s.pageView===key}"`)).join('')}</div>`;
    return views+(s.pageView==='preview'?'':`<div class="ar-chip-row" role="tablist" aria-label="Page settings">${[['page','Page details'],['offer','Your offer'],['sharing','Sharing']].map(([key,label])=>action('editor-section-'+key,label,s.pageSection===key?'is-on':'',`role="tab" aria-selected="${s.pageSection===key}"`)).join('')}</div>`);
  }
  function editPage(s,title='Edit your page') {
    const d=s.pageDraft;
    const tools=editorTabs(s);
    if(s.pageView==='preview')return `<div class="ar-editor-layout">${back('home',title)}<div class="ar-editor-scroll">${tools}<p class="ar-caption">Illustrative public-page reference. The app previews your actual draft.</p><iframe data-editor-preview src="../pages/a-shop.html" sandbox="allow-same-origin" title="Illustrative public shop-page preview" style="display:block;width:100%;height:520px;border:1px solid #D9DCD0;border-radius:18px;margin-top:12px;background:white"></iframe></div></div>`;
    if(s.pageSection==='offer')return `<div class="ar-editor-layout">${back('home',title)}<div class="ar-editor-scroll">${tools}${offerContent()}</div></div>`;
    if(s.pageSection==='sharing')return `<div class="ar-editor-layout">${back('home',title)}<div class="ar-editor-scroll">${tools}<h1>Share your page.</h1><div class="ar-card ar-detail-amount ar-mt">${pagePhoto(s.pageSaved.photo,s.pageSaved.displayName||'Mika Santos',64)}<h2>${esc(s.pageSaved.displayName||'Mika Santos')}</h2><p class="ar-caption ar-mt">tendso.com/v2/a/mika</p><strong>${php(CODE_PRICE)} · ${CODE_PERCENT_OFF}% off</strong></div>${action('share','Share my shop link','ar-btn ar-mt')}${action('poster','Share QR or poster','ar-btn ar-secondary ar-mt')}${help('Sharing uses saved public details and the fixed 30% offer. Unsaved profile edits are not shared.')}</div></div>`;
    const toggle=(key,title,subtitle)=>`<label class="ar-toggle"><span><b>${title}</b><small>${subtitle}</small></span><input type="checkbox" name="show-${key}" role="switch" ${d['show'+key[0].toUpperCase()+key.slice(1)]?'checked':''}><i aria-hidden="true"></i></label>`;
    return `<div class="ar-editor-layout">${back('home',title)}<div class="ar-editor-scroll">${tools}<h1>Make it yours.</h1><label class="ar-edit-field ar-mt"><span>Display name</span><input name="display-name" aria-label="Display name" maxlength="100" value="${esc(d.displayName)}"><small>The name shown on your public page.</small></label>
      ${toggle('photo','Show my photo',d.photo?'Tap below to change it':'Add a photo of yourself')}${d.showPhoto?`<div class="ar-card ar-photo-picker">${pagePhoto(d.photo,d.displayName||'Mika Santos',64)}${action('choose-photo',d.photo?'Change page photo':'Choose page photo','ar-textlink')}<input class="ar-file-input" type="file" name="page-photo" accept="image/*" aria-label="Choose page photo"></div>`:''}
      ${toggle('message','Show a message','Introduce yourself to visitors')}${d.showMessage?`<label class="ar-edit-field"><span>Short message</span><textarea name="page-message" aria-label="Short message" maxlength="200" placeholder="A short introduction or invitation">${esc(d.message)}</textarea><small data-message-count>${d.message.length} / 200 characters</small></label>`:''}
      ${toggle('socialLinks','Show social links','Add the profiles you want visitors to find')}${d.showSocialLinks?`<div class="ar-social-fields"><p class="ar-caption">Choose any of these platforms. Leave the others blank.</p>${platforms.map(p=>`<label class="ar-edit-field"><span>${p.label} link</span><div class="ar-social-input">${icon('link')}<input type="url" name="social-${p.key}" aria-label="${p.label} link" maxlength="2048" value="${esc(d.socialLinks[p.key]||'')}" placeholder="${p.placeholder}" autocomplete="off" autocapitalize="none" spellcheck="false"></div><small>Optional · Starts with https://</small></label>`).join('')}</div>`:''}
      <p class="ar-caption ar-handle">Your page handle is @mika. It stays the same.</p></div><div class="ar-save-dock"><p class="ar-save-status${s.pageError?' is-error':''}" data-page-status role="status" aria-live="polite">${esc(pageStatus(s))}</p>${action('save-page','Save page','ar-btn',pageDirty(s)?'':'disabled')}</div></div>`;
  }
  function offerContent() {
    return `<h1>Your code.<br>${CODE_PERCENT_OFF}% off.</h1><div class="ar-card ar-mt ar-detail-amount"><span class="ar-lab">Website price with your code</span><strong class="ar-number">${php(CODE_PRICE)}</strong><span class="ar-badge ar-ok">Fixed ${CODE_PERCENT_OFF}% offer</span></div><div class="ar-card ar-mt ar-data-rows"><div class="ar-data-row"><span>Your commission per website</span><b>${php(Math.round(CODE_PRICE/2))}</b></div><div class="ar-data-row"><span>The shop saves</span><b>${php(CODE_LIST_PRICE-CODE_PRICE)}</b></div></div>${help('Every creator code gives the same fixed 30% offer. Update your photo, name, message and social links in Page details.')}`;
  }
  function offer(s) {return body(`${back('page','Your offer')}${offerContent()}`,'ar-pushed');}
  function wise(s) {
    return body(`${back(s.previous==='cashout'?'cashout':'me','Payout details')}<h1>Your Wise email.</h1><p class="ar-caption ar-mt">Use the email linked to your Wise account.</p><label class="ar-edit-field ar-mt"><span>Wise email</span><input type="email" name="wise-email" value="${esc(s.wiseEmail)}"></label>`, 'ar-pushed ar-has-action') + footer(action('save-wise','Save Wise email','ar-btn'),true);
  }
  function invite(s) {
    return `<div class="ar-modal-layer"><button class="ar-modal-backdrop" type="button" data-action="close-overlay" aria-label="Dismiss agent invite" tabindex="-1"></button><section class="ar-dialog ar-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="${s.uid}-invite-title" tabindex="-1"><header class="ar-dialog-header"><span class="ar-invite-icon">${icon('agents')}</span><h2 id="${s.uid}-invite-title">Invite a field agent</h2>${action('close-overlay',icon('close'),'ar-round','aria-label="Close agent invite"')}</header><div class="ar-dialog-scroll"><p class="ar-invite-intro">Earn 5% of their sales for 12 months, after each shop has paid in full.</p><div class="ar-invite-panel"><div><span>Your invite link</span><p>https://tendso.com/v2/a/mika/earn</p></div>${action('copy-invite',icon('copy'),'ar-invite-copy','aria-label="Copy invite link"')}</div><div><div class="ar-invite-panel"><div><span>Your invitation code</span><strong>MIKA</strong></div>${action('copy-code',icon('copy'),'ar-invite-copy','aria-label="Copy invitation code"')}</div><p class="ar-invite-helper">They can enter this code when creating their account.</p></div>${action('share-invite',icon('share')+'Share agent invite','ar-btn')}<p class="ar-dialog-status" role="status" aria-live="polite">${esc(s.inviteStatus)}</p></div></section></div>`;
  }
  function notifications(s) {
    const unread=s.notifications.some(n=>!n.read);
    return body(`<div class="ar-backbar ar-inbox-back">${go('me',icon('back'),'ar-round','aria-label="Back" data-back="true"')}${unread?action('mark-all-read','Mark all read','ar-textlink'):''}</div><h1>Notifications</h1><p class="ar-notice-group">Today</p>${s.notifications.map((n,i)=>`${i===1?'<p class="ar-notice-group">This week</p>':''}${action('notice-'+n.id,`<span class="ar-notice-icon">${icon(n.icon)}</span><span class="ar-notice-copy"><span class="ar-notice-title"><b>${esc(n.title)}</b>${n.read?'':'<i class="ar-unread-dot" aria-label="Unread"></i>'}</span><span class="ar-notice-preview">${esc(n.body)}</span><small>${n.time}</small></span>${chevron}`,'ar-notice'+(n.read?'':' is-unread'),`aria-label="Read ${esc(n.title)}"`)}`).join('')}`, 'ar-pushed');
  }
  function notificationDetails(s) {
    const n=s.notifications.find(row=>row.id===s.selectedNotice);
    if(!n)return '';
    return `<div class="ar-modal-layer"><button class="ar-modal-backdrop" type="button" data-action="close-overlay" aria-label="Dismiss notification" tabindex="-1"></button><section class="ar-dialog ar-notification-dialog" role="dialog" aria-modal="true" aria-labelledby="${s.uid}-notification-title" tabindex="-1"><header class="ar-dialog-header"><h2 id="${s.uid}-notification-title">Notification</h2>${action('close-overlay',icon('close'),'ar-round','aria-label="Close notification"')}</header><div class="ar-dialog-scroll ar-full-message"><div class="ar-notification-meta"><span class="ar-notice-icon">${icon(n.icon)}</span><span>${n.time}</span></div><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p></div><div class="ar-dialog-footer">${action('close-overlay','Close','ar-btn')}</div></section></div>`;
  }
  function profile(s) {
    return body(`${back('me','Edit profile')}<div class="ar-profile-head">${face('mika',83,'Mika Santos')}</div><label class="ar-edit-field"><span>First name</span><input name="first-name" value="Mika"></label><label class="ar-edit-field"><span>Last name</span><input name="last-name" value="Santos"></label><label class="ar-edit-field"><span>Mobile</span><input name="mobile" inputmode="tel" value="0917 000 0000"></label>`, 'ar-pushed ar-has-action')+footer(action('save-profile','Save profile','ar-btn'),true);
  }
  function helpScreen() {
    return body(`${back('me','Help & account')}<h1>How can we help?</h1><div class="ar-mt">${menu([['support','Contact support','help'],['terms','Terms & privacy','page']])}</div>`, 'ar-pushed');
  }
  function poster(s) {
    return body(`${back('page','Share your page')}<h1>Put your link<br>in their hands.</h1><div class="ar-card ar-detail-amount ar-mt"><img src="${P}brand/mark-ink-256.png" alt="Tendso" style="height:72px;width:72px;margin:0 auto 20px"><h2>${esc(s.pageSaved.displayName||'Mika Santos')}</h2><p class="ar-caption ar-mt">tendso.com/v2/a/mika</p></div>${help('The app can share your saved QR image or printable poster.')}`, 'ar-pushed ar-has-action')+footer(action('poster','Share QR or poster','ar-btn'),true);
  }
  const screens = {
    home:{title:'Home',group:'overview',render:home,note:'One dark card combines monthly earnings and both clickable sources. Full-width Sales and My page rows lead to the tools; the URL, Copy and Share link button stay together in one scrolling card.'},
    agents:{title:'Your agents',group:'team',render:agents,note:'Your commission appears beside each name. Remaining months are written out; the track explains time, not performance.'},
    agent:{title:'Agent details',group:'team',render:agent,note:'Owned-agent details show credited totals and exact dates. Commission expiry and the 5% rule sit together.'},
    money:{title:'Your money',group:'money',render:money,note:'Available cash leads. Lifetime totals and uncredited commission stay separate, with a floating cash-out action.'},
    cashout:{title:'Cash out',group:'money',render:cashout,note:'A focused Wise sheet: amount, quick picks and saved email. Review comes before requesting; nothing sends from this board.'},
    history:{title:'Activity & payouts',group:'money',render:history,note:'Filter earned income and cash outs. Pending, completed and failed transfers have distinct, readable labels.'},
    sales:{title:'Your sales',group:'overview',render:sales,note:'Website price and your commission are explicitly labelled. Awaiting payment stays visible and is not counted as available.'},
    page:{title:'My page',group:'overview',render:page,note:'Opens directly to Page details, read-only Your offer and Sharing, with Edit/Preview switching. There is no separate summary screen.'},
    me:{title:'Me',group:'overview',render:me,note:'A dedicated fourth tab makes profile, page, sales, payout details and help easy to find.'},
    editpage:{title:'Edit your page',group:'overview',render:editPage,note:'Photo, message and social switches plus five optional platform links. Status and Save page sit below the scroll area, clear of every field. Saving changes this phone only.'},
    invite:{title:'Invite popup',group:'team',render:agents,note:'A centered invitation over the unchanged Agents list: copy the link or code, or share the invite. Close, backdrop or Escape dismisses it without losing your filter or scroll position.'},
    notifications:{title:'Notifications',group:'overview',render:notifications,note:'Tap a message for selectable full details. Only that item becomes read. Opening or leaving the inbox preserves unread items; Mark all read is an explicit choice.'}
  };
  const extra = { offer, wise, profile, help:helpScreen, poster, 'cash-review':cashReview, 'request-result':requestResult };
  const keys = Object.keys(screens), hosts = new Map();
  let hero, serial=0, toastTimer;
  const toast = message => { const node=document.getElementById('ar-toast');clearTimeout(toastTimer);node.textContent=message;node.hidden=false;toastTimer=setTimeout(()=>{node.hidden=true;},4200); };
  function state(view) {
    const saved=savedPage();
    return {uid:'ar-'+serial++,view:view==='invite'?'agents':view,overlay:view==='invite'?'invite':null,previous:'home',stack:({agent:['agents'],cashout:['money'],history:['money'],sales:['home'],page:['home'],editpage:['home'],notifications:['me']}[view]||[]).slice(),month:'oct',agent:'paolo',agentFilter:'all',historyFilter:'all',salesFilter:'all',amount:7200,amountError:'',wiseEmail:'mika.santos@gmail.com',pageSaved:saved,pageDraft:draftPage(saved),pageSection:'page',pageView:'edit',pageError:'',pageWasSaved:false,inviteStatus:'',notifications:sampleNotices(),selectedNotice:null,returnFocus:null,requested:false,requestedAmount:0};
  }
  function mount(parent, view) { const phone=T.phone({size:'lg'});parent.appendChild(phone.el);hosts.set(phone.screen,state(view));render(phone.screen);return phone.screen; }
  function updatePicker(host) {
    if(host!==hero)return;
    const s=hosts.get(host),key=s.overlay==='invite'?'invite':screens[s.view]?s.view:s.previous;
    document.getElementById('ar-screen-picker').value=keys.includes(key)?key:'home';
    document.getElementById('ar-current').textContent=screens[key]?(String(keys.indexOf(key)+1).padStart(2,'0')+' / '+screens[key].title):'Explore / '+s.view.replace(/-/g,' ');
  }
  function renderOverlay(host,focus=false) {
    const s=hosts.get(host),app=host.querySelector('.ar-app');
    app.querySelector('.ar-modal-layer')?.remove();
    [...app.children].forEach(node=>{if(!node.classList.contains('sb')&&!node.classList.contains('ar-home-indicator'))node.inert=!!s.overlay;});
    if(s.overlay)app.insertAdjacentHTML('beforeend',s.overlay==='invite'?invite(s):notificationDetails(s));
    if(focus)app.querySelector('.ar-dialog [data-action="close-overlay"]')?.focus({preventScroll:true});
    updatePicker(host);
  }
  function openOverlay(host,kind) {
    const s=hosts.get(host);s.returnFocus=host.contains(document.activeElement)?document.activeElement:null;s.overlay=kind;s.inviteStatus='';renderOverlay(host,true);
  }
  function closeOverlay(host) {
    const s=hosts.get(host),target=s.returnFocus;s.overlay=null;s.selectedNotice=null;s.inviteStatus='';renderOverlay(host);
    const fallback=host.querySelector('[data-action="invite"], [data-action^="notice-"]');
    (target?.isConnected?target:fallback)?.focus({preventScroll:true});s.returnFocus=null;
  }
  function render(host) {
    const s=hosts.get(host), renderer=screens[s.view]?.render||extra[s.view]||home;
    const active=host.contains(document.activeElement)?document.activeElement:null;
    const focusKey=active?['name','data-action','data-go','aria-label'].find(key=>active.hasAttribute(key)):null;
    const focusValue=focusKey?active.getAttribute(focusKey):null;
    const selection=active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
    const sameView=host.querySelector('.ar-app')?.dataset.view===s.view;
    const scroll=sameView?[...host.querySelectorAll('.ar-body,.ar-editor-scroll')].map(node=>node.scrollTop):[];
    host.innerHTML=`<div class="ar-app" data-proposed="false" data-view="${s.view}">${T.statusBar(false)}${renderer(s)}<div class="ar-home-indicator"></div></div>`;
    host.querySelector('[data-editor-preview]')?.addEventListener('load',event=>{const doc=event.target.contentDocument;const block=e=>{if(e.target.closest('a,button,form')){e.preventDefault();e.stopPropagation();}};doc?.addEventListener('click',block,true);doc?.addEventListener('submit',block,true);});
    [...host.querySelectorAll('.ar-body,.ar-editor-scroll')].forEach((node,i)=>{node.scrollTop=scroll[i]||0;});
    if(sameView&&focusKey){const next=[...host.querySelectorAll('button,input,textarea')].find(node=>node.getAttribute(focusKey)===focusValue);next?.focus({preventScroll:true});if(selection&&next?.setSelectionRange&&next.type!=='url'&&next.type!=='email')next.setSelectionRange(...selection);}
    renderOverlay(host);
  }
  function prepareView(s,next) {
    if(['page','editpage'].includes(s.view)&&!['page','editpage'].includes(next))s.photoAttempt=null;
    if(['page','editpage'].includes(next)&&!['page','editpage'].includes(s.view)){s.pageDraft=draftPage(s.pageSaved);s.pageError='';s.pageWasSaved=false;s.photoAttempt=null;s.pageSection='page';s.pageView='edit';}
  }
  const navigate=(host,view,reset=false)=>{const s=hosts.get(host);if(view==='support'){toast('Prototype: contact the Tendso support team.');return;}if(view==='terms'){toast('Prototype: Terms of Service and Privacy Policy open here.');return;}if(view==='invite'){if(s.view!=='agents'){prepareView(s,'agents');s.previous=s.view;s.view='agents';render(host);}openOverlay(host,'invite');return;}prepareView(s,view);s.overlay=null;if(reset)s.stack=[];else if(view!==s.view)s.stack.push(s.view);s.previous=s.view;s.view=view;render(host);};
  const backTo=(host,fallback)=>{const s=hosts.get(host);if(s.overlay){closeOverlay(host);return;}const next=s.stack.pop()||fallback;prepareView(s,next);s.view=next;s.previous=s.stack.at(-1)||'home';render(host);};
  function refreshPageStatus(host) {
    const s=hosts.get(host),status=host.querySelector('[data-page-status]'),save=host.querySelector('[data-action="save-page"]');
    if(status){status.textContent=pageStatus(s);status.classList.toggle('is-error',!!s.pageError);status.setAttribute('role',s.pageError?'alert':'status');}
    if(save)save.disabled=!pageDirty(s);
  }
  function validatePage(s) {
    const saved=effectivePage(s.pageDraft);
    if(saved.displayName.length>100)return {field:'display-name',message:'Use a display name of 100 characters or fewer.'};
    if(saved.message.length>200)return {field:'page-message',message:'Use a message of 200 characters or fewer.'};
    for(const p of platforms){const value=saved.socialLinks[p.key];if(!value)continue;let valid=false;try{const url=new URL(value);valid=value.length<=2048&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&p.hosts.some(domain=>url.hostname===domain||(!['m.me','youtu.be'].includes(domain)&&url.hostname.endsWith('.'+domain)));}catch{}if(!valid)return {field:'social-'+p.key,message:`Use a valid ${p.label} link starting with https://.`};}
    return null;
  }
  function handle(host,name) {
    const s=hosts.get(host);
    if(name==='month'){s.month=s.month==='oct'?'sep':'oct';render(host);}
    else if(name==='invite')openOverlay(host,'invite');
    else if(name==='close-overlay')closeOverlay(host);
    else if(name==='mark-all-read'){s.notifications.forEach(n=>{n.read=true;});render(host);}
    else if(name.startsWith('notice-')){const n=s.notifications.find(row=>row.id===name.slice(7));if(n){n.read=true;s.selectedNotice=n.id;render(host);openOverlay(host,'notification');}}
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
    else if(name==='save-page'){
      if(!pageDirty(s))return;const invalid=validatePage(s);
      if(invalid){s.pageError=invalid.message;refreshPageStatus(host);const field=host.querySelector(`[name="${invalid.field}"]`);field?.focus({preventScroll:true});field?.scrollIntoView({block:'nearest'});return;}
      s.pageSaved=effectivePage(s.pageDraft);s.pageWasSaved=true;s.pageError='';refreshPageStatus(host);toast('Page saved in this phone only. Your real page is unchanged.');
    }
    else if(name.startsWith('editor-section-')){s.pageSection=name.slice('editor-section-'.length);render(host);}
    else if(name.startsWith('editor-view-')){s.pageView=name.slice('editor-view-'.length);render(host);}
    else if(name==='choose-photo')host.querySelector('[name="page-photo"]')?.click();
    else if(name==='save-wise'){const field=host.querySelector('[name="wise-email"]');if(!field.value.includes('@')||!field.validity.valid){field.reportValidity();return;}s.wiseEmail=field.value.trim();backTo(host,'me');toast('Wise details changed in the prototype only.');}
    else if(name==='save-profile'){backTo(host,'me');toast('Prototype only. No account details were changed.');}
    else if(s.view==='home'&&(name==='copy'||name==='share')){s.homeStatus=name==='copy'?'Sample link: tendso.com/v2/a/mika':'Prototype only. No external sharing opens here.';host.querySelector('[data-home-share-status]').textContent=s.homeStatus;}
    else if(name==='copy'||name==='copy-invite'||name==='copy-code'){if(s.overlay==='invite'){s.inviteStatus=name==='copy-code'?'Invitation code copied.':'Invite link copied.';host.querySelector('.ar-dialog-status').textContent=s.inviteStatus;}toast(name==='copy-code'?'Sample invitation code: MIKA':'Sample link: tendso.com/v2/a/mika'+(name==='copy-invite'?'/earn':''));}
    else if(name==='share'||name==='share-invite'){if(name==='share-invite'){s.inviteStatus='Prototype only. No invitation was sent.';host.querySelector('.ar-dialog-status').textContent=s.inviteStatus;}toast(name==='share'?`Prototype: share ${s.pageSaved.displayName||'Mika Santos'}’s saved shop page. Unsaved edits are not shared.`:'Prototype: share your agent invitation. No external sharing opens here.');}
    else if(name.startsWith('social-')){const p=platforms.find(row=>row.key===name.slice(7));if(p&&s.pageSaved.socialLinks[p.key])toast(`Saved ${p.label} link: ${s.pageSaved.socialLinks[p.key]}`);}
    else if(name==='poster')toast('Prototype: choose the QR image or printable poster.');
    else if(name==='signout')toast('Prototype only. You remain signed in to your real account.');
  }
  document.getElementById('ar-screen-picker').innerHTML=keys.map((key,i)=>`<option value="${key}">${String(i+1).padStart(2,'0')} · ${screens[key].title}</option>`).join('');
  hero=mount(document.getElementById('ar-live-phone'),'home');
  keys.forEach((key,i)=>{const data=screens[key],figure=document.createElement('figure');figure.className='ar-tile';figure.dataset.group=data.group;figure.dataset.screen=key;figure.innerHTML=`<div class="ar-tile-top"><span>${String(i+1).padStart(2,'0')} / ${data.title}</span><span>Reference</span></div><div class="ar-tile-phone"></div><figcaption><span>${String(i+1).padStart(2,'0')}</span><div><h3>${data.title}</h3><p>${data.note}</p></div></figcaption>`;document.getElementById('ar-gallery').appendChild(figure);mount(figure.querySelector('.ar-tile-phone'),key);});
  [['ar-sales-held','sales'],['ar-page-held','page']].forEach(([id,held])=>{const target=document.getElementById(id);if(target)target.innerHTML=`<div class="ar-app ar-held-home" data-view="home" inert aria-hidden="true"><div class="ar-body"><p class="ar-home-tools-label">Your tools</p>${homeTools(held)}</div></div>`;});
  document.addEventListener('click',event=>{
    const control=event.target.closest('button');if(!control)return;
    if(control.dataset.filter){const filter=control.dataset.filter;document.querySelectorAll('[data-filter]').forEach(node=>node.setAttribute('aria-pressed',String(node===control)));document.querySelectorAll('.ar-tile').forEach(tile=>{tile.hidden=filter!=='all'&&tile.dataset.group!==filter;});T.fitPhones();return;}
    if(control.dataset.cycle){const currentState=hosts.get(hero),current=keys.indexOf(currentState.overlay==='invite'?'invite':currentState.view),next=(Math.max(0,current)+Number(control.dataset.cycle)+keys.length)%keys.length;navigate(hero,keys[next],true);return;}
    const host=control.closest('.screen-root');if(!host||!hosts.has(host))return;
    if(control.dataset.back)backTo(host,control.dataset.go);else if(control.dataset.go)navigate(host,control.dataset.go,!!control.closest('.ar-tabs'));else if(control.dataset.action)handle(host,control.dataset.action);
  });
  document.addEventListener('input',event=>{
    const field=event.target,host=field.closest('.screen-root');if(!host||!hosts.has(host))return;
    const s=hosts.get(host);if(!['page','editpage'].includes(s.view))return;
    if(field.name==='display-name')s.pageDraft.displayName=field.value;
    else if(field.name==='page-message'){s.pageDraft.message=field.value;host.querySelector('[data-message-count]').textContent=`${field.value.length} / 200 characters`;}
    else if(field.name?.startsWith('social-'))s.pageDraft.socialLinks[field.name.slice(7)]=field.value;
    else return;
    s.pageError='';s.pageWasSaved=false;refreshPageStatus(host);
  });
  document.addEventListener('change',event=>{
    const field=event.target,host=field.closest('.screen-root');if(!host||!hosts.has(host))return;
    const s=hosts.get(host);if(!['page','editpage'].includes(s.view))return;
    if(field.name?.startsWith('show-')){const key=field.name.slice(5);s.pageDraft['show'+key[0].toUpperCase()+key.slice(1)]=field.checked;s.pageError='';s.pageWasSaved=false;render(host);}
    else if(field.name==='page-photo'){
      const file=field.files[0];if(!file)return;
      if(!file.type.startsWith('image/')||!file.size||file.size>5*1024*1024){s.pageError='Choose an image up to 5 MB.';refreshPageStatus(host);field.value='';return;}
      const attempt={};s.photoAttempt=attempt;const reader=new FileReader();
      reader.onload=()=>{if(s.photoAttempt!==attempt)return;s.pageDraft.photo=String(reader.result);s.pageDraft.showPhoto=true;s.pageError='';s.pageWasSaved=false;if(['page','editpage'].includes(s.view))render(host);};
      reader.onerror=()=>{if(s.photoAttempt!==attempt)return;s.pageError='Your photo could not be opened. Please try again.';refreshPageStatus(host);};
      reader.readAsDataURL(file);
    }
  });
  document.addEventListener('keydown',event=>{
    const host=event.target.closest?.('.screen-root');if(!host||!hosts.has(host))return;
    const s=hosts.get(host);if(!s.overlay)return;
    if(event.key==='Escape'){event.preventDefault();closeOverlay(host);return;}
    if(event.key==='Tab'){
      const dialog=host.querySelector('.ar-dialog'),controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const first=controls[0],last=controls.at(-1);if(!first)return;
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus({preventScroll:true});}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
    }
  });
  document.getElementById('ar-screen-picker').addEventListener('change',event=>navigate(hero,event.target.value,true));
  T.fitPhones();
  window.AffiliateProposal={ready:true,screens:keys,show:key=>{if(screens[key])navigate(hero,key);}};
})();
