/* WorldCook Vision v6 — fast saved-photo and live-camera recognition with selectable localized candidates. */
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
en:{load:"Loading the ingredient detector… First use may take a moment.",detect:"Finding ingredients in the photo…",fallback:"High-accuracy scan unavailable. Running compatibility scan…",retake:"📸 Retake photo",source:"fast on-device scan",low:"No result was reliable enough. Retake a close, bright photo or add ingredients manually."},
ko:{load:"재료 탐지 모델을 불러오는 중입니다. 최초 1회만 잠시 걸릴 수 있습니다.",detect:"사진 속 재료를 찾는 중입니다…",fallback:"고정밀 분석을 사용할 수 없어 호환 분석을 실행합니다…",retake:"📸 사진 다시 찍기",source:"기기 내 빠른 분석",low:"신뢰할 만한 결과가 없습니다. 재료를 가까이에서 밝게 다시 찍거나 직접 추가하세요."},
es:{load:"Cargando el detector de ingredientes… La primera vez puede tardar un momento.",detect:"Buscando ingredientes en la foto…",fallback:"El análisis de alta precisión no está disponible. Ejecutando el modo compatible…",retake:"📸 Repetir foto",source:"análisis rápido local",low:"No hubo resultados suficientemente fiables. Toma otra foto cercana y luminosa o añade los ingredientes manualmente."},
ja:{load:"食材検出モデルを読み込み中です。初回のみ少し時間がかかる場合があります。",detect:"写真の食材を検出中です…",fallback:"高精度分析を利用できないため互換スキャンを実行します…",retake:"📸 写真を撮り直す",source:"端末内高速分析",low:"信頼できる結果がありません。食材を明るい場所で近くから撮り直すか、手動で追加してください。"},
zh:{load:"正在加载食材检测模型，首次使用可能需要一点时间。",detect:"正在识别照片中的食材…",fallback:"高精度分析不可用，正在运行兼容扫描…",retake:"📸 重新拍摄",source:"设备端快速分析",low:"没有足够可靠的结果。请在明亮环境中近距离重拍，或手动添加食材。"}
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
 if(!classifierPromise){
  activeDetector="MobileNet v2 Lite";
  classifierPromise=(async()=>{
   await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
   await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js");
   return mobilenet.load({version:2,alpha:.5});
  })();
 }
 return classifierPromise;
}
function waitForImage(img){
 if(img.complete&&img.naturalWidth)return Promise.resolve();
 return Promise.race([
  new Promise((ok,no)=>{img.addEventListener("load",ok,{once:true});img.addEventListener("error",()=>no(new Error("Image decode failed")),{once:true})}),
  new Promise((_,no)=>setTimeout(()=>no(new Error("Image decode timeout")),8000))
 ]);
}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error("Analysis timeout")),ms))])}
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
 const btn=$("#scanButton"),p=PUI[lang()],t=ui(),img=$("#photoPreview");
 btn.disabled=true;setStatus(t.load);
 try{
  await waitForImage(img);
  const model=await withTimeout(loadModels(),22000);
  setStatus(t.detect);
  await new Promise(ok=>requestAnimationFrame(ok));
  const predictions=await withTimeout(model.classify(img,30),12000),best={};
  for(const x of predictions){const n=mapLabel(x.className);if(n)best[n]=Math.max(best[n]||0,+x.probability||0)}
  detected=Object.entries(best).map(([n,score])=>({n,score})).sort((a,b)=>b.score-a.score).slice(0,12);
  if(!detected.length){detected=[{n:"",score:0}];renderCandidates();setStatus(t.low)}
  else{renderCandidates();setStatus(detected.length+" "+p.found+" · "+t.source+" ("+activeDetector+")")}
 }catch(err){
  console.warn("WorldCook Vision v6",err);classifierPromise=null;
  detected=[{n:"",score:0}];renderCandidates();setStatus(t.low);
 }finally{btn.disabled=false}
};
function installCameraControls(){
 if($("#retakePhoto"))return;
 const input=document.createElement("input");input.type="file";input.id="directCamera";input.accept="image/*";input.capture="environment";input.className="hidden";input.onchange=previewPhoto;document.body.appendChild(input);
 const b=document.createElement("button");b.id="retakePhoto";b.className="tab";b.type="button";b.onclick=openLiveCamera;
 const actions=$("#scanButton")&&$("#scanButton").parentElement;if(actions)actions.appendChild(b);
 const tools=$("#candidateTools");if(tools){
  const hint=document.createElement("p");hint.id="wcCandidateHint";hint.className="small";tools.prepend(hint);
  const row=document.createElement("div");row.className="scanActions";row.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0";
  row.innerHTML='<button id="wcSelectAll" class="tab" type="button" onclick="wcSelectAllCandidates(true)"></button><button id="wcClearAll" class="tab" type="button" onclick="wcSelectAllCandidates(false)"></button><button id="wcAnalyzeAgain" class="tab" type="button" onclick="wcAnalyzeAgain()"></button>';
  const candidates=$("#candidates");tools.insertBefore(row,candidates||tools.firstChild);
 }
 syncCameraLabels();
}
installCameraControls();
$("#lang").addEventListener("change",()=>{syncCameraLabels();if(detected.length)renderCandidates()});
})();