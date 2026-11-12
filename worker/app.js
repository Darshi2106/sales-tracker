'use strict';
const $=id=>document.getElementById(id);
const owners=['Dinesh','Manoj','Sales Lead','Ops Lead','Management','Other'];
const opsOwners=['Adarsh','Faheem','Hardik'];
const stages=['Sourced','Researching','Outreach in Progress','Engaged','Meeting Booked','SQL Accepted','Discovery','Qualified Opportunity','Proposal Submitted','Pilot / PoC','Tool Awaited','Negotiation','Contracting','Nurture / On Hold','Closed Won','Closed Lost','Disqualified'];
const closed=stages.slice(-3);
const movesToProject=stage=>stage==='Closed Won'||stage==='Closed Lost';
const numberOf=id=>Number(id.match(/^(?:AG-|ADT_[SP]_)([0-9]+)$/)?.[1]||0);
const formatId=(number,stage)=>'ADT_'+(movesToProject(stage)?'P':'S')+'_'+String(number).padStart(2,'0');
const views=['Lead Intake','All leads','Presales','Ongoing sales','Follow-ups','Closed','Projects'];
const leadGroups=[
 ['Lead and account',[
  ['company','Company','text',true],['domain','Domain',['AI/ML Data Services','BPO / Managed Operations','GCC Solutions','Other'],true],['industry','Industry'],['market','Country / Market'],['website','Company website'],['url','Account / Source URL'],
  ['owner','Lead owner',owners,true],['salesOwner','Sales owner',owners],['stage','Current stage',stages,true],['priority','Priority',['High','Medium','Low']],['sourced','Sourced date','date'],['since','Stage since','date'],['source','Lead source',['Sales Navigator','LinkedIn','Referral','Website Inbound','Event','Partner','Outbound Research','Existing Client','Other']]
 ]],
 ['Requirements and qualification',[
  ['fit','Fit / Trigger / Need','textarea'],['buyingRole','Decision maker / Buying role'],['budget','Budget status',['Unknown','Unconfirmed','Indicative','Approved','Unavailable']],['timeline','Decision timeline'],['notes','Latest notes / Risks','textarea']
 ]],
 ['Lead contact',[
  ['contact','Contact name'],['title','Job title / Designation'],['email','Work email','email'],['phone','Phone','tel'],['linkedin','LinkedIn profile']
 ]],
 ['Next follow-up',[
  ['next','Primary next action'],['due','Next follow-up','date']
 ]],
 ['Sales milestones and value',[
  ['outreach','First outreach','date'],['reply','First reply','date'],['meeting','Meeting date','date'],['sql','SQL accepted date','date'],['opportunity','Opportunity created','date'],['proposal','Proposal sent','date'],['expected','Expected close','date'],['close','Actual close','date'],['value','Estimated deal value','number'],['signed','Signed value','number'],['currency','Deal currency',['USD','INR'],true],['closeReason','Close / Hold reason'],['crm','CRM / Deal link']
 ]],
 ['Lead quality audit',[
  ['quality','Lead quality',['Unreviewed','Pass','Needs Review','Fail']],['auditDate','Audit date','date'],['auditor','Audited by'],['auditNotes','Audit notes','textarea']
 ]]
];
const projectFields=[
 ['owner','Ops owner',opsOwners,true],['status','Project status',['Handover Pending','Handover Accepted','Mobilisation','Pilot / Transition','Live Delivery','On Hold','Closure Pending','Completed','Cancelled'],true],
 ['kickoff','Kickoff date','date'],['target','Target end date','date'],['end','Actual end date','date'],['next','Next project action'],['due','Project follow-up','date'],['notes','Scope, handover and closure notes','textarea']
];
const activityFields=[
 ['date','Activity date','date',true],['owner','Activity owner',owners],['type','Activity type',['Research','Outreach','Follow-up','Reply','Meeting','Discovery','Stage Change','Proposal','Pilot','Negotiation','Handover','Delivery','Internal Task','Lead Audit','Lead Acceptance','Client reply','Other'],true],
 ['channel','Channel',['Email','LinkedIn','Phone','Video Call','In Person','CRM','Other']],['contact','Contact'],['outcome','Outcome / Stage change'],
 ['note','Summary / Notes','textarea',true],['actionOwner','Action owner',owners],['action','Action required'],['due','Action due','date'],
 ['status','Action status',['Open','In Progress','Done','Cancelled']],['completed','Completed date','date'],['evidence','Evidence / Link']
];
let leads=[],revision=0,role='',view='All leads',current=null,mode='lead',activityId=null;
const salesAllowed=()=>['sales','management','admin'].includes(role);
const opsAllowed=()=>['ops','management','admin'].includes(role);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(value,currency)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:currency==='USD'?'USD':'INR',maximumFractionDigits:2}).format(Number(value));
const handoverFields=[
 ['outcome','Closure outcome / reason','textarea'],['client','Client sponsor, project manager and contacts','textarea'],
 ['signed','Signed agreement / SOW / PO references','textarea'],['scope','Scope, exclusions and deliverables','textarea'],
 ['volume','Volume, staffing assumptions and languages','textarea'],['commercials','Pricing, currency, billing and payment terms','textarea'],
 ['dates','Kickoff, pilot, go-live dates and commitments','textarea'],['quality','SLA, QA and acceptance criteria','textarea'],
 ['security','Security, data handling and access requirements','textarea'],['risks','Risks, dependencies and escalation path','textarea'],
 ['docs','Document links and source materials','textarea'],['approvals','Sales approver and approval date','textarea']
];
projectFields.push(['acceptance','Ops acceptance owner and date','textarea'],['staffing','Staffing plan and backups','textarea'],['training','Training, SOP and readiness checks','textarea'],['tools','Tools, access and security readiness','textarea'],['readiness','Pilot or go-live readiness and escalation contacts','textarea'],['deliverables','Milestones, owners and due dates','textarea'],['qa','QA and SLA tracking plan','textarea'],['blockers','Risks, blockers and follow-up owners','textarea'],['signoff','Client sign-off and evidence','textarea'],['invoice','Final invoice status','textarea'],['closure','Closure notes and lessons','textarea']);
async function api(path,body){
 const options=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
 const res=await fetch(path,options);
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'Request failed. Reload and try again.');
 return data;
}
function update(data){leads=data.leads;revision=data.revision;render();}
async function load(){
 try{
  const data=await api('/api/state');
  role=data.role;
  $('identity').textContent=data.email+' · '+({ops:'Ops',sales:'Sales',admin:'Admin',management:'Management'}[role]);
  $('admin').hidden=role!=='admin';
  $('import').hidden=role!=='admin';
  try{$('migrate').hidden=role!=='admin'||!localStorage.getItem('adept-gic-tracker-v1');}catch{/* Browser storage is unavailable. */}
  $('add').hidden=!salesAllowed();
  update(data);
 }catch(e){$('notice').textContent=e.message;}
}
const by=(items,field)=>{
 const totals=new Map();
 for(const l of items){const k=l[field]||'Unassigned';totals.set(k,(totals.get(k)||0)+1);}
 return [...totals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
};
function summary(title,items){return `<section class="card"><h3>${title}</h3><dl>${items.length?items.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join(''):'<div>No records</div>'}</dl></section>`;}
function renderMonthly(){
 const year=Number($('reportYear').value)||2026;
 const rows=Array.from({length:12},(_,i)=>{
  const prefix=year+'-'+String(i+1).padStart(2,'0');
  const count=(field,predicate=()=>true)=>leads.filter(l=>!isIntake(l)&&String(l[field]||'').startsWith(prefix)&&l[field]<=today()&&predicate(l)).length;
  const month=new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(year,i,1)));
  return `<tr><th scope="row">${month}</th><td>${count('sourced')}</td><td>${count('sql')}</td><td>${count('opportunity')}</td><td>${count('proposal')}</td><td>${count('close',l=>l.stage==='Closed Won')}</td><td>${count('close',l=>l.stage==='Closed Lost')}</td></tr>`;
 });
 $('monthly').innerHTML='<table><thead><tr><th>Month</th><th>Sourced</th><th>SQLs</th><th>Opportunities</th><th>Proposals</th><th>Won</th><th>Lost</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
}
const actionOpen=a=>a?.action&&!['Done','Cancelled'].includes(a.status);
function followUp(lead){
 const items=(lead.activities||[]).filter(actionOpen).map(a=>({next:a.action,due:a.due,owner:a.actionOwner}));
 if(lead.next||lead.due)items.push({next:lead.next,due:lead.due,owner:lead.owner});
 return items.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))[0];
}
function age(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '—';
 const days=(Date.parse(today())-Date.parse(date))/86400000;
 return Number.isFinite(days)&&days>=0?days+' d':'—';
}
const isIntake=l=>Boolean(l.intake&&l.intake.status!=='Accepted');
function inView(l){
 if(view==='Lead Intake')return isIntake(l);
 if(isIntake(l))return false;
 if(view==='Projects')return movesToProject(l.stage);
 if(view==='Closed')return closed.includes(l.stage);
 if(view==='Follow-ups')return !closed.includes(l.stage)&&Boolean(followUp(l));
 if(view==='Presales')return stages.indexOf(l.stage)<6||l.stage==='Nurture / On Hold';
 if(view==='Ongoing sales')return stages.indexOf(l.stage)>=6&&!closed.includes(l.stage)&&l.stage!=='Nurture / On Hold';
 return true;
}
function render(){
 const pipelineLeads=leads.filter(l=>!isIntake(l));
 const open=pipelineLeads.filter(l=>!closed.includes(l.stage)),won=pipelineLeads.filter(l=>l.stage==='Closed Won');
 const projects=pipelineLeads.filter(l=>movesToProject(l.stage));
 const pipeline=new Map();
 for(const l of open){if(l.value!==''&&l.value!=null&&Number.isFinite(Number(l.value))){const c=l.currency||'INR';pipeline.set(c,(pipeline.get(c)||0)+Number(l.value));}}
 const stats=[['Accepted leads',pipelineLeads.length],...(role==='ops'?[]:[['Intake to review',leads.length-pipelineLeads.length]]),['Open leads',open.length],['Follow-ups due',open.filter(l=>{const due=followUp(l)?.due;return due&&due<=today();}).length],['Closed won',won.length],['Closed lost',pipelineLeads.filter(l=>l.stage==='Closed Lost').length],['Projects active',projects.filter(l=>l.project&&!['Completed','Cancelled'].includes(l.project.status)).length]];
 $('stats').innerHTML=stats.map(([label,value])=>`<div class="card"><strong>${value}</strong><span>${label}</span></div>`).join('');
 $('breakdowns').innerHTML=summary('Leads by stage',by(pipelineLeads,'stage'))+summary('Leads by owner',by(pipelineLeads,'owner'))+summary('Leads by service',by(pipelineLeads,'domain'))+summary('Open pipeline value',[...pipeline].map(([c,v])=>[c,money(v,c)]));
 renderMonthly();
 $('nav').innerHTML=views.filter(v=>role!=='ops'||v!=='Lead Intake').map(v=>`<button data-view="${v}" aria-pressed="${v===view}">${v}</button>`).join('');
 const query=$('search').value.trim().toLowerCase();
 const records=leads.filter(l=>inView(l)&&(!$('owner').value||l.owner===$('owner').value)&&[l.id,formatId(numberOf(l.id),'Sourced'),l.company,l.contact,l.industry,l.email,l.fit].some(x=>String(x??'').toLowerCase().includes(query))).sort((a,b)=>((view==='Projects'?a.project?.due:followUp(a)?.due)||'9999').localeCompare((view==='Projects'?b.project?.due:followUp(b)?.due)||'9999'));
 if(!records.length){$('list').innerHTML=`<p class="empty">${leads.length?'No records in this view.':'Add your first lead to start tracking the pipeline.'}</p>`;return;}
 const projectView=view==='Projects';
 $('list').innerHTML=`<table><thead><tr><th>Company / Lead ID</th><th>${projectView?'Ops owner':'Lead owner'}</th><th>${projectView?'Project status':'Stage'}</th>${projectView?'':'<th>Lead age</th><th>Stage age</th>'}<th>Next action</th><th>Due date</th><th>Deal value</th><th>Action</th></tr></thead><tbody>${records.map(l=>{
  const record=projectView?(l.project||{}):l;
  const next=projectView?record:(followUp(l)||{});
  const inactive=projectView?['Completed','Cancelled'].includes(record.status):closed.includes(l.stage);
  return `<tr><td><strong>${esc(l.company)}</strong><br><small>${esc([l.id,l.industry].filter(Boolean).join(' · '))}</small></td><td>${esc(record.owner||'Unassigned')}</td><td><span class="tag">${esc(projectView?(record.status||'Handover needed'):(isIntake(l)?l.intake.status:l.stage))}</span></td>${projectView?'':`<td>${age(l.sourced)}</td><td>${age(l.since)}</td>`}<td>${esc(next.next||'—')}</td><td class="${next.due&&next.due<today()&&!inactive?'late':''}">${esc(next.due||'—')}</td><td>${l.value?esc(money(l.value,l.currency)):'—'}</td><td><button data-id="${esc(l.id)}">${projectView?'Open project':'Open lead'}</button></td></tr>`;
 }).join('')}</tbody></table>`;
}
function field([name,label,type='text',required=false],value){
 const options=Array.isArray(type)&&value&&!type.includes(value)?[...type,value]:type;
 const attr=`name="${name}" ${required?'required':''}`;
 const control=Array.isArray(type)?`<select ${attr}><option value="">Select</option>${options.map(v=>`<option ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select>`:type==='textarea'?`<textarea ${attr}>${esc(value)}</textarea>`:`<input type="${type}" ${attr} value="${esc(value)}" ${type==='number'?'min="0" step="0.01"':''}>`;
 return `<label class="${type==='textarea'?'wide':''}">${esc(label)}${control}</label>`;
}
function detailGroup(title,fields,lead){
 return `<section class="record-section wide"><h3>${esc(title)}</h3><dl class="detail-grid">${fields.map(([name,label,type])=>{
  const value=lead[name];
  const shown=(name==='value'||name==='signed')&&value!==''&&value!=null?money(value,lead.currency):value;
  return `<div class="${type==='textarea'?'wide':''}"><dt>${esc(label)}</dt><dd>${esc(shown??'')||'—'}</dd></div>`;
 }).join('')}</dl></section>`;
}
function activityHistory(lead){
 const entries=[...(lead.activities||[])].reverse();
 return `<section class="record-section"><h3>Activity and follow-up history</h3>${entries.length?entries.map(a=>{
  const due=a.due&&actionOpen(a)&&a.due<today();
  return `<article class="history-entry"><strong>${esc([a.date,a.type,a.owner].filter(Boolean).join(' · '))}</strong>${a.channel||a.contact?`<p>${esc([a.channel,a.contact].filter(Boolean).join(' · '))}</p>`:''}${a.outcome?`<p>${esc(a.outcome)}</p>`:''}<p>${esc(a.note)}</p>${a.action?`<p><strong>Action</strong> ${esc(a.action)} · ${esc(a.actionOwner||'Unassigned')} · <span class="${due?'late':''}">${esc(a.status||'Open')}${a.due?' · Due '+esc(a.due):''}</span>${a.completed?' · Completed '+esc(a.completed):''}</p>`:''}${a.evidence?`<p><strong>Evidence</strong> ${esc(a.evidence)}</p>`:''}${a.action&&a.id&&salesAllowed()?`<button type="button" data-activity="${esc(a.id)}">Update follow-up</button>`:''}</article>`;
 }).join(''):'<p class="muted">No activity logged yet.</p>'}</section>`;
}
function intakePanel(lead){
 if(!lead.intake)return '';
 const status=lead.intake.status;
 const review=['management','admin'].includes(role)&&status==='Pending audit';
 const resubmit=salesAllowed()&&status==='Changes requested';
 return `<section class="record-section wide"><h3>Lead intake · ${esc(status)}</h3><p>${status==='Accepted'?'Accepted into the sales pipeline.':'Complete Lead Quality, Audit Date, Audited By and Audit Notes in Edit Lead. Management or Admin can accept a passing audit.'}</p>${lead.intake.note?`<p><strong>Review notes</strong> ${esc(lead.intake.note)}</p>`:''}${review||resubmit?`<label>Review / resubmission notes<textarea id="intakeNote"></textarea></label><div class="actions">${review?'<button type="button" data-decision="accept">Accept into pipeline</button><button type="button" data-decision="changes">Request changes</button>':'<button type="button" data-decision="resubmit">Resubmit for audit</button>'}</div>`:''}</section>`;
}
function edit(lead,kind,activity=null){
 current=lead;mode=kind;activityId=activity?.id||null;
 const defaults={stage:'Sourced',sourced:today(),since:today(),currency:'USD'};
 const data=kind==='project'?(lead.project||{status:'Handover Pending'}):kind==='handover'?(lead.salesHandover||{}):kind==='activity'?(activity||{date:today(),owner:lead.owner,contact:lead.contact}):lead?{...lead,currency:lead.currency||'INR'}:defaults;
 const editable=kind==='detail'?false:kind==='project'?opsAllowed()&&lead.stage==='Closed Won':kind==='handover'?salesAllowed()&&(role!=='sales'||!lead.project||lead.project.status==='Handover Pending'||lead.stage==='Closed Lost'):salesAllowed();
 const titles={project:'Project tracker',handover:'Sales handover',activity:activity?'Update follow-up':'Log activity or follow-up',detail:lead?.company,lead:lead?'Edit lead':'New lead'};
 $('editorTitle').textContent=titles[kind]+(lead&&kind!=='detail'?' · '+lead.company:'');
 const fields=kind==='project'?projectFields:kind==='handover'?handoverFields:activityFields;
 if(kind==='detail'){
  const next=followUp(lead);
  $('fields').innerHTML=`<div class="lead-facts wide"><span class="tag">${esc(lead.id)}</span><span class="tag">${esc(lead.stage)}</span><span>Lead age <strong>${age(lead.sourced)}</strong></span><span>Stage age <strong>${age(lead.since)}</strong></span></div>`+
   intakePanel(lead)+(next?`<section class="record-section wide next-action"><h3>Next pending action</h3><p>${esc([next.next,next.owner,next.due].filter(Boolean).join(' · '))}</p></section>`:'')+
   [leadGroups[1],leadGroups[2],leadGroups[0],...leadGroups.slice(3)].map(([title,f])=>detailGroup(title,f,data)).join('');
 }else{
  $('fields').innerHTML=kind==='lead'?(!lead?'<p class=wide>New records go to Lead Intake until the audit is accepted.</p>':'')+leadGroups.map(([title,f])=>`<fieldset class="wide fields"><legend>${esc(title)}</legend>${f.map(x=>field(x,data[x[0]])).join('')}</fieldset>`).join(''):fields.map(f=>field(f,data[f[0]])).join('');
  if(!editable)for(const control of $('fields').querySelectorAll('input,select,textarea'))control.disabled=true;
 }
 $('save').hidden=!editable;
 $('activity').hidden=kind!=='detail'||!salesAllowed();
 $('editLead').hidden=kind!=='detail'||!salesAllowed();
 $('changeStage').hidden=kind!=='detail'||!salesAllowed()||isIntake(lead);
 $('project').hidden=!lead||!movesToProject(lead.stage)||kind==='project';
 $('handover').hidden=!lead||!movesToProject(lead.stage)||kind==='handover';
 $('leadDetails').hidden=!lead||kind==='detail';
 $('editorNotice').textContent=kind==='project'&&lead.stage==='Closed Lost'?'Closed lost record. Sales can record the closure reason under Sales handover.':kind==='detail'?'':!editable?'View only for this record.':kind==='project'?'Save a draft as Handover Pending. Complete the Sales brief and Ops checklist before accepting.':kind==='handover'?'Complete the brief and record the Sales approval before Ops accepts it.':'';
 $('history').innerHTML=kind==='detail'?activityHistory(lead):'';
 if(!$('editor').open)$('editor').showModal();
}
$('owner').innerHTML='<option value="">All lead owners</option>'+owners.map(o=>`<option>${o}</option>`).join('');
$('nav').onclick=e=>{if(e.target.dataset.view){view=e.target.dataset.view;render();}};
$('search').oninput=render;$('owner').onchange=render;
$('list').onclick=e=>{const l=leads.find(l=>l.id===e.target.dataset.id);if(l)edit(l,view==='Projects'?'project':'detail');};
$('add').onclick=()=>edit(null,'lead');
$('cancel').onclick=()=>$('editor').close();
$('activity').onclick=()=>edit(current,'activity');
$('project').onclick=()=>edit(current,'project');
$('handover').onclick=()=>edit(current,'handover');
$('leadDetails').onclick=()=>edit(current,'detail');
$('editLead').onclick=()=>edit(current,'lead');
$('changeStage').onclick=()=>{edit(current,'lead');$('form').elements.stage.focus();};
$('fields').onclick=async e=>{
 const decision=e.target.dataset.decision;
 if(!decision)return;
 e.target.disabled=true;
 try{
  const response=await api('/api/state',{revision,action:'intake',id:current.id,data:{decision,note:$('intakeNote').value}});
  update(response);edit(leads.find(l=>l.id===response.id),'detail');
 }catch(err){$('editorNotice').textContent=err.message;e.target.disabled=false;}
};
$('history').onclick=e=>{const a=current?.activities?.find(a=>a.id===e.target.dataset.activity);if(e.target.dataset.activity&&a&&salesAllowed())edit(current,'activity',a);};
$('form').onsubmit=async e=>{
 e.preventDefault();
 if($('save').hidden)return;
 const data=Object.fromEntries(new FormData(e.currentTarget));
 $('save').disabled=true;
 try{
  const response=await api('/api/state',{revision,action:mode,id:current?.id,activityId,data});
  if(mode==='lead'&&!current)view='Lead Intake';
  update(response);
  const saved=leads.find(l=>l.id===response.id);
  if(saved)edit(saved,'detail');else $('editor').close();
  $('notice').textContent='Saved '+response.id+'.';
 }catch(err){$('editorNotice').textContent=err.message;}
 finally{$('save').disabled=false;}
};
$('export').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,leads},null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='adept-gic-tracker-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('migrate').onclick=async()=>{
 if(!confirm('Merge the earlier records on this browser into the shared tracker?'))return;
 try{
  const records=JSON.parse(localStorage.getItem('adept-gic-tracker-v1')||'[]');
  update(await api('/api/state',{revision,action:'restore',records}));
  $('notice').textContent='Earlier browser records merged.';
  $('migrate').hidden=true;
 }catch(err){$('notice').textContent=err.message;}
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  const backup=JSON.parse(await file.text());
  if(backup.version!==1||!Array.isArray(backup.leads))throw Error('Choose a tracker JSON backup.');
  update(await api('/api/state',{revision,action:'restore',records:backup.leads}));
  $('notice').textContent='Backup merged.';
 }catch(err){$('notice').textContent=err.message;}
};
async function listUsers(){
 const {users}=await api('/api/users');
 $('userList').innerHTML=summary('Tracker roles',users.map(u=>[u.email,u.master?(u.activated?'Super Admin':'Super Admin · awaiting first sign-in'):u.transition?'Temporary admin during transfer':u.role]));
}
$('admin').onclick=async()=>{
 $('adminDialog').showModal();
 try{await listUsers();}catch(err){$('adminNotice').textContent=err.message;}
};
$('closeAdmin').onclick=()=>$('adminDialog').close();
$('userForm').onsubmit=async e=>{
 e.preventDefault();
 const body=Object.fromEntries(new FormData(e.currentTarget));
 $('invite').hidden=true;
 try{
  await api('/api/users',body);
  await listUsers();
  $('adminNotice').textContent=body.role==='remove'?'Tracker role removed.':'User role saved. Create their login before sharing the invitation.';
  if(body.role!=='remove'){
   const label={sales:'Sales',ops:'Ops',management:'Management',admin:'Admin'}[body.role];
   $('inviteText').value=['Hi,','', 'You’ve been assigned the '+label+' role in the Adept GIC Lead Tracker.','Open '+location.origin+' and sign in using '+body.email.trim().toLowerCase()+'.','','Adept GIC'].join('\n');
   $('invite').hidden=false;
  }
 }catch(err){$('adminNotice').textContent=err.message;}
};
$('copyInvite').onclick=async()=>{
 try{await navigator.clipboard.writeText($('inviteText').value);$('adminNotice').textContent='Invitation copied.';}
 catch{$('inviteText').focus();$('inviteText').select();$('adminNotice').textContent='Copy the selected invitation text.';}
};
$('reportYear').onchange=renderMonthly;
$('add').hidden=true;
load();
