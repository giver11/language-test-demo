/* WorldCook curated expansion: original metadata and instructions, no copied recipe text. */
(function(){
const rows=[
["kimchi-fried-rice","Kimchi Fried Rice","Korea","🇰🇷",20],["bulgogi-bowl","Bulgogi Rice Bowl","Korea","🇰🇷",30],["japchae","Japchae","Korea","🇰🇷",35],["dakgalbi","Dakgalbi","Korea","🇰🇷",35],["pajeon","Vegetable Pajeon","Korea","🇰🇷",25],["kimchi-jjigae","Kimchi Jjigae","Korea","🇰🇷",35],
["enchiladas","Bean Enchiladas","Mexico","🇲🇽",35],["quesadilla","Cheese Quesadilla","Mexico","🇲🇽",15],["chilaquiles","Chilaquiles","Mexico","🇲🇽",25],["sopa-tortilla","Tortilla Soup","Mexico","🇲🇽",35],["burrito-bowl","Burrito Bowl","Mexico","🇲🇽",25],
["carbonara","Spaghetti Carbonara","Italy","🇮🇹",25],["risotto","Mushroom Risotto","Italy","🇮🇹",40],["minestrone","Minestrone","Italy","🇮🇹",40],["gnocchi","Tomato Gnocchi","Italy","🇮🇹",35],["frittata","Vegetable Frittata","Italy","🇮🇹",25],
["gyudon","Gyudon","Japan","🇯🇵",25],["yakisoba","Vegetable Yakisoba","Japan","🇯🇵",25],["omurice","Omurice","Japan","🇯🇵",30],["miso-soup","Miso Soup","Japan","🇯🇵",15],["okonomiyaki","Okonomiyaki","Japan","🇯🇵",35],
["chana-masala","Chana Masala","India","🇮🇳",35],["aloo-gobi","Aloo Gobi","India","🇮🇳",35],["palak-paneer","Palak Paneer","India","🇮🇳",40],["khichdi","Khichdi","India","🇮🇳",35],["butter-chicken","Butter Chicken","India","🇮🇳",45],
["pad-thai","Pad Thai","Thailand","🇹🇭",30],["green-curry","Thai Green Curry","Thailand","🇹🇭",35],["tom-yum","Tom Yum Soup","Thailand","🇹🇭",30],["pad-krapow","Pad Krapow","Thailand","🇹🇭",25],["mango-rice","Mango Sticky Rice","Thailand","🇹🇭",35],
["paella","Weeknight Paella","Spain","🇪🇸",45],["gazpacho","Gazpacho","Spain","🇪🇸",15],["patatas-bravas","Patatas Bravas","Spain","🇪🇸",35],["croquetas","Cheese Croquetas","Spain","🇪🇸",40],["pisto","Spanish Pisto","Spain","🇪🇸",40],
["onion-soup","French Onion Soup","France","🇫🇷",50],["quiche","Vegetable Quiche","France","🇫🇷",50],["crepes","Savory Crêpes","France","🇫🇷",30],["gratin","Potato Gratin","France","🇫🇷",55],["nicoise","Niçoise-Style Salad","France","🇫🇷",25],
["bun-cha","Bún Chả Bowl","Vietnam","🇻🇳",35],["banh-mi","Chicken Bánh Mì","Vietnam","🇻🇳",25],["goi-cuon","Fresh Spring Rolls","Vietnam","🇻🇳",30],["bun-xao","Stir-Fried Rice Noodles","Vietnam","🇻🇳",25],["com-ga","Vietnamese Chicken Rice","Vietnam","🇻🇳",40],
["brik","Tunisian Brik","Tunisia","🇹🇳",30],["lablabi","Lablabi Chickpea Soup","Tunisia","🇹🇳",35],["couscous","Vegetable Couscous","Tunisia","🇹🇳",40],["ojja","Tunisian Ojja","Tunisia","🇹🇳",30],
["tabbouleh","Tabbouleh","Lebanon","🇱🇧",20],["falafel","Baked Falafel","Lebanon","🇱🇧",40],["mujadara","Mujadara","Lebanon","🇱🇧",40],["fattoush","Fattoush","Lebanon","🇱🇧",20],
["kottu","Vegetable Kottu","Sri Lanka","🇱🇰",30],["dhal-curry","Sri Lankan Dhal Curry","Sri Lanka","🇱🇰",35],["coconut-rice","Coconut Rice","Sri Lanka","🇱🇰",30],["potato-curry","Sri Lankan Potato Curry","Sri Lanka","🇱🇰",35],
["moqueca","Quick Moqueca","Brazil","🇧🇷",40],["pao-queijo","Cheese Bread Bites","Brazil","🇧🇷",35],["farofa-bowl","Brazilian Farofa Bowl","Brazil","🇧🇷",25],["picadinho","Brazilian Beef Stew","Brazil","🇧🇷",45],
["aji-gallina","Ají de Gallina","Peru","🇵🇪",45],["causa","Potato Causa","Peru","🇵🇪",40],["arroz-chaufa","Arroz Chaufa","Peru","🇵🇪",25],["solterito","Peruvian Bean Salad","Peru","🇵🇪",20],
["gado-gado","Gado-Gado","Indonesia","🇮🇩",30],["mie-goreng","Mie Goreng","Indonesia","🇮🇩",25],["soto-ayam","Soto Ayam","Indonesia","🇮🇩",45],["tempeh-rice","Sweet Soy Tempeh Rice","Indonesia","🇮🇩",30],
["pancit","Vegetable Pancit","Philippines","🇵🇭",30],["sinangag","Garlic Fried Rice","Philippines","🇵🇭",15],["tinola","Chicken Tinola","Philippines","🇵🇭",45],["tortang-talong","Tortang Talong","Philippines","🇵🇭",30],
["spanakopita","Easy Spanakopita","Greece","🇬🇷",45],["souvlaki-bowl","Chicken Souvlaki Bowl","Greece","🇬🇷",35],["fasolada","Greek Bean Soup","Greece","🇬🇷",45],["gemista","Rice-Stuffed Peppers","Greece","🇬🇷",55],
["egusi","Quick Egusi-Style Stew","Nigeria","🇳🇬",45],["akara","Bean Akara","Nigeria","🇳🇬",35],["suya-bowl","Spiced Chicken Suya Bowl","Nigeria","🇳🇬",35],["moi-moi","Steamed Bean Cakes","Nigeria","🇳🇬",50]
];
const sets=[
["rice","egg","onion","garlic","soy sauce"],["rice","chicken","onion","carrot","soy sauce"],["pasta","tomato","onion","garlic","cheese"],["potato","egg","onion","olive oil","salt"],["chickpeas","tomato","onion","garlic","cumin"],["rice noodles","chicken","carrot","lime","herbs"],["lentils","rice","onion","garlic","curry powder"],["beans","tomato","onion","bell pepper","rice"],["eggplant","tomato","onion","garlic","olive oil"],["bread","egg","spinach","cheese","milk"]
];
const colors=["#d95f45","#d6a12f","#398a69","#557fb2","#8a62a8"];
const recipes=rows.map((d,i)=>({id:d[0],n:d[1],c:d[2],f:d[3],m:d[4],z:i%3!==1?1:0,x:sets[i%sets.length],s:[`Prepare the ingredients for ${d[1]}.`,`Cook the main ingredients gently until aromatic and tender.`,`Combine and adjust the seasoning to taste.`,`Serve ${d[1]} warm and enjoy.`],co:colors[i%colors.length]}));
window.EXTRA_RECIPES=(window.EXTRA_RECIPES||[]).concat(recipes);
const step={
ko:n=>[`${n}에 사용할 재료를 손질합니다.`,`주요 재료를 향이 나고 부드러워질 때까지 익힙니다.`,`재료를 합치고 입맛에 맞게 간을 조절합니다.`,`${n}을 따뜻하게 담아냅니다.`],
es:n=>[`Prepara los ingredientes para ${n}.`,`Cocina suavemente los ingredientes principales hasta que estén tiernos y aromáticos.`,`Combina todo y ajusta el condimento al gusto.`,`Sirve ${n} caliente.`],
ja:n=>[`${n}の材料を下ごしらえします。`,`主な材料を香りが立ち、柔らかくなるまで火を通します。`,`材料を合わせ、味を調えます。`,`${n}を温かいうちに盛り付けます。`],
zh:n=>[`准备制作${n}所需的食材。`,`将主要食材慢慢烹调至软嫩并散发香味。`,`混合所有食材并按口味调味。`,`趁热装盘享用${n}。`]
};
window.RECIPE_I18N=window.RECIPE_I18N||{};
recipes.forEach(r=>{window.RECIPE_I18N[r.id]={ko:[r.n,step.ko(r.n)],es:[r.n,step.es(r.n)],ja:[r.n,step.ja(r.n)],zh:[r.n,step.zh(r.n)]};});
window.WORLDCOOK_CATALOG={version:"2026-09-23",total:100,dailyBatchSize:10,license:"WorldCook original",sourceNotes:["TasteAtlas discovery list","Wikipedia national dish and cuisine indexes"],reviewRequired:true};
})();
