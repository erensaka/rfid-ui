/* ========= Helpers ========= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const toast = (m, t=2200) => { const el = $('#toast'); if(!el) return; el.textContent = m; el.classList.add('show'); setTimeout(()=> el.classList.remove('show'), t); };
const showStep = id => { $$('.step').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); };
const randHex = n => [...crypto.getRandomValues(new Uint8Array(n/2))].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
const fmtDate = d => new Date(d).toLocaleString('tr-TR');
const diffHuman = (from, to=new Date())=>{
  const ms = Math.max(0, new Date(to)-new Date(from));
  const days = Math.floor(ms/86400000);
  const hours = Math.floor((ms%86400000)/3600000);
  return `${days} gün ${hours} saat`;
};

/* ========= Harita (Excel/CSV/TSV → marka/karkas/kaplama) ========= */
function buildBrandMapFromTable(text) {
  if (!text || !text.trim()) return null;
  const lines = text.replace(/\r/g,'').split('\n').filter(x=>x.trim());
  if (!lines.length) return null;
  const delim = (lines[0].includes('\t') ? '\t' : ',');
  const startIdx = /marka/i.test(lines[0]) ? 1 : 0;
  const map = {};
  for (let i=startIdx;i<lines.length;i++){
    const parts = lines[i].split(delim).map(s=>s.trim());
    if (parts.length < 2) continue;
    const [brandRaw, karkasRaw, kaplamaRaw] = parts;
    const brand = canonicalBrand(brandRaw);
    if (!map[brand]) map[brand] = { karkas: new Set(), kaplama: new Set() };
    if (karkasRaw)  map[brand].karkas.add(karkasRaw);
    if (kaplamaRaw) map[brand].kaplama.add(kaplamaRaw);
  }
  const out = {};
  Object.keys(map).forEach(b=>{
    out[b] = { karkas: [...map[b].karkas], kaplama: [...map[b].kaplama] };
  });
  return Object.keys(out).length ? out : null;
}
const BRAND_MAP_DEFAULT = {
  "Fenner Dunlop": { karkas:["EP (Tekstil)","NN (Tekstil)","ST (Çelik kord)","PB"], kaplama:["DIN Y","DIN X","DIN W","ISO G","A","S","FR","OR"] },
  "Beltsiflex":   { karkas:["EP (Tekstil)","EE","PP","EPP","ST"], kaplama:["DIN Y","DIN X","DIN W","Aşınmaya Mukavim","Isıya Mukavim","Aleve Mukavim","Yağa Mukavim"] },
  "Trelleborg":   { karkas:["EP (Tekstil)","EPP","PEP","PP"], kaplama:["DIN Y","DIN X","DIN W","ISO H","ISO D","ISO L","ENDURE HEAT","ENDURE OIL","ENDURE FIRE"] },
  "Ayık Band AS": { karkas:["EP (Tekstil)","EE","PP","EPP","ST (Çelik kord)"], kaplama:["DIN Y","DIN X","DIN W","Aşınmaya Mukavim","Isıya Mukavim","Aleve Mukavim","Yağa Mukavim","C","WF","WF A","WFG","WFKG"] }
};
const PASTED_TABLE = `
Marka	Karkas Tipi	Kaplama Cinsi
DUNLOP	EP	AA
DUNLOP	ULTRA X1	RA
DUNLOP	ULTRA X3	RE
DUNLOP	EE	RS
DUNLOP	EPGB	Betahete
DUNLOP	EPGB2	Deltahete
DUNLOP	FIW	ROM
DUNLOP	FKS	ROS
DUNLOP	FSW	ISO H
DUNLOP	PP	ISO D
DUNLOP	ST	ISO L
DUNLOP	UF	BVK DIN K
DUNLOP	UF1	BVS DIN S
TRELLEBORG	EP	DIN Y
TRELLEBORG	EPP	DIN X
TRELLEBORG	PEP	DIN W
TRELLEBORG	CB	WH
BELTSIFLEX	EP	DIN Y
BELTSIFLEX	EE	DIN X
BELTSIFLEX	PP	DIN W
AYIKBAND AS	EP	DIN Y
AYIKBAND AS	EE	DIN X
AYIKBAND AS	PP	DIN W
DİĞER	EP	Aşınmaya Mukavim
DİĞER	EE	Isıya Mukavim
DİĞER	PP	Aleve Mukavim
`;

function canonicalBrand(raw){
  if(!raw) return '';
  const key = String(raw).trim().toUpperCase().replace(/\s+/g,' ');
  const map = {
    'DUNLOP':'Fenner Dunlop','FENNER DUNLOP':'Fenner Dunlop',
    'BELTSIFLEX':'Beltsiflex','TRELLEBORG':'Trelleborg',
    'AYIK BAND AS':'Ayık Band AS','AYIKBAND AS':'Ayık Band AS'
  };
  return map[key] || String(raw).trim();
}
const BRAND_MAP_FROM_PASTE = buildBrandMapFromTable(PASTED_TABLE);
const ACTIVE_BRAND_MAP = BRAND_MAP_FROM_PASTE || BRAND_MAP_DEFAULT;

/* ========= Modül seçim ========= */
$$('.mod').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const target = btn.dataset.target;
    if(target==='identification') showStep('#step2');
    if(target==='info') showStep('#info1');
  });
});

/* ========= EPC STEP 2 ========= */
$('#btnSimEPC')?.addEventListener('click', ()=>{
  $('#epcInput').value = `3008 ${randHex(4)} ${randHex(4)} ${randHex(4)} ${randHex(4)} ${randHex(4)}`;
  toast('EPC simüle edildi');
});
$('#toStep3')?.addEventListener('click', ()=>{
  const epc = $('#epcInput').value.trim();
  if(!epc){ toast('EPC giriniz veya simüle ediniz.'); return; }
  $('#epcText').value = epc;
  showStep('#step3');
});

/* ========= Marka → Karkas/Kaplama ========= */
function setOptions(sel, arr){
  sel.innerHTML = '';
  if(!arr || !arr.length){
    const o = document.createElement('option'); o.value=''; o.textContent='—'; sel.appendChild(o); return;
  }
  arr.forEach((v,i)=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; if(i===0) o.selected=true; sel.appendChild(o); });
}
function refreshByBrand(){
  const markaSel = $('#marka'), karkasSel = $('#karkas'), kaplamaSel = $('#kaplama');
  if(!markaSel || !karkasSel || !kaplamaSel) return;
  const brand = canonicalBrand(markaSel.value);
  const conf  = ACTIVE_BRAND_MAP[brand];
  setOptions(karkasSel, conf?.karkas || []);
  setOptions(kaplamaSel, conf?.kaplama || []);
}
(function initBrandLists(){
  const markaSel = $('#marka'); const karkasSel = $('#karkas'); const kaplamaSel = $('#kaplama');
  if(!markaSel || !karkasSel || !kaplamaSel) return;
  setOptions(markaSel, Object.keys(ACTIVE_BRAND_MAP));
  refreshByBrand();
  markaSel.addEventListener('change', refreshByBrand);
})();

/* ========= MUKAVEMET & KAT listeleri ========= */
const MUKAVEMET_LIST = [250,315,400,500,630,800,1000,1250,1400,1600,1800,2000,2250];
const KAT_LIST = [2,3,4,5,6,7,8];
(function initMukKat(){
  const mSel = $('#mukavemet');
  const kSel = $('#kat');
  if(mSel){ setOptions(mSel, MUKAVEMET_LIST.map(String)); }
  if(kSel){ setOptions(kSel, KAT_LIST.map(String)); }
})();

/* ========= Personel chipleri (opsiyonel presetler) ========= */
const chipsEl = $('#chips'); const chipInput = $('#chipInput');
function addChip(name){ if(!name || !chipsEl) return; if($$('#chips .badge-chip').some(c=>c.dataset.name?.toLowerCase()===name.toLowerCase())) return;
  const b=document.createElement('span'); b.className='badge-chip'; b.dataset.name=name; b.innerHTML=`${name} <button title="Kaldır">×</button>`;
  b.querySelector('button').addEventListener('click',()=>b.remove()); chipsEl.appendChild(b);
}
chipInput?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addChip(chipInput.value.trim()); chipInput.value=''; }});
$$('[data-suggest]').forEach(btn=> btn.addEventListener('click', ()=> addChip(btn.dataset.suggest)));

/* ========= Notlar (timestamp ile) ========= */
const entryNotes = []; // {ts: Date, text: string}
function renderEntryNotes(){
  const ul = $('#noteList'); if(!ul) return; ul.innerHTML='';
  entryNotes.forEach(n=>{ const li=document.createElement('li'); li.textContent=`${fmtDate(n.ts)} — ${n.text}`; ul.appendChild(li); });
}
$('#addNoteBtn')?.addEventListener('click', ()=>{
  const ta = $('#not'); const v = (ta?.value||'').trim();
  if(!v){ toast('Not boş olamaz.'); return; }
  entryNotes.push({ts:new Date(), text:v});
  ta.value=''; renderEntryNotes();
  toast('Not eklendi');
});

/* ========= CSV parser + çizim ========= */
function parseNumLocale(s){
  s = String(s||'').trim().replace(/^\uFEFF/,'');
  if(s.includes('.') && s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  else s = s.replace(',','.');
  s = s.replace(/[^0-9.\-eE]/g,'');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
function parseHMS_toMinutes(s){
  s = String(s||'').trim().replace(/^\uFEFF/,'');
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!m) return NaN;
  const h=+m[1], min=+m[2], sec=+(m[3]||0);
  return h*60 + min + sec/60;
}
function parseMultiSeriesCSV(text){
  const lines = String(text).replace(/\r/g,'').split('\n').filter(ln=>ln.trim().length>0);
  if(!lines.length) return {series:[]};
  const head = lines[0].split(/[,;|\t]/).map(s=>s.trim());
  const hasHeader = /time|date|saat|zaman/i.test(head[0]);
  const rows = (hasHeader? lines.slice(1): lines).map(ln => ln.split(/[,;|\t]/).map(s=>s.trim())).filter(r=>r.length>=2);
  const absTimes = rows.map(r => parseHMS_toMinutes(r[0]));
  const t0 = absTimes.find(v=>Number.isFinite(v));
  if(!Number.isFinite(t0)) return {series:[]};
  const rel = absTimes.map(v => Number.isFinite(v)? (v-t0): NaN);
  const names = (hasHeader? head.slice(1): []);
  const colCount = rows[0].length;
  const palette = ['#1E73BE', '#6b7280', '#f59e0b', '#16a34a', '#ef4444', '#8b5cf6'];
  const out=[];
  for(let c=1;c<colCount;c++){
    const pts=[];
    for(let i=0;i<rows.length;i++){
      const T=parseNumLocale(rows[i][c]); const t=rel[i];
      if(Number.isFinite(t)&&Number.isFinite(T)) pts.push({t,T});
    }
    if(pts.length>=2){
      out.push({ name:(names[c-1] || (c===1?'Top Platen':'Bottom Platen')).trim(), color:palette[(c-1)%palette.length], points:pts });
    }
  }
  return {series: out};
}
function drawSeries(canvas, series, xUnit='dk'){
  const ctx = canvas.getContext('2d'), W=canvas.width, H=canvas.height;
  const pad={l:56,r:16,t:16,b:40};
  ctx.clearRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,H-pad.b); ctx.lineTo(W-pad.r,H-pad.b); ctx.stroke();
  if(!series.length){ ctx.fillStyle='#6b7280'; ctx.font='13px Inter, system-ui,-apple-system,Segoe UI,Roboto,Arial'; ctx.fillText('CSV yükleyin. Format: "hh:mm[:ss], temp1, temp2"', pad.l+8, H/2); return; }
  const all=series.flatMap(s=>s.points); const tMin=Math.min(...all.map(p=>p.t)); const tMax=Math.max(...all.map(p=>p.t));
  const TMin=Math.floor(Math.min(...all.map(p=>p.T))); const TMax=Math.ceil(Math.max(...all.map(p=>p.T)));
  const x=t=> pad.l + ((W-pad.l-pad.r)*(t-tMin)/((tMax-tMin)||1));
  const y=T=> (H-pad.b) - ((H-pad.t-pad.b)*(T-TMin)/((TMax-TMin)||1));
  const gctx=ctx; gctx.fillStyle='#6b7280'; gctx.font='11px Inter, system-ui,-apple-system,Segoe UI,Roboto,Arial'; gctx.textAlign='center';
  for(let i=0;i<=6;i++){ const tt=tMin+i*(tMax-tMin)/6; const xx=x(tt); gctx.strokeStyle='#eef2f7'; gctx.beginPath(); gctx.moveTo(xx,pad.t); gctx.lineTo(xx,H-pad.b); gctx.stroke(); gctx.fillText(`${Math.round(tt)} ${xUnit}`, xx, H-pad.b+18); }
  gctx.textAlign='right';
  for(let i=0;i<=5;i++){ const TT=TMin+i*(TMax-TMin)/5; const yy=y(TT); gctx.strokeStyle='#eef2f7'; gctx.beginPath(); gctx.moveTo(pad.l,yy); gctx.lineTo(W-pad.r,yy); gctx.stroke(); gctx.fillText(`${Math.round(TT)}°C`, pad.l-8, yy+4); }
  series.forEach((s,si)=>{
    ctx.strokeStyle=s.color; ctx.lineWidth=2; ctx.beginPath();
    s.points.forEach((p,i)=>{ const xx=x(p.t), yy=y(p.T); if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); }); ctx.stroke();
    if(si===0){ const grad=ctx.createLinearGradient(0,pad.t,0,H-pad.b); grad.addColorStop(0,'rgba(30,115,190,.18)'); grad.addColorStop(1,'rgba(30,115,190,0)'); ctx.fillStyle=grad; ctx.beginPath();
      s.points.forEach((p,i)=>{ const xx=x(p.t), yy=y(p.T); if(i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); });
      ctx.lineTo(x(s.points.at(-1).t),H-pad.b); ctx.lineTo(x(s.points[0].t),H-pad.b); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle=s.color; s.points.forEach(p=>{ const xx=x(p.t), yy=y(p.T); ctx.beginPath(); ctx.arc(xx,yy,2.3,0,Math.PI*2); ctx.fill(); });
  });
  ctx.fillStyle='#000'; ctx.font='12px Inter, system-ui,-apple-system,Segoe UI,Roboto,Arial'; ctx.fillText('Vulkanizasyon Eğrisi (Sıcaklık °C / Zaman dk)', 56, 26);
}

/* ========= CSV input (Entry) ========= */
let entrySeries = [];
$('#curveInput')?.addEventListener('change', e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ const {series}=parseMultiSeriesCSV(r.result); entrySeries=series; drawSeries($('#curveChart'), entrySeries); toast(series.length?`CSV önizleme: ${series.length} seri`:'Sıcaklık sütunları bulunamadı'); e.target.value=''; };
  r.readAsText(f);
});

/* ========= Foto (Entry) ========= */
const photoGrid = $('#photoGrid');
$('#photoInput')?.addEventListener('change', e=>{
  const files=[...e.target.files];
  files.forEach(f=>{ const url=URL.createObjectURL(f); const d=document.createElement('div'); d.className='photo';
    d.innerHTML=`<img alt="Fotoğraf" src="${url}"><button class="del" title="Kaldır">×</button>`;
    d.querySelector('.del').addEventListener('click',()=>d.remove()); photoGrid.prepend(d);
  });
  if(files.length) toast(`${files.length} fotoğraf eklendi`); e.target.value='';
});

/* ========= Navigasyon (Entry) ========= */
$('#backTo2')?.addEventListener('click', ()=> showStep('#step2'));
$('#backTo3')?.addEventListener('click', ()=> showStep('#step3'));
$('#restart')?.addEventListener('click', ()=>{
  $$('#step3 .input, #step3 .textarea').forEach(el=> el.value='');
  entryNotes.length=0; renderEntryNotes();
  $('#epcInput') && ($('#epcInput').value='');
  entrySeries=[]; $('#curveChart') && drawSeries($('#curveChart'), entrySeries);
  photoGrid && (photoGrid.innerHTML=''); $('#chips') && ($('#chips').innerHTML='');
  const approve=$('#approveBtn'); if(approve){ approve.classList.remove('success'); approve.disabled=false; approve.textContent='Kaydı Onayla'; }
  showStep('#step1');
});

/* ========= Özet (Entry) ========= */
$('#toStep4')?.addEventListener('click', ()=>{
  const val=id=> document.getElementById(id)?.value?.trim()||'';
  const muk=$('#mukavemet')?.value; const kat=$('#kat')?.value;
  const personel=$$('#chips .badge-chip').map(c=>c.dataset.name).join(', ');
  const fotoSayisi=$$('#photoGrid .photo').length;
  const csvVar= entrySeries.length? `Yüklendi (${entrySeries.length} seri)` : '—';
  const notesText = entryNotes.length ? entryNotes.map(n=>`${fmtDate(n.ts)} — ${n.text}`).join(' | ') : '—';

  const rows=[
    ['Durum',$('#durum')?.value], ['Müşteri',val('musteri')], ['Hat',val('hat')],
    ['Band ID',val('bandId')],
    ['Bant Markası',$('#marka')?.value], ['Karkas Tipi',$('#karkas')?.value], ['Kaplama Sınıfı',$('#kaplama')?.value],
    ['Bant Genişliği (mm)',val('genislik')], ['Mukavemet (N/mm)',muk||'—'], ['Kat Sayısı', kat||'—'],
    ['Üst Kaplama (mm)',val('ust')], ['Alt Kaplama (mm)',val('alt')],
    ['Ek Tipi',$('#ektipi')?.value], ['Ek Boyu (mm)',val('ekboyu')],
    ['Pres Modeli',$('#pres')?.value], ['Montaj Personeli',personel||'—'],
    ['EPC',val('epcText')], ['Giriş Tarihi',val('girisTarihi')],
    ['Gözlem Notları', notesText], ['Vulkanizasyon Eğrisi (CSV)',csvVar], ['Fotoğraf Sayısı', String(fotoSayisi)]
  ];
  const tbody=$('#summaryBody'); if(tbody){ tbody.innerHTML=''; rows.forEach(([k,v])=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${escapeHtml(v??'')}</td>`; tbody.appendChild(tr); }); }
  const summaryPhotos=$('#summaryPhotos'); if(summaryPhotos){ summaryPhotos.innerHTML=''; $$('#photoGrid img').forEach(img=>{ const d=document.createElement('div'); d.className='photo'; d.innerHTML=`<img alt="Fotoğraf" src="${img.src}">`; summaryPhotos.appendChild(d); }); }
  showStep('#step4');
});
$('#approveBtn')?.addEventListener('click', ()=>{
  const btn=$('#approveBtn'); btn.classList.add('success'); btn.textContent='Onaylandı ✓'; btn.disabled=true; toast('Kayıt onaylandı ve kaydedildi (demo).');
});

/* ========= ÜRÜN BİLGİSİ — Mock & işlem ========= */
const MOCK_DB = [
  { match:'3008', bandId:'AB-2024-000872', musteri:'Kolin Termik', hat:'Kömür Besleme #1', marka:'Fenner Dunlop', karkas:'EP (Tekstil)',
    kaplama:'DIN X', genislik:'1000', mukavemet:'800', kat:'4', ust:'4', alt:'3', ektipi:'Parmak (Finger)', ekboyu:'400',
    pres:'ALMEX SVP 1200', personel:'A. Yılmaz, B. Öztürk', durum:'Kullanımda', giris:'2025-03-01T08:30', not:'Ek bölgesinde kontrol yapıldı, sorun yok.' },
  { match:'ABCD', bandId:'AB-2024-000991', musteri:'EÜAŞ', hat:'CV-17', marka:'Beltsiflex', karkas:'ST (Çelik kord)',
    kaplama:'DIN W', genislik:'1200', mukavemet:'1000', kat:'4', ust:'6', alt:'3', ektipi:'Adım (Step)', ekboyu:'500',
    pres:'NILOS', personel:'C. Demir', durum:'Onaylı', giris:'2025-02-10T10:00', not:'Merkezleme normal.' }
];
function findMockByEPC(epc){
  if(!epc) return null;
  const key = epc.replace(/\s+/g,'').slice(0,4).toUpperCase();
  return MOCK_DB.find(r=> key.includes(r.match)) || MOCK_DB[0];
}
function fillInfoSummary(rec, epc){
  const rows = [
    ['Durum', rec.durum], ['Müşteri', rec.musteri], ['Hat', rec.hat],
    ['Bant Markası', rec.marka], ['Karkas Tipi', rec.karkas], ['Kaplama Sınıfı', rec.kaplama],
    ['Bant Genişliği (mm)', rec.genislik], ['Mukavemet (N/mm)', rec.mukavemet], ['Kat Sayısı', rec.kat],
    ['Üst Kaplama (mm)', rec.ust], ['Alt Kaplama (mm)', rec.alt],
    ['Ek Tipi', rec.ektipi], ['Ek Boyu (mm)', rec.ekboyu],
    ['Pres Modeli', rec.pres], ['Montaj Personeli', rec.personel],
    ['Band ID', rec.bandId], ['EPC', epc], ['Giriş Tarihi', rec.giris], ['Gözlem Notu', rec.not]
  ];
  const tbody = $('#infoSummaryBody'); if(!tbody) return; tbody.innerHTML='';
  rows.forEach(([k,v])=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${k}</td><td>${escapeHtml(v??'')}</td>`; tbody.appendChild(tr); });
}

const infoNotes = []; // ürün bilgisi ekranındaki anlık notlar
function renderInfoNotes(){
  const ul = $('#infoNoteList'); if(!ul) return; ul.innerHTML='';
  infoNotes.forEach(n=>{ const li=document.createElement('li'); li.textContent=`${fmtDate(n.ts)} — ${n.text}`; ul.appendChild(li); });
}
$('#addInfoNoteBtn')?.addEventListener('click', ()=>{
  const ta = $('#infoNote'); const v = (ta?.value||'').trim();
  if(!v){ toast('Not boş olamaz.'); return; }
  infoNotes.push({ts:new Date(), text:v});
  ta.value=''; renderInfoNotes(); toast('Not eklendi');
});

$('#btnSimEPCInfo')?.addEventListener('click', ()=>{
  $('#epcInfoInput').value = `3008 ${randHex(4)} ${randHex(4)} ${randHex(4)} ${randHex(4)} ${randHex(4)}`;
  toast('EPC simüle edildi');
});
$('#toInfo2')?.addEventListener('click', ()=>{
  const epc = $('#epcInfoInput').value.trim();
  if(!epc){ toast('EPC giriniz veya simüle ediniz.'); return; }
  const rec = findMockByEPC(epc);
  fillInfoSummary(rec, epc);

  // Kullanım süresi popup
  const sure = diffHuman(rec.giris, new Date());
  toast(`Bant ${sure}dir çalışıyor`);

  showStep('#info2');
});
$('#backToInfo1')?.addEventListener('click', ()=> showStep('#info1'));

/* ========= CSV & Foto (Info) ========= */
let infoSeries = [];
$('#curveInputInfo')?.addEventListener('change', e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ const {series}=parseMultiSeriesCSV(r.result); infoSeries=series; drawSeries($('#curveChartInfo'), infoSeries); toast(series.length?`CSV önizleme: ${series.length} seri`:'Sıcaklık sütunları bulunamadı'); e.target.value=''; };
  r.readAsText(f);
});
const photoGridInfo = $('#photoGridInfo');
$('#photoInputInfo')?.addEventListener('change', e=>{
  const files=[...e.target.files];
  files.forEach(f=>{ const url=URL.createObjectURL(f); const d=document.createElement('div'); d.className='photo';
    d.innerHTML=`<img alt="Fotoğraf" src="${url}"><button class="del" title="Kaldır">×</button>`;
    d.querySelector('.del').addEventListener('click',()=>d.remove()); photoGridInfo.prepend(d);
  });
  if(files.length) toast(`${files.length} fotoğraf eklendi`); e.target.value='';
});

/* ========= Utilities ========= */
function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
