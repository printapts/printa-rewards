import {period,freshness} from './report.js';
const $=id=>document.getElementById(id),config=window.PRINTA_MOBILE||{};
let session=null,shop=null,snapshot=null,received=null,polling=false;
let pairing=new URLSearchParams(location.hash.slice(1)).get('pair');
history.replaceState(null,'',location.pathname+location.search);
if(pairing&&!/^[a-f0-9]{64}$/.test(pairing))pairing=null;
const endpoint=String(config.endpoint||'').replace(/\/$/,'');
const configured=(()=>{try{return new URL(endpoint).protocol==='https:'&&!!config.publishableKey}catch{return false}})();
function notice(text){$('notice').textContent=text;}
function clear(){session=null;shop=null;snapshot=null;received=null;$('metrics').replaceChildren();$('trend').replaceChildren();$('dashboard').hidden=$('account').hidden=$('pair').hidden=true;$('login').hidden=false;$('password').value='';}
async function request(path,body,auth=false,method=body===undefined?'GET':'POST'){
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(auth){if(!session)throw Error('auth');headers.Authorization='Bearer '+session.access_token;}
 const response=await fetch(endpoint+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok){if((auth&&(response.status===401||response.status===403))||(path.includes('grant_type=refresh_token')&&[400,401,403].includes(response.status))){clear();notice('انتهت الجلسة أو أُلغي الوصول؛ سجّل الدخول مجددًا.');}throw Error(response.status===429?'rate':'request');}
 return response.status===204?null:response.json();
}
async function signedIn(value){session={...value,expires_at:Date.now()+value.expires_in*1000};$('password').value='';$('login').hidden=true;$('account').hidden=false;$('pair').hidden=!pairing;await refresh();}
async function guard(action){document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await action();}catch{if(session)notice('تعذر الاتصال. المعروض هو آخر ملخص مستلم، وليس بيانات لحظية.');else notice('تعذر الدخول؛ راجع الحساب وتأكيد البريد والاتصال.');}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);if(!configured)$('login-button').disabled=$('signup').disabled=true;}}
$('login-form').addEventListener('submit',e=>{e.preventDefault();guard(async()=>{const value=await request('/auth/v1/token?grant_type=password',{email:$('email').value.trim(),password:$('password').value});notice('');await signedIn(value);});});
$('signup').onclick=()=>guard(async()=>{if(!$('login-form').reportValidity())return;await request('/auth/v1/signup',{email:$('email').value.trim(),password:$('password').value});$('password').value='';notice('راجع بريدك لتأكيد الحساب، ثم سجّل الدخول هنا.');});
$('approve').onclick=()=>guard(async()=>{if(!pairing||!$('shop-name').value.trim())return;if(!confirm('ربط هذا الجهاز بحساب مطبعتك وإيقاف أي جهاز رئيسي سابق؟'))return;await request('/rest/v1/rpc/printa_approve',{shop_name:$('shop-name').value.trim(),device_hash:pairing},true);pairing=null;$('pair').hidden=true;await refresh();notice('تم ربط الحساب. ارجع إلى Printa واضغط «تأكيد الحساب وإكمال الربط» لبدء إرسال الملخصات.');});
async function refresh(){
 if(!session||polling)return;polling=true;
 try{
  if(Date.now()>session.expires_at-60000){const value=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});session={...value,expires_at:Date.now()+value.expires_in*1000};}
  const shops=await request('/rest/v1/printa_shops?select=id,name',undefined,true);
  if(!shops.length){shop=null;snapshot=null;$('dashboard').hidden=true;$('metrics').replaceChildren();$('trend').replaceChildren();notice(pairing?'أكّد الربط أدناه.':'افتح «متابعة الموبايل» من البرنامج لربط حسابك.');return;}
  shop=shops[0];$('shop-title').textContent=shop.name;$('shop-name').value=shop.name;
  const rows=await request('/rest/v1/printa_snapshots?select=received_at,payload&shop_id=eq.'+encodeURIComponent(shop.id),undefined,true);
  if(!rows.length){snapshot=null;$('dashboard').hidden=true;$('metrics').replaceChildren();$('trend').replaceChildren();notice('في انتظار أول ملخص من الجهاز الرئيسي.');return;}
  snapshot=rows[0].payload;received=rows[0].received_at;
  const from=$('from'),to=$('to');from.min=to.min=snapshot.days[0].date;from.max=to.max=snapshot.today;
  if(!from.value||from.value<from.min)from.value=snapshot.today;if(!to.value||to.value>to.max)to.value=snapshot.today;
  $('dashboard').hidden=false;notice('');render();
 }finally{polling=false;}
}
function render(){
 if(!snapshot)return;const from=$('from').value,to=$('to').value;if(from>to){notice('اختر بداية قبل نهاية الفترة.');return;}
 const {days,totals:t,outstanding}=period(snapshot,from,to),money=n=>new Intl.NumberFormat('en-EG',{maximumFractionDigits:2}).format(n)+' ج';
 const cards=[['المبيعات',money(t.sales)],['العمليات',String(t.orders)],['صافي حركة الدرج',money(t.drawerBalance)],['نقدي مستلم',money(t.cash)],['تحويلات مستلمة',money(t.insta)],['المسدد لأوردرات الفترة',money(t.actualSales)],['متبقي أوردرات الفترة',money(t.pendingToday)],['تحصيل أوردرات سابقة',money(t.previousCollections)],['إضافات الدرج',money(t.additions)],['مسحوبات الدرج',money(t.withdrawals)],['إجمالي المتبقي الحالي',money(outstanding)]];
 $('metrics').replaceChildren(...cards.map(([label,value])=>{const div=document.createElement('div');div.className='metric';const span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=value;div.append(span,strong);return div;}));
 $('freshness').textContent=(freshness(received)==='fresh'?'آخر مزامنة: ':'البيانات قديمة · آخر مزامنة: ')+new Date(received).toLocaleString('ar-EG')+' · توقيت المطبعة: '+snapshot.timeZone;
 const chart=days.slice(-14),maximum=Math.max(1,...chart.map(d=>d.sales));
 $('trend').replaceChildren(...chart.map(day=>{const div=document.createElement('div'),bar=document.createElement('i'),label=document.createElement('small');div.className='bar';div.title=day.date+' · '+money(day.sales);div.setAttribute('aria-label',div.title);bar.style.height=Math.round(day.sales/maximum*115)+'px';label.textContent=day.date.slice(5);div.append(bar,label);return div;}));
}
$('from').onchange=$('to').onchange=render;$('refresh').onclick=()=>guard(refresh);
async function logout(scope){try{await request('/auth/v1/logout?scope='+scope,{},true);clear();notice(scope==='global'?'تم إلغاء جلسات الموبايلات.':'تم الخروج من هذا الموبايل.');}catch{clear();notice('تم مسح الجلسة من الشاشة؛ تعذر تأكيد إلغائها على الخدمة. أعد المحاولة عند عودة الاتصال.');}}
$('logout').onclick=()=>guard(()=>logout('local'));
$('logout-all').onclick=()=>guard(async()=>{if(confirm('إلغاء جلسات كل الموبايلات؟'))await logout('global');});
$('revoke').onclick=()=>guard(async()=>{if(!confirm('إيقاف استقبال بيانات الرئيسي؟ سيحتاج إعادة الربط.'))return;await request('/rest/v1/rpc/printa_revoke_device',{},true);notice('تم إيقاف استقبال البيانات؛ آخر ملخص محفوظ.');});
setInterval(()=>{if(session&&!document.hidden)refresh().catch(()=>{if(snapshot)render();notice('الاتصال متوقف؛ راجع وقت آخر مزامنة.');});},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)refresh().catch(()=>notice('تعذر تحديث البيانات.'));});
if(!configured){notice('صفحة المتابعة لم تُربط بالخدمة بعد. لا توجد بيانات تجريبية معروضة.');$('login-button').disabled=$('signup').disabled=true;}
