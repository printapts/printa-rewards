export function period(snapshot,from,to){
 if(!snapshot||snapshot.schemaVersion!==1||!Array.isArray(snapshot.days))throw Error('unsupported');
 const days=snapshot.days.filter(d=>d.date>=from&&d.date<=to);
 const fields=['orders','sales','actualSales','cash','insta','pendingToday','previousCollections','additions','withdrawals','collections','drawerBalance'];
 const totals=Object.fromEntries(fields.map(k=>[k,days.reduce((sum,d)=>sum+Number(d[k]||0),0)]));
 return {days,totals,outstanding:Number(snapshot.outstanding)};
}
export function freshness(receivedAt,now=Date.now()){
 const age=now-Date.parse(receivedAt);return Number.isFinite(age)&&age>=-60000&&age<150000?'fresh':'stale';
}
