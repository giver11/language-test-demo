/* Cookora In compatibility layer. Keeps wc-* storage keys while upgrading pantry records. */
(function(){
const now=()=>new Date().toISOString();
let pantryQuery="",pantryFilter="all",wakeLock=null;
pantry=pantry.map(item=>({
 n:item.n,q:Number(item.q)||0,u:item.u||"piece",e:item.e||item.expiry||"",
 created_at:item.created_at||now(),updated_at:item.updated_at||item.created_at||now()
}));
save();
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function daysLeft(item){return item.e?Math.ceil((new Date(item.e+"T23:59:59")-new Date())/86400000):Infinity}
function pantryLabel(key){
 const copy={
  en:{search:"Search pantry",all:"All",soon:"Use soon",expired:"Expired",zero:"Out of stock",device:"Saved on this device · existing wc-* data preserved"},
  ko:{search:"팬트리 검색",all:"전체",soon:"우선 사용",expired:"기한 지남",zero:"재고 없음",device:"이 기기에 저장됨 · 기존 wc-* 데이터 유지"},
  es:{search:"Buscar despensa",all:"Todo",soon:"Usar pronto",expired:"Caducado",zero:"Agotado",device:"Guardado en este dispositivo · datos wc-* conservados"},
  ja:{search:"パントリー検索",all:"すべて",soon:"早めに使用",expired:"期限切れ",zero:"在庫なし",device:"この端末に保存 · 既存の wc-* データを維持"},
  zh:{search:"搜索食材",all:"全部",soon:"尽快使用",expired:"已过期",zero:"无库存",device:"保存在此设备 · 保留现有 wc-* 数据"}
 };
 return (copy[lang()]||copy.en)[key];
}
function installTools(){
 const rows=$("#pantryRows");if(!rows||$("#pantryTools"))return;
 const tools=document.createElement("div");tools.id="pantryTools";tools.className="search";
 tools.innerHTML='<input id="pantrySearch" aria-label="Search pantry"><select id="pantryFilter" aria-label="Pantry filter"><option value="all"></option><option value="soon"></option><option value="expired"></option><option value="zero"></option></select>';
 rows.parentElement.insertBefore(tools,rows);
 $("#pantrySearch").oninput=e=>{pantryQuery=e.target.value.trim().toLowerCase();render()};
 $("#pantryFilter").onchange=e=>{pantryFilter=e.target.value;render()};
}
const baseRender=render;
render=function(){
 baseRender();installTools();
 const search=$("#pantrySearch"),select=$("#pantryFilter");
 if(search){search.placeholder=pantryLabel("search");search.value=pantryQuery}
 if(select){["all","soon","expired","zero"].forEach((key,i)=>select.options[i].textContent=pantryLabel(key));select.value=pantryFilter}
 let shown=pantry.map((item,index)=>({item,index,days:daysLeft(item)}))
  .filter(x=>!pantryQuery||ingredientName(x.item.n).toLowerCase().includes(pantryQuery))
  .filter(x=>pantryFilter==="all"||(pantryFilter==="soon"&&x.days>=0&&x.days<=3)||(pantryFilter==="expired"&&x.days<0)||(pantryFilter==="zero"&&x.item.q<=0))
  .sort((a,b)=>a.days-b.days||a.item.n.localeCompare(b.item.n));
 $("#pantryRows").innerHTML=shown.map(({item,index,days})=>{
  const state=days<0?"⚠ "+pantryLabel("expired"):days<=3?"⚠ "+pantryLabel("soon"):"";
  return '<div class="row"><span style="font-size:24px">🥬</span><div class="grow"><b>'+esc(ingredientName(item.n))+'</b><div class="small">'+esc(item.u)+(item.e?' · '+esc(item.e):'')+(state?' · '+state:'')+'</div></div><div class="qtyedit"><input type="number" min="0" step="0.1" value="'+item.q+'" aria-label="Quantity" onchange="wcUpdateQuantity('+index+',this.value)"></div><button class="trash" onclick="removePantry('+index+')">'+tx().remove+'</button></div>';
 }).join('')+'<p class="small">'+pantryLabel("device")+'</p>';
};
window.wcUpdateQuantity=function(index,value){const item=pantry[index];if(!item)return;item.q=Math.max(0,Number(value)||0);item.updated_at=now();save();render()};
const baseAdd=addPantry;
addPantry=function(){const before=pantry.length;baseAdd();if(pantry.length||before){const item=pantry[0];if(item){item.created_at=item.created_at||now();item.updated_at=now();save();render()}}};
async function lockScreen(){try{if("wakeLock" in navigator)wakeLock=await navigator.wakeLock.request("screen")}catch(_){}}
function unlockScreen(){try{wakeLock&&wakeLock.release()}catch(_){}wakeLock=null}
const baseStart=startCook;
startCook=function(id){baseStart(id);lockScreen()};
const baseEnd=endCook;
endCook=function(){unlockScreen();baseEnd()};
const baseNext=nextStep;
nextStep=function(){
 const finishing=current&&step>=recipeSteps(current).length-1;
 const used=finishing?current.x.slice():[];
 baseNext();
 if(finishing){used.forEach(name=>{const item=pantry.find(x=>x.n===name);if(item){item.q=Math.max(0,(Number(item.q)||0)-1);item.updated_at=now()}});save();render()}
};
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&current)lockScreen()});
render();
})();
