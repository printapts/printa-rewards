import {renderOrders,clearOrders} from './orders.js?v=74';
import {period,freshness} from './report.js?v=74';
const $=id=>document.getElementById(id),config=window.PRINTA_MOBILE||{};
let session=null,shop=null,snapshot=null,received=null,polling=false;
const callback=new URLSearchParams(location.hash.slice(1));
let creating=false,recovery=null;
let pairing=callback.get('pair');
history.replaceState(null,'',location.pathname+location.search);
if(pairing&&!/^[a-f0-9]{64}$/.test(pairing))pairing=null;
const endpoint=String(config.endpoint||'').replace(/\/$/,'');
const configured=(()=>{try{return new URL(endpoint).protocol==='https:'&&!!config.publishableKey}catch{return false}})();
function notice(text){$('notice').textContent=text;}
function clear(){clearOrders();session=null;shop=null;snapshot=null;received=null;$('metrics').replaceChildren();$('trend').replaceChildren();$('dashboard').hidden=$('account').hidden=$('pair').hidden=true;$('login').hidden=false;$('password').value='';$('recovery').hidden=true;recovery=null;}
async function request(path,body,auth=false,method=body===undefined?'GET':'POST'){
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(auth){if(!session)throw Error('auth');headers.Authorization='Bearer '+session.access_token;}
 const response=await fetch(endpoint+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok){if((auth&&(response.status===401||response.status===403))||(path.includes('grant_type=refresh_token')&&[400,401,403].includes(response.status))){clear();notice('انتهت الجلسة أو أُلغي الوصول؛ سجّل الدخول مجددًا.');}let errorBody={};try{errorBody=await response.json();}catch{}const code=errorBody.code||errorBody.error_code;const messages={invalid_credentials:'البريد أو كلمة المرور غير صحيحة. لو الحساب اتعمل قبل كده استخدم «نسيت كلمة المرور» بدل إنشاء حساب جديد.',email_not_confirmed:'الحساب اتعمل؛ افتح رسالة تأكيد البريد أولًا، ثم ارجع وسجّل الدخول.',weak_password:'اختَر كلمة مرور أقوى من 8 حروف على الأقل.',user_already_exists:'البريد مسجل بالفعل؛ استخدم الدخول أو نسيت كلمة المرور.',signup_disabled:'إنشاء الحسابات متوقف حاليًا على الخدمة.',email_address_invalid:'راجع كتابة البريد الإلكتروني.',over_email_send_rate_limit:'تم إرسال رسائل كثيرة؛ انتظر قليلًا قبل طلب رسالة أخرى.',over_request_rate_limit:'محاولات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.',otp_expired:'رابط البريد انتهى أو استُخدم بالفعل؛ اطلب رابطًا جديدًا من الصفحة.'};const error=new Error('request');error.userMessage=messages[code]||(response.status===429?'محاولات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.':null);throw error;}
 return response.status===204?null:response.json();
}
async function signedIn(value){session={...value,expires_at:Date.now()+value.expires_in*1000};$('password').value='';$('login').hidden=true;$('account').hidden=false;$('pair').hidden=!pairing;await refresh();}
async function guard(action){document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await action();}catch(error){if(error.userMessage)notice(error.userMessage);else if(session)notice('تعذر الاتصال. المعروض هو آخر ملخص مستلم، وليس بيانات لحظية.');else notice('تعذر الدخول؛ راجع الحساب وتأكيد البريد والاتصال.');}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);if(!configured)$('login-button').disabled=$('signup').disabled=true;}}
function mode(signup){creating=signup;$('confirm-password-row').hidden=!signup;$('confirm-password').required=signup;$('password').autocomplete=signup?'new-password':'current-password';$('login-button').textContent=signup?'إنشاء الحساب':'دخول';$('signup').textContent=signup?'عندي حساب: تسجيل الدخول':'إنشاء حساب جديد';$('password').value=$('confirm-password').value='';notice(signup?'اختَر كلمة مرور جديدة لهذا الحساب، ثم اكتبها مرة ثانية.':'');}
$('signup').onclick=()=>mode(!creating);
const returnUrl=location.origin+location.pathname;
$('login-form').addEventListener('submit',e=>{e.preventDefault();guard(async()=>{
 if(creating){if($('password').value!==$('confirm-password').value){notice('كلمتا المرور غير متطابقتين.');return;}const value=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(returnUrl),{email:$('email').value.trim(),password:$('password').value});mode(false);if(value.access_token){await signedIn(value);return;}notice('راجع بريدك لتأكيد الحساب. لو البريد مسجل من قبل، استخدم «نسيت كلمة المرور»؛ إعادة إنشاء الحساب لا تغيّر كلمة مروره.');return;}
 const value=await request('/auth/v1/token?grant_type=password',{email:$('email').value.trim(),password:$('password').value});notice('');await signedIn(value);
});});
$('forgot').onclick=()=>guard(async()=>{if(!$('email').reportValidity())return;await request('/auth/v1/recover?redirect_to='+encodeURIComponent(returnUrl),{email:$('email').value.trim()});$('password').value='';notice('لو البريد مسجل، ستصلك رسالة لتعيين كلمة مرور جديدة. افتح أحدث رسالة فقط.');});
$('recovery-form').addEventListener('submit',e=>{e.preventDefault();guard(async()=>{if(!recovery){notice('افتح رابط استعادة جديد من بريدك.');return;}if($('new-password').value!==$('repeat-password').value){notice('كلمتا المرور غير متطابقتين.');return;}session=recovery;let revoked=false;try{await request('/auth/v1/user',{password:$('new-password').value},true,'PUT');try{await request('/auth/v1/logout?scope=global',{},true);revoked=true;}catch{}}finally{session=null;}clear();mode(false);$('new-password').value=$('repeat-password').value='';notice(revoked?'تم تغيير كلمة المرور وإلغاء الجلسات السابقة. سجّل الدخول بكلمة المرور الجديدة.':'تم تغيير كلمة المرور. سجّل الدخول بالجديدة؛ تعذر تأكيد إلغاء الجلسات السابقة.');});});
$('cancel-recovery').onclick=()=>{clear();mode(false);};
async function finishCallback(){if(callback.get('error')){notice('رابط البريد انتهى أو استُخدم. لو أكدت بريدك سابقًا، سجّل الدخول أو استخدم نسيت كلمة المرور.');return;}if(callback.get('type')!=='recovery'){if(callback.get('access_token'))notice('تم تأكيد البريد. سجّل الدخول بكلمة المرور التي اخترتها عند إنشاء الحساب.');return;}const token=callback.get('access_token');if(!token){notice('رابط استعادة غير مكتمل؛ اطلب رسالة جديدة.');return;}recovery={access_token:token,refresh_token:callback.get('refresh_token'),expires_at:Date.now()+3600000};session=recovery;try{await request('/auth/v1/user',undefined,true);session=null;$('login').hidden=true;$('recovery').hidden=false;notice('اختَر كلمة مرور جديدة لحسابك.');}catch{clear();notice('رابط الاستعادة غير صالح أو انتهى؛ اطلب رسالة جديدة.');}}

$('approve').onclick=()=>guard(async()=>{if(!pairing||!$('shop-name').value.trim())return;if(!confirm('ربط هذا الجهاز بحساب مطبعتك وإيقاف أي جهاز رئيسي سابق؟'))return;await request('/rest/v1/rpc/printa_approve',{shop_name:$('shop-name').value.trim(),device_hash:pairing},true);pairing=null;$('pair').hidden=true;await refresh();notice('تم ربط الحساب. ارجع إلى Printa واضغط «تأكيد الحساب وإكمال الربط» لبدء إرسال الملخصات.');});
async function refresh(){
 if(!session||polling)return;polling=true;
 try{
  if(Date.now()>session.expires_at-60000){const value=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});session={...value,expires_at:Date.now()+value.expires_in*1000};}
  const shops=await request('/rest/v1/printa_shops?select=id,name',undefined,true);
  if(!shops.length){shop=null;snapshot=null;clearOrders();$('dashboard').hidden=true;$('metrics').replaceChildren();$('trend').replaceChildren();notice(pairing?'أكّد الربط أدناه.':'افتح «متابعة الموبايل» من البرنامج لربط حسابك.');return;}
  shop=shops[0];$('shop-title').textContent=shop.name;$('shop-name').value=shop.name;
  const rows=await request('/rest/v1/printa_snapshots?select=received_at,payload&shop_id=eq.'+encodeURIComponent(shop.id),undefined,true);
  if(!rows.length){snapshot=null;clearOrders();$('dashboard').hidden=true;$('metrics').replaceChildren();$('trend').replaceChildren();notice('في انتظار أول ملخص من الجهاز الرئيسي.');return;}
  snapshot=rows[0].payload;received=rows[0].received_at;
  const from=$('from'),to=$('to');from.min=to.min=snapshot.days[0].date;from.max=to.max=snapshot.today;
  if(!from.value||from.value<from.min)from.value=snapshot.today;if(!to.value||to.value>to.max)to.value=snapshot.today;
  $('dashboard').hidden=false;notice('');render();
 }finally{polling=false;}
}
function render(){
 if(!snapshot)return;const from=$('from').value,to=$('to').value;if(from>to){notice('اختر بداية قبل نهاية الفترة.');return;}
 renderOrders(snapshot,from,to);
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

if(configured)finishCallback();
