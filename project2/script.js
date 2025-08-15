// Simple, clean JS for layout + persistence + admin features
// - localStorage key: saisree_v2
// - admin default credentials created at first run
// - routes: #/ (landing), #/public, #/event/<id>, #/login, #/admin

const DATA_KEY = 'saisree_v2';
const CRED_KEY = 'saisree_creds_v2';
const SESSION_KEY = 'saisree_session';

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from((r||document).querySelectorAll(s));

/* ----------------- Utility: hashing (sha-256 with salt) ----------------- */
async function hashWithSalt(password, saltHex){
  const enc = new TextEncoder();
  const passBytes = enc.encode(password);
  const saltBytes = hexToBytes(saltHex);
  const combined = new Uint8Array(saltBytes.length + passBytes.length);
  combined.set(saltBytes, 0); combined.set(passBytes, saltBytes.length);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  return bytesToHex(new Uint8Array(hash));
}
function bytesToHex(bytes){ return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function hexToBytes(hex){ if(!hex) return new Uint8Array(); const arr = new Uint8Array(hex.length/2); for(let i=0;i<arr.length;i++) arr[i]=parseInt(hex.substr(i*2,2),16); return arr; }

/* ----------------- Data helpers ----------------- */
function readData(){ try{ return JSON.parse(localStorage.getItem(DATA_KEY)) || {}; }catch(e){ return {}; } }
function saveData(d){ localStorage.setItem(DATA_KEY, JSON.stringify(d)); window.dispatchEvent(new Event('data-updated')); }
function readCreds(){ try{ return JSON.parse(localStorage.getItem(CRED_KEY)); }catch(e){ return null; } }
function saveCreds(c){ localStorage.setItem(CRED_KEY, JSON.stringify(c)); }

/* ----------------- Init defaults ----------------- */
async function initDefaults(){
  if(!localStorage.getItem(DATA_KEY)){
    const initial = {
      company: {
        name: "SAISREE LED EVENTS",
        logo: "",
        watermark: "Video by Sai Sree",
        contacts: [
          {label: "Phone", value: "9849135853"},
          {label: "Email", value: "raju.saisree.rk@gmail.com"},
          {label: "Address", value: "Warangal Fort Road, Warangal, Telangana"}
        ],
        defaultPlayer: "16:9",
        landing: {
          heading: "Enter Public View",
          subtitle: "Professional live streaming & event cinematography",
          productsTitle: "PRODUCTS",
          productsContent: "Packages & pricing can be edited in Admin"
        }
      },
      events: []
    };
    saveData(initial);
  }
  if(!localStorage.getItem(CRED_KEY)){
    // create simple salted hash for provided initial credentials
    const salt = crypto.getRandomValues(new Uint8Array(12));
    const saltHex = bytesToHex(salt);
    const hash = await hashWithSalt('9849135853', saltHex);
    const creds = { username: 'raju.saisree.rk@gmail.com', salt: saltHex, hash };
    saveCreds(creds);
    console.log('Admin cred created: raju.saisree.rk@gmail.com / 9849135853');
  }
  $('#year').textContent = new Date().getFullYear();
}

/* ----------------- Routing ----------------- */
function show(id){ $$('.page').forEach(p=>p.classList.add('hidden')); $('#'+id).classList.remove('hidden'); }

function router(){
  const hash = location.hash.replace(/^#/, '') || '/';
  if(hash.startsWith('event/')){
    const id = hash.split('/')[1];
    show('event'); renderEvent(id);
  } else if(hash === '/public' || hash === 'public'){
    show('public'); renderPublic();
  } else if(hash === '/login' || hash === 'login'){
    show('login');
  } else if(hash === '/admin' || hash === 'admin'){
    const session = sessionStorage.getItem(SESSION_KEY);
    if(!session) { location.hash = '#/login'; return; }
    show('admin'); renderAdmin();
  } else {
    show('landing');
  }
  updateHeaderLinks();
}

/* ----------------- Header & footer population ----------------- */
function populateHeader(){
  const d = readData();
  const c = d.company || {};
  $('#siteTitle').textContent = c.name || 'SAISREE LED EVENTS';
  $('#siteTagline').textContent = c.landing?.subtitle || '';
  $('#siteLogo').src = c.logo || '';
  $('#landingLogo').src = c.logo || '';
  $('#landingHeading').textContent = c.landing?.heading || 'Enter Public View';
  $('#landingSub').textContent = c.landing?.subtitle || '';
  $('#landingAbout').textContent = c.about || c.landing?.subtitle || '';
  $('#productsTitle').textContent = c.landing?.productsTitle || 'PRODUCTS';
  $('#productsContent').textContent = c.landing?.productsContent || '';
  const contacts = c.contacts || [];
  $('#landingContacts').innerHTML = contacts.map(ct=>`<div><strong>${ct.label}:</strong> ${ct.value}</div>`).join('');
}

/* ----------------- Public view rendering ----------------- */
function renderPublic(){
  const d = readData();
  const events = (d.events || []).slice().sort((a,b)=>{
    const da = parseEventDate(a.date), db = parseEventDate(b.date);
    return (da||0) - (db||0);
  });
  const grid = $('#events');
  grid.innerHTML = '';
  if(!events.length) { grid.innerHTML = '<div class="card">No events yet. Admin can add events.</div>'; return; }
  events.forEach(ev=>{
    const card = document.createElement('div'); card.className='event-card card';
    const thumb = ev.thumbnail || ev.images?.[0] || '';
    card.innerHTML = `
      <img src="${escapeHtml(thumb)}" alt="${escapeHtml(ev.title||'')}" />
      <div style="margin-top:8px"><strong>${escapeHtml(ev.title||'Untitled')}</strong></div>
      <div class="meta muted">${escapeHtml(ev.date||'')} • ${escapeHtml(ev.client||'')}</div>
      <div class="event-actions">
        <a class="btn btn-primary" href="#/event/${ev.id}">View Event</a>
        <button class="btn" data-id="${ev.id}" data-act="share">Share</button>
      </div>
    `;
    grid.appendChild(card);
    card.querySelector('[data-act="share"]').addEventListener('click', ()=> {
      const url = location.origin + location.pathname + '#/event/' + ev.id;
      navigator.clipboard?.writeText(url).then(()=> alert('Event URL copied to clipboard'));
    });
  });
}

/* ----------------- Event page rendering ----------------- */
function renderEvent(id){
  const d = readData();
  const ev = (d.events||[]).find(e=>e.id===id);
  if(!ev){ alert('Event not found'); location.hash = '#/'; return; }

  // Views increment
  ev.views = (ev.views||0) + 1;
  saveData(d);

  $('#eventTitle').textContent = ev.title || '';
  $('#eventSub').textContent = `${ev.date || ''}${ev.time ? ' • ' + ev.time : ''} ${ev.venue ? ' • ' + ev.venue : ''}`;
  $('#viewLikeSmall').textContent = `${(ev.views||0).toLocaleString()} views • ${(ev.likes||0).toLocaleString()} likes`;

  // player
  const playerWrap = $('#playerContainer'); playerWrap.innerHTML = '';
  const size = ev.playerSize || d.company?.defaultPlayer || '16:9';
  const padding = (size === '9:16') ? (100*(9/16)) : (size === '4:3' ? 100*(3/4) : (size === '1:1' ? 100 : 56.25));
  const player = document.createElement('div'); player.className='player-centered'; player.style.paddingTop = padding + '%';
  if(ev.youtube){
    const yt = extractYouTubeID(ev.youtube);
    if(yt){
      const iframe = document.createElement('iframe'); iframe.src = `https://www.youtube.com/embed/${yt}?rel=0`; iframe.allow='accelerometer; autoplay; encrypted-media; picture-in-picture'; iframe.setAttribute('loading','lazy');
      iframe.style.border='0'; iframe.style.width='100%'; iframe.style.height='100%'; player.appendChild(iframe);
    } else player.innerHTML = `<div class="muted">Invalid YouTube link</div>`;
  } else player.innerHTML = `<div class="muted">No video set</div>`;
  // watermark
  const wm = document.createElement('div'); wm.textContent = d.company?.watermark || ''; wm.style.position='absolute'; wm.style.left='8px'; wm.style.bottom='8px'; wm.style.background='rgba(0,0,0,0.28)'; wm.style.color='white'; wm.style.padding='6px 8px'; wm.style.borderRadius='8px';
  player.appendChild(wm);
  playerWrap.appendChild(player);

  // intro overlay (brief)
  $('#introText').textContent = d.company?.introText || 'Presented by SAISREE LED EVENTS';
  $('#introOverlay').classList.remove('hidden');
  setTimeout(()=> $('#introOverlay').classList.add('hidden'), 2600);

  // gallery
  const gallery = $('#gallery'); gallery.innerHTML = '';
  (ev.images||[]).forEach(src=>{
    const img = document.createElement('img'); img.src = src; gallery.appendChild(img);
    img.style.opacity = 0; setTimeout(()=>{ img.style.transition='opacity .45s'; img.style.opacity = 1; }, 60);
  });

  // details
  $('#eventDetails').innerHTML = `
    <p><strong>Client:</strong> ${escapeHtml(ev.client||'')}</p>
    <p><strong>Ad:</strong> ${escapeHtml(ev.adText||'')}</p>
    <p><strong>VOD Links:</strong></p>
    <ul>${(ev.vods||[]).map(v=>`<li><a href="${escapeAttr(v)}" target="_blank">${escapeHtml(v)}</a></li>`).join('')}</ul>
  `;

  // chat toggle
  if(ev.options?.chat) { $('#chatBox').classList.remove('hidden'); renderChat(ev); } else $('#chatBox').classList.add('hidden');

  // like handler
  $('#likeBtn').onclick = ()=> {
    const name = prompt('Enter your name to like (one-time). This stores your name locally for this event).');
    if(!name) return;
    ev.likedBy = ev.likedBy || [];
    const already = ev.likedBy.some(n => n.trim().toLowerCase() === name.trim().toLowerCase());
    if(already) { alert('You have already liked this event.'); return; }
    ev.likedBy.push(name.trim());
    ev.likes = (ev.likedBy||[]).length;
    saveData(d);
    $('#viewLikeSmall').textContent = `${(ev.views||0).toLocaleString()} views • ${(ev.likes||0).toLocaleString()} likes`;
  };

  // share handler
  $('#shareBtn').onclick = ()=> {
    const url = location.origin + location.pathname + '#/event/' + ev.id;
    navigator.clipboard?.writeText(url).then(()=> alert('Event URL copied to clipboard'));
  };

  // poster: simple canvas
  $('#posterBtn').onclick = ()=> generatePoster(ev);

  // QR: opens external QR generator
  $('#qrBtn').onclick = ()=> {
    const url = location.origin + location.pathname + '#/event/' + ev.id;
    window.open('https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url), '_blank');
  };

  // pip (works only for local <video>)
  $('#pipBtn').onclick = async ()=> {
    const vid = $('#playerContainer video');
    if(!vid){ alert('PiP available for uploaded video files only.'); return; }
    try{ await vid.requestPictureInPicture(); } catch(err){ alert('PiP failed: '+err.message); }
  };

  // back button
  $('#eventBack').onclick = ()=> { location.hash = '#/'; };
}

/* ----------------- Chat rendering ----------------- */
function renderChat(ev){
  const data = readData();
  const event = (data.events||[]).find(x=>x.id===ev.id);
  const wrap = $('#chatMessages'); wrap.innerHTML = '';
  (event.chat||[]).forEach(m=>{
    const div = document.createElement('div'); div.className='msg';
    div.innerHTML = `<strong>${escapeHtml(m.name)}</strong> <div class="muted small">${new Date(m.t).toLocaleString()}</div><div>${escapeHtml(m.text)}</div>`;
    wrap.appendChild(div);
  });
  $('#chatSend').onclick = ()=> {
    const name = $('#chatName').value.trim();
    const text = $('#chatMsg').value.trim();
    if(!name) return alert('Enter your name');
    if(!text) return;
    event.chat = event.chat || [];
    event.chat.push({ name, text, t: Date.now() });
    saveData(data);
    $('#chatMsg').value = ''; renderChat(ev);
  };
}

/* ----------------- Admin panel ----------------- */
async function renderAdmin(){
  const d = readData();
  // populate company & main
  $('#mainSiteTitle').value = d.company?.name || '';
  $('#mainLanding').value = d.company?.landing?.heading || '';
  $('#mainSub').value = d.company?.landing?.subtitle || '';
  $('#mainProductsTitle').value = d.company?.landing?.productsTitle || '';
  $('#mainProducts').value = d.company?.landing?.productsContent || '';

  // events list
  const list = $('#eventsList'); list.innerHTML = '';
  (d.events||[]).forEach(ev=>{
    const div = document.createElement('div'); div.className='admin-event';
    div.innerHTML = `<div><strong>${escapeHtml(ev.title)}</strong><div class="muted">${escapeHtml(ev.date||'')}</div></div>
      <div class="row">
        <button class="btn" data-id="${ev.id}" data-act="edit">Edit</button>
        <button class="btn btn-ghost" data-id="${ev.id}" data-act="delete">Delete</button>
      </div>`;
    list.appendChild(div);
    div.querySelector('[data-act="edit"]').onclick = ()=> openEventModal(ev.id);
    div.querySelector('[data-act="delete"]').onclick = ()=> { if(confirm('Delete event?')) { d.events = d.events.filter(x=>x.id!==ev.id); saveData(d); renderAdmin(); renderPublic(); } };
  });

  // contacts
  $('#contactsList').innerHTML = (d.company?.contacts||[]).map((ct, i)=> `<div class="row"><div style="flex:1"><strong>${escapeHtml(ct.label)}</strong>: ${escapeHtml(ct.value)}</div><button class="btn btn-ghost" data-i="${i}">Remove</button></div>`).join('');
  $$('#contactsList button').forEach(btn => {
    btn.onclick = (e)=>{ const idx = +btn.dataset.i; d.company.contacts.splice(idx,1); saveData(d); renderAdmin(); populateHeader(); };
  });
}

/* ----------------- Event modal logic ----------------- */
let editingId = null;
function openEventModal(id){
  editingId = id || null;
  $('#eventModal').classList.remove('hidden');
  $('#eventModalTitle').textContent = id ? 'Edit Event' : 'Add Event';
  const d = readData(); const ev = d.events?.find(x=>x.id===id);
  $('#evTitle').value = ev?.title || ''; $('#evClient').value = ev?.client || ''; $('#evDate').value = ev?.date || ''; $('#evTime').value = ev?.time || '';
  $('#evVenue').value = ev?.venue || ''; $('#evAd').value = ev?.adText || ''; $('#evYoutube').value = ev?.youtube || '';
  $('#evPlayer').value = ev?.playerSize || 'default'; $('#evBg').value = ev?.bgColor || '#000000'; $('#evTheme').value = ev?.theme || '';
  $('#optChat').checked = !!ev?.options?.chat; $('#optFeatured').checked = !!ev?.options?.featured; $('#optCountdown').checked = !!ev?.options?.countdown; $('#optPoster').checked = !!ev?.options?.poster; $('#optScheduled').checked = !!ev?.options?.scheduled;
}
function closeEventModal(){ $('#eventModal').classList.add('hidden'); editingId = null; $('#eventForm').reset(); }

/* save event */
$('#saveEventBtn').onclick = async ()=> {
  const d = readData(); d.events = d.events || [];
  const files = Array.from($('#evImages').files || []);
  const images = [];
  for(const f of files) images.push(await fileToDataURL(f));
  const thumbFile = $('#evThumb').files?.[0];
  const thumb = thumbFile ? await fileToDataURL(thumbFile) : null;

  const obj = {
    id: editingId || 'ev_' + Math.random().toString(36).slice(2,9),
    title: $('#evTitle').value.trim(),
    client: $('#evClient').value.trim(),
    date: $('#evDate').value.trim(),
    time: $('#evTime').value.trim(),
    venue: $('#evVenue').value.trim(),
    adText: $('#evAd').value.trim(),
    youtube: $('#evYoutube').value.trim(),
    vods: [],
    playerSize: $('#evPlayer').value,
    bgColor: $('#evBg').value,
    theme: $('#evTheme').value || null,
    options: {
      chat: !!$('#optChat').checked,
      featured: !!$('#optFeatured').checked,
      countdown: !!$('#optCountdown').checked,
      poster: !!$('#optPoster').checked,
      scheduled: !!$('#optScheduled').checked
    },
    images, thumbnail: thumb,
    likes: 0, likedBy: [], views: 0, chat: []
  };

  if(editingId){
    d.events = d.events.map(e => e.id === editingId ? Object.assign(e, obj) : e);
  } else d.events.push(obj);

  saveData(d);
  closeEventModal(); renderAdmin(); renderPublic();
};

/* cancel / modal close */
$('#cancelEventBtn').onclick = ()=> closeEventModal();
$('.modal')?.addEventListener('click', (ev)=> { if(ev.target.classList.contains('modal')) closeEventModal(); });

/* add event */
$('#addEvent').onclick = ()=> openEventModal();

/* delete all */
$('#deleteAll').onclick = ()=> { if(confirm('Delete all events?')){ const d=readData(); d.events=[]; saveData(d); renderAdmin(); renderPublic(); } };

/* ----------------- Company main save ----------------- */
$('#saveMain').onclick = async ()=>{
  const d = readData(); d.company = d.company || {};
  d.company.name = $('#mainSiteTitle').value.trim();
  d.company.landing = d.company.landing || {};
  d.company.landing.heading = $('#mainLanding').value.trim();
  d.company.landing.subtitle = $('#mainSub').value.trim();
  d.company.landing.productsTitle = $('#mainProductsTitle').value.trim();
  d.company.landing.productsContent = $('#mainProducts').value.trim();
  const logoFile = $('#mainLogoFile').files?.[0];
  if(logoFile) d.company.logo = await fileToDataURL(logoFile);
  saveData(d); populateHeader(); alert('Main page saved');
};

/* contacts add */
$('#addContactBtn').onclick = (e)=>{
  e.preventDefault();
  const label = $('#contactLabel').value.trim(); const value = $('#contactValue').value.trim();
  if(!label || !value) return alert('Enter label & value');
  const d = readData(); d.company = d.company || {}; d.company.contacts = d.company.contacts || []; d.company.contacts.push({label,value});
  saveData(d); $('#contactLabel').value=''; $('#contactValue').value=''; renderAdmin(); populateHeader();
};

/* save company settings + admin credential change */
$('#saveCompanyBtn').onclick = async ()=>{
  const d = readData(); d.company = d.company || {};
  d.company.name = $('#companyName').value.trim();
  d.company.watermark = $('#companyWatermark').value.trim();
  d.company.defaultPlayer = $('#companyPlayer').value;
  // credentials change
  const curr = $('#currAdmin').value.trim(); const currPass = $('#currAdminPass').value;
  const newUser = $('#newAdmin').value.trim(); const newPass = $('#newAdminPass').value;
  if(curr && currPass && (newUser || newPass)){
    const creds = readCreds();
    if(!creds){ alert('No existing creds found'); return; }
    const check = await hashWithSalt(currPass, creds.salt);
    if(check !== creds.hash || curr !== creds.username){ alert('Current username/password incorrect'); return; }
    // create new salt & hash
    const salt = crypto.getRandomValues(new Uint8Array(12)); const saltHex = bytesToHex(salt);
    const hash = await hashWithSalt(newPass || currPass, saltHex);
    saveCreds({ username: newUser || curr, salt: saltHex, hash });
    alert('Admin credentials updated');
  }
  saveData(d); alert('Company settings saved'); populateHeader();
};

/* ----------------- Login ----------------- */
$('#loginForm').onsubmit = async (e)=>{
  e.preventDefault();
  const username = $('#loginUser').value.trim(), pwd = $('#loginPass').value;
  const creds = readCreds();
  if(!creds){ alert('No credentials set'); return; }
  const check = await hashWithSalt(pwd, creds.salt);
  if(check === creds.hash && username === creds.username){
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: username, token: Math.random().toString(36).slice(2) }));
    updateHeaderLinks(); location.hash = '#/admin';
  } else {
    $('#loginError').textContent = 'Invalid username or password'; $('#loginError').classList.remove('hidden');
    setTimeout(()=> $('#loginError').classList.add('hidden'), 2000);
  }
};

/* ----------------- Utilities ----------------- */
function escapeHtml(s=''){ return String(s||'').replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s=''){ return escapeHtml(s).replace(/"/g,'&quot;'); }
function fileToDataURL(file){ return new Promise((res,rej)=>{ const fr = new FileReader(); fr.onload = ()=> res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); }); }
function extractYouTubeID(url){ try{ const u = new URL(url); if(u.hostname.includes('youtu.be')) return u.pathname.slice(1); if(u.hostname.includes('youtube.com')){ if(u.searchParams.get('v')) return u.searchParams.get('v'); const m = u.pathname.match(/\/embed\/([^\/\?]+)/); if(m) return m[1]; } }catch(e){} return null; }
function parseEventDate(s){ if(!s) return null; const [d,m,y] = s.split('-').map(Number); if(!d||!m||!y) return null; return new Date(y,m-1,d).getTime(); }

/* ----------------- Poster generation (simple) ----------------- */
function generatePoster(ev){
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 675;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1724'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const imgSrc = ev.thumbnail || ev.images?.[0];
  const draw = ()=> {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 48px Poppins, sans-serif'; ctx.fillText(ev.title||'Event', 40, 520);
    ctx.font = '20px Roboto, sans-serif'; ctx.fillText(`${ev.date || ''} ${ev.time || ''}`, 40, 560);
    const a = document.createElement('a'); a.download = `${(ev.title||'event').replace(/\s+/g,'_')}.png`; a.href = canvas.toDataURL('image/png'); a.click();
  };
  if(imgSrc){
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload = ()=> { ctx.drawImage(img,0,0,canvas.width,420); draw(); };
    img.onerror = ()=> draw();
    img.src = imgSrc;
  } else draw();
}

/* ----------------- Header link updates ----------------- */
function updateHeaderLinks(){
  const authed = !!sessionStorage.getItem(SESSION_KEY);
  $('#nav-admin').classList.toggle('hidden', !authed);
  $('#nav-login').classList.toggle('hidden', authed);
  $('#nav-logout').classList.toggle('hidden', !authed);
}

/* ----------------- Small helpers / event wiring ----------------- */
window.addEventListener('hashchange', router);
window.addEventListener('load', async ()=>{
  await initDefaults();
  populateHeader();
  wireUI();
  router();
});
window.addEventListener('data-updated', ()=> { populateHeader(); renderPublic(); renderAdmin(); });

function wireUI(){
  // landing links
  $('#enterPublic').onclick = ()=> location.hash = '#/public';
  $('#enterAdmin').onclick = ()=> location.hash = '#/login';
  $('#nav-home').onclick = ()=> location.hash = '#/';
  $('#nav-public').onclick = ()=> location.hash = '#/public';
  $('#nav-login').onclick = ()=> location.hash = '#/login';
  $('#nav-logout').onclick = ()=> { sessionStorage.removeItem(SESSION_KEY); updateHeaderLinks(); location.hash = '#/'; };

  // public search
  $('#searchBtn').onclick = ()=> renderPublic();
  $('#clearBtn').onclick = ()=> { $('#searchText').value=''; $('#searchDate').value=''; renderPublic(); };

  // login default value for convenience (the credential created at init)
  const creds = readCreds(); if(creds) $('#loginUser').value = creds.username;

  // admin tabs
  $$('.tab').forEach(btn => btn.addEventListener('click', ()=> {
    $$('.tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    $$('.admin-panel').forEach(p=>p.classList.add('hidden'));
    $('#'+id).classList.remove('hidden');
    if(id === 'eventsTab') renderAdmin();
    if(id === 'mainTab') renderAdmin();
    if(id === 'companyTab') renderAdmin();
  }));

  // preview apply (simple)
  $('#applyPreviewBtn').onclick = ()=> { const d = readData(); $('#previewArea').innerHTML = `<h4>${escapeHtml(d.company?.name||'SAISREE LED EVENTS')}</h4><p class="muted">${escapeHtml(d.company?.landing?.subtitle||'')}</p>`; };

  // main save and reset
  $('#saveMain').onclick = ()=> $('#saveMain').disabled = false;
  $('#resetMain').onclick = ()=> { const d = readData(); $('#mainSiteTitle').value = d.company?.name || ''; $('#mainLanding').value = d.company?.landing?.heading || ''; $('#mainSub').value = d.company?.landing?.subtitle || ''; $('#mainProductsTitle').value = d.company?.landing?.productsTitle || ''; $('#mainProducts').value = d.company?.landing?.productsContent || ''; };

  // events modal close on clicking outside
  $('.modal')?.addEventListener('click', (ev)=> { if(ev.target.classList.contains('modal')) closeEventModal(); });

  // add contact
  $('#addContactBtn').onclick = (e)=> { e.preventDefault(); $('#saveCompanyBtn').disabled=false; };

  // save company form handler
  $('#saveCompanyBtn').onclick = ()=> { /* handled in renderAdmin save click in code above */ };

  // confirm modal buttons
  $('#confirmNo').onclick = ()=> $('#confirmModal').classList.add('hidden');

  // basic bindings for event modal save are above
}

/* Utility: querySelector shorthand for body elements used earlier */
function $(sel, root=document){ return root.querySelector(sel); }
function $$(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
