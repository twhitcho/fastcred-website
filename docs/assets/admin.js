(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"US$"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const dt=d=>d?new Date(d).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";
const dd=d=>d?new Date(String(d).length===10?d+"T00:00:00":d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"";
const ago=d=>{const s=(Date.now()-new Date(d))/1000;if(s<90)return"just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"};
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const addMonths=(iso,n)=>{const d=new Date(iso+"T00:00:00");const day=d.getDate();d.setMonth(d.getMonth()+n);if(d.getDate()<day)d.setDate(0);return d.toISOString().slice(0,10)};
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),3200)}
const ICON={file:'<path d="M6 2h8l6 6v14H6z"/><path d="M14 2v6h6"/>',check:'<path d="M5 12.5l4.2 4.2L19 7"/>',open:'<path d="M14 3h7v7M10 14L21 3M19 14v6H4V5h6"/>'};
const ic=(n,a="")=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${a}>${ICON[n]}</svg>`;

const BK=window.FASTCRED_BACKEND||{};
const root=$("#root");
if(!BK.url||!BK.key||!window.supabase){root.innerHTML=`<div class="login"><div class="fcard"><img src="assets/logo.png" alt="FastCred Financial Services"><h2>Loans desk not connected</h2><p class="muted">Add the Supabase Project URL and anon key to <b>assets/config.js</b>, then reload this page.</p></div></div>`;return}
const db=window.supabase.createClient(BK.url,BK.key,{auth:{persistSession:true,autoRefreshToken:true}});

const ST={submitted:"New",under_review:"In review",more_info:"Info requested",approved:"Approved",rejected:"Rejected",disbursed:"Active loan",closed:"Repaid",withdrawn:"Withdrawn"};
const pill=(s,label)=>`<span class="pill ${esc(s)}">${esc(label||ST[s]||s)}</span>`;
const LABEL={product:"Loan",amount:"Amount (US$)",term:"Months",loanType:"New / repeat",purpose:"Purpose",purposeDetail:"Use of funds",fullName:"Full name",nickname:"Nickname",gender:"Gender",dob:"Date of birth",nationality:"Nationality",idNumber:"ID number",civilStatus:"Civil status",homeAddress:"Home address",homeOwnership:"Home ownership",lengthOfStay:"Length of stay",permanentAddress:"Permanent address",mobile:"Mobile",notifyChannel:"Updates by",homePhone:"Home phone",officePhone:"Office phone",email:"Email",dependents:"Dependents",dependentAges:"Ages of dependents",employer:"Employer",jobTitle:"Job title",ecNumber:"EC number",employmentType:"Employment type",appointmentDate:"Date joined",payday:"Payday",grossSalary:"Gross salary (US$)",netSalary:"Net salary (US$)",employerAddress:"Employer address",bizName:"Business name",bizPosition:"Position",bizForm:"Ownership",bizAddress:"Business address",bizPhone:"Business phone",bizNature:"Nature of business",bizYears:"Years in business",bizSales:"Monthly sales (US$)",bizReg:"Registration no.",kinName:"Name",kinPhone:"Phone",kinRelation:"Relationship",kinGender:"Gender",kinAddress:"Address",gMode:"Guarantor",gName:"Name",gGender:"Gender",gDob:"Date of birth",gId:"ID number",gPhone:"Phone",gEmail:"Email",gAddress:"Address",gEmployer:"Employer / business",gIncome:"Net income (US$)",gRelation:"Relationship",signature:"Signed as",
 spouseName:"Spouse",spousePhone:"Spouse phone",phone:"Phone",workType:"Work type",bizStart:"Business started",grossProfit:"Gross profit / month",netProfit:"Net profit / month",appointment:"Appointment date",loanee:"Borrower",relation:"Relationship",applicationRef:"Application ref",loanType_g:"Loan type"};
["1","2"].forEach(i=>Object.assign(LABEL,{[`ref${i}Name`]:"Name",[`ref${i}Phone`]:"Phone",[`ref${i}Relation`]:"Relationship",[`ref${i}Gender`]:"Gender",[`ref${i}Email`]:"Email",[`ref${i}Address`]:"Address"}));
const GROUPS=[["Applicant",["fullName","nickname","gender","dob","nationality","idNumber","civilStatus","mobile","notifyChannel","homePhone","officePhone","email","dependents","dependentAges"]],["Residence",["homeAddress","homeOwnership","lengthOfStay","permanentAddress"]],
 ["Employment",["employer","jobTitle","ecNumber","employmentType","appointmentDate","payday","grossSalary","netSalary","employerAddress"]],["Business",["bizName","bizPosition","bizForm","bizAddress","bizPhone","bizNature","bizYears","bizSales","bizReg"]],
 ["Next of kin",["kinName","kinPhone","kinRelation","kinGender","kinAddress"]],["Reference 1",["ref1Name","ref1Phone","ref1Relation","ref1Gender","ref1Email","ref1Address"]],["Reference 2",["ref2Name","ref2Phone","ref2Relation","ref2Gender","ref2Email","ref2Address"]],
 ["Guarantor (from application)",["gMode","gName","gGender","gDob","gId","gPhone","gEmail","gAddress","gEmployer","gIncome","gRelation"]],["Loan request",["loanType","purpose","purposeDetail","signature"]]];
const fieldsHTML=(data,keys)=>{const rows=keys.filter(k=>data[k]!=null&&data[k]!==""&&data[k]!==false);return rows.length?`<dl class="fields">${rows.map(k=>`<div><dt>${esc(LABEL[k]||k)}</dt><dd>${esc(data[k])}</dd></div>`).join("")}</dl>`:""};

const S={me:null,staff:[],apps:[],filter:"open",q:"",settings:{},cur:null};
const staffName=id=>(S.staff.find(s=>s.user_id===id)||{}).full_name||"";
const isMgr=()=>["manager","admin"].includes(S.me?.role);
const setting=(k,d)=>S.settings[k]??d;

async function act(appId,action,payload,okMsg){try{const {data,error}=await db.rpc("staff_action",{p_app:appId,p_action:action,p:payload||{}});if(error)throw error;toast(okMsg||"Saved");await openApp(appId,true);return data}catch(e){toast(e.message||String(e));return null}}

/* ---------- Auth ---------- */
function loginView(msg){root.innerHTML=`<div class="login"><form class="fcard" id="lf" novalidate>
 <img src="assets/logo.png" alt="FastCred Financial Services"><header><h2 style="font-size:1.5rem">Loans desk</h2><p class="muted">Sign in with your FastCred staff account.</p></header>
 ${msg?`<div class="notice">${esc(msg)}</div>`:""}
 <div class="f s6"><label for="le">Email</label><input id="le" type="email" autocomplete="username" required></div>
 <div class="f s6"><label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password" required></div>
 <div class="form-nav" style="border:0;padding:0"><button type="button" class="mini" id="forgot">Forgot password?</button><button class="btn" type="submit" id="lb">Sign in</button></div>
 <p class="muted" style="font-size:.85rem">Staff accounts are created by your administrator. <a href="./">Back to the website</a></p></form></div>`;
 $("#lf").onsubmit=async e=>{e.preventDefault();const b=$("#lb");b.disabled=true;b.textContent="Signing in…";const {error}=await db.auth.signInWithPassword({email:$("#le").value.trim(),password:$("#lp").value});if(error){b.disabled=false;b.textContent="Sign in";toast(error.message==="Invalid login credentials"?"Email or password is incorrect.":error.message)}else boot()};
 $("#forgot").onclick=async()=>{const em=$("#le").value.trim();if(!em){toast("Type your email first, then tap Forgot password.");return}const {error}=await db.auth.resetPasswordForEmail(em,{redirectTo:location.href.split("#")[0]+"#reset"});toast(error?error.message:"Check your email for a link to set a new password.")}}
function resetView(){root.innerHTML=`<div class="login"><form class="fcard" id="rf" novalidate><img src="assets/logo.png" alt="FastCred"><h2 style="font-size:1.4rem">Set a new password</h2>
 <div class="f s6"><label for="np">New password (at least 10 characters)</label><input id="np" type="password" autocomplete="new-password" minlength="10" required></div>
 <button class="btn" type="submit">Save password</button></form></div>`;
 $("#rf").onsubmit=async e=>{e.preventDefault();const p=$("#np").value;if(p.length<10){toast("Use at least 10 characters.");return}const {error}=await db.auth.updateUser({password:p});if(error)toast(error.message);else{toast("Password saved");location.hash="dashboard";boot()}}}

async function boot(){
 if(location.hash==="#reset"||/type=recovery/.test(location.hash)){const {data}=await db.auth.getSession();if(data.session){resetView();return}}
 const {data:{session}}=await db.auth.getSession();if(!session){loginView();return}
 const uid=session.user.id;
 const [{data:me},{data:staff},{data:sets}]=await Promise.all([db.from("staff").select("*").eq("user_id",uid).maybeSingle(),db.from("staff").select("*"),db.from("settings").select("*")]);
 if(!me||!me.active){await db.auth.signOut();loginView("This login is not set up as FastCred staff. Ask your administrator to add you.");return}
 S.me=me;S.staff=staff||[];S.settings=Object.fromEntries((sets||[]).map(s=>[s.key,s.value]));
 shell();window.onhashchange=route;route()}
db.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT")loginView();if(ev==="PASSWORD_RECOVERY")resetView()});

function shell(){root.innerHTML=`<header class="bar"><div class="wrap"><a href="#dashboard"><img src="assets/logo_white.png" alt="FastCred loans desk"></a>
 <nav aria-label="Loans desk">${[["dashboard","Dashboard"],["apps","Applications"],["loans","Loans & repayments"],["guarantors","Guarantors"],["messages","Messages"],["settings","Settings"]].map(([h,t])=>`<a href="#${h}" data-nav="${h}">${t}</a>`).join("")}</nav>
 <div class="me"><span class="who">${esc(S.me.full_name)} · ${esc(S.me.role)}</span><button id="so" type="button">Sign out</button></div></div></header><main class="desk" id="main"></main>`;
 $("#so").onclick=()=>db.auth.signOut()}

async function loadApps(){const {data,error}=await db.from("applications").select("id,ref,created_at,updated_at,client_updated_at,product,product_name,amount,term,applicant_name,mobile,status,assigned_to,is_business,approved_amount,approved_term,decided_at").order("created_at",{ascending:false}).limit(1000);if(error){toast(error.message);return}S.apps=data||[]}

function route(){const h=location.hash.slice(1)||"dashboard";const nav=h.startsWith("app-")?"apps":h;
 $$("[data-nav]").forEach(a=>a.dataset.nav===nav?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current"));
 if(h.startsWith("app-"))return openApp(h.slice(4));
 ({dashboard:viewDash,apps:viewApps,loans:viewLoans,guarantors:viewGuarantors,messages:viewMessages,settings:viewSettings}[h]||viewDash)()}
const main=()=>$("#main");
const loading=()=>{main().innerHTML=`<div class="empty-s">Loading…</div>`};

/* ---------- Dashboard ---------- */
async function viewDash(){loading();await loadApps();
 const [{data:inst},{data:fails}]=await Promise.all([db.from("installments").select("*,applications(id,ref,applicant_name,mobile)").neq("status","paid").lte("due_date",addMonths(today(),1)).order("due_date").limit(100),db.from("outbox").select("id",{count:"exact"}).eq("status","failed")]);
 const c=s=>S.apps.filter(a=>a.status===s).length;const over=(inst||[]).filter(i=>i.status==="overdue");const soon=(inst||[]).filter(i=>i.status!=="overdue"&&i.due_date<=addMonths(today(),0).slice(0,8)+"31");
 const waiting=S.apps.filter(a=>["submitted","under_review","more_info"].includes(a.status)&&a.client_updated_at&&a.client_updated_at>a.updated_at);
 main().innerHTML=`<div class="row sb"><h1>Good ${new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, ${esc(S.me.full_name.split(" ")[0])}</h1><a class="btn sm" href="#apps">Open applications</a></div>
 <div class="tiles4">
  ${[["submitted","New applications","var(--navy)"],["under_review","In review","var(--navy)"],["more_info","Waiting for client","var(--warn)"],["approved","Approved, not yet paid out","var(--leaf)"],["disbursed","Active loans","var(--forest)"]].map(([s,l,t])=>`<a class="tile" style="--tone:${t}" href="#apps" data-f="${s}"><b>${c(s)}</b><span>${l}</span></a>`).join("")}
  <a class="tile" style="--tone:var(--danger)" href="#loans"><b>${over.length}</b><span>Overdue instalments</span></a>
 </div>
 ${(fails?.length||0)?`<div class="notice">${ic("file")}<div><b>${fails.length} message${fails.length>1?"s":""} failed to send.</b> <a href="#messages">Check the messages log</a>.</div></div>`:""}
 <div class="grid-2">
  <div class="panel"><h3>New documents from clients <small>${waiting.length}</small></h3>${waiting.length?appTable(waiting.slice(0,8),true):`<p class="muted">Nothing new. Clients' uploads after you asked for information appear here.</p>`}</div>
  <div class="panel"><h3>Overdue & due this month <small>${(inst||[]).length}</small></h3>${(inst||[]).length?`<div class="tbl-wrap"><table class="tbl" style="min-width:480px"><thead><tr><th>Due</th><th>Client</th><th class="r">Outstanding</th><th>Status</th></tr></thead><tbody>${inst.slice(0,10).map(i=>`<tr data-go="${i.applications?.id}"><td class="num">${dd(i.due_date)}</td><td>${esc(i.applications?.applicant_name)}<span class="sub num">${esc(i.applications?.ref)} · #${i.n}</span></td><td class="r num">${money(i.amount-i.paid_amount)}</td><td>${pill(i.status,i.status==="overdue"?"Overdue":"Due")}</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">No repayments due in the next month.</p>`}</div>
 </div>
 <div class="panel"><h3>Latest applications</h3>${S.apps.length?appTable(S.apps.slice(0,8)):`<p class="muted">No applications yet. They appear here as soon as someone applies on the website.</p>`}</div>`;
 $$("[data-f]").forEach(a=>a.onclick=()=>{S.filter=a.dataset.f});bindRows()}
function appTable(list,compact){return `<div class="tbl-wrap"><table class="tbl" ${compact?'style="min-width:520px"':""}><thead><tr><th>Reference</th><th>Applicant</th><th>Loan</th><th class="r">Amount</th>${compact?"":"<th>Officer</th>"}<th>Status</th><th>Received</th></tr></thead><tbody>
 ${list.map(a=>`<tr data-go="${a.id}"><td class="num">${esc(a.ref)}${a.client_updated_at&&a.client_updated_at>a.updated_at&&["submitted","under_review","more_info"].includes(a.status)?'<span class="dot" title="New client activity"></span>':""}</td><td>${esc(a.applicant_name)}<span class="sub num">${esc(a.mobile)}</span></td><td>${esc(a.product_name||a.product)}</td><td class="r num">${money(a.approved_amount||a.amount)}<span class="sub">${a.approved_term||a.term} mo</span></td>${compact?"":`<td>${esc(staffName(a.assigned_to))||'<span class="muted">—</span>'}</td>`}<td>${pill(a.status)}</td><td>${ago(a.created_at)}</td></tr>`).join("")}</tbody></table></div>`}
function bindRows(){$$("tr[data-go]").forEach(r=>{r.tabIndex=0;r.onclick=()=>{location.hash="app-"+r.dataset.go};r.onkeydown=e=>{if(e.key==="Enter")r.click()}})}

/* ---------- Applications ---------- */
async function viewApps(){loading();await loadApps();
 const F={open:["submitted","under_review","more_info","approved"],submitted:["submitted"],under_review:["under_review"],more_info:["more_info"],approved:["approved"],disbursed:["disbursed"],rejected:["rejected"],closed:["closed","withdrawn"],all:null};
 const cnt=k=>F[k]?S.apps.filter(a=>F[k].includes(a.status)).length:S.apps.length;
 main().innerHTML=`<div class="row sb"><h1>Applications</h1><label class="search">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'}<span class="sr">Search</span><input id="q" type="search" placeholder="Name, reference, phone or ID" value="${esc(S.q)}"></label></div>
 <div class="tabs" role="group" aria-label="Filter">${[["open","Needs action"],["submitted","New"],["under_review","In review"],["more_info","Info requested"],["approved","Approved"],["disbursed","Active loans"],["rejected","Rejected"],["closed","Closed"],["all","All"]].map(([k,l])=>`<button type="button" data-k="${k}" aria-pressed="${S.filter===k}">${l}<small>${cnt(k)}</small></button>`).join("")}</div>
 <div id="list"></div>`;
 const paint=()=>{const q=S.q.trim().toLowerCase();const list=S.apps.filter(a=>(!F[S.filter]||F[S.filter].includes(a.status))&&(!q||[a.ref,a.applicant_name,a.mobile,a.product_name].join(" ").toLowerCase().includes(q)));
  $("#list").innerHTML=list.length?appTable(list):`<div class="panel empty-s">No applications here.</div>`;bindRows()};
 $$("[data-k]").forEach(b=>b.onclick=()=>{S.filter=b.dataset.k;$$("[data-k]").forEach(x=>x.setAttribute("aria-pressed",x===b));paint()});
 $("#q").oninput=e=>{S.q=e.target.value;paint()};paint()}

/* ---------- One application ---------- */
async function openApp(id,keepScroll){if(!keepScroll)loading();const y=scrollY;
 const [{data:a,error},{data:docs},{data:gs},{data:ev},{data:inst},{data:pays},{data:msgs}]=await Promise.all([
  db.from("applications").select("*").eq("id",id).maybeSingle(),db.from("documents").select("*").eq("application_id",id).order("uploaded_at"),
  db.from("guarantors").select("*").eq("application_id",id).order("created_at"),db.from("events").select("*").eq("application_id",id).order("at",{ascending:false}),
  db.from("installments").select("*").eq("application_id",id).order("n"),db.from("payments").select("*").eq("application_id",id).order("paid_on"),
  db.from("outbox").select("*").eq("application_id",id).order("id",{ascending:false}).limit(50)]);
 if(error||!a){main().innerHTML=`<div class="panel empty-s">Application not found. <a href="#apps">Back to applications</a></div>`;return}
 S.cur=a;const d=a.data||{};const total=(inst||[]).reduce((s,i)=>s+ +i.amount,0),paid=(inst||[]).reduce((s,i)=>s+ +i.paid_amount,0);
 const appDocs=(docs||[]).filter(x=>!x.guarantor_id),gDocs=(docs||[]).filter(x=>x.guarantor_id);
 main().innerHTML=`<div class="row sb"><div style="display:grid;gap:6px"><a class="mini" href="#apps" style="justify-self:start">← Applications</a><h1>${esc(a.applicant_name)}</h1>
  <div class="row"><span class="num muted">${esc(a.ref)}</span>${pill(a.status)}<span class="muted">${esc(a.product_name||a.product)} · ${money(a.amount)} over ${a.term} mo · received ${dt(a.created_at)}</span></div></div>
  <div class="row"><span class="muted">Officer: <b>${esc(staffName(a.assigned_to))||"unassigned"}</b></span>${a.assigned_to!==S.me.user_id?`<button class="mini" id="assignMe" type="button">Assign to me</button>`:""}</div></div>
 <div class="detail2"><div style="display:grid;gap:16px;min-width:0">
  ${a.decision_reason&&["more_info","approved","rejected","withdrawn"].includes(a.status)?`<div class="notice"><div><b>${a.status==="more_info"?"Information requested":a.status==="approved"?"Approval conditions":"Reason given"}</b> (sent to client)<br>${esc(a.decision_reason)}${a.decided_by?`<br><small class="muted">${esc(staffName(a.decided_by))} · ${dt(a.decided_at)}</small>`:""}</div></div>`:""}
  ${total?`<div class="panel"><h3>Repayment schedule <small>${money(paid)} paid of ${money(total)} · balance ${money(total-paid)}</small></h3><div class="sched-wrap"><table class="sched num"><thead><tr><th>#</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead><tbody>${inst.map(i=>`<tr><td>${i.n}</td><td>${dd(i.due_date)}</td><td>${money(i.amount)}</td><td>${money(i.paid_amount)}</td><td>${pill(i.status,i.status[0].toUpperCase()+i.status.slice(1))}</td></tr>`).join("")}</tbody></table></div>
   ${(pays||[]).length?`<details><summary class="mini" style="display:inline-flex">Payments recorded (${pays.length})</summary><ul class="doclist" style="margin-top:10px">${pays.map(p=>`<li>${ic("check")}<div><b class="num">${money(p.amount)}</b> on ${dd(p.paid_on)}<small>${esc([p.method,p.reference,staffName(p.recorded_by)].filter(Boolean).join(" · "))}</small></div></li>`).join("")}</ul></details>`:""}</div>`:""}
  <div class="panel"><h3>Documents <small>${appDocs.length} uploaded</small></h3>${appDocs.length?`<div class="docgrid">${appDocs.map(docCard).join("")}</div>`:`<p class="muted">No documents uploaded yet. Use "Request information" to ask the client for them.</p>`}</div>
  <div class="panel"><h3>Application details</h3>${GROUPS.map(([t,keys])=>{const h=fieldsHTML(d,keys);return h?`<div style="display:grid;gap:8px"><b style="font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">${t}</b>${h}</div>`:""}).join("")}</div>
  <div class="panel"><h3>Guarantor forms <small>${(gs||[]).length}</small></h3>${(gs||[]).length?gs.map(g=>`<div style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:12px"><div class="row sb"><b>${esc(g.full_name)} <span class="num muted">${esc(g.ref)}</span></b><span class="muted">${dt(g.created_at)}</span></div>${fieldsHTML(g.data||{},Object.keys(g.data||{}).filter(k=>!["agree","applicationRef"].includes(k)))}
   ${gDocs.filter(x=>x.guarantor_id===g.id).length?`<div class="docgrid">${gDocs.filter(x=>x.guarantor_id===g.id).map(docCard).join("")}</div>`:`<p class="muted">No guarantor documents.</p>`}</div>`).join(""):`<p class="muted">No guarantor form linked. <a href="#guarantors">Find and link one</a> if the guarantor applied without the reference.</p>`}</div>
 </div>
 <aside>
  <div class="panel actions" id="acts"><h3>Decision</h3>${actionsHTML(a,total-paid)}</div>
  <div class="panel"><h3>Message the client <small>${esc(a.mobile)} · ${esc({sms:"SMS",whatsapp:"WhatsApp",both:"SMS + WhatsApp"}[a.notify_channel])}</small></h3>
   <div class="f s6"><label for="cm" class="sr">Message</label><textarea id="cm" rows="3" placeholder="Write a message to ${esc(a.applicant_name.split(" ")[0])}…"></textarea></div>
   <div class="row sb"><select id="cmCh" class="mini" aria-label="Channel"><option value="${esc(a.notify_channel)}">Client's choice</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select><button class="btn sm" id="cmSend" type="button">Send</button></div>
   <div class="f s6"><label for="nt">Internal note <span class="opt">(staff only)</span></label><textarea id="nt" rows="2" placeholder="e.g. Called employer, salary confirmed"></textarea></div><button class="mini" id="ntSave" type="button" style="justify-self:end">Save note</button></div>
  <div class="panel"><h3>History</h3><ol class="timeline">${(ev||[]).map(e=>`<li class="${e.actor?"staff":""} ${e.kind==="message"?"msg":""}"><time>${dt(e.at)}</time><span>${esc(e.note)}</span><span class="who">${esc(e.actor_name||(e.actor?"Staff":"Client / system"))}${e.client_visible?" · visible to client":""}</span></li>`).join("")}</ol></div>
  <div class="panel"><h3>Messages sent <small>${(msgs||[]).length}</small></h3>${(msgs||[]).length?`<ul class="doclist">${msgs.map(m=>`<li>${ic(m.status==="sent"?"check":"file")}<div><b>${esc(m.channel.toUpperCase())} ${pill(m.status)}</b><small>${dt(m.created_at)}${m.error?" · "+esc(m.error):""}</small><div class="msgbody">${esc(m.body)}</div></div></li>`).join("")}</ul>`:`<p class="muted">None yet.</p>`}</div>
 </aside></div>`;
 bindApp(a);if(keepScroll)scrollTo(0,y);else scrollTo(0,0)}
const docCard=x=>`<div class="docc" data-doc="${x.id}" data-path="${esc(x.file_path)}" data-mime="${esc(x.mime||"")}"><div class="thumb">${ic("file")}</div><div class="meta"><b>${esc(x.label||x.kind)}</b><small>${esc(x.file_name||"")} · ${dt(x.uploaded_at)}</small>
 <div class="acts"><button class="mini" data-open type="button">${ic("open",'style="width:14px;height:14px"')} Open</button><button class="mini ${x.verified?"ok":""}" data-verify="${x.verified?"0":"1"}" type="button">${x.verified?"✓ Verified":"Mark verified"}</button></div></div></div>`;

function actionsHTML(a,bal){const s=a.status;const terms=[];for(let i=+setting("min_term",1);i<=+setting("max_term",4);i++)terms.push(i);
 const btn=(k,l,cls="")=>`<button type="button" class="btn sm ${cls}" data-act="${k}">${l}</button>`;
 let h="";
 if(["submitted","more_info"].includes(s))h+=`<div class="btns">${btn("review","Start review","navy")}${btn("more_info","Request information","warn")}</div>`;
 if(s==="under_review")h+=`<div class="btns">${btn("more_info","Request information","warn")}</div>`;
 if(["submitted","under_review","more_info"].includes(s))h+=`<div class="btns">${btn("approve","Approve")}${btn("reject","Reject","danger")}</div>`;
 if(s==="approved")h+=`<div class="btns">${btn("disburse","Release funds")}${btn("reject","Reject","danger")}</div>`;
 if(s==="disbursed")h+=`<div class="btns">${btn("payment","Record payment")}</div><p class="muted">Outstanding: <b class="num">${money(bal)}</b></p>`;
 if(["rejected","closed","withdrawn"].includes(s))h+=`<p class="muted">This application is ${esc(ST[s].toLowerCase())}. No further decisions are needed.</p>`;
 if(!["disbursed","closed","withdrawn","rejected"].includes(s))h+=`<button type="button" class="mini" data-act="withdraw" style="justify-self:start">Mark as withdrawn</button>`;
 return h+`<div id="actForm"></div>`}
function actForm(a,k){const terms=[];for(let i=+setting("min_term",1);i<=+setting("max_term",4);i++)terms.push(i);const rate=+setting("monthly_rate",0.1);
 const F={
  review:[`Move to review. The client is told their application is being reviewed.`,`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="af_notify" checked> Send the client an update</label>`,"Start review"],
  more_info:[`Tell the client exactly what you need. They get it by ${a.notify_channel==="both"?"SMS and WhatsApp":a.notify_channel==="whatsapp"?"WhatsApp":"SMS"} and can upload on the website. They are reminded every 3 days if nothing arrives.`,`<div class="f s6"><label for="af_reason">What is needed?</label><textarea id="af_reason" rows="3" required placeholder="e.g. your latest payslip and a clearer photo of your ID"></textarea><span class="emsg">Say what is needed.</span></div>`,"Send request"],
  approve:[`Approve the loan. You can change the amount or term.`,`<div class="fgrid"><div class="f s3"><label for="af_amount">Approved amount (US$)</label><input id="af_amount" inputmode="decimal" value="${a.amount}"></div><div class="f s3"><label for="af_term">Months</label><select id="af_term">${terms.map(t=>`<option ${t===a.term?"selected":""}>${t}</option>`).join("")}</select></div>
   <div class="f s6"><label for="af_reason">Conditions or note to client <span class="opt">(optional)</span></label><textarea id="af_reason" rows="2" placeholder="e.g. Bring your original ID and payslip to sign."></textarea></div></div><p class="sched-prev num" id="af_prev"></p>`,"Approve loan"],
  reject:[`Reject the application. The client receives the reason you write, so keep it clear and respectful.`,`<div class="f s6"><label for="af_reason">Reason for the client</label><textarea id="af_reason" rows="3" required placeholder="e.g. The repayment is more than your net salary can carry."></textarea><span class="emsg">Give a reason.</span></div>`,"Reject application"],
  disburse:[`Release the funds and create the repayment schedule.`,`<div class="fgrid"><div class="f s3"><label for="af_dis">Date released</label><input id="af_dis" type="date" value="${today()}"></div><div class="f s3"><label for="af_first">First repayment due</label><input id="af_first" type="date" value="${addMonths(today(),1)}"></div></div><p class="sched-prev num" id="af_prev"></p>`,"Release funds"],
  payment:[`Record money received. It is applied to the oldest unpaid instalment first, and the client gets a receipt message.`,`<div class="fgrid"><div class="f s3"><label for="af_amount">Amount (US$)</label><input id="af_amount" inputmode="decimal" required><span class="emsg">Enter the amount.</span></div><div class="f s3"><label for="af_on">Date paid</label><input id="af_on" type="date" value="${today()}"></div>
   <div class="f s3"><label for="af_m">Method</label><select id="af_m"><option>EcoCash</option><option>Cash</option><option>Bank transfer</option><option>Payroll deduction</option><option>Debit order</option><option>InnBucks</option><option>Other</option></select></div><div class="f s3"><label for="af_ref">Receipt / reference</label><input id="af_ref"></div></div>`,"Record payment"],
  withdraw:[`Close this application without a decision (for example, the client cancelled).`,`<div class="f s6"><label for="af_reason">Reason <span class="opt">(optional)</span></label><input id="af_reason"></div>`,"Mark withdrawn"]
 }[k];
 const box=$("#actForm");box.innerHTML=`<div class="act-form"><p>${F[0]}</p>${F[1]}<div class="row sb"><button type="button" class="mini" id="af_x">Cancel</button><button type="button" class="btn sm ${k==="reject"?"danger":k==="more_info"?"warn":""}" id="af_go">${F[2]}</button></div></div>`;
 const prev=()=>{const p=$("#af_prev");if(!p)return;const amt=k==="approve"?+($("#af_amount").value.replace(/[^\d.]/g,"")):+(a.approved_amount||a.amount);const t=k==="approve"?+$("#af_term").value:+(a.approved_term||a.term);if(!amt){p.textContent="";return}
  const tot=Math.round(amt*(1+(+(a.monthly_rate||rate))*t)*100)/100;p.innerHTML=`Total repayable <b>${money(tot)}</b> · ${t} × <b>${money(tot/t)}</b>${k==="disburse"?` · first due ${dd($("#af_first").value)}`:""}`};
 $$("input,select",box).forEach(x=>x.addEventListener("input",prev));prev();
 const first=$("textarea,input",box);if(first)first.focus();
 $("#af_x").onclick=()=>{box.innerHTML=""};
 $("#af_go").onclick=async()=>{const v=id=>{const e=$("#"+id);return e?e.value.trim():undefined};const req=$$("[required]",box).find(e=>!e.value.trim());if(req){req.closest(".f").classList.add("err");req.focus();return}
  const b=$("#af_go");b.disabled=true;
  const p={review:{notify:$("#af_notify")?.checked},more_info:{reason:v("af_reason")},approve:{amount:v("af_amount"),term:v("af_term"),reason:v("af_reason")},reject:{reason:v("af_reason")},disburse:{disbursed_on:v("af_dis"),first_due:v("af_first")},payment:{amount:v("af_amount"),paid_on:v("af_on"),method:v("af_m"),reference:v("af_ref")},withdraw:{reason:v("af_reason")}}[k];
  const msg={review:"Moved to review",more_info:"Request sent to client",approve:"Loan approved. Client notified.",reject:"Application rejected. Client notified.",disburse:"Funds released. Schedule created.",payment:"Payment recorded",withdraw:"Marked withdrawn"}[k];
  const r=await act(a.id,k,p,msg);if(!r)b.disabled=false}}
function bindApp(a){$$("[data-act]").forEach(b=>b.onclick=()=>actForm(a,b.dataset.act));
 const am=$("#assignMe");if(am)am.onclick=()=>act(a.id,"assign",{},"Assigned to you");
 $("#cmSend").onclick=()=>{const t=$("#cm").value.trim();if(!t){toast("Write a message first.");return}act(a.id,"message",{text:t,channel:$("#cmCh").value},"Message queued for sending")};
 $("#ntSave").onclick=()=>{const t=$("#nt").value.trim();if(!t){toast("Write a note first.");return}act(a.id,"note",{reason:t},"Note saved")};
 $$("[data-doc]").forEach(async c=>{const path=c.dataset.path;const {data}=await db.storage.from("loan-docs").createSignedUrl(path,900);if(!data)return;c._url=data.signedUrl;
  if(c.dataset.mime.startsWith("image/")&&!/hei[cf]/.test(c.dataset.mime))$(".thumb",c).innerHTML=`<img src="${esc(data.signedUrl)}" alt="" loading="lazy">`;
  $("[data-open]",c).onclick=()=>window.open(c._url,"_blank","noopener");
  $("[data-verify]",c).onclick=e=>act(a.id,"verify_doc",{document_id:c.dataset.doc,verified:e.currentTarget.dataset.verify==="1"},e.currentTarget.dataset.verify==="1"?"Document verified":"Verification removed")})}

/* ---------- Loans ---------- */
async function viewLoans(){loading();const {data:inst,error}=await db.from("installments").select("*,applications(id,ref,applicant_name,mobile,status,product_name)").order("due_date");if(error){toast(error.message);return}
 const act=(inst||[]).filter(i=>i.applications?.status==="disbursed");const by={};act.forEach(i=>{(by[i.application_id]=by[i.application_id]||[]).push(i)});
 const loans=Object.values(by).map(l=>{const a=l[0].applications;const tot=l.reduce((s,i)=>s+ +i.amount,0),pd=l.reduce((s,i)=>s+ +i.paid_amount,0);const nx=l.find(i=>i.status!=="paid");return{a,tot,pd,nx,over:l.some(i=>i.status==="overdue")}}).sort((x,y)=>(y.over-x.over)||((x.nx?.due_date||"")>(y.nx?.due_date||"")?1:-1));
 const book=loans.reduce((s,l)=>s+l.tot-l.pd,0),overAmt=act.filter(i=>i.status==="overdue").reduce((s,i)=>s+ +i.amount- +i.paid_amount,0);
 main().innerHTML=`<h1>Loans & repayments</h1><div class="tiles4" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><div class="tile" style="--tone:var(--forest)"><b>${loans.length}</b><span>Active loans</span></div><div class="tile" style="--tone:var(--navy)"><b class="num" style="font-size:1.4rem">${money(book)}</b><span>Outstanding balance</span></div><div class="tile" style="--tone:var(--danger)"><b class="num" style="font-size:1.4rem">${money(overAmt)}</b><span>Overdue amount</span></div></div>
 <p class="muted">Clients get automatic reminders ${esc(setting("reminder_days_before","3"))} days before each due date, on the due date, and 1 and 7 days after a missed payment, sent each morning at 08:00.</p>
 ${loans.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Loan</th><th class="r">Repayable</th><th class="r">Paid</th><th class="r">Balance</th><th>Next due</th><th>Status</th></tr></thead><tbody>${loans.map(l=>`<tr data-go="${l.a.id}"><td>${esc(l.a.applicant_name)}<span class="sub num">${esc(l.a.mobile)}</span></td><td>${esc(l.a.product_name||"")}<span class="sub num">${esc(l.a.ref)}</span></td><td class="r num">${money(l.tot)}</td><td class="r num">${money(l.pd)}</td><td class="r num"><b>${money(l.tot-l.pd)}</b></td><td class="num">${l.nx?dd(l.nx.due_date)+`<span class="sub">${money(l.nx.amount-l.nx.paid_amount)}</span>`:"—"}</td><td>${l.over?pill("overdue","Overdue"):pill("paid","On track")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="panel empty-s">No active loans yet. Loans appear here after you release funds on an approved application.</div>`}`;bindRows()}

/* ---------- Guarantors ---------- */
async function viewGuarantors(){loading();const {data:gs}=await db.from("guarantors").select("*,applications(id,ref,applicant_name)").order("created_at",{ascending:false}).limit(300);await loadApps();
 const open=S.apps.filter(a=>!["rejected","closed","withdrawn"].includes(a.status));
 main().innerHTML=`<h1>Guarantor forms</h1><p class="muted">Forms submitted with the borrower's reference are linked automatically. Link the rest here.</p>
 ${(gs||[]).length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guarantor</th><th>For borrower</th><th>Received</th><th>Linked application</th></tr></thead><tbody>${gs.map(g=>`<tr><td>${esc(g.full_name)}<span class="sub num">${esc(g.mobile)} · ${esc(g.ref)}</span></td><td>${esc(g.loanee_name||"")}${g.application_ref?`<span class="sub num">${esc(g.application_ref)}</span>`:""}</td><td>${dt(g.created_at)}</td>
 <td>${g.applications?`<a href="#app-${g.applications.id}">${esc(g.applications.ref)} · ${esc(g.applications.applicant_name)}</a>`:`<div class="row"><select class="mini" data-g="${g.id}" aria-label="Choose application"><option value="">Choose application…</option>${open.map(a=>`<option value="${a.id}" ${a.applicant_name.toLowerCase()===(g.loanee_name||"").toLowerCase()?"selected":""}>${esc(a.ref)} · ${esc(a.applicant_name)}</option>`).join("")}</select><button class="mini" data-link="${g.id}" type="button">Link</button></div>`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="panel empty-s">No guarantor forms yet.</div>`}`;
 $$("[data-link]").forEach(b=>b.onclick=async()=>{const app=$(`select[data-g="${b.dataset.link}"]`).value;if(!app){toast("Choose the application first.");return}const {error}=await db.rpc("staff_action",{p_app:app,p_action:"link_guarantor",p:{guarantor_id:b.dataset.link}});if(error)toast(error.message);else{toast("Guarantor linked");viewGuarantors()}})}

/* ---------- Messages ---------- */
async function viewMessages(){loading();const {data:m,error}=await db.from("outbox").select("*,applications(id,ref,applicant_name)").order("id",{ascending:false}).limit(300);if(error){toast(error.message);return}
 const cnt=s=>(m||[]).filter(x=>x.status===s).length;
 main().innerHTML=`<div class="row sb"><h1>Messages</h1><button class="mini" id="rf" type="button">Refresh</button></div>
 <div class="tiles4" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${[["sent","Sent","var(--leaf)"],["queued","Waiting to send","var(--navy)"],["failed","Failed","var(--danger)"]].map(([s,l,t])=>`<div class="tile" style="--tone:${t}"><b>${cnt(s)}</b><span>${l}</span></div>`).join("")}</div>
 ${setting("sending_enabled","true")!=="true"?`<div class="notice"><div><b>Sending is paused.</b> Turn it back on in Settings.</div></div>`:""}
 ${(m||[]).some(x=>x.status==="queued"&&/not set up/.test(x.error||""))?`<div class="notice"><div><b>Twilio isn't connected yet.</b> Messages are waiting and will send automatically once the Twilio details are added in Supabase (see the setup guide).</div></div>`:""}
 ${(m||[]).length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>To</th><th>Type</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>${m.map(x=>`<tr data-go="${x.applications?.id||""}"><td>${dt(x.created_at)}</td><td class="num">${esc(x.to_phone)}<span class="sub">${esc(x.applications?.applicant_name||"Guarantor")}</span></td><td>${esc(x.channel.toUpperCase())}<span class="sub">${esc(x.template_key||"")}</span></td><td><div class="msgbody">${esc(x.body)}</div>${x.error?`<span class="sub" style="color:var(--danger)">${esc(x.error)}</span>`:""}</td><td>${pill(x.status)}${x.attempts>1?`<span class="sub">${x.attempts} tries</span>`:""}</td>
 <td>${["failed","cancelled"].includes(x.status)&&isMgr()?`<button class="mini" data-retry="${x.id}" type="button">Retry</button>`:x.status==="queued"&&isMgr()?`<button class="mini" data-cancel="${x.id}" type="button">Cancel</button>`:""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="panel empty-s">No messages yet.</div>`}`;
 $$("tr[data-go]").forEach(r=>{if(r.dataset.go)r.onclick=e=>{if(!e.target.closest("button"))location.hash="app-"+r.dataset.go}});
 $("#rf").onclick=viewMessages;
 $$("[data-retry],[data-cancel]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const {error}=await db.rpc("admin_save",{p_kind:b.dataset.retry?"retry_message":"cancel_message",p:{id:b.dataset.retry||b.dataset.cancel}});toast(error?error.message:"Done");viewMessages()})}

/* ---------- Settings ---------- */
async function viewSettings(){loading();const [{data:t},{data:s},{data:st}]=await Promise.all([db.from("message_templates").select("*").order("key"),db.from("settings").select("*").order("key"),db.from("staff").select("*").order("full_name")]);
 S.settings=Object.fromEntries((s||[]).map(x=>[x.key,x.value]));const can=isMgr(),adm=S.me.role==="admin";
 main().innerHTML=`<h1>Settings</h1>${can?"":`<div class="notice"><div>Only managers and admins can change settings. You can view them here.</div></div>`}
 <div class="panel"><h3>Automatic messages</h3><p class="muted">Words in {curly brackets} are filled in automatically: {first_name}, {ref}, {product}, {approved_amount}, {approved_term}, {reason}, {amount_due}, {due_date}, {balance}, {site_url}, {office_phone}. For WhatsApp, paste the Twilio Content SID of the approved template (it starts with HX).</p>
 ${(t||[]).map(x=>`<div style="display:grid;gap:8px;border-top:1px solid var(--line);padding-top:14px" data-tpl="${esc(x.key)}"><div class="row sb"><b>${esc(x.label)}</b><label class="row" style="gap:6px"><input type="checkbox" data-en ${x.enabled?"checked":""} ${can?"":"disabled"}> Send automatically</label></div>
  <textarea class="tpl" ${can?"":"disabled"} aria-label="${esc(x.label)} message">${esc(x.body)}</textarea><div class="row sb"><input class="mini" style="min-width:260px;font-family:var(--f-num)" data-wa placeholder="WhatsApp Content SID (optional)" value="${esc(x.wa_content_sid||"")}" ${can?"":"disabled"}><span class="row"><span class="muted" data-len>${x.body.length} characters · ${Math.ceil(x.body.length/153)} SMS</span>${can?`<button class="btn sm" data-save type="button">Save</button>`:""}</span></div></div>`).join("")}</div>
 <div class="panel"><h3>Lending settings</h3>${(s||[]).map(x=>`<div class="setrow" data-set="${esc(x.key)}"><div><b>${esc(x.key.replace(/_/g," "))}</b><span class="sub muted" style="display:block;font-size:.84rem">${esc(x.note||"")}</span></div><input value="${esc(x.value)}" ${can?"":"disabled"} aria-label="${esc(x.key)}">${can?`<button class="mini" data-saveset type="button">Save</button>`:"<span></span>"}</div>`).join("")}
  <p class="muted" style="font-size:.85rem">Changing the interest rate or loan limits here affects new applications and new schedules. Also update the public calculator in assets/data.js so both match.</p></div>
 <div class="panel"><h3>Staff</h3><div class="tbl-wrap"><table class="tbl" style="min-width:520px"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead><tbody>${(st||[]).map(x=>`<tr style="cursor:default"><td>${esc(x.full_name)}</td><td>${esc(x.email||"")}</td><td>${esc(x.role)}</td><td>${x.active?"Yes":"No"}</td></tr>`).join("")}</tbody></table></div>
 ${adm?`<div class="act-form"><b>Add or update a staff member</b><p class="muted" style="font-size:.88rem">First create their login in Supabase → Authentication → Users → Add user. Then add them here.</p><div class="fgrid"><div class="f s2"><label for="sf_e">Email</label><input id="sf_e" type="email"></div><div class="f s2"><label for="sf_n">Full name</label><input id="sf_n"></div><div class="f s1" style="grid-column:span 1"><label for="sf_r">Role</label><select id="sf_r"><option>officer</option><option>manager</option><option>admin</option></select></div><div class="f" style="grid-column:span 1"><label for="sf_a">Active</label><select id="sf_a"><option value="true">Yes</option><option value="false">No</option></select></div></div><button class="btn sm" id="sf_go" type="button" style="justify-self:end">Save staff member</button></div>`:""}</div>`;
 $$("[data-tpl]").forEach(w=>{const ta=$("textarea",w);ta.oninput=()=>{$("[data-len]",w).textContent=`${ta.value.length} characters · ${Math.ceil(ta.value.length/153)} SMS`};const sv=$("[data-save]",w);if(sv)sv.onclick=async()=>{const {error}=await db.rpc("admin_save",{p_kind:"template",p:{key:w.dataset.tpl,body:ta.value,enabled:$("[data-en]",w).checked,wa_content_sid:$("[data-wa]",w).value}});toast(error?error.message:"Message saved")}});
 $$("[data-set]").forEach(w=>{const b=$("[data-saveset]",w);if(b)b.onclick=async()=>{const {error}=await db.rpc("admin_save",{p_kind:"setting",p:{key:w.dataset.set,value:$("input",w).value.trim()}});toast(error?error.message:"Setting saved")}});
 const sf=$("#sf_go");if(sf)sf.onclick=async()=>{const {error}=await db.rpc("admin_save",{p_kind:"staff",p:{email:$("#sf_e").value,full_name:$("#sf_n").value,role:$("#sf_r").value,active:$("#sf_a").value==="true"}});toast(error?error.message:"Staff member saved");if(!error)viewSettings()}}

boot();
})();
