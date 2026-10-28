(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(n,d=2)=>"US$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
/* Supabase backend (public endpoints only; all data is protected by the database) */
const BK=CONFIG.backend||{};const HAS_BK=!!(BK.url&&BK.key);
const bkHeaders=(extra={})=>Object.assign({apikey:BK.key},/^eyJ/.test(BK.key)?{Authorization:"Bearer "+BK.key}:{},extra);
class BkError extends Error{constructor(m,user){super(m);this.user=user}}
const sb={
 async rpc(fn,body){let r;try{r=await fetch(`${BK.url}/rest/v1/rpc/${fn}`,{method:"POST",headers:bkHeaders({"Content-Type":"application/json"}),body:JSON.stringify(body)})}catch(e){throw new BkError("We couldn't reach our server. Check your internet connection and try again.",false)}
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
  if(!r.ok){const m=j&&(j.message||j.error_description||j.error);throw new BkError(m&&r.status<500?m:"Something went wrong on our side. Please try again in a moment.",r.status<500)}return j},
 async upload(path,file){const type=file.type||({pdf:"application/pdf",heic:"image/heic",heif:"image/heif",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[(file.name.split(".").pop()||"").toLowerCase()]||"application/octet-stream");
  let r;try{r=await fetch(`${BK.url}/storage/v1/object/loan-docs/${path.split("/").map(encodeURIComponent).join("/")}`,{method:"POST",headers:bkHeaders({"Content-Type":type,"x-upsert":"false","cache-control":"3600"}),body:file})}catch(e){throw new BkError("Upload failed. Check your connection and try again.",false)}
  if(!r.ok){let m="";try{m=(await r.json()).message}catch(e){}throw new BkError(`Could not upload ${file.name}${m?": "+m:""}`,true)}return{type}}
};
const safeName=n=>n.normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(-80);
async function uploadAll(token,bag,list,onProg){const items=[];list.forEach(x=>(bag[x.k]||[]).forEach(f=>items.push([x,f])));
 const docs=[];let i=0;for(const [x,f] of items){i++;onProg&&onProg(i,items.length,f.name);const path=`${token}/${x.k}/${Date.now()}-${i}-${safeName(f.name)}`;const {type}=await sb.upload(path,f);docs.push({kind:x.k,label:x.t,path,name:f.name,size:f.size,mime:type})}
 if(docs.length)await sb.rpc("register_documents",{p_token:token,p_docs:docs});return docs.length}
const CHAN={"SMS":"sms","WhatsApp":"whatsapp","SMS and WhatsApp":"both"};
const LOGO=window.FC_LOGO, LOGO_W=window.FC_LOGO_WHITE, MARK=window.FC_MARK;

/* ---------- Icons ---------- */
const P={
 check:'<path d="M5 12.5l4.2 4.2L19 7"/>',
 badge:'<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c.8-1.8 2.3-2.7 4-2.7s3.2.9 4 2.7"/>',
 briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
 bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 store:'<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
 clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
 receipt:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
 tool:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
 id:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.4 1.8-2 3.2-2s2.6.6 3.2 2M14 9.5h4M14 12.5h4"/>',
 home:'<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
 bank:'<path d="M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
 shield:'<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2"/>',
 chat:'<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
 upload:'<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
 file:'<path d="M6 2h8l6 6v14H6z"/><path d="M14 2v6h6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 handshake:'<path d="M2 12l4-4 4 2 4-3 4 3 4 2-4 5-3 1-4-3-2 1z"/><path d="M10 10l3 3"/>',
 scale:'<path d="M12 3v18M7 21h10M4 7h16M4 7l-2 6a3 3 0 0 0 6 0zM20 7l-2 6a3 3 0 0 0 6 0z"/>',
 heart:'<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z"/>',
 calc:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v3H8zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',
 leaf:'<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19c3-4 6-7 10-9"/>'
};
const ic=(n,extra="")=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[n]||""}</svg>`;
const tick=()=>`<span class="tick">${ic("check",'stroke-width="3"')}</span>`;

/* Ribbon motif drawn from the logo's three interlocking bands */
const ribbons=(cls="ribbons")=>`<svg class="${cls}" viewBox="0 0 720 720" aria-hidden="true"><defs>
<linearGradient id="rg1" x1="0" x2="1"><stop offset="0" stop-color="#0b3448"/><stop offset="1" stop-color="#0f5372"/></linearGradient>
<linearGradient id="rg2" x1="0" x2="1"><stop offset="0" stop-color="#025c28"/><stop offset="1" stop-color="#179b06"/></linearGradient>
<linearGradient id="rg3" x1="1" x2="0"><stop offset="0" stop-color="#0f5372"/><stop offset="1" stop-color="#0b3448"/></linearGradient></defs>
<path d="M300 110 C330 60 390 60 420 110 L600 420" fill="none" stroke="url(#rg1)" stroke-width="64" stroke-linecap="round" opacity=".16"/>
<path d="M630 470 C660 525 630 575 570 575 L210 575" fill="none" stroke="url(#rg2)" stroke-width="64" stroke-linecap="round" opacity=".2"/>
<path d="M150 575 C90 575 60 525 90 470 L270 160" fill="none" stroke="url(#rg3)" stroke-width="64" stroke-linecap="round" opacity=".14"/></svg>`;

const coverArt=(p,big)=>{const [a,b,c]=p.cover;const id="cv"+p.slug.replace(/\W/g,"");
 return `<span class="cover" aria-hidden="true"><svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
 <rect width="400" height="200" fill="url(#${id})"/>
 <path d="M250 -20 L420 260" stroke="${b}" stroke-width="46" stroke-linecap="round" opacity=".55"/>
 <path d="M200 230 L330 10" stroke="#ffffff" stroke-width="14" stroke-linecap="round" opacity=".12"/>
 <path d="M-30 170 C80 120 140 210 260 150" stroke="#ffffff" stroke-width="2" fill="none" opacity=".35"/>
 <text x="24" y="${big?172:176}" fill="#ffffff" font-family="Sora,Segoe UI,sans-serif" font-size="${big?15:13}" font-weight="600" letter-spacing="2.5" opacity=".95">${esc(p.cat.toUpperCase())}</text></svg></span>`;};

/* ---------- Shared bits ---------- */
const fmtDate=d=>new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
const readMins=p=>Math.max(2,Math.round(p.body.replace(/<[^>]+>/g,"").split(/\s+/).length/200));
const prod=s=>PRODUCTS.find(p=>p.slug===s);
const waLink=t=>`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(t)}`;
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),2600)}
async function copyText(txt,btn){try{await navigator.clipboard.writeText(txt);toast("Copied")}catch(e){const r=document.createRange();const el=btn?.previousElementSibling||btn;if(el){r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r)}toast("Selected. Press copy on your device")}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-copy]");if(b){e.preventDefault();copyText(b.dataset.copy,b)}});

function pageHead(title,lede,crumbs){return `<div class="page-head">${ribbons()}<div class="wrap">
 <nav class="crumbs" aria-label="Breadcrumb"><a href="#home">Home</a>${(crumbs||[]).map(c=>` <span aria-hidden="true">/</span> ${c[1]?`<a href="#${c[1]}">${esc(c[0])}</a>`:`<span>${esc(c[0])}</span>`}`).join("")}</nav>
 <h1>${title}</h1>${lede?`<p class="lede">${lede}</p>`:""}</div></div>`}

function ctaBand(){return `<section class="tight"><div class="wrap"><div class="cta-band">
 <div style="display:grid;gap:12px"><h2>Ready when you are.</h2><p>Apply online in about 10 minutes. Have your ID, proof of residence and payslip or business records ready.</p></div>
 <div class="acts"><a class="btn light" href="#apply">Start my application</a><a class="btn ghost" style="color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.4)" href="#contact">Talk to an advisor</a></div></div></div></section>`}

const fraudNote=()=>`<div class="notice" role="note">${ic("alert")}<div><b>Stay safe from loan scams.</b> FastCred will never ask you to send money to a personal number to "unlock" a loan, and we will never ask for your PIN or one-time codes. If in doubt, call us on ${CONFIG.phones.map(esc).join(" or ")}.</div></div>`;

/* ---------- Loan calculator (the only place rates and tenure appear) ---------- */
const C=CONFIG.calc;
const calcState={amount:C.defaultAmount,term:C.defaultTerm};
function quote(amount,term){const interest=amount*C.monthlyRate*term;const total=amount+interest;return {amount,term,interest,total,monthly:total/term}}
function calcHTML(id){const a=calcState.amount,t=calcState.term;
 return `<div class="calc" id="${id}">
 <div class="calc-in">
  <div style="display:grid;gap:6px"><span class="eyebrow">Loan calculator</span><h3 style="font-size:1.4rem">See your repayment before you apply</h3></div>
  <div class="field-row"><div class="top"><label for="${id}-amt">How much do you need?</label>
   <div class="amount-box"><span>US$</span><input id="${id}-amtn" inputmode="numeric" aria-label="Loan amount in US dollars" value="${a}"></div></div>
   <input type="range" id="${id}-amt" min="${C.minAmount}" max="${C.maxAmount}" step="${C.step}" value="${a}">
   <div class="range-ends num"><span>${money(C.minAmount,0)}</span><span>${money(C.maxAmount,0)}</span></div></div>
  <div class="field-row"><span class="lab" style="font-weight:600" id="${id}-tl">Repay over</span>
   <div class="seg" role="group" aria-labelledby="${id}-tl">${Array.from({length:C.maxTerm-C.minTerm+1},(_,i)=>i+C.minTerm).map(n=>`<button type="button" data-term="${n}" aria-pressed="${n===t}">${n} month${n>1?"s":""}</button>`).join("")}</div></div>
  <div class="sched-wrap"><table class="sched num"><thead><tr><th>Month</th><th>Repayment</th><th>Interest</th><th>Balance after</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div>
 </div>
 <div class="calc-out" aria-live="polite">
  <span class="lbl">Estimated monthly repayment</span>
  <div class="big num" data-o="monthly">—</div>
  <dl class="num">
   <dt>Amount borrowed</dt><dd data-o="amount">—</dd>
   <dt>Interest rate</dt><dd>${(C.monthlyRate*100).toFixed(0)}% per month</dd>
   <dt>Repayment period</dt><dd data-o="term">—</dd>
   <dt>Total interest</dt><dd data-o="interest">—</dd>
   <dt class="total">Total repayable</dt><dd class="total" data-o="total">—</dd>
  </dl>
  <a class="btn" href="#apply" data-apply-calc>Apply with these figures</a>
  <p class="calc-note">Interest is worked out at ${(C.monthlyRate*100).toFixed(0)}% per month on the amount borrowed, over ${C.minTerm} to ${C.maxTerm} months. Figures are estimates. Your final amount and repayment are confirmed in your loan agreement after assessment.</p>
 </div></div>`}
function bindCalc(id){const root=$("#"+id);if(!root)return;const rng=$(`#${id}-amt`),num=$(`#${id}-amtn`);
 const paint=()=>{const q=quote(calcState.amount,calcState.term);
  rng.value=calcState.amount;rng.style.setProperty("--p",((calcState.amount-C.minAmount)/(C.maxAmount-C.minAmount)*100)+"%");
  if(document.activeElement!==num)num.value=calcState.amount.toLocaleString("en-US");
  $$("[data-term]",root).forEach(b=>b.setAttribute("aria-pressed",+b.dataset.term===calcState.term));
  const o=k=>$(`[data-o="${k}"]`,root);o("monthly").textContent=money(q.monthly);o("amount").textContent=money(q.amount);o("term").textContent=q.term+" month"+(q.term>1?"s":"");o("interest").textContent=money(q.interest);o("total").textContent=money(q.total);
  let bal=q.total,rows="";for(let m=1;m<=q.term;m++){bal-=q.monthly;rows+=`<tr><td>Month ${m}</td><td>${money(q.monthly)}</td><td>${money(q.interest/q.term)}</td><td>${money(Math.max(0,bal))}</td></tr>`}
  $("tbody",root).innerHTML=rows;$("tfoot",root).innerHTML=`<tr><td>Total</td><td>${money(q.total)}</td><td>${money(q.interest)}</td><td></td></tr>`;
  store.set("fc_calc",calcState)};
 rng.addEventListener("input",()=>{calcState.amount=+rng.value;paint()});
 num.addEventListener("input",()=>{const v=parseInt(num.value.replace(/[^\d]/g,""),10);if(!isNaN(v)){calcState.amount=Math.min(C.maxAmount,Math.max(C.minAmount,v));const keep=num.value;paint();num.value=keep}});
 num.addEventListener("blur",()=>{num.value=calcState.amount.toLocaleString("en-US")});
 $$("[data-term]",root).forEach(b=>b.addEventListener("click",()=>{calcState.term=+b.dataset.term;paint()}));
 $("[data-apply-calc]",root).addEventListener("click",()=>{app.data.amount=String(calcState.amount);app.data.term=String(calcState.term);saveDraft()});
 paint()}

/* ---------- Views ---------- */
const V={};

V.home=()=>`
<section class="hero">${ribbons()}<div class="wrap">
 <div class="hero-copy">
  <span class="eyebrow">A registered micro-financier · Harare</span>
  <h1>Credit that keeps your plans <span class="grad">moving forward.</span></h1>
  <p class="lede">Fast, fair loans for civil servants, salaried workers and growing businesses across Zimbabwe. Apply online in minutes, or visit us at Travel Plaza in Harare.</p>
  <div class="hero-actions"><a class="btn" href="#apply">Apply now</a><a class="btn ghost" href="#calculator">${ic("calc",'style="width:18px;height:18px"')} Work out my repayment</a></div>
  <ul class="hero-ticks"><li>${tick()}Apply from your phone</li><li>${tick()}Clear costs, no hidden charges</li><li>${tick()}Real people at a real office</li></ul>
 </div>
 <div class="hero-card" aria-label="What you need to apply">
  <div class="hc-top"><b style="font-family:var(--f-display)">Ready to apply?</b><span class="chip">About 10 minutes</span></div>
  <ul class="checklist">
   <li><span class="ck">${ic("check",'stroke-width="3"')}</span><div><b>Your national ID</b><small>Clear photo of the front, all four corners visible</small></div></li>
   <li><span class="ck">${ic("check",'stroke-width="3"')}</span><div><b>Proof of residence</b><small>Utility bill, lease or landlord's letter</small></div></li>
   <li><span class="ck">${ic("check",'stroke-width="3"')}</span><div><b>Proof of income</b><small>Payslip, or 3 months' bank statements / sales records</small></div></li>
   <li><span class="ck">${ic("check",'stroke-width="3"')}</span><div><b>Two references</b><small>Plus a guarantor for business loans</small></div></li>
  </ul>
  <a class="btn navy" href="#apply">Start my application</a>
 </div>
</div></section>

<section class="tight band-surface" style="padding-block:22px;border-bottom:1px solid var(--line)"><div class="wrap">${fraudNote()}</div></section>

<section><div class="wrap">
 <div class="sec-head"><span class="eyebrow">Find your loan</span><h2>Which best describes you?</h2><p class="lede">Pick the one that fits. Each path shows only the loans you can apply for.</p></div>
 <div class="paths">
  ${[["badge","I work for the Government","Teachers, nurses, police and other civil servants with an EC number.",["civil-servant","emergency"]],
     ["briefcase","I'm employed by a company or NGO","Permanent staff paid a monthly salary, including partner employers.",["salary-based","emergency"]],
     ["store","I run a business","Traders, shops, suppliers, manufacturers and service providers.",["working-capital","order-finance","invoice-discounting","asset-financing"]]]
   .map(([i,t,d,ps])=>`<div class="path"><span class="ic">${ic(i)}</span><div style="display:grid;gap:6px"><h3>${t}</h3><p class="muted">${d}</p></div>
   <ul>${ps.map(s=>`<li><a href="#loan-${s}">${esc(prod(s).name)}<span class="arrow" aria-hidden="true">→</span></a></li>`).join("")}</ul></div>`).join("")}
 </div>
</div></section>

<section class="band-soft" id="how-it-works"><div class="wrap">
 <div class="sec-head"><span class="eyebrow">How it works</span><h2>From application to funds in four steps</h2></div>
 <div class="steps">
  ${[["Choose your loan","Pick the loan that fits and check your repayment in the calculator."],
     ["Apply online","Fill in your details and upload clear photos of your documents."],
     ["We assess","Our team verifies your documents, runs credit checks and calls you."],
     ["Get funded","Sign your agreement and receive funds in your bank account or wallet."]]
   .map(([t,d],i)=>`<div class="step"><span class="n">${i+1}</span><h3>${t}</h3><p class="muted">${d}</p></div>`).join("")}
 </div>
</div></section>

<section id="calculator-sec"><div class="wrap">${calcHTML("calcHome")}</div></section>

<section class="band-soft"><div class="wrap">
 <div class="sec-head"><span class="eyebrow">Why FastCred</span><h2>Lending you can understand, from people you can visit</h2></div>
 <div class="values">
  ${[["shield","Registered and regulated","Registered with the Reserve Bank of Zimbabwe as a credit-only microfinance institution."],
     ["eye","Clear costs","Your repayment, interest and total cost are shown in the calculator and confirmed in writing before you sign."],
     ["handshake","Personal service","Talk to a real loans officer by phone, WhatsApp or at our Harare office."],
     ["leaf","Growth-minded","Our purpose is in our name: Growing Wealth, Growing Tomorrow, for families and businesses."]]
   .map(([i,t,d])=>`<div class="value"><span class="ic">${ic(i)}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}
 </div>
</div></section>

<section><div class="wrap">
 <div class="blog-tools" style="margin-bottom:24px"><div class="sec-head" style="margin:0"><span class="eyebrow">Money tips & news</span><h2>From the FastCred blog</h2></div><a class="link-arrow" href="#blog">All articles</a></div>
 <div class="posts">${POSTS.slice(0,3).map(p=>postCard(p)).join("")}</div>
</div></section>

<section class="band-soft"><div class="wrap" style="display:grid;gap:28px">
 <div class="sec-head"><span class="eyebrow">Questions</span><h2>Frequently asked questions</h2></div>
 ${faqHTML(FAQS.slice(0,6))}
 <a class="link-arrow" href="#faq">See all questions</a>
</div></section>
${ctaBand()}`;

const faqHTML=list=>`<div class="faq">${list.map(([q,a])=>`<details><summary>${esc(q)}</summary><div><p>${esc(a)}</p></div></details>`).join("")}</div>`;

V.loans=()=>pageHead("Loans for people and businesses","Personal loans backed by your salary, and business finance built around how your money actually moves.",[["Loans"]])+
`<section><div class="wrap">
 <h2 class="group-label">Personal loans</h2>
 <div class="grid-3">${PRODUCTS.filter(p=>p.group==="personal").map(prodCard).join("")}</div>
 <h2 class="group-label" style="margin-top:44px">Business loans</h2>
 <div class="grid-2">${PRODUCTS.filter(p=>p.group==="business").map(prodCard).join("")}</div>
</div></section>
<section class="band-soft"><div class="wrap">
 <div class="sec-head"><span class="eyebrow">Before you apply</span><h2>The documents most loans need</h2></div>
 <div class="docs">
  <div class="doc"><span class="ic">${ic("id")}</span><div><b>Identity</b><span>Copy of your national ID or passport</span></div></div>
  <div class="doc"><span class="ic">${ic("home")}</span><div><b>Residence</b><span>Current utility bill, lease or landlord's letter</span></div></div>
  <div class="doc"><span class="ic">${ic("bank")}</span><div><b>Income</b><span>Latest payslip, or last 3 months' bank statements or sales records</span></div></div>
 </div>
 <p class="muted" style="margin-top:18px">Please bring your original documents for verification before funds are released.</p>
</div></section>${ctaBand()}`;
const prodCard=p=>`<a class="card link" href="#loan-${p.slug}"><span class="ic">${ic(p.icon)}</span><h3>${esc(p.name)}</h3><p>${esc(p.short)}</p><span class="foot link-arrow">Learn more</span></a>`;

V.loan=slug=>{const p=prod(slug);if(!p)return V.notfound();const others=PRODUCTS.filter(x=>x.group===p.group&&x.slug!==p.slug);
 return pageHead(esc(p.name),esc(p.intro),[["Loans","loans"],[p.name]])+
 `<section><div class="wrap detail"><div class="main">
  <div class="prose"><span class="eyebrow">Who it's for</span><p>${esc(p.who)}</p></div>
  <div class="prose"><h2>What you can use it for</h2><div class="uses">${p.uses.map(u=>`<span>${esc(u)}</span>`).join("")}</div></div>
  <div class="prose"><h2>How it works</h2><ul>${p.how.map(h=>`<li>${esc(h)}</li>`).join("")}</ul></div>
  <div class="grid-2">
   <div class="card"><span class="ic">${ic("file")}</span><h3>Documents you'll need</h3><ul class="prose" style="padding-left:1.2em;margin:0">${p.docs.map(d=>`<li>${esc(d)}</li>`).join("")}</ul></div>
   <div class="card"><span class="ic">${ic("check")}</span><h3>Who can apply</h3><ul class="prose" style="padding-left:1.2em;margin:0">${p.elig.map(d=>`<li>${esc(d)}</li>`).join("")}</ul></div>
  </div>
  ${p.group==="business"?`<div class="notice" style="background:var(--navy-soft);border-color:var(--line)">${ic("users",'style="color:var(--navy)"')}<div><b style="color:var(--navy)">A guarantor is usually needed.</b> Your guarantor can complete our <a href="#guarantor-form">online guarantor form</a>. <a href="#guarantors">What does a guarantor do?</a></div></div>`:""}
 </div>
 <aside>
  <div class="card" style="box-shadow:var(--shadow)"><h3>Apply for ${esc(p.name)}</h3><p>Use the calculator to see your repayment, then apply online in about 10 minutes.</p>
   <a class="btn" href="#apply" data-prod="${p.slug}">Apply now</a><a class="btn ghost" href="#calculator">Open loan calculator</a></div>
  <div class="card"><h3 style="font-size:1rem">Prefer to talk?</h3><p>${CONFIG.phones.map(esc).join("<br>")}</p><a class="link-arrow" href="${waLink("Hello FastCred, I'd like to ask about "+p.name+".")}" target="_blank" rel="noopener">Chat on WhatsApp</a></div>
  ${others.length?`<div class="card"><h3 style="font-size:1rem">Related loans</h3>${others.map(o=>`<a class="link-arrow" href="#loan-${o.slug}">${esc(o.name)}</a>`).join("")}</div>`:""}
 </aside></div></section>${ctaBand()}`};

V.calculator=()=>pageHead("Loan calculator","Choose an amount and how long you'd like to repay. You'll see your monthly repayment, the interest and the total before you apply.",[["Loan calculator"]])+
 `<section><div class="wrap">${calcHTML("calcPage")}</div></section>${ctaBand()}`;

V.guarantors=()=>pageHead("Being a guarantor","A guarantor promises that a loan will be repaid if the borrower cannot pay. Here is what that means and how to complete the guarantor form.",[["Guarantors"]])+
`<section><div class="wrap detail"><div class="main">
 <div class="prose"><h2>What you are agreeing to</h2>
 <p>By signing as a guarantor, you stand behind the borrower's loan. If they do not repay as agreed, FastCred Financial Services may ask you to pay and may take legal action under the guarantee. You also consent to credit checks and to your information being shared with credit bureaus.</p>
 <p>Only guarantee an amount you could repay yourself without serious hardship.</p></div>
 <div class="prose"><h2>What the form asks for</h2><ul>
  <li>Your personal details, ID number, contact details and home address</li>
  <li>Your employment details and monthly salary, or your business details and profit if self-employed</li>
  <li>The name of the borrower, the loan type and your relationship with them</li>
  <li>Your signature on the certification and consent clauses</li></ul></div>
 <div class="docs">
  <div class="doc"><span class="ic">${ic("id")}</span><div><b>ID copy</b><span>National ID or passport</span></div></div>
  <div class="doc"><span class="ic">${ic("home")}</span><div><b>Proof of residence</b><span>Current, in your name or with a confirming letter</span></div></div>
  <div class="doc"><span class="ic">${ic("bank")}</span><div><b>Income proof</b><span>Latest payslip + 3 months' bank statements (salaried)</span></div></div>
 </div>
 <a class="link-arrow" href="#post-being-a-guarantor">Read: Standing as a guarantor, what you are really agreeing to</a>
 </div><aside><div class="card" style="box-shadow:var(--shadow)"><h3>Complete the guarantor form</h3><p>Fill it in online and upload your documents. It takes about 5 minutes.</p><a class="btn" href="#guarantor-form">Open guarantor form</a></div>
 <div class="card"><h3 style="font-size:1rem">Borrower? Send this to your guarantor</h3><p class="muted">Share the guarantor form link with the person standing for your loan.</p><button class="copy" type="button" data-copy-link="guarantor-form">Copy form link</button></div></aside></div></section>`;

V.about=()=>pageHead("About FastCred","FastCred Financial Services is a registered micro-financier based in Harare, helping individuals and businesses grow with practical, responsible credit.",[["About us"]])+
`<section><div class="wrap detail"><div class="main">
 <div class="prose"><span class="eyebrow">Who we are</span><h2>Growing Wealth, Growing Tomorrow</h2>
 <p>FastCred Financial Services (Pvt) Ltd is registered with the Reserve Bank of Zimbabwe as a credit-only microfinance institution. We lend to civil servants, salaried employees and small and medium businesses that need finance to move forward.</p>
 <p>We believe credit should be a tool for growth. That means lending amounts people can repay, explaining costs clearly, and treating every client with respect, whether they walk into our office at Travel Plaza or apply from their phone.</p></div>
 <div class="values two">
  ${[["scale","Responsible lending","We assess affordability carefully, because a loan that cannot be repaid helps no one."],["eye","Transparency","Repayments and total costs are shown before you apply and confirmed in writing before you sign."],["heart","Respect","We listen, explain, and treat your information with care."],["leaf","Growth","We back the businesses and families building Zimbabwe's tomorrow."]]
   .map(([i,t,d])=>`<div class="value"><span class="ic">${ic(i)}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}
 </div>
 <div class="prose"><h2>Our commitments to you</h2><ul>
  <li>We show you your repayment and total cost before you sign.</li>
  <li>We give you time to read and understand your loan agreement.</li>
  <li>We only collect payments through official FastCred channels.</li>
  <li>We handle complaints promptly and fairly. See <a href="#complaints">how to raise a concern</a>.</li></ul></div>
 </div><aside>
 <div class="card"><h3>Visit us</h3><p>${esc(CONFIG.address)}</p><a class="link-arrow" href="${CONFIG.mapsUrl}" target="_blank" rel="noopener">Get directions</a></div>
 <div class="card"><h3>Loan products</h3>${PRODUCTS.map(p=>`<a class="link-arrow" href="#loan-${p.slug}">${esc(p.name)}</a>`).join("")}</div></aside></div></section>${ctaBand()}`;

V.faq=()=>pageHead("Frequently asked questions","Answers to the questions we hear most. Can't find yours? Call or WhatsApp us.",[["FAQ"]])+`<section><div class="wrap">${faqHTML(FAQS)}</div></section>${ctaBand()}`;

V.contact=()=>pageHead("Contact us","Call, WhatsApp, email or visit our Harare office. Our loans team is happy to help.",[["Contact"]])+
`<section><div class="wrap contact-grid">
 <div>
  ${CONFIG.phones.map((ph,i)=>`<div class="cline"><span class="ic">${ic("phone")}</span><div><small>${i?"Mobile":"Office"}</small><b class="num">${esc(ph)}</b></div><button class="copy" type="button" data-copy="${esc(ph)}">Copy</button></div>`).join("")}
  <div class="cline"><span class="ic">${ic("chat")}</span><div><small>WhatsApp</small><b class="num">+${CONFIG.whatsapp.replace(/^(\d{3})(\d{2})(\d{3})(\d{4})$/,"$1 $2 $3 $4")}</b></div><a class="copy" style="text-decoration:none" href="${waLink("Hello FastCred, ")}" target="_blank" rel="noopener">Open chat</a></div>
  <div class="cline"><span class="ic">${ic("mail")}</span><div><small>Email</small><b>${esc(CONFIG.email)}</b></div><button class="copy" type="button" data-copy="${esc(CONFIG.email)}">Copy</button></div>
  <div class="cline"><span class="ic">${ic("pin")}</span><div><small>Visit us today</small><b>${esc(CONFIG.address)}</b></div><a class="copy" style="text-decoration:none" href="${CONFIG.mapsUrl}" target="_blank" rel="noopener">Directions</a></div>
  <div class="cline" style="border-bottom:0"><span class="ic">${ic("clock")}</span><div><small>Opening hours</small>${CONFIG.hours.map(h=>`<div style="display:flex;justify-content:space-between;gap:16px"><span>${esc(h[0])}</span><b class="num">${esc(h[1])}</b></div>`).join("")}</div><span></span></div>
 </div>
 <form class="fcard" id="contactForm" novalidate>
  <header><h2 style="font-size:1.5rem">Send us a message</h2><p class="muted">We'll get back to you by phone or WhatsApp.</p></header>
  <div class="fgrid">
   <div class="f"><label for="c_name">Full name</label><input id="c_name" name="name" required autocomplete="name"><span class="emsg">Enter your name.</span></div>
   <div class="f"><label for="c_phone">Phone number</label><input id="c_phone" name="phone" required inputmode="tel" autocomplete="tel" placeholder="+263 77 123 4567"><span class="emsg">Enter a valid phone number.</span></div>
   <div class="f s6"><label for="c_topic">What is it about?</label><select id="c_topic" name="topic"><option>A new loan</option><option>My existing loan</option><option>Being a guarantor</option><option>Partnering with FastCred (employers)</option><option>A complaint</option><option>Something else</option></select></div>
   <div class="f s6"><label for="c_msg">Message</label><textarea id="c_msg" name="msg" required></textarea><span class="emsg">Write a short message.</span></div>
  </div>
  <div class="form-nav" style="border:0;padding:0"><span class="saved">Opens WhatsApp with your message ready to send.</span><button class="btn" type="submit">Send message</button></div>
 </form>
</div></section>`;

V.blog=()=>pageHead("Money tips & news","Practical guides on borrowing wisely, growing your business and staying safe from scams.",[["Blog"]])+
`<section><div class="wrap">
 <div class="blog-tools"><div class="cats" role="group" aria-label="Filter by topic">${["All",...new Set(POSTS.map(p=>p.cat))].map(c=>`<button type="button" data-cat="${esc(c)}" aria-pressed="${c===app.blogCat}">${esc(c)}</button>`).join("")}</div>
 <label class="search">${ic("search")}<span class="sr">Search articles</span><input id="blogQ" type="search" placeholder="Search articles" value="${esc(app.blogQ)}"></label></div>
 <div class="posts" id="postList"></div></div></section>`;
const postCard=(p,feature)=>`<a class="post-card${feature?" feature":""}" href="#post-${p.slug}">${coverArt(p,feature)}<div class="body"><div class="meta"><span class="chip navy">${esc(p.cat)}</span><span>${fmtDate(p.date)}</span><span>· ${readMins(p)} min read</span></div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><span class="link-arrow">Read article</span></div></a>`;
function paintPosts(){const q=app.blogQ.trim().toLowerCase();const list=POSTS.filter(p=>(app.blogCat==="All"||p.cat===app.blogCat)&&(!q||(p.title+" "+p.excerpt+" "+p.body).toLowerCase().includes(q)));
 const el=$("#postList");if(!el)return;el.innerHTML=list.length?list.map((p,i)=>postCard(p,i===0&&app.blogCat==="All"&&!q)).join(""):`<div class="empty" style="grid-column:1/-1">No articles match "${esc(app.blogQ)}". Try another word or <button class="copy" type="button" id="clearQ">clear the search</button>.</div>`;
 const c=$("#clearQ");if(c)c.onclick=()=>{app.blogQ="";$("#blogQ").value="";paintPosts()}}

V.post=slug=>{const p=POSTS.find(x=>x.slug===slug);if(!p)return V.notfound();const rel=POSTS.filter(x=>x!==p&&x.cat===p.cat).concat(POSTS.filter(x=>x!==p&&x.cat!==p.cat)).slice(0,3);
 return `<div class="page-head">${ribbons()}<div class="wrap" style="max-width:900px;margin-inline:auto">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="#home">Home</a> <span aria-hidden="true">/</span> <a href="#blog">Blog</a> <span aria-hidden="true">/</span> <span>${esc(p.cat)}</span></nav>
  <h1 style="font-size:clamp(1.9rem,4.4vw,3rem)">${esc(p.title)}</h1>
  <div class="post-meta"><span class="chip navy">${esc(p.cat)}</span><span>By the FastCred team</span><span>· ${fmtDate(p.date)}</span><span>· ${readMins(p)} min read</span></div></div></div>
 <section><div class="wrap article"><article class="prose">${p.body}</article>
 <aside><div class="card" style="box-shadow:var(--shadow)"><h3>Need finance?</h3><p>Check your repayment, then apply online in about 10 minutes.</p><a class="btn" href="#apply">Apply now</a><a class="btn ghost" href="#calculator">Loan calculator</a></div>
  <div class="card"><h3 style="font-size:1rem">Share this article</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="copy" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(p.title+" — FastCred Financial Services")}">WhatsApp</a><a class="copy" style="text-decoration:none" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://fastcred.co.zw/#post-"+p.slug)}">Facebook</a><a class="copy" style="text-decoration:none" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://fastcred.co.zw/#post-"+p.slug)}">LinkedIn</a><button class="copy" type="button" data-copy-link="post-${p.slug}">Copy link</button></div></div></aside></div></section>
 <section class="band-soft"><div class="wrap"><div class="sec-head"><span class="eyebrow">Keep reading</span><h2>More from the blog</h2></div><div class="posts">${rel.map(x=>postCard(x)).join("")}</div></div></section>`};

const legal={
 privacy:["Privacy notice",`<p>This notice explains how ${CONFIG.legalName} ("FastCred", "we") collects and uses your personal information when you use this website or apply for credit.</p>
 <h2>What we collect</h2><p>Information you give us in applications and forms, such as your name, ID number, date of birth, contact details, address, employment or business details, income, next of kin, references and guarantor details, and copies of supporting documents.</p>
 <h2>How we use it</h2><ul><li>To verify your identity and assess your application and affordability</li><li>To run credit checks with credit bureaus such as FCB and XDS, with your consent</li><li>To manage your loan, collect repayments and contact you about your account</li><li>To meet our legal and regulatory obligations</li></ul>
 <h2>Who we share it with</h2><p>Credit bureaus and credit reporting entities, the Credit Information Bureau, your employer's payroll office for salary deductions, regulators and authorities where required by law, and service providers who help us operate, under confidentiality obligations. We do not sell your information.</p>
 <h2>Keeping it safe</h2><p>We take reasonable technical and organisational steps to protect your information and keep it only as long as needed for the purposes above and our legal obligations.</p>
 <h2>Your rights</h2><p>You may ask to see the information we hold about you and ask us to correct anything inaccurate. Contact us using the details on our <a href="#contact">contact page</a>.</p>
 <h2>Cookies</h2><p>This website does not use advertising or tracking cookies. Your browser may store an unfinished application on your own device so you can return to it; you can clear it at any time.</p>`],
 terms:["Terms of use",`<p>By using this website you agree to these terms.</p><h2>Information only</h2><p>Content on this site, including calculator results and blog articles, is general information and not financial advice. Calculator figures are estimates; your loan amount, costs and repayments are confirmed only in your signed loan agreement.</p><h2>Applications</h2><p>Submitting an application does not guarantee approval. All loans are subject to assessment, verification of documents and credit checks. You must give true and complete information.</p><h2>Official channels</h2><p>We only accept payments through official FastCred channels. We are not responsible for losses from payments made to people impersonating FastCred.</p><h2>Changes</h2><p>We may update this website and these terms from time to time.</p>`],
 complaints:["Complaints & feedback",`<p>We want to get things right. If you are unhappy with our service, please tell us so we can put it right.</p><h2>How to raise a concern</h2><ol><li>Speak to your loans officer, or call us on ${CONFIG.phones.map(esc).join(" or ")}.</li><li>If it is not resolved, write to us at ${esc(CONFIG.email)} or deliver a letter to our office, marked for the attention of management, with your name, phone number and a description of the issue.</li><li>We will acknowledge your complaint, investigate it, and tell you the outcome and the reasons for it.</li></ol><h2>Report fraud</h2><p>If someone asks you to pay money to "release" a loan in FastCred's name, or asks for your PIN, do not pay. Report it to us immediately on our published numbers.</p>`]
};
V.legal=k=>{const [t,b]=legal[k];return pageHead(t,"",[[t]])+`<section><div class="wrap"><div class="prose" style="font-size:1.04rem">${b}</div></div></section>`};
V.notfound=()=>pageHead("Page not found","The page you were looking for has moved or does not exist.",[["Not found"]])+`<section><div class="wrap"><a class="btn" href="#home">Back to home</a></div></section>`;

/* ---------- Application wizard ---------- */
const app={data:store.get("fc_draft")||{},files:{},step:0,maxStep:0,blogCat:"All",blogQ:"",gFiles:{},trkFiles:{}};
const saved=store.get("fc_calc");if(saved){calcState.amount=saved.amount||calcState.amount;calcState.term=saved.term||calcState.term}
function saveDraft(){store.set("fc_draft",app.data);const s=$("#savedNote");if(s)s.textContent="Draft saved on this device"}
const isBiz=()=>prod(app.data.product||"")?.group==="business";
const isCivil=()=>app.data.product==="civil-servant";

// field helpers
const F={
 text:(n,l,o={})=>`<div class="f ${o.s||""}"><label for="a_${n}">${l}${o.req===false?' <span class="opt">(optional)</span>':""}</label><input id="a_${n}" name="${n}" type="${o.type||"text"}" ${o.req===false?"":"required"} ${o.attrs||""} value="${esc(app.data[n]??"")}" ${o.ph?`placeholder="${esc(o.ph)}"`:""}>${o.hint?`<span class="hint">${o.hint}</span>`:""}<span class="emsg">${o.err||"This field is required."}</span></div>`,
 area:(n,l,o={})=>`<div class="f ${o.s||"s6"}"><label for="a_${n}">${l}${o.req===false?' <span class="opt">(optional)</span>':""}</label><textarea id="a_${n}" name="${n}" ${o.req===false?"":"required"} rows="2">${esc(app.data[n]??"")}</textarea><span class="emsg">This field is required.</span></div>`,
 select:(n,l,opts,o={})=>`<div class="f ${o.s||""}"><label for="a_${n}">${l}</label><select id="a_${n}" name="${n}" ${o.req===false?"":"required"}><option value="">Select…</option>${opts.map(x=>`<option ${app.data[n]===x?"selected":""}>${esc(x)}</option>`).join("")}</select><span class="emsg">Choose an option.</span></div>`,
 radios:(n,l,opts,o={})=>`<div class="f ${o.s||""}" data-radio="${n}" ${o.req===false?"":"data-req"}><span class="lab" id="lab_${n}">${l}</span><div class="opts" role="radiogroup" aria-labelledby="lab_${n}">${opts.map((x,i)=>`<label><input type="radio" id="a_${n}_${i}" name="${n}" value="${esc(x)}" ${app.data[n]===x?"checked":""}>${esc(x)}</label>`).join("")}</div><span class="emsg">Choose one.</span></div>`
};
const phoneAttrs='inputmode="tel" autocomplete="tel" data-v="phone"';
const STEPS=[
 {t:"Your loan",render:()=>{const groups=[["personal","Personal loans"],["business","Business loans"]];
  return `<fieldset data-radio="product" data-req><legend>Which loan are you applying for?</legend>${groups.map(([g,l])=>`<div style="display:grid;gap:8px"><span class="muted" style="font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em">${l}</span><div class="tiles">${PRODUCTS.filter(p=>p.group===g).map(p=>`<label><input type="radio" name="product" id="a_product_${p.slug}" value="${p.slug}" ${app.data.product===p.slug?"checked":""}><b>${esc(p.name)}</b><small>${esc(p.short)}</small></label>`).join("")}</div></div>`).join("")}<span class="emsg" id="prodErr" style="color:var(--danger);display:none">Choose a loan to continue.</span></fieldset>
  <fieldset><legend>Loan details</legend><div class="fgrid">
   ${F.text("amount","Amount you need (US$)",{s:"s2",attrs:`inputmode="numeric" data-v="amount"`,ph:String(C.defaultAmount),err:`Enter an amount between ${money(C.minAmount,0)} and ${money(C.maxAmount,0)}.`})}
   ${F.select("term","Repayment period",Array.from({length:C.maxTerm-C.minTerm+1},(_,i)=>`${i+C.minTerm}`),{s:"s2"})}
   ${F.radios("loanType","New or repeat?",["New","Repeat"],{s:"s2"})}
   <div id="purposeWrap" style="grid-column:1/-1;display:grid"></div>
   ${F.area("purposeDetail","Briefly, what will the money be used for?",{req:false})}
  </div></fieldset>
  <div class="quote-mini" id="quoteMini" hidden><span>Loan calculator estimate</span><span><b class="num" id="qm">—</b> / month</span><a class="link-arrow" style="color:#9be58b" href="#calculator">Open calculator</a></div>`}},
 {t:"About you",render:()=>`<fieldset><legend>Personal details</legend><div class="fgrid">
   ${F.text("fullName","Full name (as on ID)",{s:"s4",attrs:'autocomplete="name"'})}${F.text("nickname","Nickname",{s:"s2",req:false})}
   ${F.radios("gender","Gender",["Male","Female"],{s:"s2"})}${F.text("dob","Date of birth",{type:"date",s:"s2",attrs:'data-v="adult"',err:"You must be 18 or older."})}${F.text("nationality","Nationality",{s:"s2",ph:"Zimbabwean"})}
   ${F.text("idNumber","National ID / passport number",{s:"s3",ph:"e.g. 63-123456A78",attrs:'autocapitalize="characters"'})}
   ${F.radios("civilStatus","Civil status",["Single","Married","Widowed","Separated","Divorced"],{s:"s6"})}
  </div></fieldset>
  <fieldset><legend>Where you live</legend><div class="fgrid">
   ${F.area("homeAddress","Present home address",{s:"s6"})}
   ${F.radios("homeOwnership","Home ownership",["Owned","Family house","Rented","Other"],{s:"s4"})}${F.text("lengthOfStay","Length of stay",{s:"s2",ph:"e.g. 3 years"})}
   ${F.area("permanentAddress","Permanent home address, if different",{req:false})}
  </div></fieldset>
  <fieldset><legend>Contact details</legend><div class="fgrid">
   ${F.text("mobile","Mobile number",{s:"s2",attrs:phoneAttrs,ph:"+263 77 123 4567",err:"Enter a valid phone number."})}${F.text("homePhone","Home phone",{s:"s2",req:false,attrs:phoneAttrs})}${F.text("officePhone","Office phone",{s:"s2",req:false,attrs:phoneAttrs})}
   ${F.text("email","Email address",{type:"email",s:"s4",req:false,attrs:'autocomplete="email" data-v="email"',err:"Enter a valid email address."})}${F.text("dependents","Number of dependents",{s:"s2",req:false,attrs:'inputmode="numeric"'})}
   ${F.text("dependentAges","Ages of dependents",{s:"s6",req:false,ph:"e.g. 4, 9, 15"})}
   ${F.radios("notifyChannel","Send me updates and repayment reminders by",["SMS","WhatsApp","SMS and WhatsApp"],{s:"s6"})}
  </div></fieldset>`},
 {t:"Work or business",render:()=>isBiz()?`<fieldset><legend>Business information</legend><div class="fgrid">
   ${F.text("bizName","Name of business",{s:"s4"})}${F.text("bizPosition","Your position in the business",{s:"s2",ph:"e.g. Owner, Director"})}
   ${F.radios("bizForm","Form of ownership",["Sole proprietorship","Partnership","Company / Corporation"],{s:"s6"})}
   ${F.area("bizAddress","Business address")}
   ${F.text("bizPhone","Business phone",{s:"s2",attrs:phoneAttrs,err:"Enter a valid phone number."})}${F.text("bizNature","Nature of business",{s:"s2",ph:"e.g. Hardware retail"})}${F.text("bizYears","Years in business",{s:"s2",attrs:'inputmode="numeric"'})}
   ${F.text("bizSales","Average monthly sales (US$)",{s:"s3",req:false,attrs:'inputmode="numeric"'})}${F.text("bizReg","Company registration number",{s:"s3",req:false})}
  </div></fieldset>`:`<fieldset><legend>Employment information</legend><div class="fgrid">
   ${F.text("employer","Name of employer",{s:"s4",ph:isCivil()?"e.g. Ministry of Primary and Secondary Education":""})}${F.text("jobTitle","Job title",{s:"s2"})}
   ${isCivil()?F.text("ecNumber","EC number",{s:"s2",attrs:'autocapitalize="characters"'}):F.radios("employmentType","Employment type",["Permanent","Contract"],{s:"s2"})}
   ${F.text("appointmentDate","Date you joined",{type:"date",s:"s2"})}${F.text("payday","Payday",{s:"s2",req:false,ph:"e.g. 25th"})}
   ${F.text("grossSalary","Gross monthly salary (US$)",{s:"s3",attrs:'inputmode="numeric"'})}${F.text("netSalary","Net monthly salary (US$)",{s:"s3",attrs:'inputmode="numeric"'})}
   ${F.area("employerAddress","Employer address",{req:false})}
  </div></fieldset>`},
 {t:"Next of kin & references",render:()=>`<fieldset><legend>Spouse / next of kin</legend><div class="fgrid">
   ${F.text("kinName","Full name",{s:"s4"})}${F.text("kinPhone","Phone number",{s:"s2",attrs:phoneAttrs,err:"Enter a valid phone number."})}
   ${F.text("kinRelation","Relationship to you",{s:"s3",ph:"e.g. Spouse, Brother"})}${F.radios("kinGender","Gender",["Male","Female"],{s:"s3"})}
   ${F.area("kinAddress","Home address")}
  </div></fieldset>
  ${[1,2].map(i=>`<fieldset class="sub-block"><legend>Reference ${i}</legend><div class="fgrid">
   ${F.text("ref"+i+"Name","Full name",{s:"s4"})}${F.text("ref"+i+"Phone","Phone number",{s:"s2",attrs:phoneAttrs,err:"Enter a valid phone number."})}
   ${F.text("ref"+i+"Relation","Relationship to you",{s:"s2"})}${F.radios("ref"+i+"Gender","Gender",["Male","Female"],{s:"s2"})}${F.text("ref"+i+"Email","Email",{type:"email",s:"s2",req:false,attrs:'data-v="email"',err:"Enter a valid email address."})}
   ${F.area("ref"+i+"Address","Address",{req:false})}
  </div></fieldset>`).join("")}
  <p class="muted">References should not live in your household. Please let them know we may call.</p>`},
 {t:"Guarantor",render:()=>{const biz=isBiz();const modes=biz?["Enter guarantor details now","My guarantor will fill in the form"]:["No guarantor for now","Enter guarantor details now","My guarantor will fill in the form"];
  if(!modes.includes(app.data.gMode))app.data.gMode=biz?modes[0]:modes[0];
  return `<fieldset><legend>${biz?"Business loans need a guarantor":"Guarantor (only if we ask for one)"}</legend>
   <p class="muted" style="margin-top:-6px">${biz?"A guarantor promises the loan will be repaid if you cannot pay.":"Salary-backed loans usually do not need a guarantor. Our team will tell you if one is needed."} <a href="#guarantors" target="_blank">What a guarantor does</a></p>
   <div class="f s6" data-radio="gMode" data-req><div class="opts">${modes.map((m,i)=>`<label><input type="radio" name="gMode" id="a_gMode_${i}" value="${esc(m)}" ${app.data.gMode===m?"checked":""}>${esc(m)}</label>`).join("")}</div></div></fieldset>
  <div id="gBlock"></div>`}},
 {t:"Documents",render:()=>{const d=docList();return `<fieldset><legend>Upload your documents</legend><p class="muted" style="margin-top:-6px">Clear phone photos or PDFs, up to ${CONFIG.maxFileMB} MB each. Lay documents flat in good light with all four corners visible.</p>
  <div style="display:grid;gap:12px">${d.map(x=>uploadBox(x)).join("")}</div></fieldset>
  <div class="notice" style="background:var(--navy-soft);border-color:var(--line)">${ic("file",'style="color:var(--navy)"')}<div>We request all documents in original for verification before funds are released. Bring them to our office when we call you.</div></div>`}},
 {t:"Review & sign",render:()=>reviewHTML()+`
  <fieldset><legend>Credit information authority</legend>
  <div class="legal-box"><p>I/We hereby certify that all information and statements in this application are correct and complete, and that they are made for the purpose of obtaining credit. I/We likewise certify that the signatures appearing herein are genuine.</p><p>I/We authorise FastCred Financial Services to obtain such information as may be required concerning the statements made in this application through use of credit bureaus available for their use, including FCB and XDS credit checks.</p><p>I/We consent to my/our demographic and credit information being used and shared by the Credit Information Bureau and other credit reporting entities, and to FastCred Financial Services disclosing such information as is necessary to facilitate credit checks.</p></div>
  <div class="f s6" data-check="agreeCert"><label style="display:flex;gap:10px;align-items:flex-start;font-weight:500"><input type="checkbox" id="a_agreeCert" name="agreeCert" ${app.data.agreeCert?"checked":""} style="accent-color:var(--leaf);width:20px;height:20px;margin-top:2px;flex-shrink:0"> I confirm the information I have given is true and complete, and I accept the credit information authority above.</label><span class="emsg">Please confirm to continue.</span></div>
  <div class="f s6" data-check="agreePrivacy"><label style="display:flex;gap:10px;align-items:flex-start;font-weight:500"><input type="checkbox" id="a_agreePrivacy" name="agreePrivacy" ${app.data.agreePrivacy?"checked":""} style="accent-color:var(--leaf);width:20px;height:20px;margin-top:2px;flex-shrink:0"> I have read the <a href="#privacy" target="_blank">privacy notice</a>.</label><span class="emsg">Please confirm to continue.</span></div>
  <div class="fgrid">${F.text("signature","Type your full name as your signature",{s:"s4",attrs:'autocomplete="name" style="font-family:\'Brush Script MT\',cursive;font-size:1.3rem"'})}<div class="f s2"><span class="lab">Date</span><div class="num" style="padding:.75em 0;font-weight:600">${new Date().toLocaleDateString("en-GB")}</div></div></div>
  </fieldset>`}
];
function docList(){const biz=isBiz(),civ=isCivil(),p=app.data.product;const L=[
 {k:"id",t:"Copy of your ID",d:"National ID or passport, front (and back if needed)",req:true},
 {k:"residence",t:"Current proof of residence",d:"Utility bill, lease or landlord's letter",req:true}];
 if(!biz){L.push({k:"payslip",t:"Latest payslip",d:civ?"Must show your EC number":"Your most recent payslip",req:true});if(!civ&&p!=="emergency")L.push({k:"statements",t:"Last 3 months' bank statements",d:"PDF or clear photos",req:true})}
 else{L.push({k:"statements",t:"Last 3 months' bank statements or sales records",d:"Bank, mobile money or sales book",req:true});
  const extra={"order-finance":"Purchase order or contract, and supplier quotation","invoice-discounting":"Invoices and proof of delivery or acceptance","asset-financing":"Quotation or pro-forma invoice for the asset","working-capital":"Any supporting documents (e.g. supplier quotes)"}[p];
  L.push({k:"support",t:"Supporting documents",d:extra,req:p!=="working-capital",multi:true})}
 if(app.data.gMode==="Enter guarantor details now")L.push({k:"gdocs",t:"Guarantor documents",d:"Guarantor's ID, proof of residence and latest payslip + 3 months' bank statements",req:false,multi:true});
 return L}
const uploadBox=(x,bag="files",pre="up")=>{const f=app[bag][x.k]||[];return `<div class="upload ${f.length?"has":""}" data-up="${x.k}" data-bag="${bag}">
 <span class="ic">${ic(f.length?"check":"upload")}</span><div class="meta"><b>${esc(x.t)}${x.req?"":' <span class="muted" style="font-weight:400">(optional)</span>'}</b><small>${f.length?esc(f.map(z=>z.name).join(", ")):esc(x.d)}</small><span class="emsg" style="color:var(--danger);font-size:.84rem;display:none">Please add this document.</span></div>
 <label class="btn sm ${f.length?"ghost":"navy"}" for="${pre}_${x.k}" style="cursor:pointer">${f.length?"Change":"Choose file"}</label><input type="file" id="${pre}_${x.k}" accept="image/*,application/pdf" ${x.multi?"multiple":""}></div>`};
function bindUploads(root,bag,list){$$(".upload",root).forEach(box=>{const k=box.dataset.up,inp=$("input[type=file]",box);
 const take=fl=>{const ok=[...fl].filter(f=>{if(f.size>CONFIG.maxFileMB*1048576){toast(`${f.name} is larger than ${CONFIG.maxFileMB} MB`);return false}if(!/^image\/|pdf$/.test(f.type)){toast(`${f.name}: use a photo or PDF`);return false}return true});
  if(ok.length){app[bag][k]=ok;const x=list().find(z=>z.k===k);const nb=document.createElement("div");nb.innerHTML=uploadBox(x,bag,bag==="files"?"up":"gup");const n=nb.firstElementChild;box.replaceWith(n);bindUploads(n.parentElement,bag,list)}};
 inp.addEventListener("change",()=>take(inp.files));
 ["dragenter","dragover"].forEach(ev=>box.addEventListener(ev,e=>{e.preventDefault();box.classList.add("drag")}));
 ["dragleave","drop"].forEach(ev=>box.addEventListener(ev,e=>{e.preventDefault();box.classList.remove("drag")}));
 box.addEventListener("drop",e=>take(e.dataTransfer.files))})}

const LABELS={product:"Loan",amount:"Amount (US$)",term:"Repayment period (months)",loanType:"New or repeat",purpose:"Purpose",purposeDetail:"Use of funds",fullName:"Full name",nickname:"Nickname",gender:"Gender",dob:"Date of birth",nationality:"Nationality",idNumber:"ID number",civilStatus:"Civil status",homeAddress:"Home address",homeOwnership:"Home ownership",lengthOfStay:"Length of stay",permanentAddress:"Permanent address",mobile:"Mobile",notifyChannel:"Updates by",homePhone:"Home phone",officePhone:"Office phone",email:"Email",dependents:"Dependents",dependentAges:"Ages of dependents",employer:"Employer",jobTitle:"Job title",ecNumber:"EC number",employmentType:"Employment type",appointmentDate:"Date joined",payday:"Payday",grossSalary:"Gross salary (US$)",netSalary:"Net salary (US$)",employerAddress:"Employer address",bizName:"Business name",bizPosition:"Position",bizForm:"Form of ownership",bizAddress:"Business address",bizPhone:"Business phone",bizNature:"Nature of business",bizYears:"Years in business",bizSales:"Monthly sales (US$)",bizReg:"Registration no.",kinName:"Name",kinPhone:"Phone",kinRelation:"Relationship",kinGender:"Gender",kinAddress:"Address",gMode:"Guarantor",gName:"Name",gPhone:"Phone",gId:"ID number",gRelation:"Relationship",gEmployer:"Employer / business",gIncome:"Net monthly income (US$)",gAddress:"Address",gGender:"Gender",gDob:"Date of birth",gEmail:"Email"};
["1","2"].forEach(i=>Object.assign(LABELS,{[`ref${i}Name`]:"Name",[`ref${i}Phone`]:"Phone",[`ref${i}Relation`]:"Relationship",[`ref${i}Gender`]:"Gender",[`ref${i}Email`]:"Email",[`ref${i}Address`]:"Address"}));
const SECTIONS=[["Loan",0,["product","amount","term","loanType","purpose","purposeDetail"]],["About you",1,["fullName","nickname","gender","dob","nationality","idNumber","civilStatus","homeAddress","homeOwnership","lengthOfStay","permanentAddress","mobile","notifyChannel","homePhone","officePhone","email","dependents","dependentAges"]],
 ["Work or business",2,["employer","jobTitle","ecNumber","employmentType","appointmentDate","payday","grossSalary","netSalary","employerAddress","bizName","bizPosition","bizForm","bizAddress","bizPhone","bizNature","bizYears","bizSales","bizReg"]],
 ["Next of kin",3,["kinName","kinPhone","kinRelation","kinGender","kinAddress"]],["Reference 1",3,["ref1Name","ref1Phone","ref1Relation","ref1Gender","ref1Email","ref1Address"]],["Reference 2",3,["ref2Name","ref2Phone","ref2Relation","ref2Gender","ref2Email","ref2Address"]],
 ["Guarantor",4,["gMode","gName","gGender","gDob","gId","gPhone","gEmail","gAddress","gEmployer","gIncome","gRelation"]]];
const shown=k=>{const v=app.data[k];if(v==null||v==="")return null;if(k==="product")return prod(v)?.name;if(k==="gMode")return v;
 const bizK=k.startsWith("biz"),empK=["employer","jobTitle","ecNumber","employmentType","appointmentDate","payday","grossSalary","netSalary","employerAddress"].includes(k);
 if(bizK&&!isBiz())return null;if(empK&&isBiz())return null;if(k==="ecNumber"&&!isCivil())return null;if(k==="employmentType"&&isCivil())return null;
 if(k.startsWith("g")&&k!=="gender"&&k!=="grossSalary"&&app.data.gMode!=="Enter guarantor details now")return null;return v};
function reviewHTML(){const q=quote(+app.data.amount||0,+app.data.term||1);
 return `<div class="review"><div class="quote-mini"><span>${esc(prod(app.data.product)?.name||"")} · ${money(q.amount,0)} over ${q.term} month${q.term>1?"s":""}</span><span><b class="num">${money(q.monthly)}</b> / month (calculator estimate)</span></div>
 ${SECTIONS.map(([t,s,keys])=>{const rows=keys.map(k=>[k,shown(k)]).filter(r=>r[1]!=null);if(!rows.length)return"";return `<section><h4>${t}<button type="button" data-goto="${s}">Edit</button></h4><dl>${rows.map(([k,v])=>`<dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>`}).join("")}
 <section><h4>Documents<button type="button" data-goto="5">Edit</button></h4><dl>${docList().map(x=>`<dt>${esc(x.t)}</dt><dd>${(app.files[x.k]||[]).length?esc(app.files[x.k].map(f=>f.name).join(", ")):'<span class="muted">Not added</span>'}</dd>`).join("")}</dl></section></div>`}

V.apply=()=>{if(!app.data.amount)app.data.amount=String(calcState.amount);if(!app.data.term)app.data.term=String(calcState.term);
 return pageHead("Apply for a loan","Your answers save on this device as you go, so you can finish later. It takes about 10 minutes.",[["Apply"]])+
 `<section style="padding-top:36px"><div class="wrap form-shell"><ol class="stepper" id="stepper"></ol>
 <div style="display:grid;gap:16px;min-width:0"><div class="progress-m" id="progM"></div><form class="fcard" id="appForm" novalidate></form></div></div></section>`};

function paintStepper(){const el=$("#stepper");if(!el)return;el.innerHTML=STEPS.map((s,i)=>`<li class="${i<app.step?"done":""} ${i===app.step?"cur":""} ${i>app.maxStep?"locked":""}"><button type="button" data-goto="${i}" ${i>app.maxStep?'aria-disabled="true"':""} ${i===app.step?'aria-current="step"':""}><span class="dot">${i<app.step?ic("check",'stroke-width="3" style="width:16px;height:16px"'):i+1}</span><span>${s.t}</span></button></li>`).join("");
 $("#progM").innerHTML=`<div style="display:flex;justify-content:space-between;font-size:.9rem"><b>Step ${app.step+1} of ${STEPS.length}: ${STEPS[app.step].t}</b><span class="muted">${Math.round(app.step/(STEPS.length-1)*100)}%</span></div><div class="bar"><i style="width:${(app.step+1)/STEPS.length*100}%"></i></div>`}
function paintStep(focus){const form=$("#appForm");if(!form)return;const s=STEPS[app.step];
 form.innerHTML=`<header><span class="eyebrow">Step ${app.step+1} of ${STEPS.length}</span><h2 style="font-size:1.6rem">${s.t}</h2></header>${s.render()}
 <div class="form-nav"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${app.step?`<button class="btn ghost" type="button" id="back">Back</button>`:""}<span class="saved" id="savedNote">${Object.keys(app.data).length>2?"Draft saved on this device":""}</span></div>
 <button class="btn" type="submit" id="next">${app.step===STEPS.length-1?"Submit application":"Continue"}</button></div>`;
 paintStepper();bindStep();if(focus){const h=$("header h2",form);h.setAttribute("tabindex","-1");h.focus({preventScroll:true});form.scrollIntoView({behavior:"smooth",block:"start"})}}
function purposeHTML(){const p=prod(app.data.product);if(!p)return"";return F.radios("purpose","Loan purpose",p.purposes,{s:"s6"})}
function gBlockHTML(){if(app.data.gMode==="Enter guarantor details now")return `<fieldset class="sub-block"><legend>Guarantor details</legend><div class="fgrid">
 ${F.text("gName","Full name",{s:"s4"})}${F.radios("gGender","Gender",["Male","Female"],{s:"s2"})}
 ${F.text("gDob","Date of birth",{type:"date",s:"s2",attrs:'data-v="adult"',err:"Guarantor must be 18 or older."})}${F.text("gId","ID number",{s:"s2"})}${F.text("gPhone","Phone number",{s:"s2",attrs:phoneAttrs,err:"Enter a valid phone number."})}
 ${F.text("gEmail","Email",{type:"email",s:"s3",req:false,attrs:'data-v="email"',err:"Enter a valid email address."})}${F.text("gRelation","Relationship to you",{s:"s3"})}
 ${F.area("gAddress","Home address")}
 ${F.text("gEmployer","Employer, or business name if self-employed",{s:"s4"})}${F.text("gIncome","Net monthly income (US$)",{s:"s2",attrs:'inputmode="numeric"'})}
 </div><p class="muted">Your guarantor will also be asked to sign the guarantor form and bring their documents.</p></fieldset>`;
 if(app.data.gMode==="My guarantor will fill in the form")return `<div class="sub-block"><div class="t">Send the guarantor form to your guarantor</div><p class="muted">They can complete it online, or download and print it at our office. We'll link it to your application by your name.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn sm navy" type="button" data-copy-link="guarantor-form">Copy form link</button><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("Please complete the FastCred guarantor form for my loan application: "+location.href.split("#")[0]+"#guarantor-form")}">Share on WhatsApp</a></div></div>`;
 return ""}
function bindStep(){const form=$("#appForm");
 form.oninput=form.onchange=e=>{const t=e.target;if(!t.name||t.type==="file")return;app.data[t.name]=t.type==="checkbox"?t.checked:t.value;const f=t.closest(".f");if(f)f.classList.remove("err");
  if(t.name==="product"){$("#purposeWrap").innerHTML=purposeHTML();$("#prodErr").style.display="none";delete app.data.purpose}
  if(t.name==="gMode"){$("#gBlock").innerHTML=gBlockHTML()}
  if(t.name==="amount"||t.name==="term"||t.name==="product")paintQuote();saveDraft()};
 if($("#purposeWrap"))$("#purposeWrap").innerHTML=purposeHTML();if($("#gBlock"))$("#gBlock").innerHTML=gBlockHTML();
 paintQuote();if(app.step===5)bindUploads(form,"files",docList);
 $$("[data-goto]",form).forEach(b=>b.onclick=()=>{app.step=+b.dataset.goto;paintStep(true)});
 const back=$("#back");if(back)back.onclick=()=>{app.step--;paintStep(true)};
 form.onsubmit=e=>{e.preventDefault();if(!validate(form))return;if(app.step<STEPS.length-1){app.step++;app.maxStep=Math.max(app.maxStep,app.step);paintStep(true)}else submitApp()}}
function paintQuote(){const m=$("#quoteMini");if(!m)return;const a=+app.data.amount,t=+app.data.term;if(a>=C.minAmount&&a<=C.maxAmount&&t){m.hidden=false;$("#qm").textContent=money(quote(a,t).monthly)}else m.hidden=true}
function validate(form){let first=null;const mark=(el,bad)=>{const f=el.closest(".f");if(f)f.classList.toggle("err",bad);if(bad&&!first)first=el};
 $$("input:not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea",form).forEach(el=>{const v=el.value.trim();let bad=el.required&&!v;
  if(!bad&&v){const k=el.dataset.v;if(k==="phone")bad=!/^\+?[\d\s\-()]{9,16}$/.test(v);if(k==="email")bad=!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);if(k==="amount"){const n=+v.replace(/[^\d.]/g,"");bad=!(n>=C.minAmount&&n<=C.maxAmount)}
   if(k==="adult"){const d=new Date(v),n=new Date();const age=n.getFullYear()-d.getFullYear()-((n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))?1:0);bad=isNaN(age)||age<18||age>100}}
  mark(el,bad)});
 $$("[data-radio][data-req]",form).forEach(g=>{const n=g.dataset.radio;const ok=$$(`input[name="${n}"]`,g).some(r=>r.checked);g.classList.toggle("err",!ok);if(n==="product"){$("#prodErr").style.display=ok?"none":"block"}if(!ok&&!first)first=$("input",g)});
 $$("[data-check]",form).forEach(g=>{const c=$("input",g);g.classList.toggle("err",!c.checked);if(!c.checked&&!first)first=c});
 $$(".upload",form).forEach(b=>{const x=(b.dataset.bag==="gFiles"?gDocList():b.dataset.bag==="trkFiles"?trkDocs():docList()).find(z=>z.k===b.dataset.up);const miss=x.req&&!(app[b.dataset.bag][x.k]||[]).length;$(".emsg",b).style.display=miss?"block":"none";if(miss){b.style.borderColor="var(--danger)";if(!first)first=$("label.btn",b)}else b.style.borderColor=""});
 if(first){first.focus();first.scrollIntoView({behavior:"smooth",block:"center"});toast("Please check the highlighted fields");return false}return true}

const refNo=pre=>{const d=new Date();return `${pre}-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.random().toString(36).slice(2,6).toUpperCase()}`};
function summaryText(ref){const q=quote(+app.data.amount,+app.data.term);let t=`FASTCRED LOAN APPLICATION\nRef: ${ref}\n\n`;
 SECTIONS.forEach(([s,_,keys])=>{const rows=keys.map(k=>[k,shown(k)]).filter(r=>r[1]!=null);if(rows.length)t+=`— ${s} —\n`+rows.map(([k,v])=>`${LABELS[k]||k}: ${v}`).join("\n")+"\n\n"});
 t+=`Calculator estimate: ${money(q.monthly)} / month, total ${money(q.total)}\nDocuments attached online: ${docList().map(x=>`${x.t}: ${(app.files[x.k]||[]).length?"yes":"no"}`).join("; ")}\nSigned: ${app.data.signature} on ${new Date().toLocaleDateString("en-GB")}`;return t}
async function submitApp(){const btn=$("#next");btn.disabled=true;btn.textContent="Sending application…";let ref=refNo("FC"),sent=false,docsOk=true;
 if(HAS_BK){let res=null;
  try{const payload={...app.data,productName:prod(app.data.product)?.name,isBusiness:isBiz(),notifyChannel:CHAN[app.data.notifyChannel]||"sms"};
   res=await sb.rpc("submit_application",{p:payload});ref=res.ref;sent=true;
   await uploadAll(res.upload_token,app.files,docList(),(i,n)=>{btn.textContent=`Uploading documents ${i} of ${n}…`});
  }catch(e){if(!res){btn.disabled=false;btn.textContent="Submit application";toast(e.message);if(e.user)return;}else docsOk=false}
  if(sent)store.set("fc_last",{ref,mobile:app.data.mobile});
 }
 const text=summaryText(ref);doneScreen($("#appForm"),{ref,sent,text,name:(app.data.fullName||"").split(" ")[0],kind:"application",docsOk});
 if(sent){store.del("fc_draft");app.data={};app.files={};app.step=0;app.maxStep=0}
 $("#stepper").innerHTML="";$("#progM").innerHTML=""}
function doneScreen(form,{ref,sent,text,name,kind,docsOk=true}){form.classList.add("done-card");form.onsubmit=e=>e.preventDefault();
 form.innerHTML=`<span class="badge">${ic(sent?"check":"chat",'stroke-width="2.4"')}</span>
 <h2>${sent?`Thank you${name?", "+esc(name):""}. We've received your ${kind}.`:`Your ${kind} is ready to send`}</h2>
 <div class="ref" aria-label="Reference number">${esc(ref)}</div>
 <p class="lede" style="margin-inline:auto">${sent?`Keep this reference number. We've sent it to your phone too. A FastCred loans officer will call you to confirm your details and arrange the verification of your original documents.${docsOk?"":"</p><div class=\"notice\" style=\"text-align:left\">"+ic("alert")+"<div><b>Some documents did not upload.</b> Your application is saved. Open <a href=\"#track\">My loan</a> with your reference number and mobile number to add them.</div></div><p>"}`
  :"Tap <b>Send on WhatsApp</b> to deliver it to our loans team, then keep this reference number. Your uploaded documents stay on your device, so please bring the originals to our office or send them on WhatsApp when we call."}</p>
 ${sent?"":`<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn" target="_blank" rel="noopener" href="${waLink(text)}">${ic("chat",'style="width:18px;height:18px"')} Send on WhatsApp</a><button class="btn ghost" type="button" id="copySum">Copy details</button></div>
 <pre id="sumText" style="text-align:left;white-space:pre-wrap;background:var(--surface-2);padding:16px;border-radius:12px;max-height:260px;overflow:auto;font:13px/1.5 var(--f-num);width:100%">${esc(text)}</pre>`}
 <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">${sent&&kind==="application"?'<a class="btn" href="#track">Track my application</a>':""}<a class="link-arrow" href="#home">Back to home</a><a class="link-arrow" href="#blog">Read money tips</a></div>`;
 const c=$("#copySum");if(c)c.onclick=()=>copyText(text,$("#sumText"));form.scrollIntoView({behavior:"smooth",block:"start"})}

/* ---------- Track my application ---------- */
const STAGES=[["submitted","Received"],["under_review","In review"],["approved","Approved"],["disbursed","Funds released"],["closed","Repaid"]];
const STATUS_TXT={submitted:["Received","We have your application and will start reviewing it shortly.","navy"],under_review:["In review","A loans officer is reviewing your application.","navy"],more_info:["Information needed","We need something more from you before we can decide.","warn"],approved:["Approved","Your loan is approved. We will call you to sign and release the funds.",""],rejected:["Not approved","We could not approve this application.","warn"],disbursed:["Active loan","Your funds have been released. See your repayments below.",""],closed:["Fully repaid","This loan is fully repaid. Thank you.",""],withdrawn:["Withdrawn","This application was withdrawn.","navy"]};
const trk={res:null,ref:"",mobile:"",files:{}};
V.track=()=>{const last=store.get("fc_last")||{};if(!trk.ref){trk.ref=last.ref||"";trk.mobile=last.mobile||""}
 return pageHead("My loan","Check your application status, add documents and see your repayments.",[["My loan"]])+
 `<section style="padding-top:36px"><div class="wrap" style="max-width:960px;display:grid;gap:22px">
 ${HAS_BK?`<form class="fcard" id="trkForm" novalidate><div class="fgrid">
  <div class="f s3"><label for="t_ref">Reference number</label><input id="t_ref" name="ref" required placeholder="e.g. FC-261028-7Q2KD" autocapitalize="characters" value="${esc(trk.ref)}"><span class="emsg">Enter the reference number we sent you.</span></div>
  <div class="f s3"><label for="t_mob">Mobile number used to apply</label><input id="t_mob" name="mobile" required ${phoneAttrs} placeholder="+263 77 123 4567" value="${esc(trk.mobile)}"><span class="emsg">Enter a valid phone number.</span></div>
 </div><div class="form-nav" style="border:0;padding:0"><span class="saved">Lost your reference? Call ${esc(CONFIG.phones[0])}.</span><button class="btn" type="submit" id="trkBtn">Check my loan</button></div></form>
 <div id="trkOut" style="display:grid;gap:22px"></div>`
 :`<div class="card"><h3>Online tracking is coming soon</h3><p>For now, call or WhatsApp us on ${CONFIG.phones.map(esc).join(" or ")} with your reference number.</p></div>`}
 </div></section>`};
function trkDocs(){return [{k:"extra",t:"Document",d:"Photo or PDF of the document we asked for",req:true,multi:true}]}
function paintTrack(){const r=trk.res,out=$("#trkOut");if(!out||!r)return;
 if(!r.found){out.innerHTML=`<div class="notice">${ic("alert")}<div><b>We couldn't find that application.</b> Check the reference number and use the same mobile number you applied with. Still stuck? Call ${esc(CONFIG.phones[0])}.</div></div>`;return}
 const [st,desc,tone]=STATUS_TXT[r.status]||[r.status,"",""];const idx=r.status==="more_info"?1:r.status==="rejected"?2:STAGES.findIndex(s=>s[0]===r.status);
 const amt=r.approved_amount||r.amount,term=r.approved_term||r.term;
 const inst=r.installments||[];const next=inst.find(i=>i.status!=="paid");
 out.innerHTML=`<div class="fcard">
  <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start"><div style="display:grid;gap:6px"><span class="muted num">${esc(r.ref)} · ${esc(r.product)}</span><h2 style="font-size:1.7rem">${esc(st)}</h2><p class="muted">${esc(desc)}</p></div><span class="chip ${tone}" style="font-size:.9rem">${esc(st)}</span></div>
  ${r.status!=="withdrawn"?`<ol class="track-stages">${STAGES.map((s,i)=>`<li class="${r.status==="rejected"&&i===2?"bad":i<idx||(i===idx&&["closed"].includes(r.status))?"done":i===idx?"cur":""}"><span></span><b>${r.status==="rejected"&&i===2?"Not approved":s[1]}</b></li>`).join("")}</ol>`:""}
  ${r.reason?`<div class="notice" ${r.status==="approved"?'style="background:var(--leaf-soft);border-color:var(--line)"':""}>${ic(r.status==="approved"?"check":"alert",r.status==="approved"?'style="color:var(--leaf-ink)"':"")}<div><b ${r.status==="approved"?'style="color:var(--leaf-ink)"':""}>${r.status==="more_info"?"What we need from you":r.status==="rejected"?"Reason":"Note from our loans team"}</b><br>${esc(r.reason)}</div></div>`:""}
  <dl class="kv num"><div><dt>${r.approved_amount?"Approved amount":"Amount requested"}</dt><dd>${money(amt)}</dd></div><div><dt>Repayment period</dt><dd>${term} month${term>1?"s":""}</dd></div>${r.total?`<div><dt>Balance</dt><dd>${money(r.balance)}</dd></div>`:""}${next?`<div><dt>Next repayment</dt><dd>${money(next.amount-next.paid)} on ${fmtDate(next.due)}</dd></div>`:""}</dl>
 </div>
 ${inst.length?`<div class="fcard"><h3>Repayment schedule</h3><div class="sched-wrap"><table class="sched num"><thead><tr><th>Instalment</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead><tbody>${inst.map(i=>`<tr><td>${i.n}</td><td>${fmtDate(i.due)}</td><td>${money(i.amount)}</td><td>${money(i.paid)}</td><td><span class="chip ${i.status==="overdue"?"warn":i.status==="paid"?"":"navy"}">${i.status==="paid"?"Paid":i.status==="overdue"?"Overdue":"Due"}</span></td></tr>`).join("")}</tbody></table></div><p class="muted">Always pay through official FastCred channels and keep your receipt.</p></div>`:""}
 ${r.can_upload?`<form class="fcard" id="trkUp" novalidate><div style="display:grid;gap:6px"><h3>${r.status==="more_info"?"Upload what we asked for":"Add documents"}</h3><p class="muted">Photos or PDFs up to ${CONFIG.maxFileMB} MB each. Our team is notified when you upload.</p></div>
  <div class="f s6"><label for="t_kind">What are you uploading?</label><select id="t_kind" name="kind">${["Copy of ID","Proof of residence","Payslip","Bank statements / sales records","Purchase order or invoice","Quotation","Guarantor documents","Other"].map(x=>`<option>${x}</option>`).join("")}</select></div>
  <div id="trkBox">${uploadBox(trkDocs()[0],"trkFiles","tup")}</div>
  <div class="form-nav" style="border:0;padding:0"><span class="saved"></span><button class="btn" type="submit" id="trkUpBtn">Upload documents</button></div></form>`:""}
 <div class="grid-2"><div class="fcard"><h3>History</h3><ol class="timeline">${(r.events||[]).slice().reverse().map(e=>`<li><time>${new Date(e.at).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</time><span>${esc(e.note)}</span></li>`).join("")}</ol></div>
 <div class="fcard"><h3>Documents received</h3>${(r.documents||[]).length?`<ul class="doclist">${r.documents.map(d=>`<li>${ic(d.verified?"check":"file")}<div><b>${esc(d.label)}</b><small>${esc(d.name||"")}${d.verified?" · verified":""}</small></div></li>`).join("")}</ul>`:`<p class="muted">No documents yet.</p>`}</div></div>`;
 const up=$("#trkUp");if(up){app.trkFiles={};bindUploads(up,"trkFiles",trkDocs);up.onsubmit=async e=>{e.preventDefault();if(!validate(up))return;const b=$("#trkUpBtn");b.disabled=true;
  const label=$("#t_kind").value;try{const n=await uploadAll(r.upload_token,app.trkFiles,[{k:"extra",t:label}],(i,t)=>{b.textContent=`Uploading ${i} of ${t}…`});toast(`${n} document${n>1?"s":""} uploaded`);await runTrack()}catch(err){toast(err.message);b.disabled=false;b.textContent="Upload documents"}}}}
async function runTrack(){const b=$("#trkBtn");if(b){b.disabled=true;b.textContent="Checking…"}
 try{trk.res=await sb.rpc("track_application",{p_ref:trk.ref.trim(),p_mobile:trk.mobile});if(trk.res.found)store.set("fc_last",{ref:trk.res.ref,mobile:trk.mobile});paintTrack()}catch(e){toast(e.message)}
 if(b){b.disabled=false;b.textContent="Check my loan"}}
function bindTrack(){const f=$("#trkForm");if(!f)return;f.onsubmit=e=>{e.preventDefault();if(!validate(f))return;trk.ref=$("#t_ref").value;trk.mobile=$("#t_mob").value;runTrack()};if(trk.res)paintTrack()}

/* ---------- Standalone guarantor form ---------- */
const gd={};
function gDocList(){return [{k:"gid",t:"Copy of your ID",d:"National ID or passport",req:true},{k:"gres",t:"Current proof of residence",d:"Utility bill, lease or landlord's letter",req:true},{k:"gpay",t:"Latest payslip and 3 months' bank statements",d:"For salaried guarantors. Self-employed: bank statements or sales records",req:false,multi:true}]}
V["guarantor-form"]=()=>{const G=(n,l,o={})=>F.text(n,l,o).replace(`value="${esc(app.data[n]??"")}"`,`value="${esc(gd[n]??"")}"`).replace(/id="a_/g,'id="g_').replace(/for="a_/g,'for="g_');
 const R=(n,l,opts,o={})=>`<div class="f ${o.s||""}" data-radio="${n}" ${o.req===false?"":"data-req"}><span class="lab">${l}</span><div class="opts">${opts.map((x,i)=>`<label><input type="radio" id="g_${n}_${i}" name="${n}" value="${esc(x)}" ${gd[n]===x?"checked":""}>${esc(x)}</label>`).join("")}</div><span class="emsg">Choose one.</span></div>`;
 const A=(n,l,o={})=>`<div class="f ${o.s||"s6"}"><label for="g_${n}">${l}</label><textarea id="g_${n}" name="${n}" ${o.req===false?"":"required"} rows="2">${esc(gd[n]??"")}</textarea><span class="emsg">This field is required.</span></div>`;
 return pageHead("Loan guarantor form","Complete this form if you are standing as guarantor for a FastCred loan. Please read the certification and consent before you sign.",[["Guarantors","guarantors"],["Guarantor form"]])+
 `<section style="padding-top:36px"><div class="wrap" style="max-width:920px"><form class="fcard" id="gForm" novalidate>
 <fieldset><legend>Guarantor personal information</legend><div class="fgrid">
  ${G("fullName","Full name",{s:"s4",attrs:'autocomplete="name"'})}${R("gender","Gender",["Male","Female"],{s:"s2"})}
  ${G("dob","Date of birth",{type:"date",s:"s2",attrs:'data-v="adult"',err:"You must be 18 or older."})}${G("nationality","Nationality",{s:"s2"})}${G("idNumber","ID number",{s:"s2"})}
  ${R("civilStatus","Civil status",["Single","Married","Widowed","Separated","Other"],{s:"s6"})}
  ${G("spouseName","Spouse full name (if married)",{s:"s4",req:false})}${G("spousePhone","Spouse phone",{s:"s2",req:false,attrs:phoneAttrs})}
  ${R("homeOwnership","Home ownership",["Owned","Family house","Rented","Other"],{s:"s4"})}${G("lengthOfStay","Length of stay",{s:"s2"})}
  ${A("homeAddress","Home address")}
  ${G("phone","Phone number",{s:"s3",attrs:phoneAttrs,err:"Enter a valid phone number."})}${G("email","Email address",{type:"email",s:"s3",req:false,attrs:'data-v="email"',err:"Enter a valid email address."})}
 </div></fieldset>
 <fieldset><legend>Employment information</legend>${R("workType","Are you employed or self-employed?",["Employed","Self-employed"],{s:"s6"})}<div class="fgrid" id="gWork"></div></fieldset>
 <fieldset><legend>Loan guarantee statement</legend><div class="fgrid">
  ${G("loanee","I/We stand as guarantor for a loan applied for by (borrower's full name)",{s:"s6"})}
  <div class="f s3"><label for="g_loanType">Loan type</label><select id="g_loanType" name="loanType" required><option value="">Select…</option>${PRODUCTS.map(p=>`<option ${gd.loanType===p.name?"selected":""}>${esc(p.name)}</option>`).join("")}</select><span class="emsg">Choose an option.</span></div>
  ${G("relation","Relationship with borrower",{s:"s3"})}
  ${G("applicationRef","Borrower's application reference, if you have it",{s:"s6",req:false,ph:"e.g. FC-261028-7Q2KD",hint:"Ask the borrower for the reference number we sent them. It links this form to their application.",attrs:'autocapitalize="characters"'})}
 </div></fieldset>
 <fieldset><legend>Documents</legend><div style="display:grid;gap:12px">${gDocList().map(x=>uploadBox(x,"gFiles","gup")).join("")}</div></fieldset>
 <fieldset><legend>Certification and consent</legend><div class="legal-box">
  <p><b>Certification.</b> The undersigned certifies that, to the best of my/our knowledge and belief, all information contained in this loan guarantor form and the accompanying statements and documents is true, complete and correct. The undersigned agrees to notify FastCred Financial Services immediately of any material changes in this information. Further, the undersigned assures to make prompt and timely repayments as per the agreement. In the event of non-compliance, the undersigned hereby authorises FastCred Financial Services to take legal action as per FastCred Financial Services Pvt Ltd norms.</p>
  <p><b>Consent clause.</b> The parties hereunto in their respective capacities declare that all the information furnished herewith is correct to the best of my/our knowledge and ability, and consent to disclose and share all or such information required by FastCred Financial Services Pvt Ltd to do such acts, deeds or things as are deemed necessary to facilitate the Credit Information Bureau to ascertain the accuracy of information. The parties consent to the use of my/our demographic and credit information by the Credit Information Bureau and other credit reporting entities.</p></div>
  <div class="f s6" data-check="agree"><label style="display:flex;gap:10px;align-items:flex-start;font-weight:500"><input type="checkbox" id="g_agree" name="agree" ${gd.agree?"checked":""} style="accent-color:var(--leaf);width:20px;height:20px;margin-top:2px;flex-shrink:0"> I have read and accept the certification and consent clause, and I understand that as guarantor I may be required to repay this loan.</label><span class="emsg">Please confirm to continue.</span></div>
  <div class="fgrid">${G("signature","Type your full name as your signature",{s:"s4"})}<div class="f s2"><span class="lab">Date</span><div class="num" style="padding:.75em 0;font-weight:600">${new Date().toLocaleDateString("en-GB")}</div></div></div>
 </fieldset>
 <div class="form-nav"><span class="saved">Your documents are sent securely when you submit.</span><button class="btn" type="submit" id="gNext">Submit guarantor form</button></div>
 </form></div></section>`};
function bindGForm(){const form=$("#gForm");if(!form)return;
 const work=()=>{const self=gd.workType==="Self-employed";const G=(n,l,o={})=>F.text(n,l,o).replace(`value="${esc(app.data[n]??"")}"`,`value="${esc(gd[n]??"")}"`).replace(/id="a_/g,'id="g_').replace(/for="a_/g,'for="g_');
  $("#gWork").innerHTML=!gd.workType?"":self?`${G("bizName","Name of business",{s:"s3"})}${G("bizStart","Date of start",{type:"date",s:"s3"})}${G("bizNature","Nature of business",{s:"s3"})}${G("bizAddress","Business address",{s:"s3"})}${G("grossProfit","Gross profit per month (US$)",{s:"s3",attrs:'inputmode="numeric"'})}${G("netProfit","Net profit per month (US$)",{s:"s3",attrs:'inputmode="numeric"'})}`
  :`${G("employer","Name of employer",{s:"s4"})}${G("jobTitle","Job title",{s:"s2"})}${G("grossSalary","Gross monthly salary (US$)",{s:"s2",attrs:'inputmode="numeric"'})}${G("netSalary","Net monthly salary (US$)",{s:"s2",attrs:'inputmode="numeric"'})}${G("appointment","Initial job appointment date",{type:"date",s:"s2"})}`};
 work();bindUploads(form,"gFiles",gDocList);
 form.oninput=form.onchange=e=>{const t=e.target;if(!t.name||t.type==="file")return;gd[t.name]=t.type==="checkbox"?t.checked:t.value;const f=t.closest(".f");if(f)f.classList.remove("err");if(t.name==="workType")work()};
 form.onsubmit=async e=>{e.preventDefault();if(!validate(form))return;const b=$("#gNext");b.disabled=true;b.textContent="Submitting…";let ref=refNo("FCG"),sent=false;
  if(HAS_BK){let res=null;try{res=await sb.rpc("submit_guarantor",{p:{...gd}});ref=res.ref;sent=true;await uploadAll(res.upload_token,app.gFiles,gDocList(),(i,n)=>{b.textContent=`Uploading documents ${i} of ${n}…`})}
   catch(err){if(!res){b.disabled=false;b.textContent="Submit guarantor form";toast(err.message);if(err.user)return}}}
  const text=`FASTCRED GUARANTOR FORM\nRef: ${ref}\n\n`+Object.entries(gd).filter(([k,v])=>v!==""&&k!=="agree").map(([k,v])=>`${k}: ${v}`).join("\n")+`\n\nAccepted certification & consent: yes\nDate: ${new Date().toLocaleDateString("en-GB")}`;
  doneScreen(form,{ref,sent,text,name:(gd.fullName||"").split(" ")[0],kind:"guarantor form"})}}

/* ---------- Shell ---------- */
function shell(){document.getElementById("root").innerHTML=`
<a class="skip" href="#main" onclick="event.preventDefault();document.getElementById('main').focus()">Skip to content</a>
<div class="topstrip"><div class="wrap"><span class="alert">${ic("shield",'style="width:16px;height:16px"')}<span><b>Registered micro-financier.</b> We never ask for money to release a loan.</span></span>
<span class="contacts">${CONFIG.phones.map(p=>`<span>${esc(p)}</span>`).join("")}<a href="#contact">${esc(CONFIG.addressShort)}</a></span></div></div>
<header class="site"><div class="wrap">
 <a class="brand" href="#home" id="brandLink" aria-label="FastCred Financial Services home"><img class="on-light" src="${LOGO}" alt="FastCred Financial Services"><img class="on-dark" src="${LOGO_W}" alt="FastCred Financial Services"></a>
 <nav class="main" id="nav" aria-label="Main">${[["loans","Loans"],["calculator","Loan calculator"],["guarantors","Guarantors"],["about","About"],["blog","Blog"],["contact","Contact"],["track","My loan"]].map(([h,t])=>`<a href="#${h}" data-nav="${h}">${t}</a>`).join("")}</nav>
 <div class="header-cta"><a class="btn ghost sm" href="#contact">${ic("phone",'style="width:16px;height:16px"')} Call us</a><a class="btn sm" href="#apply">Apply now</a></div>
 <button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="nav">${ic("menu")}</button>
</div></header>
<main id="main" tabindex="-1"></main>
<footer class="site"><div class="wrap">
 <div class="f-top">
  <div class="f-brand"><img src="${LOGO_W}" alt="FastCred Financial Services"><p>Fast, fair credit for civil servants, salaried workers and growing businesses in Zimbabwe.</p></div>
  <div><h4>Loans</h4><ul>${PRODUCTS.map(p=>`<li><a href="#loan-${p.slug}">${esc(p.name)}</a></li>`).join("")}</ul></div>
  <div><h4>Company</h4><ul><li><a href="#about">About us</a></li><li><a href="#apply">Apply online</a></li><li><a href="#calculator">Loan calculator</a></li><li><a href="#track">Track my loan</a></li><li><a href="#guarantor-form">Guarantor form</a></li><li><a href="#blog">Blog</a></li><li><a href="#faq">FAQ</a></li><li><a href="#complaints">Complaints</a></li></ul></div>
  <div><h4>Visit us today</h4><ul><li>${esc(CONFIG.address)}</li>${CONFIG.phones.map(p=>`<li class="num">${esc(p)}</li>`).join("")}<li>${esc(CONFIG.email)}</li></ul></div>
 </div>
 <div class="f-bottom"><span>© ${new Date().getFullYear()} ${esc(CONFIG.legalName)}. Registered by the Reserve Bank of Zimbabwe as a credit-only microfinance institution.</span><span><a href="#privacy">Privacy</a> · <a href="#terms">Terms</a> · <a href="#complaints">Complaints</a></span></div>
</div></footer>
<nav class="mbar" aria-label="Quick actions"><a href="#contact">${ic("phone")}Call</a><a href="${waLink("Hello FastCred, ")}" target="_blank" rel="noopener">${ic("chat")}WhatsApp</a><a class="btn" href="#apply">Apply now</a></nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
 const mb=$("#menuBtn"),nav=$("#nav");mb.onclick=()=>{const o=nav.classList.toggle("open");mb.setAttribute("aria-expanded",o);mb.innerHTML=ic(o?"close":"menu")};
 document.addEventListener("click",e=>{const l=e.target.closest("[data-copy-link]");if(l){e.preventDefault();copyText(location.href.split("#")[0]+"#"+l.dataset.copyLink,l)}
  const pr=e.target.closest("[data-prod]");if(pr){app.data.product=pr.dataset.prod;saveDraft()}})}

const TITLES={track:"My loan",home:"FastCred Financial Services",loans:"Loans",calculator:"Loan calculator",apply:"Apply for a loan",guarantors:"Guarantors","guarantor-form":"Guarantor form",about:"About us",blog:"Blog",faq:"FAQ",contact:"Contact",privacy:"Privacy notice",terms:"Terms of use",complaints:"Complaints"};
function route(){let h=location.hash.slice(1)||"home";const main=$("#main");let html,navKey=h;
 if(h==="main"||h==="how-it-works"){return}
 if(h.startsWith("loan-")){html=V.loan(h.slice(5));navKey="loans"}
 else if(h.startsWith("post-")){html=V.post(h.slice(5));navKey="blog"}
 else if(legal[h])html=V.legal(h);
 else if(V[h]&&!["loan","post","legal","notfound"].includes(h))html=V[h]();
 else html=V.notfound();
 main.innerHTML=`<div class="view">${html}</div>`;
 $$("[data-nav]").forEach(a=>{if(a.dataset.nav===navKey)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
 $("#nav").classList.remove("open");$("#menuBtn").innerHTML=ic("menu");$("#menuBtn").setAttribute("aria-expanded","false");
 const pt=h.startsWith("post-")?(POSTS.find(p=>p.slug===h.slice(5))||{}).title:h.startsWith("loan-")?(prod(h.slice(5))||{}).name:TITLES[h];
 document.title=(pt&&h!=="home"?pt+" · ":"")+"FastCred Financial Services";
 window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"});
 bindCalc("calcHome");bindCalc("calcPage");
 if(h==="apply"){app.step=Math.min(app.step,STEPS.length-1);paintStep(false)}
 if(h==="guarantor-form")bindGForm();
 if(h==="track")bindTrack();
 if(h==="blog"){paintPosts();$$("[data-cat]").forEach(b=>b.onclick=()=>{app.blogCat=b.dataset.cat;$$("[data-cat]").forEach(x=>x.setAttribute("aria-pressed",x===b));paintPosts()});$("#blogQ").oninput=e=>{app.blogQ=e.target.value;paintPosts()}}
 if(h==="contact"){const f=$("#contactForm");f.onsubmit=e=>{e.preventDefault();if(!validate(f))return;const d=Object.fromEntries(new FormData(f));const t=`Hello FastCred,\n\nName: ${d.name}\nPhone: ${d.phone}\nTopic: ${d.topic}\n\n${d.msg}`;f.innerHTML=`<div class="done-card" style="display:grid;gap:14px"><span class="badge">${ic("chat")}</span><h2 style="font-size:1.4rem">Your message is ready</h2><p class="muted">Tap below to send it to us on WhatsApp. You can also call us on ${esc(CONFIG.phones[0])}.</p><a class="btn" target="_blank" rel="noopener" href="${waLink(t)}">Send on WhatsApp</a></div>`;f.classList.add("done-card")}}
 // in-artifact: make outbound mailto/tel never the only route (numbers are shown as text everywhere)
}
shell();window.addEventListener("hashchange",route);route();
})();
