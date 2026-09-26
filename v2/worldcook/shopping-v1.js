(function(){
const U={en:["Shopping list","Missing ingredients","Open retailer search","WorldCook does not place or pay for orders. Review and pay on the retailer site."],ko:["장바구니","부족한 재료","판매처에서 검색","WorldCook은 주문이나 결제를 대신하지 않습니다. 판매처에서 직접 확인하고 결제하세요."],es:["Lista de compra","Ingredientes que faltan","Buscar en tienda","WorldCook no realiza ni paga pedidos. Revisa y paga en la tienda."],ja:["買い物リスト","不足している食材","販売店で検索","WorldCookは注文や決済を行いません。販売店で確認し、ご自身で決済してください。"],zh:["购物清单","缺少的食材","前往零售商搜索","WorldCook不会代替下单或付款，请在零售商网站自行确认并付款。"]};
function ui(){return U[lang()]||U.en}
function missingFor(r){let h=new Set(pantry.map(x=>x.n));return (r.x||[]).filter(x=>!h.has(x))}
function retailerSearch(q){
 let l=lang(),host=l==="ko"?"search.shopping.naver.com/search/all?query=":l==="ja"?"www.amazon.co.jp/s?k=":"www.walmart.com/search?q=";
 return "https://"+host+encodeURIComponent(q);
}
window.openShoppingForRecipe=function(id){
 let r=R.find(x=>x.id===id);if(!r)return;let m=missingFor(r),x=ui(),q=m.map(ingredientName).join(", ");
 $("#modal").innerHTML='<div class="modal" onclick="if(event.target===this)closeModal()"><div class="sheet"><button class="close" style="float:right;color:#222;background:#eee" onclick="closeModal()">✕</button><div class="meta">'+x[0]+'</div><h2>'+x[1]+'</h2>'+(m.length?m.map(n=>'<div class="row"><span>🛒</span><div class="grow"><b>'+ingredientName(n)+'</b></div></div>').join("")+'<p><a class="primary" target="_blank" rel="noopener noreferrer" href="'+retailerSearch(q)+'">'+x[2]+'</a></p>':'<p>✓</p>')+'<p class="small">'+x[3]+'</p></div></div>';
};
})();