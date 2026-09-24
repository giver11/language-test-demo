/* WorldCook Vision v3 — two-stage on-device fridge/ingredient recognition. */
(function(){
const legacyAnalyze=window.analyzePhoto;
let objectDetectorPromise=null,classifierPromise=null,activeDetector="";
const ITEMS=[
["tomato","a tomato"],["cucumber","a cucumber"],["zucchini","a zucchini"],["mushroom","mushrooms"],["bell pepper","a bell pepper"],["lemon","a lemon"],["lime","a lime"],["pineapple","a pineapple"],["strawberry","strawberries"],["blueberry","blueberries"],["grape","grapes"],["watermelon","a watermelon"],["egg","eggs"],["chicken","raw chicken"],["beef","raw beef"],["pork","raw pork"],["sausage","sausages"],["fish","fresh fish"],["cheese","cheese"],["yogurt","yogurt"],["milk","milk"],["bread","bread"],["rice","rice"],["potato","potatoes"],["sweet potato","sweet potatoes"],["corn","corn"],["cabbage","a cabbage"],["cauliflower","a cauliflower"],["lettuce","lettuce"],["spinach","spinach"],["avocado","an avocado"],["banana","bananas"],["apple","apples"],["orange","oranges"],["broccoli","broccoli"],["carrot","carrots"],["onion","onions"],["garlic","garlic"],["ginger","ginger"],["beans","beans"],["chickpeas","chickpeas"],["lentils","lentils"],["tofu","tofu"],["pasta","pasta"],["rice noodles","noodles"],["eggplant","an eggplant"],["basil","basil"],["herbs","fresh herbs"],["black beans","black beans"],["tortilla","tortillas"],["coconut milk","coconut milk"],["ground beef","ground beef"],["kimchi","kimchi"]
];
const PACKAGES=[
["egg","an egg carton"],["milk","a milk carton"],["milk","a milk bottle"],["yogurt","a yogurt cup"],["cheese","a cheese package"],["chicken","a chicken package"],["beef","a beef package"],["fish","a fish package"],["rice","a bag of rice"],["pasta","a pasta package"],["tofu","a tofu package"]
];
const TEXT={
en:{load:"Loading dual AI models… First use can download 180–300 MB.",detect:"Finding separate ingredients and checking each photo area…",fallback:"High-accuracy scan unavailable. Running compatibility scan…",retake:"📸 Retake photo",source:"dual on-device scan",low:"No result was reliable enough. Retake a close, bright photo or add ingredients manually."},
ko:{load:"이중 AI 모델을 불러오는 중입니다. 최초 1회 180~300MB를 내려받을 수 있습니다.",detect:"재료 위치를 찾고 사진 구역별로 다시 확인하는 중입니다…",fallback:"고정밀 분석을 사용할 수 없어 호환 분석을 실행합니다…",retake:"📸 사진 다시 찍기",source:"기기 내 이중 분석",low:"신뢰할 만한 결과가 없습니다. 재료를 가까이에서 밝게 다시 찍거나 직접 추가하세요."},
es:{load:"Cargando dos modelos de IA… La primera vez puede descargar 180–300 MB.",detect:"Buscando ingredientes y verificando cada zona de la foto…",fallback:"El análisis de alta precisión no está disponible. Ejecutando el modo compatible…",retake:"📸 Repetir foto",source:"análisis doble local",low:"No hubo resultados suficientemente fiables. Toma otra foto cercana y luminosa o añade los ingredientes manualmente."},
ja:{load:"2つのAIモデルを読み込み中です。初回は180〜300MBをダウンロードする場合があります。",detect:"食材の位置を検出し、写真の各領域を再確認中です…",fallback:"高精度分析を利用できないため互換スキャンを実行します…",retake:"📸 写真を撮り直す",source:"端末内2段階分析",low:"信頼できる結果がありません。食材を明るい場所で近くから撮り直すか、手動で追加してください。"},
zh:{load:"正在加载双重 AI 模型，首次使用可能下载180–300MB。",detect:"正在定位食材并复核照片的各个区域…",fallback:"高精度分析不可用，正在运行兼容扫描…",retake:"📸 重新拍摄",source:"设备端双重分析",low:"没有足够可靠的结果。请在明亮环境中近距离重拍，或手动添加食材。"}
};
const SCAN_I18N={
ko:{cucumber:"오이",pineapple:"파인애플",strawberry:"딸기",blueberry:"블루베리",grape:"포도",watermelon:"수박",pork:"돼지고기","sweet potato":"고구마",corn:"옥수수",cauliflower:"콜리플라워",lettuce:"상추",avocado:"아보카도",banana:"바나나",apple:"사과",broccoli:"브로콜리",tofu:"두부",kimchi:"김치"},
es:{cucumber:"pepino",pineapple:"piña",strawberry:"fresa",blueberry:"arándano",grape:"uva",watermelon:"sandía",pork:"cerdo","sweet potato":"batata",corn:"maíz",cauliflower:"coliflor",lettuce:"lechuga",avocado:"aguacate",banana:"plátano",apple:"manzana",broccoli:"brócoli",tofu:"tofu",kimchi:"kimchi"},
ja:{cucumber:"きゅうり",pineapple:"パイナップル",strawberry:"いちご",blueberry:"ブルーベリー",grape:"ぶどう",watermelon:"すいか",pork:"豚肉","sweet potato":"さつまいも",corn:"とうもろこし",cauliflower:"カリフラワー",lettuce:"レタス",avocado:"アボカド",banana:"バナナ",apple:"りんご",broccoli:"ブロッコリー",tofu:"豆腐",kimchi:"キムチ"},
zh:{cucumber:"黄瓜",pineapple:"菠萝",strawberry:"草莓",blueberry:"蓝莓",grape:"葡萄",watermelon:"西瓜",pork:"猪肉","sweet potato":"红薯",corn:"玉米",cauliflower:"花椰菜",lettuce:"生菜",avocado:"牛油果",banana:"香蕉",apple:"苹果",broccoli:"西兰花",tofu:"豆腐",kimchi:"泡菜"}
};
for(const l of Object.keys(SCAN_I18N))Object.assign(window.INGREDIENT_I18N[l],SCAN_I18N[l]);
const labels=[...ITEMS,...PACKAGES].map(x=>x[1]);
const keyByLabel=new Map([...ITEMS,...PACKAGES].map(x=>[x[1],x[0]]));
function ui(){return TEXT[lang()]||TEXT.en}
function setStatus(s){$("#scanStatus").textContent=s}
function reverseIngredient(value){
 const raw=value.trim(),low=raw.toLocaleLowerCase();
 const dict=window.INGREDIENT_I18N[lang()]||{};
 for(const [key,name] of Object.entries(dict))if(String(name).toLocaleLowerCase()===low)return key;
 for(const [key,label] of ITEMS)if(key===low||label===low)return key;
 return raw.toLowerCase();
}
function cropInputs(img){
 const out=[img.src],w=img.naturalWidth,h=img.naturalHeight;
 if(!w||!h)return out;
 for(let row=0;row<2;row++)for(let col=0;col<2;col++){
  const c=document.createElement("canvas"),ctx=c.getContext("2d"),sw=w/2,sh=h/2;
  c.width=384;c.height=384;ctx.drawImage(img,col*sw,row*sh,sw,sh,0,0,384,384);
  out.push(c.toDataURL("image/jpeg",.9));
 }
 return out;
}
async function loadModels(){
 if(!objectDetectorPromise){
  const hf=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm");
  const useGPU=!!navigator.gpu&&(navigator.deviceMemory||4)>=4;
  activeDetector=useGPU?"OWLv2 WebGPU":"OWL-ViT";
  objectDetectorPromise=hf.pipeline("zero-shot-object-detection",useGPU?"onnx-community/owlv2-base-patch16-ensemble-ONNX":"Xenova/owlvit-base-patch32",useGPU?{device:"webgpu",dtype:"q4"}:{dtype:"q8"}).catch(async e=>{
   activeDetector="OWL-ViT";
   return hf.pipeline("zero-shot-object-detection","Xenova/owlvit-base-patch32",{dtype:"q8"});
  });
  classifierPromise=hf.pipeline("zero-shot-image-classification","Xenova/clip-vit-base-patch16",{dtype:"q8"});
 }
 return Promise.all([objectDetectorPromise,classifierPromise]);
}
function mergeEvidence(det,cls){
 const score={};
 for(const x of det){const n=keyByLabel.get(x.label)||mapLabel(x.label);if(n)score[n]={n,det:Math.max(score[n]?.det||0,+x.score||0),cls:score[n]?.cls||0}}
 for(const x of cls){const n=keyByLabel.get(x.label)||mapLabel(x.label);if(n)score[n]={n,det:score[n]?.det||0,cls:Math.max(score[n]?.cls||0,+x.score||0)}}
 return Object.values(score).map(x=>{
  const agreed=x.det>=.045&&x.cls>=.10;
  const confidence=agreed?Math.min(.99,.52+x.det+x.cls*.8):Math.max(x.det,x.cls*.72);
  return {n:x.n,score:confidence,evidence:agreed?"detector+classifier":x.det>=x.cls*.72?"detector":"classifier"};
 }).filter(x=>x.score>=.12).sort((a,b)=>b.score-a.score).slice(0,20);
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
window.renderCandidates=function(){
 const p=PUI[lang()];
 $("#candidates").innerHTML=detected.map((x,i)=>{
  const display=x.n?ingredientName(x.n):"";
  return '<div class="candidate"><input type="checkbox" '+(x.n&&x.score>=.18?"checked":"")+' aria-label="Include candidate"><input type="text" value="'+esc(display)+'" placeholder="'+esc(p.candidate)+'" oninput="detected['+i+'].n=window.wcReverseIngredient(this.value)"><span class="small">'+(x.score?Math.round(x.score*100)+"%":p.edit)+'</span><button class="trash" onclick="removeCandidate('+i+')">✕</button></div>';
 }).join("");
 $("#candidateTools").classList.toggle("hidden",!detected.length);
};
window.wcReverseIngredient=reverseIngredient;
window.confirmCandidates=function(){
 const rows=$$("#candidates .candidate"),names=[];
 rows.forEach((r,i)=>{if(r.querySelector('input[type="checkbox"]').checked){const n=detected[i]&&detected[i].n;if(n)names.push(n)}});
 [...new Set(names)].forEach(n=>{pantry=pantry.filter(x=>x.n!==n);pantry.unshift({n,q:1,u:"piece"})});
 save();render();$("#scanStatus").textContent=names.length+" "+PUI[lang()].confirmed;detected=[];renderCandidates();setTimeout(()=>setView("explore"),700);
};
window.analyzePhoto=async function(){
 if(!photoFile)return;
 const btn=$("#scanButton"),p=PUI[lang()],t=ui();btn.disabled=true;setStatus(t.load);
 try{
  const [detector,classifier]=await loadModels();setStatus(t.detect);
  const img=$("#photoPreview");
  const detection=await detector(img.src,labels,{top_k:80,threshold:.04});
  const crops=cropInputs(img),checks=[];
  for(const src of crops){const r=await classifier(src,ITEMS.map(x=>x[1]),{top_k:4});checks.push(...r.filter(x=>x.score>=.08))}
  detected=mergeEvidence(detection,checks);
  if(!detected.length){detected=[{n:"",score:0}];renderCandidates();setStatus(t.low)}
  else{renderCandidates();setStatus(detected.length+" "+p.found+" · "+t.source+" ("+activeDetector+" + CLIP)")}
 }catch(err){
  console.warn("WorldCook Vision v3 fallback",err);objectDetectorPromise=null;classifierPromise=null;setStatus(t.fallback);btn.disabled=false;return legacyAnalyze();
 }finally{btn.disabled=false}
};
function installCameraButton(){
 if($("#retakePhoto"))return;
 const input=document.createElement("input");input.type="file";input.id="directCamera";input.accept="image/*";input.capture="environment";input.className="hidden";input.onchange=previewPhoto;document.body.appendChild(input);
 const b=document.createElement("button");b.id="retakePhoto";b.className="tab";b.type="button";b.onclick=()=>input.click();
 const actions=$("#scanButton")&&$("#scanButton").parentElement;if(actions){actions.appendChild(b);b.textContent=ui().retake}
}
installCameraButton();
$("#lang").addEventListener("change",()=>{const b=$("#retakePhoto");if(b)b.textContent=ui().retake;if(detected.length)renderCandidates()});
})();