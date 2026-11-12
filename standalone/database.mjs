import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const file=resolve(process.env.TRACKER_DB||'data/tracker.sqlite');
mkdirSync(dirname(file),{recursive:true,mode:0o700});
const db=new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec(readFileSync(new URL('../drizzle/0000_tracker.sql',import.meta.url),'utf8'));
db.exec(`
CREATE TABLE IF NOT EXISTS auth_accounts (email TEXT PRIMARY KEY, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (digest TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessions_expires ON auth_sessions(expires);
`);

export const normalizeEmail=value=>String(value||'').trim().toLowerCase();
export const validEmail=email=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const opts={N:32768,r:8,p:3,maxmem:64*1024*1024};
export function encodePassword(password,salt=randomBytes(16).toString('hex')){
 return salt+':'+scryptSync(password,salt,64,opts).toString('hex');
}
const fake=encodePassword('placeholder',randomBytes(16).toString('hex'));
export function authenticate(email,password){
 if(typeof password!=='string'||password.length>1024)return false;
 const account=db.prepare('SELECT password FROM auth_accounts WHERE email=?').get(email);
 const stored=account?.password||fake;
 const candidate=encodePassword(password,stored.split(':')[0]);
 return timingSafeEqual(Buffer.from(candidate),Buffer.from(stored))&&Boolean(account);
}
export function setPassword(email,password){
 db.exec('BEGIN IMMEDIATE');
 try{
  db.prepare('INSERT INTO auth_accounts(email,password) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET password=excluded.password').run(email,encodePassword(password));
  db.prepare('DELETE FROM auth_sessions WHERE email=?').run(email);
  db.exec('COMMIT');
 }catch(err){db.exec('ROLLBACK');throw err;}
}
const digest=token=>createHash('sha256').update(token).digest('hex');
export const sessionSeconds=8*60*60;
export function createSession(email){
 const token=randomBytes(32).toString('base64url');
 const now=Date.now();
 db.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(now);
 db.prepare('INSERT INTO auth_sessions(digest,email,expires) VALUES (?,?,?)').run(digest(token),email,now+1000*sessionSeconds);
 return token;
}
export function sessionEmail(token){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))return null;
 return db.prepare('SELECT email FROM auth_sessions WHERE digest=? AND expires>?').get(digest(token),Date.now())?.email||null;
}
export function revokeSession(token){
 if(/^[A-Za-z0-9_-]{43}$/.test(token||''))db.prepare('DELETE FROM auth_sessions WHERE digest=?').run(digest(token));
}
export const DB={prepare(sql){
 const statement=db.prepare(sql);
 const bound=args=>({
  first:async()=>statement.get(...args),
  all:async()=>({results:statement.all(...args)}),
  run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})
 });
 return {...bound([]),bind:(...args)=>bound(args)};
}};
