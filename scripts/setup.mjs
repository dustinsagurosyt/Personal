import './write-icons.mjs';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
const cli=new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url).pathname;
function wrangler(args,{input,capture=false}={}){
 const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',input,stdio:input!==undefined?['pipe','inherit','inherit']:capture?['inherit','pipe','inherit']:'inherit'});
 if(result.error||result.status!==0)throw Error('Setup stopped. Fix the message above, then run npm run setup again.');
 if(capture){process.stdout.write(result.stdout);return result.stdout}
}
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
 const config=JSON.parse(readFileSync('wrangler.json','utf8'));
 console.log('This sets up the app on your own Cloudflare account. Use the Workers Free plan.');
 const subject=(await rl.question('Contact email for Apple push delivery (used only as the server contact): ')).trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject))throw Error('Please run setup again with a valid email.');
 rl.pause();
 wrangler(['login']);
 if(!config.kv_namespaces.some(n=>n.binding==='REMINDERS'&&n.id)){
   // Persist the returned namespace ID before deploying, so a retry reuses it.
   const output=wrangler(['kv','namespace','create','ATTENTION_RESET_REMINDERS','--update-config=false'],{capture:true});
   const match=output.match(/"id"\s*:\s*"([a-f0-9]{32})"/i)||output.match(/\bid\s*=\s*"([a-f0-9]{32})"/i);
   if(!match)throw Error('Copy the namespace ID shown above into wrangler.json as {"binding":"REMINDERS","id":"YOUR_ID"}, then run setup again.');
   config.kv_namespaces.push({binding:'REMINDERS',id:match[1]});
   writeFileSync('wrangler.json',JSON.stringify(config,null,2)+'\n');
 }
 wrangler(['deploy']);
 // Re-running setup preserves signing keys: existing iPhone subscriptions keep working.
 const secretsOutput=wrangler(['secret','list'],{capture:true});
 let existing;try{const match=secretsOutput.match(/\[\s*(?:\{[\s\S]*\}\s*)?\]/);existing=JSON.parse(match?.[0]||'invalid')}catch{throw Error('Could not safely read existing notification keys. Setup stopped without changing them.')}
 const keyNames=existing.map(s=>s.name);
 if(keyNames.includes('VAPID_PUBLIC_KEY')!==keyNames.includes('VAPID_PRIVATE_KEY'))throw Error('Only one notification key exists. Inspect the app secrets before continuing; setup will not replace them automatically.');
 if(!keyNames.includes('VAPID_PUBLIC_KEY')){
   const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
   const jwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey),raw=await webcrypto.subtle.exportKey('raw',pair.publicKey);
   wrangler(['secret','bulk'],{input:JSON.stringify({VAPID_PUBLIC_KEY:Buffer.from(raw).toString('base64url'),VAPID_PRIVATE_KEY:jwk.d,VAPID_SUBJECT:'mailto:'+subject})});
 }else{
   wrangler(['secret','bulk'],{input:JSON.stringify({VAPID_SUBJECT:'mailto:'+subject})});
 }
 console.log('\nReady. Open the workers.dev URL printed above in Safari, add it to your Home Screen, then enable notifications.');
 console.log('Commit the updated wrangler.json to GitHub. Your private signing keys were sent directly to Cloudflare; they were not saved to a file.');
}catch(e){console.error(e.message);process.exitCode=1}finally{rl.close()}
