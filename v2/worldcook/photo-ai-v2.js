/* WorldCook Vision v2 — private on-device open-vocabulary ingredient detection. */
(function(){
const previousAnalyze=window.analyzePhoto;
let detectorPromise=null,activeModel="";
const TARGETS=[
["tomato","a fresh tomato"],["cucumber","a cucumber"],["zucchini","a zucchini"],["mushroom","mushrooms"],["bell pepper","a bell pepper"],["bell pepper","a chili pepper"],["lemon","a lemon"],["lime","a lime"],["pineapple","a pineapple"],["strawberry","strawberries"],["blueberry","blueberries"],["grape","grapes"],["watermelon","a watermelon"],["egg","an egg"],["egg","an egg carton"],["chicken","raw chicken"],["beef","raw beef"],["beef","a steak"],["pork","raw pork"],["sausage","sausages"],["fish","a whole fish"],["fish","a fish fillet"],["fish","salmon"],["fish","tuna"],["cheese","cheese"],["yogurt","a yogurt cup"],["milk","a milk carton"],["bread","bread"],["rice","a bag of rice"],["potato","potatoes"],["sweet potato","sweet potatoes"],["corn","corn"],["cabbage","a cabbage"],["cauliflower","a cauliflower"],["lettuce","lettuce"],["spinach","spinach"],["avocado","an avocado"],["banana","bananas"],["apple","apples"],["orange","oranges"],["broccoli","broccoli"],["carrot","carrots"],["onion","onions"],["garlic","garlic"],["ginger","ginger root"],["beans","beans"],["chickpeas","chickpeas"],["lentils","lentils"],["tofu","tofu"],["pasta","dry pasta"],["rice noodles","noodles"],["eggplant","an eggplant"],["coconut milk","a coconut milk can"],["basil","basil leaves"],["herbs","fresh herbs"],["cabbage","kimchi"],["black beans","black beans"],["tortilla","tortillas"],["orange","an orange"],["milk","a bottle of milk"],["cheese","a cheese package"],["chicken","a chicken package"],["beef","a beef package"],["fish","a fish package"]
];
const TEXT={
en:{download:"Loading high-accuracy ingredient detector… First use may download about 100–200 MB.",gpu:"Running OWLv2 open-vocabulary detection with WebGPU…",cpu:"Running OWL-ViT ingredient detection…",fallback:"High-accuracy model was unavailable. Switching to compatibility scan…",model:"High-accuracy on-device scan"},
ko:{download:"고정밀 재료 탐지 모델을 불러오는 중입니다. 최초 1회 약 100~200MB를 내려받을 수 있습니다.",gpu:"WebGPU로 OWLv2 다중 재료 탐지를 실행 중입니다…",cpu:"OWL-ViT 다중 재료 탐지를 실행 중입니다…",fallback:"고정밀 모델을 사용할 수 없어 호환 분석으로 전환합니다…",model:"기기 내 고정밀 분석"},
es:{download:"Cargando el detector de ingredientes de alta precisión… La primera vez puede descargar 100–200 MB.",gpu:"Ejecutando detección OWLv2 con WebGPU…",cpu:"Ejecutando detección de ingredientes OWL-ViT…",fallback:"El modelo de alta precisión no está disponible. Cambiando al análisis compatible…",model:"Análisis local de alta precisión"},
ja:{download:"高精度の食材検出モデルを読み込み中です。初回は約100〜200MBをダウンロードする場合があります。",gpu:"WebGPUでOWLv2の複数食材検出を実行中…",cpu:"OWL-ViTで複数食材を検出中…",fallback:"高精度モデルを利用できないため互換スキャンに切り替えます…",model:"端末内高精度スキャン"},
zh:{download:"正在加载高精度食材检测模型，首次使用可能下载约100–200MB。",gpu:"正在使用 WebGPU 运行 OWLv2 多食材检测…",cpu:"正在运行 OWL-ViT 多食材检测…",fallback:"高精度模型不可用，正在切换至兼容扫描…",model:"设备端高精度扫描"}
};
function status(s){$("#scanStatus").textContent=s}
function dedupe(items){
 const best={};
 for(const x of items){if(!best[x.n]||x.score>best[x.n].score)best[x.n]=x}
 return Object.values(best).sort((a,b)=>b.score-a.score).slice(0,20);
}
async function loadDetector(){
 if(detectorPromise)return detectorPromise;
 detectorPromise=(async()=>{
  const t=TEXT[lang()]||TEXT.en;status(t.download);
  const hf=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm");
  const hasGPU=!!navigator.gpu;
  const strong=(navigator.deviceMemory||4)>=4;
  const high=hasGPU&&strong;
  activeModel=high?"OWLv2 WebGPU q4":"OWL-ViT WASM q8";
  const model=high?"onnx-community/owlv2-base-patch16-ensemble-ONNX":"Xenova/owlvit-base-patch32";
  const options={dtype:high?"q4":"q8"};
  if(high)options.device="webgpu";
  options.progress_callback=x=>{if(x&&x.status==="progress"&&Number.isFinite(x.progress))status(t.download+" "+Math.round(x.progress)+"%")};
  try{return await hf.pipeline("zero-shot-object-detection",model,options)}
  catch(e){
   if(high){activeModel="OWL-ViT WASM q8";return await hf.pipeline("zero-shot-object-detection","Xenova/owlvit-base-patch32",{dtype:"q8"})}
   throw e;
  }
 })();
 return detectorPromise;
}
window.analyzePhoto=async function(){
 if(!photoFile)return;
 const btn=$("#scanButton"),p=PUI[lang()],t=TEXT[lang()]||TEXT.en;
 btn.disabled=true;
 try{
  const detector=await loadDetector();
  status(activeModel.startsWith("OWLv2")?t.gpu:t.cpu);
  const labels=TARGETS.map(x=>x[1]);
  const keyByLabel=new Map(TARGETS.map(x=>[x[1],x[0]]));
  const output=await detector($("#photoPreview").src,labels,{top_k:60,threshold:.045});
  const items=(output||[]).map(o=>({n:keyByLabel.get(o.label)||mapLabel(o.label),score:Number(o.score)||0,box:o.box})).filter(x=>x.n);
  detected=dedupe(items);
  if(!detected.length)detected=[{n:"",score:0}];
  renderCandidates();
  status(detected[0].n?detected.length+" "+p.found+" · "+t.model+" ("+activeModel+")":p.notFound);
 }catch(err){
  console.warn("WorldCook Vision v2 fallback",err);
  detectorPromise=null;status(t.fallback);btn.disabled=false;
  return previousAnalyze();
 }finally{btn.disabled=false}
};
})();