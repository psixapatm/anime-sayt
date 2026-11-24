
const $ = (s) => document.querySelector(s);
let me = null;

const THEMES = ['light','dark'];
// Minimal, consistent outline icons (inline SVG; no external library required).
const iconSvg = (name) => {
  const paths = {
    moon:'<path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.6 8.6 0 1 0 20.2 15.1Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    gem:'<path d="m6 3 12 0 4 6-10 12L2 9l4-6Z"/><path d="m2 9 20 0M6 3l6 18 6-18M6 3l-4 6m16-6 4 6"/>',
    crown:'<path d="m2.5 7 5 4 4.5-7 4.5 7 5-4-2 12H4.5L2.5 7Z"/><path d="M5 22h14"/>',
    bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    bot:'<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6M2 12v3m20-3v3"/>',
    medal:'<circle cx="12" cy="8" r="5"/><path d="m8.5 12-1 9 4.5-2.5 4.5 2.5-1-9"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    trophy:'<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5-4-8.9-9-8.9Z"/><path d="M7.5 10h.01M10 7.5h.01M14 7.5h.01M16.5 10h.01"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const iconLabel = (name, label) => `<span class="icon-label">${iconSvg(name)}<span>${escapeHtml(label)}</span></span>`;
const navFeatureButton = (name,label,onClick) => el('button',{className:'nav-feature',title:label,innerHTML:`<span class="nav-feature-icon">${iconSvg(name)}</span><span class="nav-feature-label">${label}</span>`,onclick:onClick});

function prefsKey(){return 'd kursi-prefs-'+(me?.username||'guest');}
function readPrefs(){try{return JSON.parse(localStorage.getItem(prefsKey())||'{}')}catch{return {}}}
function savePrefs(patch){const prefs={...readPrefs(),...patch};localStorage.setItem(prefsKey(),JSON.stringify(prefs));applyPrefs(prefs);}
function setTheme(theme, persist=true){
  if(!THEMES.includes(theme)) theme='light';
  document.documentElement.dataset.theme=theme;
  const b=document.getElementById('themeToggle'); if(b){b.innerHTML=iconSvg(theme==='dark'?'sun':'moon');b.title=theme==='dark'?'Kunduzgi rejimga o‘tish':'Tungi rejimga o‘tish';b.setAttribute('aria-label',b.title);}
  if(persist) savePrefs({theme});
}
function applyPrefs(prefs=readPrefs()){
  const root=document.documentElement;
  root.style.setProperty('--user-font',prefs.font||'Inter, system-ui, sans-serif');
  root.style.setProperty('--user-font-size',(prefs.fontSize||16)+'px');
  const colors={violet:['#6558e8','#168f9a'],blue:['#3478d4','#19a6b5'],green:['#16845d','#5aaa79'],rose:['#d34f83','#8b5cf6'],orange:['#c46a2d','#d4a13c'],cyan:['#078b9b','#5274d8']};
  const c=colors[prefs.color]||colors.violet;root.style.setProperty('--acc',c[0]);root.style.setProperty('--acc2',c[1]);
  setTheme(prefs.theme||'light',false);
  document.body.style.fontFamily=prefs.font||'Inter, system-ui, sans-serif';document.body.style.fontSize=(prefs.fontSize||16)+'px';
}
function cycleTheme(){const current=document.documentElement.dataset.theme||'light';savePrefs({theme:current==='dark'?'light':'dark'});}
applyPrefs();
let token = localStorage.getItem('token');
let list = [];
const filt = { q: '', genre: '', fav: false, sort: 'new' };
const TG = 'https://t.me/eclipse_nyx';
const BOT = 'https://t.me/verification_zverbot?start=pro';
const tgLink = (label) => el('a', { className: 'btn pri', href: TG, target: '_blank', rel: 'noopener', textContent: label || 'Telegram: @eclipse_nyx' });
const botLink = (label) => el('a', { className: 'btn pri', href: BOT, target: '_blank', rel: 'noopener', textContent: label || 'Bot orqali obuna olish' });

const api = async (url, method = 'GET', body) => {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Xatolik yuz berdi');
  return data;
};

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  kids.flat().forEach(k => e.append(k));
  return e;
};

function showAppDialog(kind, message, defaultValue=''){
  return new Promise(resolve=>{
    const overlay=el('div',{className:'app-dialog-overlay'});
    const panel=el('section',{className:'app-dialog',role:'dialog','aria-modal':'true'});
    const title=el('h3',{textContent:kind==='input'?'Ma’lumot kiriting':kind==='confirm'?'Tasdiqlash':'Xabar'});
    const body=el('p',{textContent:String(message??'')});
    let input=null;
    if(kind==='input'){input=el('input',{value:defaultValue,autocomplete:'off'});panel.append(title,body,input);}
    else panel.append(title,body);
    const actions=el('div',{className:'app-dialog-actions'});
    const close=(value)=>{overlay.remove();resolve(value);};
    if(kind!=='alert')actions.append(el('button',{type:'button',textContent:'Bekor qilish',onclick:()=>close(kind==='input'?null:false)}));
    actions.append(el('button',{type:'button',className:'pri',textContent:kind==='confirm'?'Tasdiqlash':kind==='input'?'Saqlash':'Tushunarli',onclick:()=>close(kind==='input'?input.value:kind==='confirm'?true:undefined)}));
    panel.append(actions);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)close(kind==='input'?null:false);});
    document.body.append(overlay);
    if(input){input.focus();input.select();input.addEventListener('keydown',e=>{if(e.key==='Enter')close(input.value);});}
    else actions.querySelector('.pri')?.focus();
  });
}
const askConfirm=(message)=>showAppDialog('confirm',message);
const askInput=(message,value='')=>showAppDialog('input',message,value);
window.alert=(message)=>{showAppDialog('alert',message);};

function setNav() {
  const nav = $('#nav');
  nav.replaceChildren();
  if (me) {
    const isAdmin = me.role === 'admin' || me.owner === true;
    const isMain = me.owner === true || me.adminLevel === 'main';
    const roleLabel = me.owner ? ' (Bosh Admin)' : me.role === 'admin' ? (me.adminLevel === 'main' ? ' (Main Admin)' : ' (Oddiy Admin)') : '';
    const bell = el('button', { className: 'icon-btn', title: 'Bildirishnomalar', 'aria-label': 'Bildirishnomalar', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>', onclick: () => showNotifs() });
    nav.append(
      el('button', { className: 'icon-btn', title: 'Sevimlilar', 'aria-label': 'Sevimlilar', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/></svg>', onclick: () => { filt.fav = true; showList(); } }),
      bell,
      navFeatureButton('users','Hamjamiyat',() => showCommunity()),
      navFeatureButton('trophy','Reyting',() => showLeaderboard()),
      navFeatureButton('map','Xarita',() => showRoadmap()),
      navFeatureButton('code','Kod yozish',() => showPlayground()),
      el('button', { className: 'icon-btn', title: 'Profilim', 'aria-label': 'Profilim', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.5 3.1-5.3 7-5.3s6.3 1.8 7 5.3"/></svg>', onclick: () => showProfile() }),
      el('button', { className: me.pro ? 'pri pro-pill' : 'pro-pill', innerHTML: me.pro ? iconLabel('crown','PRO') : iconLabel('gem','Pro'), onclick: () => showPlans() })
    );
    if (isAdmin && isMain) nav.append(el('button', { textContent: "Kurs qo'shish", onclick: () => showAdd() }));
    if (isAdmin) nav.append(el('button', { className: 'pri', textContent: 'Admin panel', onclick: () => showAdminPanel('stats') }));
    nav.append(el('button', { textContent: 'Chiqish', onclick: logout }));
    api('/api/notifications').then(d => { if (d.unread) { bell.dataset.count = d.unread; bell.title = d.unread + ' ta yangi bildirishnoma'; } }).catch(() => {});
  } else {
    nav.append(
      el('button', { textContent: 'Kirish', onclick: () => showAuth('login') }),
      el('button', { className: 'pri', textContent: "Ro'yxatdan o'tish", onclick: () => showAuth('register') })
    );
  }
  ensureAIWidget();
}

function logout() { localStorage.removeItem('token'); token = null; me = null; applyPrefs(readPrefs()); setNav(); showWelcome(); }

const ART = {
  a: `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1b3d"/><stop offset="1" stop-color="#2748b8"/></linearGradient></defs><rect width="200" height="300" fill="url(#ga)"/><rect x="16" y="56" width="168" height="150" rx="10" fill="#0a1022"/><circle cx="30" cy="70" r="4" fill="#ff5c8a"/><circle cx="44" cy="70" r="4" fill="#ffd86b"/><circle cx="58" cy="70" r="4" fill="#5ef0a0"/><g><rect x="28" y="92" width="46" height="6" rx="3" fill="#ff7ab6"/><rect x="80" y="92" width="64" height="6" rx="3" fill="#7fd1ff"/><rect x="40" y="110" width="88" height="6" rx="3" fill="#a8ffa0"/><rect x="40" y="128" width="60" height="6" rx="3" fill="#ffd86b"/><rect x="106" y="128" width="40" height="6" rx="3" fill="#7fd1ff"/><rect x="28" y="146" width="72" height="6" rx="3" fill="#ff7ab6"/><rect x="40" y="164" width="100" height="6" rx="3" fill="#a8ffa0"/></g><text x="28" y="194" font-family="monospace" font-size="16" fill="#5ef0a0">&gt;_</text></svg>`,
  b: `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1c8a"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient></defs><rect width="200" height="300" fill="url(#gb)"/><g fill="#fff" opacity=".18"><circle cx="30" cy="40" r="2"/><circle cx="70" cy="40" r="2"/><circle cx="110" cy="40" r="2"/><circle cx="150" cy="40" r="2"/><circle cx="30" cy="80" r="2"/><circle cx="70" cy="80" r="2"/><circle cx="110" cy="80" r="2"/><circle cx="150" cy="80" r="2"/></g><text x="100" y="168" text-anchor="middle" font-family="monospace" font-size="92" font-weight="700" fill="#fff">{ }</text><text x="100" y="214" text-anchor="middle" font-family="monospace" font-size="22" fill="#ffe3ef">&lt;/&gt;</text></svg>`,
  c: `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1030"/><stop offset="1" stop-color="#0f6b6b"/></linearGradient></defs><rect width="200" height="300" fill="url(#gc)"/><rect x="30" y="84" width="140" height="96" rx="8" fill="#0a1022" stroke="#5ef0ff" stroke-width="2"/><g><rect x="42" y="100" width="40" height="5" rx="2.5" fill="#5ef0ff"/><rect x="42" y="114" width="80" height="5" rx="2.5" fill="#ff7ab6"/><rect x="54" y="128" width="60" height="5" rx="2.5" fill="#a8ffa0"/><rect x="54" y="142" width="90" height="5" rx="2.5" fill="#ffd86b"/><rect x="42" y="156" width="50" height="5" rx="2.5" fill="#5ef0ff"/></g><path d="M14 188H186L170 206H30Z" fill="#cfd8ff"/><rect x="82" y="190" width="36" height="4" rx="2" fill="#8a96c8"/><g fill="#5ef0ff" opacity=".8"><rect x="40" y="236" width="14" height="30"/><rect x="62" y="226" width="14" height="40"/><rect x="84" y="216" width="14" height="50"/><rect x="106" y="230" width="14" height="36"/><rect x="128" y="206" width="14" height="60"/></g></svg>`,
};

function showWelcome() {
  const wc = (cls, sym, label) => {
    const pic = el('div', { className: 'art' });
    pic.innerHTML = ART[cls];
    return el('div', { className: 'wc ' + cls }, pic, el('span', { className: 'k', textContent: sym }), el('b', { textContent: label }));
  };
  const feat = (t, d) => el('div', {}, el('b', { textContent: t }), el('span', { textContent: d }));
  $('#app').replaceChildren(
    el('section', { className: 'land' },
      el('div', {},
        el('h1', { textContent: "Dasturlashni dars-ma-dars o'rganing" }),
        el('p', { textContent: "Video darslar, sevimlilar va izohlar bir joyda. Boshlash uchun akauntga kiring yoki yangisini oching." }),
        el('div', { className: 'btns' },
          el('button', { className: 'pri', textContent: 'Kirish', onclick: () => showAuth('login') }),
          el('button', { textContent: "Ro'yxatdan o'tish", onclick: () => showAuth('register') }))),
      el('div', { className: 'fan' }, wc('a', '</>', 'Python'), wc('b', '{ }', 'Web'), wc('c', '>_', 'Algoritmlar'))),
    el('div', { className: 'feats' },
      feat('Dars-ma-dars', "Har bir kurs darslarga bo'lingan, kerakli darsni tanlaysiz."),
      feat('Pro obuna', "Maxsus darslar Pro obunachilar uchun ochiladi."),
      feat('Yoqdi va izohlar', "Darslarga baho bering va fikringizni yozing.")));
}

function field(label, name, type = 'text', area = false) {
  const input = area ? el('textarea', { name, rows: 4 }) : el('input', { name, type });
  return el('div', {}, el('label', { textContent: label }), input);
}

function closeAuth() { const o = $('#ov'); if (o) o.remove(); document.body.style.overflow = ''; }
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAuth());

function showAuth(mode) {
  closeAuth();
  const reg = mode === 'register';
  const err = el('div', { className: 'err' });
  const u = el('input', { autocomplete: 'username', placeholder: 'Loginingiz' });
  const p = el('input', { type: 'password', autocomplete: reg ? 'new-password' : 'current-password', placeholder: 'Parolingiz' });
  const closeBtn=el('button',{className:'x',textContent:'×',title:'Yopish',onclick:closeAuth});
  const form=el('div',{className:'auth-form'},closeBtn,
    el('div',{className:'mobile-brand'},el('img',{className:'mobile-brand-mark',src:'/logo-mark.png',alt:''}),el('div',{className:'logo m-logo'},'Dasturlash ',el('b',{textContent:'Kursi'}))),
    el('div',{className:'tabs'},el('button',{className:'tab'+(!reg?' on':''),textContent:'Kirish',onclick:()=>showAuth('login')}),el('button',{className:'tab'+(reg?' on':''),textContent:"Ro'yxatdan o'tish",onclick:()=>showAuth('register')})),
    el('h2',{textContent:reg?'Akaunt yaratish':'Xush kelibsiz!'}),
    el('p',{className:'sub',textContent:reg?"Login va parol o'ylab toping. Har bir Telegram akkauntidan faqat bitta sayt akkaunti ochish mumkin.":'Login va parolingizni kiriting.'}),
    el('label',{textContent:'Login'}),u,el('label',{textContent:'Parol'}),p,err);
  const forgot=el('button',{type:'button',className:'forgot-link',textContent:'Parolni unutdingizmi?',hidden:true,onclick:()=>openRecovery(form,closeBtn)});
  if(!reg) form.append(forgot);
  const finishLogin=async(d)=>{token=d.token;localStorage.setItem('token',token);me=await api('/api/me');applyPrefs(readPrefs());closeAuth();setNav();showList();};
  const submitButton=el('button',{className:'pri go',textContent:reg?"Ro'yxatdan o'tish":'Kirish',onclick:async()=>{
    try{
      if(reg){
        const d=await api('/api/register/start','POST',{username:u.value.trim(),password:p.value});
        const nonce=new URL(d.botUrl).searchParams.get('start');
        const code=el('input',{inputMode:'numeric',maxLength:6,placeholder:'Telegram bot yuborgan 6 xonali kod'});
        const msg=el('p',{className:'sub',textContent:'1. Botni oching. 2. Start tugmasini bosing. 3. Bot yuborgan kodni shu yerga kiriting. Eslatma: bitta Telegram akkaunti faqat bitta sayt akkauntiga ulanadi.'});
        const bot=el('button',{className:'pri go',innerHTML:iconLabel('bot','Telegram botni ochish'),onclick:()=>window.open(d.botUrl,'_blank','noopener')});
        const verify=el('button',{className:'pri go',textContent:'Kodni tasdiqlash va ro‘yxatdan o‘tish',onclick:async()=>{try{const v=await api('/api/register/verify','POST',{nonce,code:code.value});await finishLogin(v);}catch(e){msg.textContent=e.message;}}});
        form.replaceChildren(closeBtn,el('h2',{textContent:'Telegram orqali tasdiqlash'}),msg,bot,el('label',{textContent:'Tasdiqlash kodi'}),code,verify);code.focus();return;
      }
      const d=await api('/api/login','POST',{username:u.value,password:p.value});await finishLogin(d);
    }catch(e){err.textContent=e.message;if(!reg)forgot.hidden=false;}
  }});
  form.append(submitButton);
  u.onkeydown=e=>{if(e.key==='Enter')p.focus()};p.onkeydown=e=>{if(e.key==='Enter')submitButton.click()};
  const ov=el('div',{id:'ov',className:'overlay',onclick:e=>{if(e.target===ov)closeAuth()}},el('div',{className:'auth'},el('div',{className:'auth-art'},el('img',{className:'auth-brand-mark',src:'/logo-mark.png',alt:'Dasturlash Kursi logotipi'}),el('div',{className:'logo'},'Dasturlash ',el('b',{textContent:'Kursi'})),el('p',{textContent:"Dasturlashni dars-ma-dars o'rganing. Kiring va yangi darslarni ko'ring."}),el('div',{className:'credit'},'Created by ',el('b',{textContent:'Sobirov'}))),form));
  document.body.append(ov);document.body.style.overflow='hidden';u.focus();
}

function openRecovery(form,closeBtn){
  const nonceState={value:''};const msg=el('p',{className:'sub',textContent:'Telegram bot orqali akkauntingizni tasdiqlang.'});const start=el('button',{className:'pri go',textContent:'Telegram orqali tiklash kodini olish',onclick:async()=>{try{const d=await api('/api/recovery/start','POST',{});nonceState.value=d.nonce;const bot=el('button',{className:'pri',innerHTML:iconLabel('bot','Telegram botni ochish'),onclick:()=>window.open(d.botUrl,'_blank','noopener')});const code=el('input',{inputMode:'numeric',maxLength:6,placeholder:'6 xonali kod'});const verify=el('button',{className:'pri',textContent:'Kodni tasdiqlash',onclick:async()=>{try{const v=await api('/api/recovery/verify','POST',{nonce:nonceState.value,code:code.value});const newLogin=el('input',{placeholder:'Yangi login (ixtiyoriy)',maxLength:20});const newPass=el('input',{type:'password',placeholder:'Yangi parol (ixtiyoriy)'});const save=el('button',{className:'pri',textContent:'Akkauntni tiklash',onclick:async()=>{try{const done=await api('/api/recovery/complete','POST',{recoveryToken:v.recoveryToken,username:newLogin.value.trim(),password:newPass.value});token=done.token;localStorage.setItem('token',token);me=await api('/api/me');closeAuth();setNav();showList();}catch(e){msg.textContent=e.message;}}});form.replaceChildren(closeBtn,el('h2',{textContent:'Yangi login va parol'}),msg,el('label',{textContent:'Yangi login'}),newLogin,el('label',{textContent:'Yangi parol'}),newPass,save);}catch(e){msg.textContent=e.message;}}});form.replaceChildren(closeBtn,el('h2',{textContent:'Akkauntni tiklash'}),msg,bot,el('label',{textContent:'Telegram kodini kiriting'}),code,verify);}catch(e){msg.textContent=e.message;}}});form.replaceChildren(closeBtn,el('h2',{textContent:'Parol yoki loginni unutdingizmi?'}),msg,start);}


async function showProfile() {
  try { me = await api('/api/me'); applyPrefs(readPrefs()); } catch { return logout(); }
  const recentBox=el('div',{className:'profile-grid'});
  const isOwner=me.owner===true;
  const name=el('input',{value:me.profileName||'',placeholder:'Ism Familiya',maxLength:80});
  let selectedBadge=me.badge||'none';const badge=el('div',{className:'badge-picker'});
  const badgeItems=[['none','<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.5 3.1-5.3 7-5.3s6.3 1.8 7 5.3"/></svg>','Oddiy'],['crown',iconSvg('crown'),'Toj'],['star','✦','Yulduz'],['fire','♨','Olov'],['diamond','◆','Olmos'],['code','</>','Kod']];
  const drawBadges=()=>badge.replaceChildren(...badgeItems.map(([v,ico,label])=>el('button',{type:'button',className:'badge-choice'+(selectedBadge===v?' selected':''),disabled:!me.pro&&v!=='none',title:label,innerHTML:'<span class="badge-orb">'+ico+'</span><small>'+label+'</small>',onclick:()=>{selectedBadge=v;drawBadges();}})));drawBadges();
  const status=el('div',{className:'sub'});
  const save=el('button',{className:'pri',textContent:'Profilni saqlash',onclick:async()=>{try{
    const changedName=name.value.trim()!==(me.profileName||'').trim();
    let currentPassword='';
    if(changedName){currentPassword=await askInput('Ismni o‘zgartirishni tasdiqlash uchun joriy parolingizni kiriting:');if(currentPassword===null)return;}
    await api('/api/profile','PUT',{profileName:name.value,badge:selectedBadge,currentPassword});
    me=await api('/api/me');status.textContent='Profil saqlandi.';showProfile();setNav();
  }catch(e){status.textContent=e.message;}}});
  const proUntil=me.pro&&me.proUntil?new Date(me.proUntil).toLocaleDateString():'Faol emas';
  const avatarBadge=badgeItems.find(x=>x[0]===(me.badge||'none'))||badgeItems[0];
  const head=el('section',{className:'profile-card profile-head'},el('div',{className:'profile-symbol',innerHTML:avatarBadge[0]==='none'?'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.5 3.1-5.3 7-5.3s6.3 1.8 7 5.3"/></svg>':avatarBadge[1]}),el('div',{},el('h2',{textContent:me.profileName||me.username}),el('p',{className:'sub',textContent:'@'+me.username}),el('span',{className:me.pro?'profile-pro':'profile-free',textContent:me.pro?'PRO OBUNA':'ODDIY FOYDALANUVCHI'})));
  const xpCard=el('section',{className:'profile-card learning-stats'},el('h3',{textContent:'O‘quv natijalaringiz'}),el('div',{className:'learning-stat-grid'},el('div',{},el('strong',{textContent:String(me.xp||0)}),el('small',{textContent:'XP ball'})),el('div',{},el('strong',{textContent:String((me.watchedEpisodes||[]).length)}),el('small',{textContent:'Ko‘rilgan dars'})),el('div',{},el('strong',{textContent:String((me.testResults||[]).length)}),el('small',{textContent:'Test urinishlari'}))),el('button',{className:'pri',textContent:'Reytingni ko‘rish',onclick:showLeaderboard}));
  const history=(me.recent||[]).map(x=>x.id);let courses=[];try{courses=await api('/api/anime')}catch{}const recent=history.map(id=>courses.find(c=>c.id===id)).filter(Boolean);
  recentBox.append(...(recent.length?recent.map(c=>el('div',{className:'profile-course',textContent:c.title,onclick:()=>showDetail(c.id)})):[el('p',{className:'sub',textContent:'Hozircha ko‘rilgan kurslar yo‘q.'})]));
  // Mustaqil test bo‘limi olib tashlandi: testlar kurs ichidagi har bir darsga biriktiriladi.
  const certBox=el('div',{className:'profile-grid cert-list'});
  (me.certificates||[]).forEach(c=>{
    const row=el('div',{className:'certificate-row'},
      el('button',{className:'certificate-open',innerHTML:iconLabel('medal',c.courseTitle+' · '+c.fullName),onclick:()=>printCertificate(c)}),
      el('a',{className:'certificate-verify-link',href:'/verify/'+encodeURIComponent(c.id),target:'_blank',rel:'noopener',textContent:'Tekshirish'})
    );certBox.append(row);
  });
  if(!(me.certificates||[]).length)certBox.append(el('p',{className:'sub',textContent:'Hozircha sertifikatlaringiz yo‘q.'}));
  const accountOpen=el('button',{className:'pri account-open',innerHTML:iconLabel('lock','Login va parolni almashtirish'),onclick:openAccountChange});
  const prefs=readPrefs();const colorSelect=el('select',{value:prefs.color||'violet'},...Object.entries({violet:'Binafsha',blue:'Ko‘k',green:'Yashil',rose:'Pushti',orange:'To‘q sariq',cyan:'Moviy'}).map(([v,t])=>el('option',{value:v,textContent:t})));
  const fontSelect=el('select',{value:prefs.font||'Inter, system-ui, sans-serif'},...[["Inter, system-ui, sans-serif",'Inter / Standart'],['Arial, sans-serif','Arial'],['Georgia, serif','Georgia'],['Verdana, sans-serif','Verdana'],['monospace','Monospace']].map(([v,t])=>el('option',{value:v,textContent:t})));
  const sizeSelect=el('select',{value:String(prefs.fontSize||16)},...[14,15,16,17,18,19,20].map(v=>el('option',{value:String(v),textContent:v+' px'})));
  const themeSelect=el('select',{value:prefs.theme||'light'},el('option',{value:'light',textContent:'Kunduzgi rejim'}),el('option',{value:'dark',textContent:'Tungi rejim'}));
  const savePrefsBtn=el('button',{className:'pri',textContent:'Sozlamalarni saqlash',onclick:()=>{savePrefs({color:colorSelect.value,font:fontSelect.value,fontSize:Number(sizeSelect.value),theme:themeSelect.value});alert('Ko‘rinish sozlamalari saqlandi.');}});
  const prefSection=el('section',{className:'profile-card'},el('h3',{innerHTML:iconLabel('palette','Shaxsiy dizayn sozlamalari')}),el('p',{className:'sub',textContent:'Rang, shrift va o‘lcham faqat sizning profilingizda saqlanadi.'}),el('label',{textContent:'Asosiy rang'}),colorSelect,el('label',{textContent:'Shrift turi'}),fontSelect,el('label',{textContent:'Shrift o‘lchami'}),sizeSelect,el('label',{textContent:'Rejim'}),themeSelect,savePrefsBtn);
  $('#app').replaceChildren(head,xpCard,
    el('section',{className:'profile-card'},el('h3',{textContent:'Obuna holati'}),el('p',{textContent:me.pro?'Pro obunangiz '+proUntil+' gacha faol.':'Sizda hozircha Pro obuna yo‘q.'}),el('button',{className:'pri',textContent:'Obunani boshqarish',onclick:()=>showPlans()})),
    el('section',{className:'profile-card'},el('h3',{textContent:'Profil imkoniyatlari'}),el('label',{textContent:'Profil niki / sertifikatdagi ism'}),name,el('p',{className:'sub',textContent:'Ism-familiyangizni istalgan vaqtda almashtirishingiz mumkin. Faqat harflar va bo‘sh joylardan foydalaning. Haqoratli yoki odobsiz so‘zlar taqiqlanadi.'}),el('label',{textContent:'Profil belgisi'+(me.pro?'':' (Pro obuna uchun)')}),badge,save,status),
    el('section',{className:'profile-card'},el('h3',{textContent:'Akaunt xavfsizligi'}),accountOpen),prefSection,
    el('section',{className:'profile-card'},el('h3',{textContent:'Oxirgi ko‘rilgan 5 ta kurs'}),recentBox),
    el('section',{className:'profile-card'},el('h3',{textContent:'Mening sertifikatlarim'}),certBox));
}
async function showLeaderboard(){
  try{
    const rows=await api('/api/leaderboard');
    const sorted=[...rows].sort((a,b)=>(Number(a.rank)||999999)-(Number(b.rank)||999999));
    const total=sorted.length, maxXP=Math.max(1,...sorted.map(r=>Number(r.xp)||0));
    const myName=(me?.profileName||me?.username||'').trim().toLocaleLowerCase();
    const myRow=sorted.find(r=>String(r.name||'').trim().toLocaleLowerCase()===myName);
    const shell=el('section',{className:'rank-shell'});
    const hero=el('div',{className:'rank-hero'},
      el('div',{className:'rank-kicker'},el('span',{className:'rank-kicker-dot'}),'DASTURLASH KURSI  /  LEADERBOARD'),
      el('div',{className:'rank-hero-copy'},
        el('div',{},
          el('h1',{textContent:'O‘z reytingingni zabt et.'}),
          el('p',{textContent:'Bilimingni oshir, darslarni yakunla va XP to‘pla. Har bir qadam seni yuqoriroq pog‘onaga olib chiqadi.'})),
        el('div',{className:'rank-hero-mark',innerHTML:iconSvg('trophy')})
      ),
      el('div',{className:'rank-summary'},
        el('div',{className:'rank-summary-item',innerHTML:`${iconSvg('users')}<span><b>${total}</b><small>Ishtirokchi</small></span>`}),
        el('div',{className:'rank-summary-item',innerHTML:`${iconSvg('zap')}<span><b>${myRow?Number(myRow.xp)||0:0}</b><small>Mening XP ballim</small></span>`}),
        el('div',{className:'rank-summary-item',innerHTML:`${iconSvg('medal')}<span><b>${myRow?'#'+myRow.rank:'—'}</b><small>Mening o‘rnim</small></span>`})
      )
    );
    shell.append(hero);
    if(sorted.length){
      const top=sorted.slice(0,3);
      const podium=el('section',{className:'rank-podium-section'},
        el('div',{className:'rank-section-heading'},el('div',{},el('span',{className:'rank-eyebrow',textContent:'ENG FAOL O‘QUVCHILAR'}),el('h2',{textContent:'Kuchli uchlik'})),el('span',{className:'rank-live-tag'},el('span',{className:'rank-live-dot'}),'JONLI REYTING')),
        el('div',{className:'rank-podium'})
      );
      const podiumOrder=[top[1],top[0],top[2]].filter(Boolean);
      podiumOrder.forEach(r=>{
        const pos=Number(r.rank)||sorted.indexOf(r)+1;
        const card=el('article',{className:'rank-podium-card rank-place-'+pos});
        const avatar=el('div',{className:'rank-podium-avatar',textContent:String(r.name||'?').trim().slice(0,1).toUpperCase()});
        const medal=el('div',{className:'rank-podium-medal',textContent:pos===1?'♛':pos===2?'Ⅱ':'Ⅲ'});
        card.append(medal,avatar,el('b',{className:'rank-podium-name',textContent:r.name||'O‘quvchi'}),el('span',{className:'rank-podium-xp'},`${Number(r.xp)||0} XP`),el('div',{className:'rank-podium-base'},`#${pos}`));
        podium.append(card);
      });
      shell.append(podium);
      const listPanel=el('section',{className:'rank-list-panel'},
        el('div',{className:'rank-section-heading'},el('div',{},el('span',{className:'rank-eyebrow',textContent:'BARCHA ISHTIROKCHILAR'}),el('h2',{textContent:'Umumiy jadval'})),el('span',{className:'rank-list-count',textContent:`${total} ta o‘quvchi`})),
        el('div',{className:'rank-list'})
      );
      sorted.forEach(r=>{
        const rank=Number(r.rank)||sorted.indexOf(r)+1, xp=Number(r.xp)||0;
        const mine=String(r.name||'').trim().toLocaleLowerCase()===myName;
        const row=el('div',{className:'rank-row'+(mine?' is-me':'')});
        row.append(
          el('span',{className:'rank-number'+(rank<=3?' top-rank':'')},String(rank).padStart(2,'0')),
          el('div',{className:'rank-user-avatar',textContent:String(r.name||'?').trim().slice(0,1).toUpperCase()}),
          el('div',{className:'rank-user-info'},el('b',{textContent:r.name||'O‘quvchi'}),mine?el('small',{textContent:'Bu siz'}):el('small',{textContent:rank===1?'Eng yuqori natija':'Faol o‘quvchi'})),
          el('div',{className:'rank-xp-wrap'},el('div',{className:'rank-xp-track'},el('span',{style:{width:Math.max(3,Math.round(xp/maxXP*100))+'%'}})),el('b',{textContent:`${xp.toLocaleString('uz-UZ')} XP`}))
        );
        listPanel.querySelector('.rank-list').append(row);
      });
      shell.append(listPanel);
    }else{
      shell.append(el('div',{className:'rank-empty'},el('div',{className:'rank-empty-icon',innerHTML:iconSvg('trophy')}),el('h2',{textContent:'Reyting hali bo‘sh'}),el('p',{textContent:'Birinchi bo‘lib darslarni o‘rganing va XP to‘plang. Siz reytingda birinchi bo‘lishingiz mumkin!'})));
    }
    $('#app').replaceChildren(shell);
  }catch(e){alert(e.message);}
}
async function showCommunity(){
  if(window.__communityTimer) clearInterval(window.__communityTimer);
  const shell=el('section',{className:'community-shell'});
  const hero=el('div',{className:'community-hero'},
    el('div',{className:'community-kicker',textContent:'DASTURLASH KURSI · COMMUNITY'}),
    el('h1',{textContent:'Birga o‘rganamiz. Birga rivojlanamiz.'}),
    el('p',{textContent:'Savollaringizni bering, yechimlarni ulashing va boshqa dasturchilar bilan tajriba almashing.'}));
  const layout=el('div',{className:'community-layout'});
  const composer=el('section',{className:'community-composer'});
  const avatar=el('div',{className:'community-avatar community-avatar-me',textContent:(me.profileName||me.username||'U').trim().slice(0,1).toUpperCase()});
  const input=el('textarea',{className:'community-input',placeholder:'Nima haqida fikr almashmoqchisiz? Savolingizni batafsil yozing...',maxLength:1200,rows:4});
  const count=el('span',{className:'community-count',textContent:'0 / 1200'});
  const status=el('span',{className:'community-status',textContent:'Hamjamiyatga xush kelibsiz'});
  const send=el('button',{className:'community-send',innerHTML:'<span>➤</span> Xabarni joylash',onclick:async()=>{
    const value=input.value.trim(); if(!value){status.textContent='Avval xabar matnini kiriting.';input.focus();return;}
    send.disabled=true;send.textContent='Yuborilmoqda…';
    try{await api('/api/community','POST',{text:value});input.value='';count.textContent='0 / 1200';status.textContent='Xabaringiz muvaffaqiyatli joylandi.';await refresh();}
    catch(e){status.textContent=e.message;}
    finally{send.disabled=false;send.innerHTML='<span>➤</span> Xabarni joylash';}
  }});
  input.addEventListener('input',()=>count.textContent=input.value.length+' / 1200');
  composer.append(el('div',{className:'community-composer-top'},avatar,el('div',{},el('b',{textContent:me.profileName||me.username}),el('small',{textContent:'Hamjamiyatga yangi post yozish'}))),input,el('div',{className:'community-compose-foot'},status,el('div',{className:'community-compose-actions'},count,send)));
  const feedPanel=el('section',{className:'community-feed-panel'});
  const feedHead=el('div',{className:'community-feed-head'},el('div',{},el('h2',{textContent:'Muhokamalar'}),el('p',{textContent:'O‘quvchilar tomonidan ulashilgan so‘nggi xabarlar'})));
  const search=el('input',{className:'community-search',placeholder:'Xabarlardan qidirish…',type:'search'});
  const feed=el('div',{className:'community-feed'});
  let allRows=[];
  const render=()=>{
    const q=search.value.trim().toLocaleLowerCase();const rows=allRows.filter(p=>(p.text||'').toLocaleLowerCase().includes(q)||(p.name||p.username||'').toLocaleLowerCase().includes(q));
    feed.replaceChildren();
    if(!rows.length){feed.append(el('div',{className:'community-empty'},el('div',{className:'community-empty-icon',textContent:'✦'}),el('h3',{textContent:q?'Mos xabar topilmadi':'Hali muhokama boshlanmagan'}),el('p',{textContent:q?'Boshqa so‘z bilan qidirib ko‘ring.':'Birinchi bo‘lib savol yoki fikringizni ulashing.'})));return;}
    rows.forEach(p=>{
      const name=p.name||p.username||'Foydalanuvchi';const initial=name.trim().slice(0,1).toUpperCase();
      const own=p.userId===me.id||me.owner||me.role==='admin';
      const date=new Date(p.created);const when=isNaN(date)?'':date.toLocaleDateString('uz-UZ',{day:'2-digit',month:'short',year:'numeric'})+' · '+date.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
      const post=el('article',{className:'community-post-v2'},
        el('div',{className:'community-post-avatar',textContent:initial}),
        el('div',{className:'community-post-content'},
          el('div',{className:'community-post-meta'},el('div',{},el('b',{textContent:name}),el('small',{textContent:'O‘quvchi'})),el('time',{textContent:when})),
          el('p',{className:'community-post-text',textContent:p.text||''}),
          el('div',{className:'community-post-actions'},el('span',{className:'community-post-tag',textContent:'💬 Muhokama'}),own?el('button',{className:'community-delete',textContent:'O‘chirish',onclick:async()=>{if(!(await askConfirm('Ushbu xabar o‘chirilsinmi?')))return;try{await api('/api/community/'+p.id,'DELETE');await refresh();}catch(e){status.textContent=e.message;}}}):el('span'))
        ));feed.append(post);
    });
  };
  const refresh=async()=>{try{allRows=await api('/api/community');render();}catch(e){status.textContent=e.message;}};
  search.addEventListener('input',render);
  feedHead.append(search);feedPanel.append(feedHead,feed);
  const side=el('aside',{className:'community-sidebar'},
    el('div',{className:'community-side-card'},el('span',{className:'community-side-icon',textContent:'✦'}),el('h3',{textContent:'Yaxshi hamjamiyat qoidalari'}),el('ul',{},el('li',{textContent:'Savolni aniq va tushunarli yozing'}),el('li',{textContent:'Boshqalarga hurmat bilan munosabatda bo‘ling'}),el('li',{textContent:'Yechim va foydali manbalarni ulashing'}))),
    el('div',{className:'community-side-card community-side-accent'},el('small',{textContent:'SIZNING MAQSADINGIZ'}),el('h3',{textContent:'Har kuni oz bo‘lsa ham kod yozing.'}),el('p',{textContent:'Bilim ulashilgan sari kuchayadi.'})));
  layout.append(el('div',{className:'community-main-column'},composer,feedPanel),side);
  shell.append(hero,layout);$('#app').replaceChildren(shell);await refresh();
  window.__communityTimer=setInterval(()=>{if(document.body.contains(shell))refresh();else clearInterval(window.__communityTimer);},15000);
}
async function showRoadmap(){
  try{const rows=await api('/api/roadmap');const box=el('section',{className:'profile-card'});box.append(el('h2',{textContent:'O‘quv yo‘l xaritasi'}),el('p',{className:'sub',textContent:'Kurslarni ketma-ket o‘rganing. Ko‘rilgan darslar bajarilgan deb belgilanadi.'}));
  rows.forEach(c=>{const done=c.lessons.filter(x=>x.done).length;const card=el('article',{className:'community-post'},el('h3',{textContent:c.order+'. '+c.title}),el('p',{className:'sub',textContent:c.genre+' · '+done+'/'+c.lessons.length+' dars bajarilgan'}));c.lessons.forEach((l,i)=>card.append(el('div',{className:'roadmap-lesson',textContent:(l.done?'✓ ':'○ ')+(i+1)+'. '+l.title})));card.append(el('button',{className:'pri',textContent:'Kursni ochish',onclick:()=>showDetail(c.id)}));box.append(card);});if(!rows.length)box.append(el('p',{className:'sub',textContent:'Hozircha yo‘l xaritasiga kurslar qo‘shilmagan.'}));$('#app').replaceChildren(box);}catch(e){alert(e.message);}
}

function ensureAIWidget(){
  const old=document.getElementById('ai-float-root');
  if(!me){old?.remove();return;}
  if(old)return;
  const root=el('div',{id:'ai-float-root',className:'ai-float-root'});
  const launcher=el('button',{className:'ai-float-launcher',type:'button',title:'AI yordamchi', 'aria-label':'AI yordamchini ochish',innerHTML:'<span class="ai-float-spark">✦</span><span class="ai-float-orbit">AI</span>'});
  const panel=el('section',{className:'ai-chat-panel',role:'dialog','aria-label':'AI yordamchi'});
  const header=el('div',{className:'ai-chat-head'},el('div',{className:'ai-chat-brand'},el('span',{className:'ai-chat-avatar',textContent:'✦'}),el('div',{},el('b',{textContent:'AI yordamchi'}),el('small',{textContent:'Gemini AI · Dasturlash ustozingiz'}))),el('div',{className:'ai-chat-head-actions'},el('button',{className:'ai-chat-icon-btn',type:'button',title:'Yangi suhbat',textContent:'↻',onclick:()=>{messages.replaceChildren();lastInteraction=null;historyLoaded=true;newConversation=true;addMessage('assistant','Yangi suhbat boshlandi. Savolingizni yozing.');}}),el('button',{className:'ai-chat-icon-btn',type:'button',title:'Yopish',textContent:'×',onclick:()=>panel.classList.remove('open')})));
  const messages=el('div',{className:'ai-chat-messages'});
  const attachPreview=el('div',{className:'ai-chat-attachment-preview'});
  const textarea=el('textarea',{className:'ai-chat-input',rows:2,maxLength:12000,placeholder:'Savolingizni yozing… Masalan: bu kod nima haqida?'});
  const fileInput=el('input',{type:'file',accept:'image/*,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.txt,.md,.java,.cpp,.c,.sql',style:'display:none'});
  const send=el('button',{className:'ai-chat-send',type:'button',textContent:'➤',title:'Yuborish'});
  const upload=el('button',{className:'ai-chat-tool',type:'button',title:'Rasm yoki kod fayli biriktirish',textContent:'＋',onclick:()=>fileInput.click()});
  const screen=el('button',{className:'ai-chat-tool',type:'button',title:'Ekrandan skrinshot olish',textContent:'▣'});
  const footer=el('div',{className:'ai-chat-footer'},el('div',{className:'ai-chat-tools'},upload,screen,fileInput),send);
  const composer=el('div',{className:'ai-chat-composer'},attachPreview,textarea,footer);
  panel.append(header,messages,composer);root.append(panel,launcher);document.body.append(root);
  let chosenFile=null,screenImage=null,lastInteraction=null,historyLoaded=false,sending=false,newConversation=false;
  const posKey='dasturlash-ai-position-'+(me?.id||me?.username||'user');
  try{const p=JSON.parse(localStorage.getItem(posKey)||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){launcher.style.left=Math.max(8,Math.min(innerWidth-68,p.x))+'px';launcher.style.top=Math.max(8,Math.min(innerHeight-68,p.y))+'px';launcher.style.right='auto';launcher.style.bottom='auto';}}catch{}
  const renderAIMessage=(target,value)=>{
    target.replaceChildren();
    const parts=String(value||'').split(/```([^\n`]*)\n([\s\S]*?)```/g);
    for(let i=0;i<parts.length;i++){
      if(i%3===1){const language=parts[i].trim();const pre=el('pre',{className:'ai-chat-code'});if(language)pre.append(el('small',{textContent:language}));pre.append(el('code',{textContent:parts[i+1]||''}));target.append(pre);i++;}
      else if(parts[i])target.append(document.createTextNode(parts[i]));
    }
  };
  const addMessage=(role,text,attachment='')=>{
    const item=el('article',{className:'ai-chat-message '+(role==='user'?'user':'assistant')});
    if(attachment)item.append(el('small',{className:'ai-chat-file-tag',textContent:'📎 '+attachment}));
    const body=el('div',{className:'ai-chat-message-text'});if(role==='assistant')renderAIMessage(body,text);else body.textContent=text;item.append(body);messages.append(item);messages.scrollTop=messages.scrollHeight;return body;
  };
  const loadHistory=async()=>{
    if(historyLoaded)return;historyLoaded=true;
    try{const rows=await api('/api/ai/history');const chats=rows.filter(x=>x.type==='chat').reverse().slice(-20);for(const row of chats){addMessage('user',row.message||'',row.attachmentName||'');addMessage('assistant',row.answer||'');if(row.interactionId)lastInteraction=row.interactionId;}}
    catch{}
    if(!messages.children.length)addMessage('assistant','Salom! Men sizning AI dasturlash yordamchingizman. Kod, xato, rasm yoki ekrandagi savolni yuboring — birga tahlil qilamiz.');
  };
  const setAttachment=(file)=>{chosenFile=file;screenImage=null;attachPreview.replaceChildren();if(!file)fileInput.value='';if(file)attachPreview.append(el('span',{textContent:'📎 '+file.name}),el('button',{type:'button',textContent:'×',title:'Olib tashlash',onclick:()=>{chosenFile=null;attachPreview.replaceChildren();fileInput.value='';}}));};
  fileInput.addEventListener('change',()=>setAttachment(fileInput.files?.[0]||null));
  screen.addEventListener('click',async()=>{
    if(!navigator.mediaDevices?.getDisplayMedia){addMessage('assistant','Bu brauzer ekran tasvirini olishni qo‘llab-quvvatlamaydi. Skrinshotni ＋ tugmasi orqali biriktiring.');return;}
    try{const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});const video=document.createElement('video');video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,250));const canvas=document.createElement('canvas');const sw=video.videoWidth||1280,sh=video.videoHeight||720,scale=Math.min(1,1600/sw,1000/sh);canvas.width=Math.round(sw*scale);canvas.height=Math.round(sh*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);stream.getTracks().forEach(t=>t.stop());screenImage=canvas.toDataURL('image/jpeg',0.82).split(',')[1];chosenFile=null;attachPreview.replaceChildren(el('span',{textContent:'▣ Ekran skrinshoti biriktirildi'}),el('button',{type:'button',textContent:'×',onclick:()=>{screenImage=null;attachPreview.replaceChildren();}}));}
    catch(e){addMessage('assistant',e.name==='NotAllowedError'?'Ekran ulashishga ruxsat berilmadi. Ruxsat bersangiz, skrinshot olinadi.':'Ekran tasvirini olishda xatolik: '+e.message);}
  });
  const sendMessage=async()=>{
    if(sending)return;
    let message=textarea.value.trim();if(!message&&!chosenFile&&!screenImage)return;
    let attachment=null,attachmentName='';
    try{
      if(chosenFile){attachmentName=chosenFile.name;const type=chosenFile.type||'';if(type.startsWith('image/')){if(chosenFile.size>5*1024*1024)throw new Error('Rasm hajmi 5 MB dan oshmasin.');const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(chosenFile);});attachment={type:'image',mimeType:type,data:String(dataUrl).split(',')[1]};}
        else{if(chosenFile.size>180*1024)throw new Error('Kod yoki matn fayli 180 KB dan oshmasin.');const text=await chosenFile.text();message=(message?message+'\n\n':'')+'Biriktirilgan fayl: '+attachmentName+'\n```\n'+text.slice(0,12000)+'\n```';}}
      if(screenImage){attachment={type:'image',mimeType:'image/jpeg',data:screenImage};attachmentName='Ekran skrinshoti';}
    }catch(e){addMessage('assistant',e.message);return;}
    if(!message)message=attachment?'Biriktirilgan rasm yoki ekranni tahlil qil. Undagi matn, kod, xatolar va muhim elementlarni tushuntir.':'Salom';
    addMessage('user',message,attachmentName);textarea.value='';setAttachment(null);screenImage=null;attachPreview.replaceChildren();
    sending=true;send.disabled=true;const pending=addMessage('assistant','Javob tayyorlanmoqda…');
    try{const payload={message,attachment:attachment?{mimeType:attachment.mimeType,data:attachment.data}:null,previousInteractionId:lastInteraction,newConversation};const result=await api('/api/ai/chat','POST',payload);renderAIMessage(pending,result.answer||'AI javob qaytarmadi.');lastInteraction=result.interactionId||lastInteraction;newConversation=false;}
    catch(e){pending.textContent='Xatolik: '+e.message;}
    finally{sending=false;send.disabled=false;messages.scrollTop=messages.scrollHeight;}
  };
  send.addEventListener('click',sendMessage);textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
  let pointer=null,moved=false;
  launcher.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.clientX,y:e.clientY,left:launcher.getBoundingClientRect().left,top:launcher.getBoundingClientRect().top,id:e.pointerId};moved=false;launcher.setPointerCapture(e.pointerId);});
  launcher.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;if(moved){const x=Math.max(8,Math.min(innerWidth-68,pointer.left+dx)),y=Math.max(8,Math.min(innerHeight-68,pointer.top+dy));launcher.style.left=x+'px';launcher.style.top=y+'px';launcher.style.right='auto';launcher.style.bottom='auto';}});
  launcher.addEventListener('pointerup',e=>{if(!pointer)return;if(moved){const r=launcher.getBoundingClientRect();localStorage.setItem(posKey,JSON.stringify({x:r.left,y:r.top}));}else{panel.classList.toggle('open');if(panel.classList.contains('open')){loadHistory();setTimeout(()=>textarea.focus(),80);}}pointer=null;});
  launcher.addEventListener('pointercancel',()=>{pointer=null;});
  launcher.addEventListener('click',e=>{if(e.detail===0){panel.classList.toggle('open');if(panel.classList.contains('open'))loadHistory();}});
  window.addEventListener('resize',()=>{const r=launcher.getBoundingClientRect();if(r.right>innerWidth)launcher.style.left=Math.max(8,innerWidth-68)+'px';if(r.bottom>innerHeight)launcher.style.top=Math.max(8,innerHeight-68)+'px';});
}

async function renderHomeDailyTask(slot){
  if(!me||!slot)return;
  const load=async()=>{
    slot.replaceChildren(el('div',{className:'home-daily-loading'},el('span',{className:'home-daily-dot'}),el('span',{textContent:'Bugungi topshiriq tayyorlanmoqda…'})));
    try{
      const data=await api('/api/ai/daily-task','POST',{});
      if(data.completed){slot.remove();return;}
      const task=data.task||{};
      const editor=el('textarea',{className:'home-daily-editor',rows:7,maxLength:12000,value:task.starterCode||'',placeholder:'Yechimingizni shu yerga yozing…'});
      const criteria=el('ul',{className:'home-daily-criteria'},...(task.criteria||[]).map(x=>el('li',{textContent:x})));
      const status=el('p',{className:'home-daily-status',textContent:'Topshiriqni bajaring va AI ustozga tekshirtiring. Muvaffaqiyatli topshiriq uchun +20 XP.'});
      const submit=el('button',{className:'pri home-daily-submit',textContent:'Yechimni tekshirish',onclick:async()=>{
        submit.disabled=true;status.textContent='AI yechimingizni tekshirmoqda…';
        try{const result=await api('/api/ai/daily-task/submit','POST',{id:data.id,answer:editor.value});status.textContent=(result.evaluation?.feedback||'Natija tekshirildi.')+' · '+(result.evaluation?.score||0)+'/100';
          if(result.completed){if(result.xpEarned)status.textContent+=' · +'+result.xpEarned+' XP berildi!';me=await api('/api/me');setNav();setTimeout(()=>slot.remove(),1200);}else submit.disabled=false;
        }catch(e){status.textContent=e.message;submit.disabled=false;}
      }});
      slot.replaceChildren(el('div',{className:'home-daily-head'},el('span',{className:'home-daily-bell',textContent:'♢'}),el('div',{},el('small',{textContent:'BUGUNGI TOPSHIRIQ'}),el('h2',{textContent:task.title||'Kunlik dasturlash mashqi'})),el('span',{className:'home-daily-xp',textContent:'+20 XP'})),el('p',{className:'home-daily-description',textContent:task.description||''}),criteria,editor,el('div',{className:'home-daily-bottom'},status,submit));
    }catch(e){slot.replaceChildren(el('div',{className:'home-daily-loading'},el('span',{textContent:'Bugungi topshiriq yuklanmadi: '+e.message}),el('button',{className:'pri',textContent:'Qayta urinish',onclick:load})));}
  };
  await load();
}

function showPlayground(){
  const shell=el('section',{className:'ide-shell'});
  const top=el('div',{className:'ide-heading'},el('div',{},el('div',{className:'ide-kicker',textContent:'DASTURLASH KURSI · ONLINE IDE'}),el('h1',{textContent:'G‘oyangizni kodga aylantiring.'}),el('p',{textContent:'HTML, CSS va JavaScript yozing, ishga tushiring va natijani real vaqtda ko‘ring.'})),el('div',{className:'ide-heading-mark',textContent:'</>'}));
  const toolbar=el('div',{className:'ide-toolbar'});
  const tabs=el('div',{className:'ide-tabs'});const actions=el('div',{className:'ide-actions'});
  const runBtn=el('button',{className:'ide-run',innerHTML:'▶ Ishga tushirish'});
  const resetBtn=el('button',{className:'ide-quiet',textContent:'↺ Namunani tiklash'});
  const clearBtn=el('button',{className:'ide-quiet',textContent:'⌫ Tozalash'});
  actions.append(resetBtn,clearBtn,runBtn);toolbar.append(tabs,actions);
  const starter={
    html:`<!doctype html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mening birinchi sahifam</title>
</head>
<body>
  <main class="card">
    <span class="tag">MENING BIRINCHI LOYIHAM</span>
    <h1>Salom, dunyo! 👋</h1>
    <p>Men HTML, CSS va JavaScript o‘rganyapman.</p>
    <button id="hello">Meni bos</button>
  </main>
</body>
</html>`,
    css:`* { box-sizing: border-box; }
body { margin:0; min-height:100vh; display:grid; place-items:center; font-family:Inter,Arial,sans-serif; background:linear-gradient(135deg,#eef2ff,#dff7f4); color:#17233d; }
.card { background:white; padding:42px; border-radius:24px; box-shadow:0 20px 60px #26365a22; text-align:center; max-width:520px; }
.tag { color:#6258df; font-size:11px; font-weight:800; letter-spacing:2px; }
h1 { font-size:38px; margin:18px 0 8px; }
p { color:#66748a; }
button { border:0; border-radius:12px; padding:13px 22px; background:#6258df; color:white; font-weight:700; cursor:pointer; }`,
    js:`document.querySelector('#hello')?.addEventListener('click', () => {
  console.log('Ajoyib! Tugma ishladi.');
  alert('Barakalla! JavaScript ishlayapti 🎉');
});
console.log('Loyiha muvaffaqiyatli ishga tushdi.');`
  };
  const editors={};let active='html';let cmReady=false;let cmInstances={};
  const workspace=el('div',{className:'ide-workspace'});const editorPanel=el('section',{className:'ide-editor-panel'});const editorTop=el('div',{className:'ide-panel-title'},el('span',{textContent:'✧  KOD MUHARRIRI'}),el('span',{className:'ide-save-state',textContent:'Brauzerda ishlaydi · Serverga yuborilmaydi'}));
  const editorMount=el('div',{className:'ide-editor-mount'});
  ['html','css','js'].forEach((key)=>{const ta=el('textarea',{className:'ide-textarea',spellcheck:false, value:starter[key], 'aria-label':key.toUpperCase()});editors[key]=ta;});
  const switchTab=(key)=>{active=key;tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===key));Object.keys(editors).forEach(k=>{editors[k].style.display=k===key?'block':'none';if(cmInstances[k])cmInstances[k].getWrapperElement().style.display=k===key?'block':'none';});if(cmInstances[key])setTimeout(()=>cmInstances[key].refresh(),30);};
  ['html','css','js'].forEach((key)=>{const b=el('button',{className:'ide-tab',textContent:key==='js'?'JS':key.toUpperCase(),onclick:()=>switchTab(key)});b.dataset.tab=key;tabs.append(b);editorMount.append(editors[key]);});
  editorPanel.append(editorTop,editorMount);
  const previewPanel=el('section',{className:'ide-preview-panel'});const previewHead=el('div',{className:'ide-panel-title'},el('span',{textContent:'◉  NATIJA'}),el('span',{className:'ide-preview-status',textContent:'LIVE PREVIEW'}));
  const frame=el('iframe',{className:'ide-preview',title:'Kod natijasi'});frame.setAttribute('sandbox','allow-scripts allow-modals');
  const consolePanel=el('section',{className:'ide-console-panel'});const consoleHead=el('div',{className:'ide-console-head'},el('div',{},el('b',{textContent:'Terminal / Console'}),el('small',{textContent:'JavaScript xabarlari va xatolar'})),el('button',{className:'ide-clear-console',textContent:'Tozalash'}));const consoleBody=el('div',{className:'ide-console-body'});consolePanel.append(consoleHead,consoleBody);
  previewPanel.append(previewHead,frame,consolePanel);workspace.append(editorPanel,previewPanel);
  const footer=el('div',{className:'ide-footer'},el('span',{textContent:'● Xavfsiz sandbox muhiti'}),el('span',{textContent:'Ctrl + Enter  ·  Ishga tushirish'}));
  shell.append(top,toolbar,workspace,footer);$('#app').replaceChildren(shell);
  function value(key){return cmInstances[key]?cmInstances[key].getValue():editors[key].value;}
  function log(type,args){const line=el('div',{className:'ide-log '+type});line.append(el('span',{className:'ide-log-type',textContent:type.toUpperCase()}),el('span',{textContent:args.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x);}catch{return String(x);}}).join(' ')}));consoleBody.append(line);consoleBody.scrollTop=consoleBody.scrollHeight;}
  function run(){consoleBody.replaceChildren();log('info',['Ishga tushirilmoqda…']);const raw=value('html');let source=raw;
    if(/<\/head>/i.test(source))source=source.replace(/<\/head>/i,'<style>'+value('css')+'</style></head>');else source='<style>'+value('css')+'</style>'+source;
    const bridge=`<script>(function(){const send=(type,args)=>parent.postMessage({__ideConsole:true,type,args},'*');['log','info','warn','error','debug'].forEach(k=>{const old=console[k];console[k]=(...a)=>{send(k,a.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch(e){return String(x)}}));old.apply(console,a)}});window.addEventListener('error',e=>send('error',[e.message+' ('+e.lineno+':'+e.colno+')']));})();<\/script>`;
    const script='<script>'+value('js').replace(/<\/script/gi,'<\\/script')+'<\/script>';
    source=source.replace(/<\/body>/i,bridge+script+'</body>');if(!/<\/body>/i.test(source))source+=bridge+script;
    frame.srcdoc=source;log('success',['Preview yangilandi.']);
  }
  window.removeEventListener('message',window.__ideMessageHandler||(()=>{}));window.__ideMessageHandler=(event)=>{if(event.source!==frame.contentWindow||!event.data||!event.data.__ideConsole)return;log(event.data.type,event.data.args||[]);};window.addEventListener('message',window.__ideMessageHandler);
  runBtn.onclick=run;resetBtn.onclick=()=>{Object.keys(editors).forEach(k=>{if(cmInstances[k])cmInstances[k].setValue(starter[k]);else editors[k].value=starter[k];});run();};clearBtn.onclick=()=>{Object.keys(editors).forEach(k=>{if(cmInstances[k])cmInstances[k].setValue('');else editors[k].value='';});run();};consoleHead.querySelector('button').onclick=()=>consoleBody.replaceChildren();
  shell.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}});
  switchTab('html');run();
  const load=(url,integrity)=>new Promise((resolve,reject)=>{const elx=document.createElement('script');elx.src=url;elx.integrity=integrity;elx.crossOrigin='anonymous';elx.referrerPolicy='no-referrer';elx.onload=resolve;elx.onerror=reject;document.head.append(elx);});
  (async()=>{await load('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js','sha512-OeZ4Yrb/W7d2W4rAMOO0HQ9Ro/aWLtpW9BUSR2UOWnSV2hprXLkkYnnCGc9NeLUxxE4ZG7zN16UuT1Elqq8Opg==');await load('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/xml/xml.min.js','sha512-LarNmzVokUmcA7aUDtqZ6oTS+YXmUKzpGdm8DxC46A6AHu+PQiYCUlwEGWidjVYMo/QXZMFMIadZtrkfApYp/g==');await load('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/css/css.min.js','sha512-rQImvJlBa8MV1Tl1SXR5zD2bWfmgCEIzTieFegGg89AAt7j/NBEe50M5CqYQJnRwtkjKMmuYgHBqtD1Ubbk5ww==');await load('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js','sha512-Cbz+kvn+l5pi5HfXsEB/FYgZVKjGIhOgYNBwj4W2IHP2y8r3AdyDCQRnEUqIQ+6aJjygKPTyaNT2eIihaykJlw==');
    if(!document.body.contains(shell))return;cmReady=true;
    Object.keys(editors).forEach(k=>{const mode=k==='html'?'xml':k==='css'?'css':'javascript';const cm=window.CodeMirror.fromTextArea(editors[k],{mode,lineNumbers:true,theme:'darcula',indentUnit:2,tabSize:2,lineWrapping:false,matchBrackets:true,autoCloseBrackets:true});cm.setSize('100%','100%');cmInstances[k]=cm;});switchTab(active);
  })().catch(()=>{editorTop.querySelector('.ide-save-state').textContent='Oddiy muharrir rejimi · Kutubxona yuklanmadi';});
}

function openAccountChange(){
  const overlay=el('div',{className:'overlay account-overlay'});const panel=el('div',{className:'account-modal'});const close=el('button',{className:'x',textContent:'×',onclick:()=>overlay.remove()});
  const login=el('input',{placeholder:'Yangi login (ixtiyoriy)',maxLength:20,autocomplete:'username'});const pass=el('input',{type:'password',placeholder:'Yangi parol (ixtiyoriy)',autocomplete:'new-password'});const status=el('p',{className:'sub'});
  const start=el('button',{className:'pri',textContent:'Davom etish',onclick:async()=>{try{const d=await api('/api/account/change/start','POST',{username:login.value.trim(),password:pass.value});const code=el('input',{inputMode:'numeric',maxLength:6,placeholder:'Telegram yuborgan 6 xonali kod'});const bot=el('button',{className:'pri',innerHTML:iconLabel('bot','Telegram botga o‘tish'),onclick:()=>window.open(d.botUrl||'https://t.me/verification_zverbot','_blank','noopener')});const verify=el('button',{className:'pri',textContent:'Kodni tasdiqlash va almashtirish',onclick:async()=>{try{const r=await api('/api/account/change/verify','POST',{code:code.value});if(r.token){token=r.token;localStorage.setItem('token',token);}status.textContent=r.message+' Yangi login: '+r.username;const keptPrefs=readPrefs();me=await api('/api/me');localStorage.setItem(prefsKey(),JSON.stringify(keptPrefs));applyPrefs(keptPrefs);setNav();setTimeout(()=>overlay.remove(),1100);}catch(e){status.textContent=e.message;}}});panel.replaceChildren(close,el('h2',{textContent:'Telegram orqali tasdiqlash'}),el('p',{className:'sub',textContent:'Telegram botga o‘ting, yuborilgan 6 xonali kodni oling va quyidagi maydonga kiriting. Kod 10 daqiqa amal qiladi.'}),bot,el('label',{textContent:'Tasdiqlash kodi'}),code,verify,status);code.focus();}catch(e){status.textContent=e.message;}}});
  panel.append(close,el('h2',{textContent:'Login va parolni almashtirish'}),el('p',{className:'sub',textContent:'O‘zgartirmoqchi bo‘lgan ma’lumotlaringizni kiriting.'}),el('label',{textContent:'Yangi login'}),login,el('label',{textContent:'Yangi parol'}),pass,start,status);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.append(overlay);
}

async function takeTest(id){
  try{
    const t=await api('/api/tests/'+id);
    const answers={};
    let currentQuestion=0;
    const total=t.questions.length;
    const app=$('#app');

    const renderQuestion=()=>{
      const q=t.questions[currentQuestion];
      const chosen=answers[q.id];
      const progress=Math.round(((currentQuestion+1)/total)*100);
      const stage=el('section',{className:'profile-card question-stage'});
      const top=el('div',{className:'question-top'},
        el('span',{className:'question-counter',textContent:`SAVOL ${currentQuestion+1} / ${total}`}),
        el('span',{className:'question-percent',textContent:progress+'%'}));
      const bar=el('div',{className:'question-progress'},el('span',{style:`width:${progress}%`}));
      const question=el('h2',{className:'question-text',textContent:q.text});
      const answersBox=el('div',{className:'question-answers'});
      q.options.forEach((option,index)=>{
        const item=el('button',{
          type:'button',
          className:'question-answer'+(chosen===index?' selected':''),
          'aria-pressed':chosen===index?'true':'false',
          onclick:()=>{answers[q.id]=index;renderQuestion();}
        },el('span',{className:'answer-letter',textContent:String.fromCharCode(65+index)}),el('span',{className:'answer-text',textContent:option}),...(chosen===index?[el('span',{className:'answer-check',textContent:'✓'})]:[]));
        answersBox.append(item);
      });
      const note=el('p',{className:'sub question-hint',textContent:chosen===undefined?'Javoblardan bittasini tanlang. Keyin “Keyingi” yoki Enter tugmasini bosing.':'Javob tanlandi. Keyingi savolga o‘tishingiz mumkin.'});
      const prev=el('button',{textContent:'← Oldingi',disabled:currentQuestion===0,onclick:()=>{currentQuestion--;renderQuestion();}});
      const next=el('button',{className:'pri',textContent:currentQuestion===total-1?'Testni yakunlash':'Keyingi →',disabled:chosen===undefined,onclick:()=>goNext()});
      const home=el('button',{className:'home-back-btn',type:'button',innerHTML:iconLabel('home','Asosiy sahifaga qaytish'),onclick:()=>showList()});
      const controls=el('div',{className:'question-controls'},home,prev,next);
      stage.append(top,bar,question,answersBox,note,controls);
      stage.tabIndex=0;
      stage.addEventListener('keydown',e=>{
        if(e.key==='Enter' && !e.repeat){
          e.preventDefault();
          if(answers[q.id]!==undefined)goNext();
        }
      });
      app.replaceChildren(
        el('h2',{textContent:t.title}),
        el('p',{className:'sub',textContent:'Kurs: '+t.courseTitle}),
        stage
      );
      stage.focus();
    };

    const goNext=()=>{
      const q=t.questions[currentQuestion];
      if(answers[q.id]===undefined){alert('Davom etish uchun javoblardan birini tanlang.');return;}
      if(currentQuestion<total-1){currentQuestion++;renderQuestion();}
      else submitTest();
    };

    const submitTest=async()=>{
      try{
        const r=await api('/api/tests/'+id+'/submit','POST',{answers});
        const out=el('section',{className:'profile-card test-result'},el('h2',{textContent:'Test natijasi'}),el('div',{className:'test-score',textContent:`${r.percent}%`}),el('p',{textContent:`Kurs: ${r.courseTitle || t.courseTitle || 'Dasturlash kursi'}`}),el('p',{textContent:`To‘g‘ri javoblar: ${r.correct}/${r.total}. Kerakli natija: ${r.required}%.`}),el('p',{textContent:r.passed?(t.finalTestCourseId?'Tabriklaymiz! Yakuniy imtihondan o‘tdingiz, sertifikat olishingiz mumkin.':'Tabriklaymiz! Testdan muvaffaqiyatli o‘tdingiz.'):'Afsus, bu safar kerakli foizni to‘play olmadingiz.'}));
        if(r.passed && !t.lessonId){
          let current=await api('/api/me');
          const ownerText=el('p',{className:'cert-owner',textContent:current.profileName?('Sertifikat egasi: '+current.profileName):'Sertifikat olish uchun quyida ism-familiyangizni saqlang.'});
          const statusMsg=el('p',{className:'sub'});
          const nameInput=el('input',{value:current.profileName||'',placeholder:'Ism Familiya (masalan: Aliyev Vali)',maxLength:80});
          const passInput=el('input',{type:'password',placeholder:'Tasdiqlash uchun joriy parolingiz'});
          const inlineEditor=el('div',{className:'form',style:'margin-top:12px;display:'+(current.profileName?'none':'grid')});
          const saveInlineBtn=el('button',{className:'pri',type:'button',textContent:'Ismni saqlash',onclick:async()=>{
            const val=nameInput.value.trim();
            if(val.length<2){statusMsg.textContent='Ism-familiya kamida 2 ta harfdan iborat bo‘lsin.';return;}
            try{
              await api('/api/profile','PUT',{profileName:val,badge:current.badge||'none',currentPassword:passInput.value});
              current=await api('/api/me');me=current;
              ownerText.textContent='Sertifikat egasi: '+current.profileName;
              statusMsg.textContent='Ism-familiya saqlandi.';
              inlineEditor.style.display='none';
              passInput.value='';
              getCert.disabled=false;
              editName.disabled=false;
              editName.textContent='✏️ Ismni tahrirlash';
            }catch(e){statusMsg.textContent=e.message;}
          }});
          inlineEditor.append(el('label',{textContent:'Sertifikatdagi ism-familiya'}),nameInput,el('label',{textContent:'Joriy parol'}),passInput,saveInlineBtn);
          const certActions=el('div',{className:'test-result-actions'});
          const editName=el('button',{type:'button',textContent:current.profileName?'✏️ Ismni tahrirlash':'✏️ Ism kiritish',onclick:()=>{
            inlineEditor.style.display=inlineEditor.style.display==='none'?'grid':'none';
            if(inlineEditor.style.display==='grid')nameInput.focus();
          }});
          const getCert=el('button',{className:'pri',type:'button',innerHTML:iconLabel('medal','Sertifikatni ochish / yuklab olish'),disabled:!current.profileName,onclick:async()=>{
            try{
              const cert=await api('/api/certificates','POST',t.finalTestCourseId?{courseId:t.finalTestCourseId}:{testId:id});
              me=await api('/api/me');
              printCertificate(cert);
            }catch(e){statusMsg.textContent=e.message;}
          }});
          certActions.append(editName,getCert);
          out.append(ownerText,inlineEditor,statusMsg,certActions);
        }else if(r.passed && t.lessonId){
          const statusMsg=el('p',{className:'sub',textContent:r.courseCompleted?'Barcha mavzu testlari tugadi! Endi AI tuzadigan yakuniy imtihondan o‘ting.':'Mavzu testi muvaffaqiyatli yakunlandi. Boshqa qismlarni ham mustaqil davom ettirishingiz mumkin.'});
          const actions=el('div',{className:'test-result-actions'});
          if(r.courseCompleted){
            const finalBtn=el('button',{className:'pri',textContent:'✦ AI yakuniy imtihonini boshlash',onclick:async()=>{
              finalBtn.disabled=true;statusMsg.textContent='AI yakuniy imtihonni tayyorlamoqda…';
              try{const final=await api('/api/courses/'+encodeURIComponent(r.courseId)+'/final-test');takeTest(final.id);}
              catch(e){statusMsg.textContent=e.message;finalBtn.disabled=false;}
            }});
            actions.append(finalBtn);
          }else{
            actions.append(el('button',{className:'pri',textContent:'Dars qismlarini ko‘rish',onclick:()=>showDetail(t.courseId)}));
          }
          actions.append(el('button',{textContent:'Profilim',onclick:showProfile}));
          out.append(statusMsg,actions);
        }else{
          out.append(el('div',{className:'test-result-actions'},el('button',{className:'pri',textContent:'↻ Testga qaytish',onclick:()=>takeTest(id)}),el('button',{textContent:'⌂ Bosh menyuga qaytish',onclick:()=>showList()})));
        }
        app.replaceChildren(out);
      }catch(e){alert(e.message);}
    };
    renderQuestion();
  }catch(e){alert(e.message);}
}

function buildTransparentSignatureDataUrl(src,inkColor='#e2edff'){
  return new Promise((resolve)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      try{
        const c=document.createElement('canvas');
        c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;
        const ctx=c.getContext('2d');
        ctx.drawImage(img,0,0);
        const im=ctx.getImageData(0,0,c.width,c.height);
        const d=im.data;
        const hex=inkColor.replace('#','');
        const tr=parseInt(hex.slice(0,2),16)||226;
        const tg=parseInt(hex.slice(2,4),16)||237;
        const tb=parseInt(hex.slice(4,6),16)||255;
        let minX=c.width,minY=c.height,maxX=0,maxY=0,hasInk=false;
        for(let y=0;y<c.height;y++){
          for(let x=0;x<c.width;x++){
            const i=(y*c.width+x)*4;
            const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
            const lum=(r*0.299+g*0.587+b*0.114);
            if(a>15 && lum<232){
              const alpha=Math.min(255,Math.round(((235-lum)/185)*255));
              d[i]=tr;d[i+1]=tg;d[i+2]=tb;d[i+3]=alpha;
              if(alpha>24){
                hasInk=true;
                if(x<minX)minX=x;if(x>maxX)maxX=x;
                if(y<minY)minY=y;if(y>maxY)maxY=y;
              }
            }else{
              d[i+3]=0;
            }
          }
        }
        ctx.putImageData(im,0,0);
        if(!hasInk){resolve(src);return;}
        const pad=8;
        const sx=Math.max(0,minX-pad),sy=Math.max(0,minY-pad);
        const sw=Math.min(c.width-sx,maxX-minX+1+pad*2);
        const sh=Math.min(c.height-sy,maxY-minY+1+pad*2);
        const out=document.createElement('canvas');
        out.width=sw;out.height=sh;
        out.getContext('2d').drawImage(c,sx,sy,sw,sh,0,0,sw,sh);
        resolve(out.toDataURL('image/png'));
      }catch{resolve(src);}
    };
    img.onerror=()=>resolve(src);
    img.src=src;
  });
}

function buildCertificateHtml(c,sigSrc='/certificate-signature.png'){
  const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fullName=String(c.fullName||'Foydalanuvchi').trim();
  const courseTitle=String(c.courseTitle||'Dasturlash kursi').trim();
  const issuer=String(c.issuer||'Sobirov Muhammadumar').trim();
  const nameSize=fullName.length>42?'18pt':fullName.length>30?'22pt':fullName.length>22?'25pt':'27pt';
  const descSize=courseTitle.length>45?'11.5pt':'13pt';
  const date=c.created?new Date(c.created).toLocaleDateString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Tashkent'}):'—';
  const verifyUrl=String(c.verifyUrl||((location.origin||'')+'/verify/'+c.id));
  const qrUrl='https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data='+encodeURIComponent(verifyUrl);
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sertifikat · ${safe(c.id)}</title><style>
  @page{size:A4 landscape;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;width:297mm;height:210mm}
  body{font-family:Arial,Helvetica,sans-serif;background:#080b12;color:#f5f7fb;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cert{position:relative;width:297mm;height:210mm;overflow:hidden;padding:7mm;background:radial-gradient(ellipse at 50% 45%,#111a2b 0%,#090d16 52%,#05070b 100%)}
  .cert:before{content:"";position:absolute;inset:0;background:linear-gradient(132deg,transparent 0 12%,rgba(30,111,219,.22) 12.1%,rgba(8,26,54,.55) 16%,transparent 16.2% 74%,rgba(24,95,184,.18) 74.2%,transparent 82%),linear-gradient(312deg,transparent 0 9%,rgba(120,143,173,.12) 9.2%,transparent 21%),repeating-linear-gradient(135deg,rgba(255,255,255,.018) 0 1px,transparent 1px 14px);pointer-events:none}
  .frame{position:relative;height:100%;border:1.15mm solid #b9c6d9;padding:9mm 14mm 8mm;text-align:center;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.018),transparent 40%,rgba(26,86,156,.045))}
  .frame:before{content:"";position:absolute;inset:2mm;border:.25mm solid rgba(104,159,226,.5);pointer-events:none;z-index:2}
  .corner{position:absolute;width:62mm;height:62mm;pointer-events:none;opacity:.92;z-index:1}
  .corner.tl{left:-24mm;top:-24mm;background:linear-gradient(135deg,#134385 0%,#09182e 54%,rgba(37,137,255,.35) 55%,transparent 56%)}
  .corner.br{right:-24mm;bottom:-24mm;background:linear-gradient(315deg,#174c88 0%,#0b1a30 54%,rgba(37,137,255,.35) 55%,transparent 56%)}
  .brand{position:relative;z-index:3;margin:0 auto 2mm;font-size:11pt;font-weight:800;letter-spacing:3.6px;color:#f4f7fc}
  .brand:before{content:"</>";display:block;font-size:23pt;font-weight:900;letter-spacing:-2px;color:#e8effa;margin-bottom:1mm;text-shadow:0 0 12px rgba(50,145,255,.35)}
  .created{position:relative;z-index:3;font-size:9pt;letter-spacing:4px;color:#c6d3e5;margin-bottom:2mm}
  .title{position:relative;z-index:3;margin:1mm 0 1mm;font:700 38pt Georgia,'Times New Roman',serif;letter-spacing:6px;color:#edf2fa;text-shadow:0 2px 0 #74849a,0 0 18px rgba(115,157,210,.18)}
  .ribbon{position:relative;z-index:3;display:inline-block;margin:0 auto 4mm;padding:2mm 17mm;background:linear-gradient(90deg,#8799b2,#edf2fa 48%,#8799b2);color:#111722;font:700 13pt Georgia,serif;clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%)}
  .recipient{position:relative;z-index:3;margin:1mm auto 3mm;font:700 ${nameSize} Georgia,'Times New Roman',serif;color:#fff;display:block;max-width:92%;overflow-wrap:anywhere;text-shadow:0 2px 10px rgba(255,255,255,.1)}
  .recipient:after{content:"";display:block;width:58%;height:.45mm;margin:3mm auto 0;background:linear-gradient(90deg,transparent,#9bb5d8,#f1f5fb,#9bb5d8,transparent)}
  .description{position:relative;z-index:3;margin:4mm auto 0;font:${descSize}/1.45 Georgia,'Times New Roman',serif;color:#e1e7f0;max-width:210mm}
  .course{position:relative;z-index:3;margin:2.5mm auto 0;font:700 11pt Arial,sans-serif;letter-spacing:1.4px;color:#7ebaff}
  .bottom{position:absolute;left:13mm;right:38mm;bottom:9mm;z-index:3;display:grid;grid-template-columns:1fr .95fr 1.25fr .8fr;gap:5mm;align-items:end;text-align:center}
  .leader{text-align:left;align-self:end;padding-bottom:2mm}
  .leader-label{font-size:9pt;font-weight:800;letter-spacing:1.4px;color:#dbe5f3;border-bottom:.35mm solid #6c9ed7;padding-bottom:2mm;margin-bottom:2mm}
  .leader-name{font-size:10pt;font-weight:700;letter-spacing:.7px;color:#fff}
  .seal{width:44mm;height:44mm;justify-self:center;align-self:center;transform:rotate(-6deg);filter:drop-shadow(0 0 5px rgba(90,160,255,.35))}
  .sign{align-self:end;padding-bottom:1.5mm}
  .signature-paper{position:relative;z-index:3;height:34mm;background:transparent;display:flex;align-items:flex-end;justify-content:center;padding:0;margin-bottom:-9.5mm;overflow:visible}
  .signature{display:block;height:100%;width:auto;max-width:100%;object-fit:contain;transform:scale(1.16);transform-origin:center bottom;filter:drop-shadow(0 0 6px rgba(130,185,255,.25))}
  .sign-label{position:relative;z-index:2;font-size:8pt;letter-spacing:1.5px;color:#dce8f7;margin-top:0;border-top:.35mm solid #6c9ed7;padding-top:1.2mm}
  .datebox{text-align:right;align-self:end;padding-bottom:2mm;color:#eef3fa}
  .date-label{font-size:9pt;font-weight:800;letter-spacing:1px;color:#a9c9ef;margin-bottom:2mm}
  .date-value{font-size:11pt;font-weight:700;border-bottom:.35mm solid #6c9ed7;padding-bottom:2mm;white-space:nowrap}
  .meta-foot{position:absolute;left:14mm;right:14mm;bottom:3mm;z-index:3;text-align:center;font-size:6.5pt;letter-spacing:1.4px;color:#91a0b6}.qr-code{position:absolute;right:15mm;bottom:13mm;width:18mm;height:18mm;background:#fff;padding:1mm;border-radius:1mm;z-index:4;box-shadow:0 1mm 3mm rgba(0,0,0,.25)}
  @media print{html,body{width:297mm;height:210mm}.cert{margin:0}}
  </style></head><body><div class="cert"><div class="frame"><div class="corner tl"></div><div class="corner br"></div><div class="brand">DASTURLASH KURSI</div><div class="created">CREATED BY SOBIROV</div><div class="title">SERTIFIKAT</div><div class="ribbon">Ushbu sertifikat</div><div class="recipient">${safe(fullName)}</div><div class="description">“${safe(courseTitle)}” o‘quv kursini muvaffaqiyatli yakunlagani<br>va dasturlash bo‘yicha bilim hamda ko‘nikmalarni egallagani uchun</div><div class="course">TEST NATIJASI: ${safe(c.percent)}%</div>
  <div class="bottom"><div class="leader"><div class="leader-label">SAYT RAHBARI</div><div class="leader-name">${safe(issuer.toUpperCase())}</div></div>
  <svg class="seal" viewBox="0 0 240 240" role="img" aria-label="Dasturlash Kursi Created by Sobirov rasmiy muhri">
    <defs>
      <path id="sealTop" d="M 36 120 A 84 84 0 0 1 204 120"/>
      <path id="sealBottom" d="M 24 120 A 96 96 0 0 0 216 120"/>
      <filter id="sealInk" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="rough"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" seed="3" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.2 0 0 0 -0.7" result="mask"/>
        <feComposite in="rough" in2="mask" operator="in"/>
      </filter>
    </defs>
    <g filter="url(#sealInk)" fill="none" stroke="#9cc7ff" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="120" cy="120" r="113" stroke-width="3.6"/>
      <circle cx="120" cy="120" r="107.5" stroke-width="1"/>
      <circle cx="120" cy="120" r="79" stroke-width="1.8"/>
      <circle cx="120" cy="120" r="74.5" stroke-width="1" stroke-dasharray="1.6 2.6"/>
      <text fill="#9cc7ff" stroke="none" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="800" letter-spacing="2.4">
        <textPath href="#sealTop" startOffset="50%" text-anchor="middle">DASTURLASH KURSI</textPath>
      </text>
      <text fill="#9cc7ff" stroke="none" font-family="Arial,Helvetica,sans-serif" font-size="12.8" font-weight="800" letter-spacing="1.7">
        <textPath href="#sealBottom" startOffset="50%" text-anchor="middle">CREATED BY SOBIROV</textPath>
      </text>
      <path d="M26 113l2.1 4.5 4.9.7-3.6 3.4.9 4.9-4.3-2.4-4.3 2.4.9-4.9-3.6-3.4 4.9-.7z" fill="#9cc7ff" stroke="none"/>
      <path d="M214 113l2.1 4.5 4.9.7-3.6 3.4.9 4.9-4.3-2.4-4.3 2.4.9-4.9-3.6-3.4 4.9-.7z" fill="#9cc7ff" stroke="none"/>
      <path d="M120 66l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.5-4.6 2.5.9-5.1-3.8-3.6 5.2-.8z" fill="#9cc7ff" stroke="none"/>
      <path d="M96 99L77 115l19 16" stroke-width="6.5"/>
      <path d="M129 92l-18 45" stroke-width="6.5"/>
      <path d="M144 99l19 16-19 16" stroke-width="6.5"/>
      <path d="M72 146h96" stroke-width="1.2"/>
      <text x="120" y="161" text-anchor="middle" fill="#9cc7ff" stroke="none" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="800" letter-spacing="2.2">RASMIY MUHR</text>
      <path d="M120 168l3 3.6-3 3.6-3-3.6z" fill="#9cc7ff" stroke="none"/>
    </g>
  </svg>
  <div class="sign"><div class="signature-paper"><img class="signature" src="${sigSrc}" alt="Sayt rahbarining haqiqiy imzosi"></div><div class="sign-label">IMZO</div></div>
  <div class="datebox"><div class="date-label">SANA</div><div class="date-value">${safe(date)}</div></div></div>
  <img class="qr-code" src="${qrUrl}" alt="Sertifikatni tekshirish QR kodi"><div class="meta-foot">SERTIFIKAT RAQAMI: ${safe(c.id)} &nbsp;·&nbsp; TEKSHIRISH: ${safe(verifyUrl)}</div></div></div></body></html>`;
}

async function printCertificate(c){
  const existing=document.getElementById('certPreviewOverlay');
  if(existing)existing.remove();
  const sigDataUrl=await buildTransparentSignatureDataUrl('/certificate-signature.png','#e2edff');
  const html=buildCertificateHtml(c,sigDataUrl);

  const overlay=el('div',{id:'certPreviewOverlay',style:'position:fixed;inset:0;z-index:9999;background:rgba(4,8,18,.88);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px'});
  const bar=el('div',{style:'display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center'});
  const frameWrap=el('div',{style:'width:min(100%,1060px);aspect-ratio:297/210;border-radius:10px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.6);background:#080b12'});
  const iframe=document.createElement('iframe');
  iframe.title='Sertifikat ko‘rinishi';
  iframe.style.cssText='width:1122.5px;height:793.7px;border:0;transform-origin:0 0;display:block';
  iframe.srcdoc=html;
  frameWrap.append(iframe);

  const fit=()=>{
    const w=frameWrap.clientWidth||800;
    const scale=w/1122.5;
    iframe.style.transform=`scale(${scale})`;
  };

  const printBtn=el('button',{className:'pri',type:'button',textContent:'🖨 Chop etish / PDF',onclick:()=>{
    try{
      if(iframe.contentWindow){iframe.contentWindow.focus();iframe.contentWindow.print();return;}
    }catch{}
    const w=window.open('','_blank');
    if(w){w.document.write(html.replace('</body>','<script>window.onload=()=>setTimeout(()=>window.print(),300)<\\/script></body>'));w.document.close();}
  }});

  const pngBtn=el('button',{type:'button',textContent:'⬇ Rasm (PNG) yuklab olish',onclick:async()=>{
    pngBtn.disabled=true;const prevTxt=pngBtn.textContent;pngBtn.textContent='Tayyorlanmoqda...';
    try{
      const W=2245,H=1587;
      const cssMatch=html.match(/<style>[\s\S]*?<\/style>/i);
      const bodyMatch=html.match(/<body>([\s\S]*)<\/body>/i);
      const svgMarkup=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:1122.5px;height:793.7px;transform:scale(2);transform-origin:0 0">${cssMatch?cssMatch[0]:''}${bodyMatch?bodyMatch[1]:''}</div></foreignObject></svg>`;
      const blob=new Blob([svgMarkup],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const im=new Image();
      im.onload=()=>{
        const cv=document.createElement('canvas');cv.width=W;cv.height=H;
        cv.getContext('2d').drawImage(im,0,0);
        URL.revokeObjectURL(url);
        const a=document.createElement('a');
        a.download=`sertifikat-${String(c.id||'dk').toLowerCase()}.png`;
        a.href=cv.toDataURL('image/png');a.click();
      };
      im.onerror=()=>{URL.revokeObjectURL(url);printBtn.click();};
      im.src=url;
    }finally{pngBtn.disabled=false;pngBtn.textContent=prevTxt;}
  }});

  const closeBtn=el('button',{type:'button',textContent:'✕ Yopish',onclick:()=>{window.removeEventListener('resize',fit);overlay.remove();}});
  bar.append(printBtn,pngBtn,closeBtn);
  overlay.append(bar,frameWrap);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeBtn.click();});
  document.body.append(overlay);
  window.addEventListener('resize',fit);
  requestAnimationFrame(fit);
}

async function showNotifs() {
  const box = el('div', { style: 'max-width:640px' });
  const head = [el('h2', { textContent: 'Bildirishnomalar', style: 'margin-bottom:12px' })];
  if (me.role === 'admin') {
    const ta = el('textarea', { rows: 2, maxLength: 300, placeholder: 'Hamma foydalanuvchilarga xabar yozing...', style: 'width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#2e2a58);background:var(--bg,#0f0d22);margin-top:8px' });
    const er = el('div', { className: 'err' });
    head.push(el('div', { className: 'form', style: 'margin-bottom:18px' }, el('h3', { textContent: 'Hammaga xabar yuborish' }), ta, er,
      el('button', { className: 'pri', textContent: 'Yuborish', onclick: async () => {
        try { await api('/api/notifications', 'POST', { text: ta.value }); showNotifs(); } catch (e) { er.textContent = e.message; }
      } })));
  }
  $('#app').replaceChildren(...head, box);
  try {
    const d = await api('/api/notifications');
    box.append(...(d.items.length ? d.items.map(n => {
      const row = el('div', { className: 'cm' + (n.unread ? ' new' : '') },
        el('div', { textContent: n.text }),
        el('small', { textContent: new Date(n.created).toLocaleString() + (n.by ? ' | ' + n.by : '') }));
      if (me.role === 'admin' && (me.owner || n.by === me.username)) row.append(el('div', {}, el('button', { className: 'del', textContent: "O'chirish", onclick: async () => {
        try { await api('/api/notifications/' + n.id, 'DELETE'); showNotifs(); } catch (e) { alert(e.message); } } })));
      return row;
    }) : [el('div', { className: 'empty', textContent: "Hozircha bildirishnoma yo'q." })]));
    await api('/api/notifications/seen', 'POST'); setNav();
  } catch (e) { box.append(el('div', { className: 'err', textContent: e.message })); }
}

async function showPlans(msg = '') {
  try { me = await api('/api/me'); setNav(); } catch { return logout(); }
  let ts = []; try { ts = await api('/api/plans'); } catch {}
  const err = el('div', { className: 'err', textContent: msg });
  if (msg) err.style.color = 'inherit';
  const plan = (name, price, items, on, extra) => el('div', { className: 'plan' + (on ? ' on' : '') },
    el('h3', { textContent: name }), el('div', { className: 'price', textContent: price }),
    el('ul', {}, items.map(t => el('li', { textContent: t }))),
    extra || '', on ? el('small', { textContent: 'Hozirgi rejangiz' }) : '');
  const cards = [plan('Oddiy', 'Bepul', ["Ochiq darslarni ko'rish", 'Sevimlilar, izohlar, yoqdi/yoqmadi'], !me.pro)];
  if (me.pro) cards.push(plan('Pro', new Date(me.proUntil).toLocaleDateString() + ' gacha faol', ['Barcha darslar, jumladan Pro darslar'], true));
  ts.forEach(p => cards.push(plan(p.name, p.price, [p.days + ' kun Pro obuna', ...(p.desc ? [p.desc] : [])], false, botLink('Bot orqali obuna olish'))));
  if (!ts.length && !me.pro) cards.push(plan('Pro', "Tariflar hozircha mavjud emas", ['Admin tarif qo‘shganidan keyin shu yerda ko‘rinadi'], false, botLink('Telegram botni ochish')));
  $('#app').replaceChildren(el('h2', { textContent: 'Obuna', style: 'margin-bottom:16px' }),
    el('div', { className: 'plans' }, cards),
    el('p', { className: 'sub', style: 'margin:18px 0' }, 'Tarifni tanlang va bot orqali to‘lov chekini yuboring. Agar Telegramingizga bir nechta sayt akkaunti ulangan bo‘lsa, bot avval qaysi akkaunt uchun Pro olishingizni tanlatadi. Tanlangan akkaunt nomi va IDsi to‘lovdan oldin ko‘rsatiladi. Admin tasdiqlagach, Pro aynan shu akkauntga faollashadi.'));
}

async function showAdminPanel(tab = 'stats') {
  if (!me || (me.role !== 'admin' && me.owner !== true)) {
    alert("Sizda admin panelga kirish huquqi yo'q.");
    return;
  }
  const allTabs = [['stats', 'Statistika'], ['users', 'Foydalanuvchilar'], ['comments', 'Izohlar'], ['genres', "Yo'nalishlar"], ['plans', 'Tariflar'], ['promos', 'Promo kodlar'], ['tests', 'Testlar'], ['new', 'Yangi admin']];
  const isOwner = me.owner === true;
  const isMain = isOwner || me.adminLevel === 'main';
  const tabs = isOwner ? allTabs : isMain ? allTabs.filter(([k]) => k !== 'new') : allTabs.filter(([k]) => k === 'stats');
  if (!tabs.some(([k]) => k === tab)) tab = 'stats';
  const body = el('div', { style: 'max-width:760px' });
  const stat = (l, n) => el('div', { className: 'stat' }, el('b', { textContent: String(n) }), el('span', { textContent: l }));
  const run = (fn) => async () => { try { await fn(); } catch (e) { alert(e.message); } };
  $('#app').replaceChildren(el('h2', { textContent: 'Admin panel', style: 'margin-bottom:16px' }),
    el('div', { className: 'tabs', style: 'max-width:760px' }, tabs.map(([k, t]) => el('button', { className: 'tab' + (k === tab ? ' on' : ''), textContent: t, onclick: () => showAdminPanel(k) }))), body);
  try {
    if (tab === 'stats') {
      const s = await api('/api/admin/stats');
      body.append(el('div', { className: 'stats' }, stat('Foydalanuvchilar', s.users), stat('Pro obunachilar', s.pro), stat('Kurslar', s.anime), stat('Izohlar', s.comments), stat("Jami ko'rishlar", s.views)),
        el('h3', { textContent: 'Kurslar va darslar tahlili', style: 'margin:26px 0 6px' }),
        ...s.courses.map(c => el('div', { className: 'cm' }, el('b', { textContent: c.title + ': ' + c.views + " ko'rish" }),
          ...c.lessons.map(l => el('div', { className: 'lesson', textContent: (l.pro ? '[Pro] ' : '') + l.title + ': ' + l.views + " ko'rish, " + l.likes + ' yoqdi, ' + l.dislikes + ' yoqmadi' })))));
      if (me.owner) {
        const backupStatus=el('p',{className:'sub'});
        const backupBtn=el('button',{className:'pri',textContent:'MongoDB zaxira nusxasini yaratish',onclick:run(async()=>{
          backupBtn.disabled=true;backupStatus.textContent='Zaxira nusxa olinmoqda…';
          try{const b=await api('/api/admin/backup','POST',{});backupStatus.textContent=`Zaxira nusxa tayyor: ${b.backupId} · ${b.documents} hujjat.`;}
          catch(e){backupStatus.textContent=e.message;}
          finally{backupBtn.disabled=false;}
        })});
        body.append(backupBtn,backupStatus);
      }
    } else if (tab === 'users') {
      const us = await api('/api/admin/users');
      body.append(...us.map(u => {
        const pro = u.proUntil && u.proUntil > Date.now();
        const controls = [];
        if (!u.owner) {
          controls.push(
            el('button', { textContent: 'Pro berish', onclick: run(async () => {
              const d = await askInput('Necha kunga Pro beriladi?', '30'); if (d === null) return;
              await api(`/api/admin/users/${u.id}/pro`, 'POST', { days: d }); showAdminPanel('users'); }) }),
            el('button', { hidden: !pro, textContent: 'Proni olish', onclick: run(async () => {
              await api(`/api/admin/users/${u.id}/pro`, 'POST', { days: 0 }); showAdminPanel('users'); }) })
          );
          if (me.owner) controls.push(
            el('button', { textContent: u.role === 'admin' ? 'Adminlikni olish' : 'Admin qilish', onclick: run(async () => {
              let adminLevel = 'ordinary';
              if (u.role !== 'admin') adminLevel = (await askInput('Admin darajasi: main yoki ordinary', 'ordinary') || 'ordinary').toLowerCase() === 'main' ? 'main' : 'ordinary';
              await api(`/api/admin/users/${u.id}/role`, 'POST', { role: u.role === 'admin' ? 'user' : 'admin', adminLevel }); showAdminPanel('users'); }) }),
            el('button', { className: 'del', textContent: "O'chirish", onclick: run(async () => {
              if (await askConfirm(u.username + " akauntini o'chirasizmi? Izohlari ham o'chadi.")) { await api('/api/admin/users/' + u.id, 'DELETE'); showAdminPanel('users'); } }) })
          );
        }
        return el('div', { className: 'cm urow' },
          el('div', {}, el('b', { textContent: u.username }),
            el('small', { textContent: (u.owner ? ' (bosh admin)' : u.role === 'admin' ? (u.adminLevel === 'main' ? ' (Main Admin)' : ' (Oddiy Admin)') : '') + (pro ? ' | Pro: ' + new Date(u.proUntil).toLocaleDateString() + ' gacha' : '') + ' | ' + (u.created ? new Date(u.created).toLocaleDateString() : '-') }),
            el('small', { textContent: 'Sayt ID: ' + u.id + ' | Telegram: ' + (u.telegramUsername ? '@' + u.telegramUsername : 'username mavjud emas') + ' | Telegram ID: ' + (u.telegramUserId || u.telegramChatId || 'ulanmagan') })),
          el('div', { className: 'btns2' }, ...controls));
      }));
    } else if (tab === 'comments') {
      const cs = await api('/api/admin/comments');
      if (!cs.length) body.append(el('div', { className: 'empty', textContent: "Hali izoh yo'q." }));
      body.append(...cs.map(c => el('div', { className: 'cm urow' },
        el('div', {}, el('small', { textContent: c.username + ' | ' + c.anime + ' | ' + new Date(c.created).toLocaleDateString() }), el('div', { textContent: c.text })),
        el('button', { className: 'del', textContent: "O'chirish", onclick: run(async () => { await api('/api/comments/' + c.id, 'DELETE'); showAdminPanel('comments'); }) }))));
    } else if (tab === 'genres') {
      const gs = await api('/api/genres');
      const inp = el('input', { placeholder: "Yangi yo'nalish (masalan, Python)" });
      body.append(el('div', { className: 'tools' }, inp,
          el('button', { className: 'pri', textContent: "Qo'shish", onclick: run(async () => { await api('/api/genres', 'POST', { name: inp.value }); showAdminPanel('genres'); }) })),
        ...gs.map(g => el('div', { className: 'cm urow' }, el('b', { textContent: g.name }),
          el('button', { className: 'del', textContent: "O'chirish", onclick: run(async () => { await api('/api/genres/' + g.id, 'DELETE'); showAdminPanel('genres'); }) }))));
    } else if (tab === 'plans') {
      const ps = await api('/api/plans');
      const nm = el('input', { placeholder: 'Tarif nomi (masalan, 1 oylik)' });
      const pc = el('input', { placeholder: "Narxi (masalan, 49 000 so'm)" });
      const dy = el('input', { type: 'number', placeholder: 'Necha kun Pro beradi' });
      const ds = el('input', { placeholder: 'Qisqa izoh (ixtiyoriy)' });
      body.append(el('div', { className: 'form' }, el('h3', { textContent: "Yangi tarif qo'shish" }), nm, pc, dy, ds,
          el('button', { className: 'pri', textContent: "Qo'shish", onclick: run(async () => { await api('/api/admin/plans', 'POST', { name: nm.value, price: pc.value, days: dy.value, desc: ds.value }); showAdminPanel('plans'); }) })),
        ...ps.map(p => el('div', { className: 'cm urow' }, el('div', {}, el('b', { textContent: p.name }), el('small', { textContent: ' | ' + p.price + ' | ' + p.days + ' kun' + (p.desc ? ' | ' + p.desc : '') })),
          el('button', { className: 'del', textContent: "O'chirish", onclick: run(async () => { await api('/api/admin/plans/' + p.id, 'DELETE'); showAdminPanel('plans'); }) }))));
    } else if (tab === 'promos') {
      const ps = await api('/api/admin/promos');
      const code = el('input', { placeholder: "Kod (bo'sh qoldirsangiz o'zi yaratiladi)" });
      const days = el('input', { type: 'number', placeholder: 'Necha kun Pro beradi', value: 30 });
      const max = el('input', { type: 'number', placeholder: 'Necha kishi ishlata oladi', value: 1 });
      body.append(el('div', { className: 'form' }, el('h3', { textContent: 'Yangi promo kod' }), code, days, max,
          el('button', { className: 'pri', textContent: 'Yaratish', onclick: run(async () => { await api('/api/admin/promos', 'POST', { code: code.value, days: days.value, maxUses: max.value }); showAdminPanel('promos'); }) })),
        ...ps.map(p => el('div', { className: 'cm urow' }, el('div', {}, el('b', { textContent: p.code }), el('small', { textContent: ' | ' + p.days + ' kun | ' + p.used + '/' + p.maxUses })),
          el('button', { className: 'del', textContent: "O'chirish", onclick: run(async () => { await api('/api/admin/promos/' + p.id, 'DELETE'); showAdminPanel('promos'); }) }))));
    } else if (tab === 'tests') {
      const courses = await api('/api/anime');
      let rows = await api('/api/admin/tests');
      let editingId = null, editingActive = true;
      let questionData = [{ text:'', options:['','','',''], correct:0 }];
      const title = el('input',{placeholder:'Masalan: HTML asoslari — yakuniy test',maxLength:100});
      const course = el('select',{}); courses.forEach(c=>course.append(el('option',{value:c.id,textContent:c.title})));
      const pct = el('input',{type:'number',value:70,min:50,max:100});
      const questionList = el('div',{className:'question-builder-list'});
      const count = el('div',{className:'builder-count',textContent:'1 ta savol'});
      const editor = el('section',{className:'test-builder'});
      const saveBtn = el('button',{className:'pri',textContent:'＋ Testni yaratish'});
      const cancelBtn = el('button',{className:'builder-cancel',textContent:'Bekor qilish',hidden:true});
      const renderQuestions = () => {
        questionList.replaceChildren();
        count.textContent=questionData.length+' ta savol · '+questionData.reduce((n,q)=>n+q.options.length,0)+' ta javob varianti';
        questionData.forEach((q,qi)=>{
          const card=el('div',{className:'question-editor'});
          const head=el('div',{className:'question-editor-head'},el('b',{textContent:'Savol '+(qi+1)}),el('button',{type:'button',className:'remove-question',textContent:'Olib tashlash',disabled:questionData.length===1,onclick:()=>{questionData.splice(qi,1);renderQuestions();}}));
          const question=el('textarea',{rows:2,placeholder:'Savol matnini shu yerga yozing…',value:q.text,maxLength:500,oninput:e=>q.text=e.target.value});
          const opts=el('div',{className:'answer-editor'});
          const hint=el('small',{className:'sub',textContent:'To‘g‘ri javobni belgilang'});
          q.options.forEach((value,oi)=>{
            const input=el('input',{value,placeholder:'Variant '+String.fromCharCode(65+oi),maxLength:200,oninput:e=>q.options[oi]=e.target.value});
            const radio=el('button',{type:'button',className:'correct-pick'+(q.correct===oi?' on':''),title:'To‘g‘ri javob',textContent:q.correct===oi?'✓':'○',onclick:()=>{q.correct=oi;renderQuestions();}});
            const line=el('div',{className:'answer-line'},radio,input);
            if(q.options.length>2)line.append(el('button',{type:'button',className:'remove-option',textContent:'×',title:'Variantni o‘chirish',onclick:()=>{q.options.splice(oi,1);if(q.correct>=q.options.length)q.correct=q.options.length-1;else if(oi<q.correct)q.correct--;renderQuestions();}}));
            opts.append(line);
          });
          const addOption=el('button',{type:'button',className:'add-option',textContent:'＋ Variant qo‘shish',disabled:q.options.length>=6,onclick:()=>{q.options.push('');renderQuestions();}});
          card.append(head,question,el('label',{textContent:'Javob variantlari'}),opts,addOption,hint);
          questionList.append(card);
        });
      };
      const resetBuilder=()=>{editingId=null;editingActive=true;course.disabled=false;questionData=[{text:'',options:['','','',''],correct:0}];title.value='';pct.value=70;saveBtn.textContent='＋ Testni yaratish';cancelBtn.hidden=true;renderQuestions();};
      const beginEdit=(t)=>{editingId=t.id;editingActive=t.active!==false;course.disabled=false;title.value=t.title||'';course.value=t.courseId;pct.value=t.passPercent||70;questionData=(t.questions||[]).map(q=>({id:q.id,text:q.text||'',options:[...(q.options||[])],correct:Number(q.correct)||0}));if(!questionData.length)questionData=[{text:'',options:['','','',''],correct:0}];saveBtn.textContent='Saqlash';cancelBtn.hidden=false;renderQuestions();editor.scrollIntoView({behavior:'smooth',block:'start'});};
      const addQuestion=el('button',{type:'button',className:'add-question',textContent:'＋ Yana savol qo‘shish',onclick:()=>{if(questionData.length>=50)return alert('Bitta testga eng ko‘pi bilan 50 ta savol qo‘shish mumkin.');questionData.push({text:'',options:['','','',''],correct:0});renderQuestions();}});
      saveBtn.onclick=async()=>{
        const clean=questionData.map(q=>({...q,text:q.text.trim(),options:q.options.map(x=>x.trim())}));
        if(!title.value.trim())return alert('Test nomini kiriting.');
        if(!course.value)return alert('Avval kursni tanlang.');
        const invalid=clean.findIndex(q=>!q.text||q.options.length<2||q.options.some(x=>!x)||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length);
        if(invalid>=0)return alert('Savol '+(invalid+1)+' ni tekshiring: savol matni, kamida 2 ta to‘ldirilgan variant va to‘g‘ri javob tanlangan bo‘lishi kerak.');
        try{
          const payload={title:title.value.trim(),courseId:course.value,passPercent:Number(pct.value)||70,questions:clean,active:editingActive};
          if(editingId)await api('/api/admin/tests/'+editingId,'PUT',payload);else await api('/api/admin/tests','POST',payload);
          showAdminPanel('tests');
        }catch(e){alert(e.message);}
      };
      cancelBtn.onclick=resetBuilder;
      editor.append(el('div',{className:'builder-top'},el('div',{},el('span',{className:'builder-kicker',textContent:'TEST KONSTRUKTORI'}),el('h3',{textContent:'Yangi test tuzing'}),el('p',{className:'sub',textContent:'Bir testga bir nechta savol qo‘shing, to‘g‘ri javobni belgilang.'})),el('span',{className:'builder-icon',textContent:'✓'})),
        el('div',{className:'builder-fields'},el('label',{},'Test nomi',title),el('label',{},'Qaysi kurs uchun',course),el('label',{},'O‘tish foizi',pct)),
        el('div',{className:'question-list-title'},el('h4',{textContent:'Savollar'}),count),questionList,addQuestion,el('div',{className:'builder-actions'},saveBtn,cancelBtn));
      renderQuestions();
      const list=el('section',{className:'existing-tests'},el('div',{className:'question-list-title'},el('h3',{textContent:'Mavjud testlar'}),el('span',{className:'builder-count',textContent:rows.length+' ta test'})));
      if(!rows.length)list.append(el('div',{className:'empty',textContent:'Hozircha test yo‘q. Yuqoridagi konstruktor orqali birinchi testingizni yarating.'}));
      rows.forEach(t=>{
        const item=el('article',{className:'test-admin-card'});
        const info=el('div',{className:'test-admin-info'},el('div',{className:'test-admin-title'},el('b',{textContent:t.title}),el('span',{className:'test-status '+(t.deleted?'inactive':t.active?'active':'inactive'),textContent:t.deleted?'O‘chirilgan · qayta yaratiladi':t.active?'Faol':'Yashirin'}),...(t.generatedBy? [el('span',{className:'builder-count',textContent:t.generatedBy==='gemini_final'?'AI yakuniy test':'AI yaratgan test'})]:[])),el('small',{textContent:(t.courseTitle||'Kurs tanlanmagan')+' · '+(t.questions||[]).length+' savol · '+t.passPercent+'% o‘tish'}));
        const actions=el('div',{className:'test-admin-actions'},...(t.deleted?[]:[el('button',{textContent:'Tahrirlash',onclick:()=>beginEdit(t)}),el('button',{textContent:t.active?'Yashirish':'Faollashtirish',onclick:async()=>{try{await api('/api/admin/tests/'+t.id,'PUT',{active:!t.active,passPercent:t.passPercent});showAdminPanel('tests');}catch(e){alert(e.message);}}})]),el('button',{className:'del',textContent:t.deleted?'Tarixdan o‘chirish':'O‘chirish',onclick:async()=>{if(await askConfirm('“'+t.title+'” testini o‘chirasizmi? AI testi keyingi ochilishda yangidan yaratiladi.')){try{await api('/api/admin/tests/'+t.id,'DELETE');showAdminPanel('tests');}catch(e){alert(e.message);}}}}));
        item.append(info,actions);list.append(item);
      });
      body.append(editor,list);
    } else {
      const err = el('div', { className: 'err' });
      const form = el('div', { className: 'form' }, el('h3', { textContent: 'Yangi admin akaunt' }),
        field('Login', 'username'), field('Parol (kamida 8 ta belgi)', 'password', 'password'), err,
        el('button', { className: 'pri', textContent: 'Admin yaratish', onclick: async () => {
          try {
            await api('/api/admin/users', 'POST', { username: form.querySelector('[name=username]').value, password: form.querySelector('[name=password]').value });
            err.style.color = 'inherit'; err.textContent = 'Admin akaunt yaratildi.';
            form.querySelectorAll('input').forEach(i => i.value = '');
          } catch (e) { err.style.color = ''; err.textContent = e.message; }
        } }));
      body.append(form);
    }
  } catch (e) { body.append(el('div', { className: 'err', textContent: e.message })); }
}

async function showAdd(a) {
  try { await loadGenres(); } catch {}
  const err = el('div', { className: 'err' });
  const sel = new Set((a?.genre || '').split(',').map(s => s.trim()).filter(Boolean));
  const all = [...new Set([...genreList, ...sel])];
  const picker = el('div', {}, el('label', { textContent: "Yo'nalishlar" }),
    el('div', { className: 'chips' }, all.length ? all.map(n => {
      const b = el('button', { className: 'gc' + (sel.has(n) ? ' on' : ''), textContent: n, onclick: () => { sel.has(n) ? sel.delete(n) : sel.add(n); b.classList.toggle('on', sel.has(n)); } });
      return b;
    }) : [el('small', { textContent: "Yo'nalishlar yo'q. Admin panelning Yo'nalishlar bo'limidan qo'shing." })]));
  const vp = el('input', { type: 'checkbox', checked: !!a?.videoPro });
  const videoField = field("YouTube video havolasi — avtomatik 1-qism (https://youtu.be/...)", 'video');
  const form = el('div', { className: 'form center' },
    el('h2', { textContent: a ? 'Kursni tahrirlash' : "Yangi kurs qo'shish" }),
    field('Nomi', 'title'), picker, field('Yil', 'year', 'number'),
    field('Tavsif', 'description', 'text', true),
    field('Muqova rasmi havolasi (https://...)', 'poster'),
    videoField,
    el('label', { className: 'chk' }, vp, ' 1-qism faqat Pro uchun'), err,
    el('button', { className: 'pri', textContent: a ? 'Saqlash' : "Qo'shish", onclick: async () => {
      const g = (n) => form.querySelector(`[name=${n}]`).value;
      try {
        await api(a ? '/api/anime/' + a.id : '/api/anime', a ? 'PUT' : 'POST', { title: g('title'), genre: [...sel].join(', '), year: g('year'),
          description: g('description'), poster: g('poster'), video: g('video'), videoPro: vp.checked });
        a ? showDetail(a.id) : showList();
      } catch (e) { err.textContent = e.message; }
    } })
  );
  if (a) ['title', 'year', 'description', 'poster', 'video'].forEach(k => form.querySelector(`[name=${k}]`).value = a[k] ?? '');
  $('#app').replaceChildren(form);
}

const EYE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const views = (n) => { const d = el('div', { className: 'vw' }); d.innerHTML = EYE + '<span></span>'; d.lastChild.textContent = String(n || 0); return d; };
const heartSvg = (on) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;
let genreList = [];
async function loadGenres() { genreList = (await api('/api/genres')).map(g => g.name); }
function cardPoster(a, redraw) {
  const p = poster(a);
  const b = el('button', { className: 'heart', title: 'Sevimlilarga qo\'shish' });
  const paint = () => { const on = (me.favs || []).includes(a.id); b.classList.toggle('on', on); b.innerHTML = heartSvg(on); };
  paint();
  b.onkeydown = (e) => e.stopPropagation();
  b.onclick = async (e) => { e.stopPropagation(); me.favs = (await api(`/api/anime/${a.id}/fav`, 'POST')).favs; paint(); if (filt.fav) redraw(); };
  p.append(b);
  return p;
}

const poster = (a) => {
  const p = el('div', { className: 'poster' });
  if (a.poster) p.style.backgroundImage = `url("${a.poster.replace(/"/g, '%22')}")`;
  else p.append(el('span', { className: 'ph', textContent: (a.title || '?').trim().charAt(0).toUpperCase() }));
  if (a.year) p.append(el('span', { className: 'chip', textContent: a.year }));
  if (a.videoPro || (a.episodes || []).some(e => e.pro)) p.append(el('span', { className: 'chip pro', textContent: 'Pro darslar' }));
  return p;
};

async function loadList() { list = await api('/api/anime'); }

async function showList() {
  if (!me) return showWelcome();
  try { await loadList(); await loadGenres(); } catch { return logout(); }
  const genres = [...new Set([...genreList, ...list.flatMap(a => (a.genre || '').split(',').map(s => s.trim()).filter(Boolean))])];
  const box = el('div');
  const draw = () => {
    const q = filt.q.toLowerCase();
    const items = list.filter(a =>
      (!q || a.title.toLowerCase().includes(q)) &&
      (!filt.genre || (a.genre || '').split(',').map(s => s.trim()).includes(filt.genre)) &&
      (!filt.fav || (me.favs || []).includes(a.id)))
      .sort((x, y) => filt.sort === 'views' ? (y.views || 0) - (x.views || 0) : filt.sort === 'title' ? x.title.localeCompare(y.title) : 0);
    if (!items.length) {
      box.replaceChildren(el('div', { className: 'empty', textContent: list.length
        ? (filt.fav ? "Hali sevimli kurs yo'q. Kartochkadagi yurak belgisini bosing." : 'Hech narsa topilmadi.')
        : (me.role === 'admin' ? "Hali kurs yo'q. Yuqoridagi 'Kurs qo'shish' tugmasi bilan birinchisini qo'shing." : "Hali kurs qo'shilmagan.") }));
      return;
    }
    box.replaceChildren(el('div', { className: 'grid' }, items.map(a =>
      el('div', { className: 'item', tabIndex: 0, onclick: () => showDetail(a.id), onkeydown: (e) => { if (e.key === 'Enter') showDetail(a.id); } },
        cardPoster(a, draw), el('h3', { textContent: a.title }), el('small', { textContent: [a.genre, a.year].filter(Boolean).join(', ') }), views(a.views)))));
  };
  const favBtn = el('button', { textContent: 'Sevimlilar', className: filt.fav ? 'pri' : '', onclick: () => {
    filt.fav = !filt.fav; favBtn.classList.toggle('pri', filt.fav); draw(); } });
  const dailySlot=el('section',{className:'home-daily-slot'});
  $('#app').replaceChildren(
    dailySlot,
    el('div', { className: 'tools' },
      el('input', { type: 'search', placeholder: 'Kurs qidirish...', value: filt.q, oninput: (e) => { filt.q = e.target.value; draw(); } }),
      el('select', { onchange: (e) => { filt.genre = e.target.value; draw(); } },
        el('option', { value: '', textContent: "Barcha yo'nalishlar" }),
        genres.map(x => el('option', { value: x, textContent: x, selected: x === filt.genre }))),
      el('select', { onchange: (e) => { filt.sort = e.target.value; draw(); } },
        [['new', 'Yangilari'], ['views', "Ko'p ko'rilgan"], ['title', 'Nomi bo\'yicha']].map(([v, t]) => el('option', { value: v, textContent: t, selected: v === filt.sort }))),
      favBtn),
    box);
  draw();
  renderHomeDailyTask(dailySlot);
}

let youtubeApiPromise=null, bunnyPlayerApiPromise=null;
function setLessonPlaying(value){window.__lessonVideoPlaying=!!value;if(value)window.__lessonLastMediaTick=Date.now();}
function loadPlayerScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;script.async=true;
    script.onload=resolve;script.onerror=reject;document.head.append(script);
  });
}
function playerFor(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (yt) {
    const frame=el('iframe',{className:'player',id:'lesson-youtube-'+Math.random().toString(36).slice(2),src:'https://www.youtube.com/embed/'+yt[1]+'?enablejsapi=1&origin='+encodeURIComponent(location.origin),allow:'autoplay; encrypted-media; picture-in-picture',allowFullscreen:true});
    frame.dataset.youtube='1';
    return frame;
  }
  const video=el('video',{className:'player',src:url,controls:true,preload:'metadata'});
  video.addEventListener('playing',()=>setLessonPlaying(true));
  video.addEventListener('pause',()=>setLessonPlaying(false));
  video.addEventListener('ended',()=>setLessonPlaying(false));
  video.addEventListener('timeupdate',()=>{window.__lessonLastMediaTick=Date.now();window.__lessonCurrentTime=Number(video.currentTime)||0;});
  return video;
}
async function attachLessonPlayer(media){
  if(!media)return;
  window.__lessonVideoPlaying=false;window.__lessonLastMediaTick=0;window.__lessonCurrentTime=0;
  if(media.tagName==='VIDEO')return;
  if(media.dataset.youtube==='1'){
    try{
      if(!window.YT?.Player){
        if(!youtubeApiPromise)youtubeApiPromise=new Promise((resolve,reject)=>{
          const old=window.onYouTubeIframeAPIReady;
          window.onYouTubeIframeAPIReady=()=>{try{old?.();}catch{}resolve();};
          loadPlayerScript('https://www.youtube.com/iframe_api').then(()=>{if(window.YT?.Player)resolve();}).catch(reject);
        });
        await youtubeApiPromise;
      }
      const player=new YT.Player(media.id,{events:{onStateChange:event=>{
        if(event.data===1){
          setLessonPlaying(true);
          let last=player.getCurrentTime?.()||0;
          if(media.__lessonPoll)clearInterval(media.__lessonPoll);
          media.__lessonPoll=setInterval(()=>{
            const current=player.getCurrentTime?.()||0;
            if(current>last+0.15&&current-last<3){window.__lessonLastMediaTick=Date.now();window.__lessonCurrentTime=current;}
            last=current;
          },1000);
        }else{setLessonPlaying(false);if(media.__lessonPoll)clearInterval(media.__lessonPoll);}
      }}});
      media.__lessonYTPlayer=player;
    }catch{setLessonPlaying(false);}
    return;
  }
  if(media.dataset.bunny==='1'){
    try{
      if(!window.playerjs?.Player){
        if(!bunnyPlayerApiPromise)bunnyPlayerApiPromise=loadPlayerScript('https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js');
        await bunnyPlayerApiPromise;
      }
      const player=new playerjs.Player(media);
      player.on('play',()=>setLessonPlaying(true));
      player.on('pause',()=>setLessonPlaying(false));
      player.on('ended',()=>setLessonPlaying(false));
      player.on('timeupdate',(raw)=>{window.__lessonLastMediaTick=Date.now();try{const d=typeof raw==='string'?JSON.parse(raw):raw;window.__lessonCurrentTime=Number(d.seconds??d.currentTime)||window.__lessonCurrentTime||0;}catch{}});
    }catch{setLessonPlaying(false);}
  }
}

async function showDetail(id) {
  try { await loadList(); } catch { return logout(); }
  const a = list.find(x => x.id === id);
  if (!a) return showList();
  api(`/api/anime/${id}/view`, 'POST').catch(() => {});
  const eps = (a.episodes || []).map((e, i) => ({ ...e, i })).sort((x, y) => (x.order ?? 1e9) - (y.order ?? 1e9) || x.i - y.i);
  const isOwner = !!me.owner, isStaff = me.role === 'admin' && (me.owner || me.adminLevel === 'main');
  const pl = el('div'), rx = el('div', { className: 'rx' }), lessonActions = el('div',{className:'lesson-gate'});
  let cur = 'main', reacts = {};
  const drawRx = () => {
    const r = reacts[cur] || { like: 0, dislike: 0, mine: 0 };
    const mk = (v, label, n) => el('button', { className: r.mine === v ? 'pri' : '', textContent: label + ' ' + n, onclick: async () => {
      await api(`/api/anime/${id}/react`, 'POST', { ep: cur, v: r.mine === v ? 0 : v });
      reacts = await api(`/api/anime/${id}/reactions`); drawRx(); } });
    rx.replaceChildren(mk(1, 'Yoqdi', r.like), mk(-1, 'Yoqmadi', r.dislike));
  };
  const lockBox = (episode) => el('div', { className: 'lock' }, el('b', { textContent: episode?.sequenceLocked ? 'Keyingi darsni ochish uchun avvalgi dars testidan o‘ting' : 'Bu dars faqat Pro obunachilar uchun' }),
    el('button', { className: 'pri', textContent: "Obuna bo'lish", onclick: () => showPlans() }), botLink('Bot orqali obuna olish'));
  const play = async (e, btn) => {
    cur = e ? e.id : 'main';
    const previousFrame=pl.querySelector('iframe');if(previousFrame?.__lessonPoll)clearInterval(previousFrame.__lessonPoll);
    window.__lessonVideoPlaying=false;window.__lessonLastMediaTick=0;window.__lessonCurrentTime=0;
    if(window.__lessonWatchTimer){clearInterval(window.__lessonWatchTimer);window.__lessonWatchTimer=null;}
    document.querySelectorAll('.eps .ep').forEach(b => b.classList.toggle('on', b === btn));
    const locked = e ? e.locked : a.locked;
    const video = e ? e.video : a.video;
    lessonActions.replaceChildren();
    if (locked) pl.replaceChildren(lockBox(e));
    else if (video && video.startsWith('bunny:')) {
      pl.replaceChildren(el('p', { className: 'sub', textContent: 'Himoyalangan video ochilmoqda...' }));
      try {
        const signed = await api('/api/videos/' + encodeURIComponent(video.slice(6)) + '/play');
        const frame=el('iframe', { className: 'player', id:'lesson-bunny-'+Math.random().toString(36).slice(2), src: signed.url, title: e ? e.title : a.title,
          allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowFullscreen: true, referrerPolicy: 'origin' });
        frame.dataset.bunny='1';pl.replaceChildren(frame);await attachLessonPlayer(frame);
      } catch (error) { pl.replaceChildren(el('div', { className: 'err', textContent: error.message })); }
    } else {
      const media=video?playerFor(video):el('p',{className:'empty',textContent:"Video hali qo‘shilmagan."});
      pl.replaceChildren(media);if(video)await attachLessonPlayer(media);
    }
    if (!locked && e) {
      api(`/api/anime/${id}/episodes/${e.id}/view`, 'POST').catch(() => {});
      const status=el('p',{className:'sub',textContent:'Bu dars testi istalgan vaqtda ishlash uchun ochiq.'});
      const testBtn=el('button',{className:'pri',type:'button',textContent:'📝 Dars testini ishlash →'});
      const done=el('span',{className:'sub'});
      testBtn.onclick=async()=>{
        testBtn.disabled=true;
        try{const t=await api(`/api/lessons/${id}/${e.id}/test`);takeTest(t.id);}
        catch(err){status.textContent=err.message;}
        finally{testBtn.disabled=false;}
      };
      lessonActions.append(status,testBtn,done);
    }
    drawRx();
  };

  const epBox = el('div', { className: 'eps' }, eps.map(e => {
    const b = el('button', { className: 'ep', textContent: (e.pro ? 'Pro: ' : '') + e.title, onclick: () => play(e, b) });
    const w = el('span', {}, b);
    if (isStaff) w.append(el('button', { textContent: 'Tahr.', title: 'Darsni tahrirlash', onclick: () => startEdit(e) }));
    if (isOwner) w.append(el('button', { className: 'del', textContent: 'x', title: "Darsni o'chirish", onclick: async () => {
      if (await askConfirm("Bu darsni o'chirasizmi?")) { await api(`/api/anime/${id}/episodes/${e.id}`, 'DELETE'); showDetail(id); }
    } }));
    return w;
  }));

  const fav = el('button', { onclick: async () => { me.favs = (await api(`/api/anime/${id}/fav`, 'POST')).favs; paintFav(); } });
  const paintFav = () => {
    const on = (me.favs || []).includes(id);
    fav.textContent = on ? 'Sevimlilardan olib tashlash' : "Sevimlilarga qo'shish";
    fav.classList.toggle('pri', on);
  };
  paintFav();

  const bar = el('div', { className: 'bar' }, el('button', { textContent: 'Orqaga', onclick: showList }));
  if (isOwner) bar.append(el('button', { textContent: 'Tahrirlash', onclick: () => showAdd(a) }),
    el('button', { className: 'del', textContent: "Kursni o'chirish", onclick: async () => {
      if (await askConfirm("Bu kursni o'chirasizmi?")) { await api('/api/anime/' + id, 'DELETE'); showList(); }
    } }));

  let editId = null;
  const t = el('input', { placeholder: 'Dars nomi (masalan, 1-dars)' });
  const v = el('input', { placeholder: 'YouTube havolasi: https://youtu.be/...' });
  // Dars videosi YouTube havolasi orqali qo‘shiladi.
  const o = el('input', { type: 'number', placeholder: 'Tartib raqami (1, 2, 3...)' });
  const duration = el('input', { type: 'number', min:60, placeholder: 'Video davomiyligi (sekund, masalan 900)' });
  const pr = el('input', { type: 'checkbox' });
  const err = el('div', { className: 'err' });
  const head = el('h3', { textContent: "Yangi dars qo'shish" });
  const sb = el('button', { className: 'pri', textContent: "Dars qo'shish", onclick: async () => {
    try {
      await api(editId ? `/api/anime/${id}/episodes/${editId}` : `/api/anime/${id}/episodes`, editId ? 'PUT' : 'POST',
        { title: t.value, video: v.value, order: o.value, durationSeconds: duration.value, pro: pr.checked });
      showDetail(id);
    } catch (e2) { err.textContent = e2.message; }
  } });
  const adm = isStaff ? el('div', { className: 'form sec' }, head, t, v,
    o, duration, el('label', { className: 'chk' }, pr, ' Faqat Pro uchun'), err, sb) : '';
  const startEdit = (e) => {
    editId = e.id; t.value = e.title; v.value = e.locked ? '' : e.video; o.value = e.order ?? ''; duration.value = e.durationSeconds || ''; pr.checked = !!e.pro;
    head.textContent = 'Darsni tahrirlash'; sb.textContent = 'Saqlash'; adm.scrollIntoView({ behavior: 'smooth' });
  };

  const cbox = el('div');
  const loadComments = async () => {
    const cs = await api(`/api/anime/${id}/comments`);
    cbox.replaceChildren(...(cs.length ? cs.map(c => {
      const row = el('div', { className: 'cm' },
        el('small', { textContent: c.username + ', ' + new Date(c.created).toLocaleDateString() }),
        el('div', { textContent: c.text }));
      if (c.username === me.username || isOwner) row.append(el('button', { className: 'del', textContent: "O'chirish", onclick: async () => {
        await api('/api/comments/' + c.id, 'DELETE'); loadComments(); } }));
      return row;
    }) : [el('div', { className: 'empty', textContent: "Hali izoh yo'q. Birinchi bo'lib yozing." })]));
  };
  const ta = el('textarea', { rows: 3, maxLength: 500, placeholder: 'Izoh yozing...', style: 'width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#2e2a58);background:var(--card,#1a1735)' });
  const cerr = el('div', { className: 'err' });
  const comments = el('div', { className: 'sec' }, el('h3', { textContent: 'Izohlar' }), ta, cerr,
    el('button', { className: 'pri', textContent: 'Yuborish', onclick: async () => {
      try { await api(`/api/anime/${id}/comments`, 'POST', { text: ta.value }); ta.value = ''; cerr.textContent = ''; loadComments(); }
      catch (e) { cerr.textContent = e.message; }
    } }), cbox);

  $('#app').replaceChildren(bar, el('div', { className: 'detail' }, poster(a),
    el('div', {}, el('h2', { textContent: a.title }),
      el('p', { textContent: [a.genre, a.year].filter(Boolean).join(', '), style: 'color:var(--mut,#a29fc4)' }),
      views((a.views || 0) + 1),
      el('p', { textContent: a.description }), fav,
      epBox, pl, lessonActions, rx)), adm, comments);

  try { reacts = await api(`/api/anime/${id}/reactions`); } catch {}
  if (eps.length) play(eps[0], epBox.querySelector('.ep'));
  else if (a.video || a.locked) play(null);
  else pl.append(el('p', { className: 'empty', textContent: "Video hali qo'shilmagan." }));
  loadComments();
}

$('#logo').onclick = () => { filt.fav = false; showList(); };
const brandHome = $('#brandHome');
if (brandHome) { brandHome.onclick = () => { filt.fav = false; showList(); }; brandHome.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filt.fav = false; showList(); } }; }
(async () => {
  if (token) { try { me = await api('/api/me'); applyPrefs(readPrefs()); } catch { logout(); return; } }
  setNav(); showList();
})();
