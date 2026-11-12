const roles=['sales','ops','management','admin'];
const opsOwners=['Adarsh','Faheem','Hardik'];
const stages=['Sourced','Researching','Outreach in Progress','Engaged','Meeting Booked','SQL Accepted','Discovery','Qualified Opportunity','Proposal Submitted','Pilot / PoC','Tool Awaited','Negotiation','Contracting','Nurture / On Hold','Closed Won','Closed Lost','Disqualified'];
const projectStatuses=['Handover Pending','Handover Accepted','Mobilisation','Pilot / Transition','Live Delivery','On Hold','Closure Pending','Completed','Cancelled'];
const activityTypes=['Research','Outreach','Follow-up','Reply','Meeting','Discovery','Stage Change','Proposal','Pilot','Negotiation','Handover','Delivery','Internal Task','Lead Audit','Lead Acceptance','Client reply','Other'];
const activityKeys='date owner type channel contact outcome note actionOwner action due status completed evidence'.split(' ');
const businessDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const reviewing=role=>role==='admin'||role==='management';
const isIntake=lead=>Boolean(lead?.intake&&lead.intake.status!=='Accepted');
const visible=(leads,role)=>role==='ops'?leads.filter(l=>!isIntake(l)):leads;
const salesKeys='company owner domain stage contact email source url fit sourced proposal value currency sql opportunity close next due notes priority since salesOwner industry market website title phone linkedin buyingRole budget timeline quality auditDate auditor auditNotes outreach reply meeting expected signed closeReason crm'.split(' ');
const handoverKeys='outcome client signed scope volume commercials dates quality security risks docs approvals'.split(' ');
const opsKeys='owner status kickoff target end next due notes acceptance staffing training tools readiness deliverables qa blockers signoff invoice closure'.split(' ');
const htmlHeaders={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(message,status=400)=>json({error:message},status);
const moves=stage=>stage==='Closed Won'||stage==='Closed Lost';
const seq=id=>Number(String(id).match(/^(?:ADT_[SP]_|AG-)([0-9]+)$/)?.[1]||0);
const idFor=(n,stage)=>'ADT_'+(moves(stage)?'P':'S')+'_'+String(n).padStart(2,'0');
const fields=(value,keys)=>Object.fromEntries(keys.filter(k=>typeof value?.[k]==='string').map(k=>[k,value[k].trim().slice(0,10000)]));
const salesAllowed=role=>['sales','management','admin'].includes(role);
const opsAllowed=role=>['ops','management','admin'].includes(role);
const has=(d,keys)=>keys.every(k=>typeof d?.[k]==='string'&&d[k].trim());
const gate=(heading,message,link,label)=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Adept GIC | ${heading}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fb;color:#142e46;font:17px system-ui}main{max-width:440px;background:white;border-radius:16px;padding:34px;margin:20px}.logo{display:block;width:165px;height:65px;position:relative;overflow:hidden}.logo img{position:absolute;width:220px;left:-28px;top:-29px}a{display:inline-block;background:#233764;color:white;padding:11px 16px;border-radius:8px;text-decoration:none}</style><main><span class="logo"><img src="/logo.jpeg" alt="Adept GIC"></span><h1>${heading}</h1><p>${message}</p><a href="${link}" target="_top">${label}</a></main></html>`,{headers:htmlHeaders});
async function getRole(db,email,adminEmail,previousAdmin){
 if(email===adminEmail){
  await db.prepare("INSERT OR IGNORE INTO tracker_roles(email,role) VALUES (?,'admin')").bind(adminEmail).run();
  return 'admin';
 }
 if(email===previousAdmin){
  const activation=await db.prepare('SELECT role FROM tracker_roles WHERE email = ?').bind(adminEmail).first();
  if(!activation)return 'admin';
 }
 return (await db.prepare('SELECT role FROM tracker_roles WHERE email = ?').bind(email).first())?.role;
}
async function getState(db){
 let row=await db.prepare('SELECT revision, data FROM tracker_state WHERE id = 1').first();
 if(!row){
  await db.prepare('INSERT OR IGNORE INTO tracker_state(id,data) VALUES (1,?)').bind(JSON.stringify(INITIAL)).run();
  row=await db.prepare('SELECT revision, data FROM tracker_state WHERE id = 1').first();
 }
 return {revision:row.revision,leads:JSON.parse(row.data)};
}
async function userAdmin(request,db,adminEmail,previousAdmin){
 if(request.method==='GET'){
  const {results}=await db.prepare('SELECT email,role FROM tracker_roles ORDER BY email').all();
  const activated=results.some(user=>user.email===adminEmail);
  const users=results.filter(user=>user.email!==adminEmail);
  if(previousAdmin&&!activated&&!users.some(user=>user.email===previousAdmin))users.unshift({email:previousAdmin,role:'admin',transition:true});
  return json({users:[{email:adminEmail,role:'admin',master:true,activated},...users]});
 }
 if(request.method!=='POST')return error('Method unavailable.',405);
 const body=await request.json();
 const email=String(body.email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===adminEmail)return error('Enter a valid user email. The master administrator is fixed.');
 if(body.role==='remove'){
  await db.prepare('DELETE FROM tracker_roles WHERE email = ?').bind(email).run();
 }else{
  if(!roles.includes(body.role))return error('Choose a valid role.');
  await db.prepare('INSERT INTO tracker_roles(email,role) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role').bind(email,body.role).run();
 }
 return json({ok:true});
}
async function change(request,db,role,email){
 const body=await request.json();
 const {leads,revision}=await getState(db);
 if(body.revision!==revision)return error('The tracker changed. Reload and try again.',409);
 const i=leads.findIndex(l=>l.id===body.id);
 const lead=leads[i];
 if(body.id&&(!lead||(role==='ops'&&isIntake(lead))))return error('Lead not found.',404);
 let record;
 if(body.action==='lead'&&salesAllowed(role)){
  const d=fields(body.data,salesKeys);
  if(!has(d,['company','owner','domain','stage','currency'])||!stages.includes(d.stage)||!['USD','INR'].includes(d.currency)||(d.value&&(Number(d.value)<0||!Number.isFinite(Number(d.value)))))return error('Check the required lead details and deal value.');
  if(role==='sales'&&lead?.project&&lead.project.status!=='Handover Pending'&&d.stage!==lead.stage)return error('Management or Admin must change the stage after Ops accepts the handover.',403);
  const number=lead?seq(lead.id):Math.max(0,...leads.map(l=>seq(l.id)))+1;
  if((!lead||isIntake(lead))&&moves(d.stage))return error('Accept the lead before marking it closed.');
  const changed=lead&&lead.stage!==d.stage;
  if(!d.since||changed&&d.since===lead.since)d.since=changed?businessDate():lead?.since||businessDate();
  if(!d.sourced&&!lead)d.sourced=businessDate();
  const entries=lead?.activities||[];
  if(changed)entries.push({id:crypto.randomUUID(),date:businessDate(),type:'Stage Change',outcome:d.stage,note:lead.stage+' → '+d.stage,author:email});
  record={...(lead||{intake:{status:'Pending audit',submittedAt:new Date().toISOString(),submittedBy:email}}),...d,activities:entries,id:idFor(number,d.stage)};
 }else if(body.action==='activity'&&salesAllowed(role)&&lead){
  const d=fields(body.data,activityKeys);
  if(!has(d,['date','type','note'])||!activityTypes.includes(d.type))return error('Enter a valid activity date, type and notes.');
  if(d.action&&(!has(d,['actionOwner','due','status'])||!['Open','In Progress','Done','Cancelled'].includes(d.status)))return error('Assign an owner, due date and status to the follow-up action.');
  if(d.action&&d.status==='Done'&&!d.completed)d.completed=businessDate();
  if(d.status!=='Done')d.completed='';
  const activities=[...(lead.activities||[])];
  const index=activities.findIndex(a=>a.id&&a.id===body.activityId);
  if(body.activityId&&index<0)return error('Activity not found.',404);
  if(index>=0)activities[index]={...activities[index],...d,updatedBy:email};
  else activities.push({...d,id:crypto.randomUUID(),author:email});
  record={...lead,activities};
 }else if(body.action==='intake'&&salesAllowed(role)&&isIntake(lead)){
  const decision=body.data?.decision;
  const note=fields(body.data,['note']).note||'';
  if(decision==='resubmit'&&lead.intake.status==='Changes requested'){
   record={...lead,intake:{...lead.intake,status:'Pending audit',submittedAt:new Date().toISOString(),submittedBy:email},activities:[...lead.activities,{id:crypto.randomUUID(),date:businessDate(),type:'Lead Audit',note:note||'Submitted for another review.',author:email}]};
  }else if(reviewing(role)&&lead.intake.status==='Pending audit'&&['accept','changes'].includes(decision)){
   if(decision==='accept'&&(lead.quality!=='Pass'||!has(lead,['auditDate','auditor','auditNotes'])))return error('Record a Pass, audit date, auditor and audit notes before accepting.');
   if(decision==='changes'&&!note)return error('Enter what the Sales team needs to change.');
   const status=decision==='accept'?'Accepted':'Changes requested';
   record={...lead,intake:{...lead.intake,status,note,reviewedAt:new Date().toISOString(),reviewedBy:email},activities:[...lead.activities,{id:crypto.randomUUID(),date:businessDate(),type:decision==='accept'?'Lead Acceptance':'Lead Audit',note:note||'Accepted into the sales pipeline.',author:email}]};
  }else return error('This lead is not ready for that review action.',403);
 }else if(body.action==='handover'&&salesAllowed(role)&&lead&&moves(lead.stage)){
  const d=fields(body.data,handoverKeys);
  if(role==='sales'&&lead.stage==='Closed Won'&&lead.project&&lead.project.status!=='Handover Pending')return error('Ops has accepted the handover. Ask Management or Admin to return it to Handover Pending before editing.',409);
  record={...lead,salesHandover:{...d,updatedBy:email,updatedAt:new Date().toISOString()}};
 }else if(body.action==='project'&&opsAllowed(role)&&lead?.stage==='Closed Won'){
  const d=fields(body.data,opsKeys);
  if(!opsOwners.includes(d.owner)||!projectStatuses.includes(d.status))return error('Choose an Ops owner and project status.');
  if(!['Handover Pending','Cancelled'].includes(d.status)){
   if(!has(lead.salesHandover,['client','signed','scope','volume','commercials','dates','quality','security','risks','docs','approvals']))return error('Sales must complete the handover brief before Ops accepts it.');
   if(!has(d,['acceptance','staffing','training','tools','readiness','deliverables','qa','blockers']))return error('Complete the Ops acceptance checklist before changing the project status.');
  }
  if(d.status==='Completed'&&!has(d,['end','signoff','invoice','closure']))return error('Enter the actual end date, client sign-off, invoice status and closure notes.');
  record={...lead,project:{...d,updatedBy:email,updatedAt:new Date().toISOString()}};
 }else if(body.action==='restore'&&role==='admin'){
  if(!Array.isArray(body.records)||body.records.length>2000)return error('Choose a valid tracker backup.');
  for(const old of body.records){
   const n=seq(old?.id);
   if(!Number.isSafeInteger(n)||n<1||!old.company||!stages.includes(old.stage)||!Array.isArray(old.activities))return error('The backup contains an invalid lead.');
   const j=leads.findIndex(l=>seq(l.id)===n&&String(l.company).toLowerCase()===String(old.company).toLowerCase());
   if(j>=0){
    const current=leads[j];
    const restored=old.activities.filter(a=>a&&typeof a.note==='string'&&!current.activities.some(b=>b.date===a.date&&b.type===a.type&&b.note===a.note));
    leads[j]={...old,...current,activities:[...current.activities,...restored],project:current.project||old.project};
    continue;
   }
   const number=leads.some(l=>seq(l.id)===n)?Math.max(...leads.map(l=>seq(l.id)))+1:n;
   leads.push({...old,id:idFor(number,old.stage),currency:old.currency||'INR'});
  }
 }else return error('Your role cannot make this change.',403);
 if(record){
  if(i>=0)leads[i]=record;else leads.push(record);
 }
 const serialized=JSON.stringify(leads);
 if(new TextEncoder().encode(serialized).length>1400000)return error('The tracker has reached its storage limit.',413);
 const result=await db.prepare('UPDATE tracker_state SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(serialized,revision).run();
 if(result.meta.changes!==1)return error('The tracker changed. Reload and try again.',409);
 return json({leads:visible(leads,role),revision:revision+1,id:record?.id});
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 const email=(request.headers.get('tracker-user-email')||'').trim().toLowerCase();
 const authenticated=Boolean(email&&request.headers.get('tracker-user-id'));
 if(url.pathname==='/logo.jpeg'&&request.method==='GET')return new Response(Uint8Array.from(atob(LOGO),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=3600'}});
 if(url.pathname==='/app.js'&&request.method==='GET')return new Response(APP,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
 if(!authenticated)return url.pathname.startsWith('/api/')?error('Sign in to continue.',401):gate('Sign in to the tracker','Use the email and password provided by your administrator.','/login','Sign in');
 try{
  if(!env.DB)return error('Shared tracker storage is unavailable.',503);
  const adminEmail=String(env.TRACKER_ADMIN_EMAIL||'').trim().toLowerCase();
  const previousAdmin=String(env.TRACKER_PREVIOUS_ADMIN_EMAIL||'').trim().toLowerCase();
  if(!adminEmail)return error('Tracker administrator is not configured.',503);
  const role=await getRole(env.DB,email,adminEmail,previousAdmin);
  if(!role)return url.pathname.startsWith('/api/')?error('An administrator must assign your tracker role.',403):gate('Access pending','Ask your tracker administrator to assign your role.','/login','Switch account');
  if(request.method==='POST'){
   const origin=request.headers.get('Origin');
   if((origin&&origin!==url.origin)||!request.headers.get('Content-Type')?.startsWith('application/json'))return error('Unsupported request.',415);
   if(Number(request.headers.get('Content-Length'))>1600000)return error('Request is too large.',413);
  }
  if(url.pathname==='/api/users')return role==='admin'?await userAdmin(request,env.DB,adminEmail,previousAdmin):error('Administrator access required.',403);
  if(url.pathname==='/api/state'){
   if(request.method==='GET'){const state=await getState(env.DB);return json({role,email,...state,leads:visible(state.leads,role)});}
   if(request.method==='POST')return await change(request,env.DB,role,email);
   return error('Method unavailable.',405);
  }
  if(url.pathname==='/'&&request.method==='GET')return new Response(HTML,{headers:htmlHeaders});
  return error('Not found.',404);
 }catch(err){
  console.error('Tracker request failed',err?.message);
  return error('The tracker could not complete this request.',500);
 }
}};
