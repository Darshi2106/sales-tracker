import { normalizeEmail, validEmail, setPassword } from './database.mjs';
const email=normalizeEmail(process.argv[2]);
if(!validEmail(email)||process.stdin.isTTY){
 console.error('Usage: supply a password through redirected stdin, and pass the account email as the argument.');
 process.exit(1);
}
let password='';
for await(const chunk of process.stdin){
 password+=chunk;
 if(password.length>1026)throw Error('Password is too long.');
}
password=password.replace(/\r?\n$/,'');
if(password.length<15||password.length>1024){
 console.error('Use a password between 15 and 1024 characters.');
 process.exit(1);
}
setPassword(email,password);
console.log('Login saved for '+email+'. Existing sessions for the account were revoked.');
