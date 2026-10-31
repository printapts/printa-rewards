const $=id=>document.getElementById(id);
let current=null,from='',to='',limit=25;
const money=n=>new Intl.NumberFormat('en-EG',{maximumFractionDigits:2}).format(n)+' ج';
export function filterOrders(orders,filters){return orders.filter(o=>o.date>=filters.from&&o.date<=filters.to&&o.number.toLowerCase().includes((filters.search||'').trim().toLowerCase())&&(!filters.status||o.status===filters.status)&&(!filters.payment||(o.status==='active'&&(filters.payment==='paid'?o.remaining===0:filters.payment==='partial'?o.paid>0&&o.remaining>0:o.remaining>0)))&&(!filters.delivery||(o.status==='active'&&o.delivered===(filters.delivery==='delivered'))));}
export function clearOrders(){current=null;limit=25;$('order-list').replaceChildren();$('order-count').textContent='';$('order-summary').textContent='';$('order-search').value='';for(const id of ['order-status','order-payment','order-delivery'])$(id).value='';$('orders').hidden=true;}
export function renderOrders(snapshot,start,end){current=snapshot;from=start;to=end;limit=25;render();}
function render(){
 $('orders').hidden=false;$('order-list').replaceChildren();$('order-summary').textContent='';$('order-more').hidden=true;
 if(current?.schemaVersion!==2||!Array.isArray(current.orders)){$('order-count').textContent='تفاصيل الأوردرات تظهر بعد تثبيت تحديث .74 على الجهاز الرئيسي ووصول أول مزامنة. ملخص الكاشير متاح كالمعتاد.';return;}
 const found=filterOrders(current.orders,{from,to,search:$('order-search').value,status:$('order-status').value,payment:$('order-payment').value,delivery:$('order-delivery').value});
 $('order-count').textContent=`${found.length} أوردر مطابق · المتاح أحدث ${current.orders.length} من ${current.ordersTotal} خلال آخر 90 يومًا.`+(current.ordersTotal>current.orders.length?' القائمة محدودة؛ الأوردرات الأقدم من القائمة تُراجع من البرنامج.':'');
 const active=found.filter(o=>o.status==='active');$('order-summary').textContent='الأوردرات النشطة المطابقة: إجمالي '+money(active.reduce((n,o)=>n+o.total,0))+' · مسدد '+money(active.reduce((n,o)=>n+o.paid,0))+' · متبقي '+money(active.reduce((n,o)=>n+o.remaining,0));
 if(!found.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='لا توجد أوردرات مطابقة للفترة والفلاتر المختارة.';$('order-list').append(empty);return;}
 for(const order of found.slice(0,limit)){
  const card=document.createElement('article');card.className='order-card';const heading=document.createElement('div');heading.className='order-heading';const number=document.createElement('strong');number.textContent=order.number;number.dir='ltr';const date=document.createElement('span');date.className='hint';date.textContent=order.date+' · '+order.time;heading.append(number,date);card.append(heading);
  const badges=document.createElement('div');badges.className='order-badges';for(const [text,kind] of order.status==='cancelled'?[['ملغى','cancelled']]:[[order.remaining===0?'مسدد بالكامل':order.paid>0?'مسدد جزئيًا':'غير مسدد',order.remaining===0?'paid':'pending'],[order.delivered?'مسلّم':'غير مسلّم',order.delivered?'paid':'pending']]){const badge=document.createElement('span');badge.className='badge '+kind;badge.textContent=text;badges.append(badge);}card.append(badges);
  const amounts=document.createElement('dl');amounts.className='order-amounts';for(const [label,value] of [[order.status==='cancelled'?'الإجمالي الأصلي':'الإجمالي',order.total],['المسدد',order.paid],['المتبقي',order.remaining]]){const field=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=money(value);field.append(dt,dd);amounts.append(field);}card.append(amounts);
  const details=document.createElement('p');details.className='hint';details.textContent=order.items+' بند · '+order.sheets+' ورقة محسوبة';card.append(details);$('order-list').append(card);
 }
 $('order-more').hidden=found.length<=limit;
}
for(const id of ['order-search','order-status','order-payment','order-delivery'])$(id).addEventListener(id==='order-search'?'input':'change',()=>{limit=25;if(current)render();});
$('order-more').onclick=()=>{limit+=25;if(current)render();};
