import http from 'node:http';
import worker from '../dist/server/index.js';
import { DB, normalizeEmail, validEmail, authenticate, createSession, sessionEmail, revokeSession, sessionSeconds } from './database.mjs';

const admin=normalizeEmail(process.env.TRACKER_ADMIN_EMAIL);
if(!validEmail(admin))throw Error('Set TRACKER_ADMIN_EMAIL to the initial administrator’s email.');
const port=Number(process.env.PORT||3000);
const origin=new URL(process.env.TRACKER_ORIGIN||'http://localhost:'+port);
const loopback=['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
if(origin.href!==origin.origin+'/'||(!loopback&&origin.protocol!=='https:'))throw Error('Use an HTTPS TRACKER_ORIGIN without a path for a hosted deployment.');
const secure=origin.protocol==='https:';
const cookieName=secure?'__Host-adept_session':'adept_session';
const cookie=(token,maxAge)=>`${cookieName}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
const plain=(message,status=400)=>new Response(message,{status});
const redirect=(to,sessionCookie)=>new Response(null,{status:303,headers:{Location:to,...(sessionCookie?{'Set-Cookie':sessionCookie}:{})}});
const login=(message='',status=200)=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Adept GIC sign in</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f5fa;color:#233764;font:16px system-ui}main{box-sizing:border-box;width:min(420px,calc(100% - 32px));background:white;padding:28px;border-radius:14px;border-top:4px solid #ff7900}img{width:180px}label{display:grid;gap:5px;margin-bottom:14px}input,button{font:inherit;padding:10px;border:1px solid #8f9eb1;border-radius:6px}button{background:#233764;color:white;font-weight:bold}p[role]{color:#9b2828}</style><main><img src="/logo.jpeg" alt="Adept GIC"><h1>Sign in</h1><p>Use your Adept GIC tracker email and password.</p>${message?`<p role="alert">${message}</p>`:''}<form method="post" action="/login"><label>Email<input type="email" name="email" autocomplete="username" maxlength="254" required></label><label>Password<input type="password" name="password" autocomplete="current-password" maxlength="1024" required></label><button type="submit">Sign in</button></form></main></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8'}});
const attempts=new Map();
let windowStart=Date.now(),globalAttempts=0;
function allowAttempt(email){
 const now=Date.now();
 if(now-windowStart>=60000){attempts.clear();globalAttempts=0;windowStart=now;}
 const used=attempts.get(email)||0;
 if(used>=5||globalAttempts>=30)return false;
 attempts.set(email,used+1);
 globalAttempts++;
 return true;
}
async function readBody(req,max){
 let size=0;
 const chunks=[];
 for await(const chunk of req){
  size+=chunk.length;
  if(size>max)throw Object.assign(Error('Request is too large.'),{status:413});
  chunks.push(chunk);
 }
 return Buffer.concat(chunks);
}
async function route(req){
 const url=new URL(req.url,origin);
 if(url.origin!==origin.origin)return plain('Invalid request URL.');
 const method=req.method;
 if(!['GET','HEAD','POST'].includes(method))return plain('Method unavailable.',405);
 if(method==='POST'&&req.headers.origin!==origin.origin)return plain('Invalid request origin.',403);
 const token=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 const email=sessionEmail(token);
 if(url.pathname==='/login'){
  if(method==='GET')return login();
  if(method!=='POST')return plain('Method unavailable.',405);
  if(!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))return plain('Unsupported request.',415);
  const form=new URLSearchParams((await readBody(req,12000)).toString());
  const account=normalizeEmail(form.get('email'));
  if(!allowAttempt(validEmail(account)?account:''))return login('Too many attempts. Try again in a minute.',429);
  if(!authenticate(account,form.get('password')))return login('Email or password is incorrect.',401);
  revokeSession(token);
  return redirect('/',cookie(createSession(account),sessionSeconds));
 }
 if(url.pathname==='/logout'){
  if(method!=='POST')return plain('Method unavailable.',405);
  revokeSession(token);
  return redirect('/login',cookie('',0));
 }
 if(!email&&url.pathname==='/')return redirect('/login');
 const headers=new Headers();
 if(req.headers['content-type'])headers.set('Content-Type',req.headers['content-type']);
 if(req.headers.origin)headers.set('Origin',req.headers.origin);
 if(email){
  headers.set('tracker-user-email',email);
  headers.set('tracker-user-id',email);
 }
 const body=method==='POST'?await readBody(req,1600000):undefined;
 return worker.fetch(new Request(url,{method,headers,body}),{DB,TRACKER_ADMIN_EMAIL:admin});
}
http.createServer(async(req,res)=>{
 let response;
 try{response=await route(req);}catch(err){
  response=plain(err.status?err.message:'The tracker could not complete this request.',err.status||500);
 }
 const headers=Object.fromEntries(response.headers);
 res.writeHead(response.status,{...headers,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});
 res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
}).listen(port,process.env.TRACKER_HOST||'127.0.0.1',()=>console.log('Adept GIC tracker is listening on port '+port));
