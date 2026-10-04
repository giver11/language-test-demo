export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'',allowed=(env.ALLOWED_ORIGINS||'https://giver11.github.io').split(',').map(x=>x.trim()),cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const {pathname}=new URL(request.url);
  if(pathname==='/stt')return handleSTT(request,env,cors);
  if(pathname==='/vision')return handleVision(request,env,cors);
  if(request.method==='GET')return json({ok:!!env.AI,service:'scorestep-ai-gateway',provider:'cloudflare-workers-ai',model:modelOf(env)},env.AI?200:503,cors);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,cors);
  if(!env.AI||typeof env.AI.run!=='function')return json({error:'server_not_configured'},503,cors);
  let body;try{body=await request.json()}catch{return json({error:'invalid_json'},400,cors)}
  const {language,exam,level,scenario,message,conversationHistory=[],track,showTranslation=true}=body||{};
  if(!['ko','en','zh'].includes(language)||!['TOPIK','IELTS','HSK'].includes(exam)||typeof message!=='string'||!message.trim())return json({error:'invalid_request'},400,cors);
  const messages=[{role:'system',content:buildSystem({language,exam,level,scenario,track,showTranslation})},...conversationHistory.slice(-12).filter(x=>['user','assistant'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,3000)})),{role:'user',content:message.slice(0,3000)}];
  let data;
  try{data=await env.AI.run(modelOf(env),{messages,max_tokens:Number(env.AI_MAX_TOKENS)||500})}
  catch(err){const detail=String(err&&err.message||err);console.error('Workers AI',detail);const daily=/neuron|daily|allocation|quota|4006/i.test(detail);return json({error:daily?'ai_daily_limit':'ai_upstream_failed'},daily?429:502,cors)}
  const reply=extractReply(data);if(!reply)return json({error:'empty_ai_response'},502,cors);return json({reply},200,cors)
 }
};
/* Cookora In ingredient vision. Images are processed in memory and are never persisted by this
   Worker. The browser resizes them before upload; the hard limit prevents accidental large bills. */
const DEFAULT_VISION_MODEL='@cf/meta/llama-3.2-11b-vision-instruct';
function visionModelOf(env){return String(env.VISION_MODEL||DEFAULT_VISION_MODEL)}
async function handleVision(request,env,cors){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405,cors);
 if(!env.AI||typeof env.AI.run!=='function')return json({error:'server_not_configured'},503,cors);
 let body;try{body=await request.json()}catch{return json({error:'invalid_json'},400,cors)}
 const image=String(body?.image||''),locale=['en','ko','es','ja','zh'].includes(body?.locale)?body.locale:'en';
 if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(image))return json({error:'invalid_image'},400,cors);
 if(image.length>2_200_000)return json({error:'image_too_large'},413,cors);
 const prompt=`Inspect this refrigerator, pantry, grocery or meal photo. Identify only edible ingredients or clearly identifiable prepared foods that are visibly present. Read package labels when useful. Do not guess hidden contents and do not list plates, bowls, cutlery, tables or appliances. Return JSON only with this exact shape: {"items":[{"name":"canonical English singular ingredient name","confidence":0.0,"quantity":1,"unit":"piece","evidence":"short visible evidence"}]}. Use confidence 0.85+ only for visually unmistakable items, 0.55-0.84 for probable items, and below 0.55 for uncertain items. Maximum 15 unique items. The UI locale is ${locale}, but name must remain canonical English because the client localizes it.`;
 let data;
 try{data=await env.AI.run(visionModelOf(env),{messages:[{role:'system',content:'You are a careful food-ingredient visual inspector. Output strict JSON only.'},{role:'user',content:prompt}],image,max_tokens:700,temperature:0.1})}
 catch(err){const detail=String(err&&err.message||err);console.error('Workers AI Vision',detail);const daily=/neuron|daily|allocation|quota|4006/i.test(detail);return json({error:daily?'ai_daily_limit':'vision_upstream_failed'},daily?429:502,cors)}
 const raw=extractReply(data),parsed=parseVision(raw);
 if(!parsed.length)return json({error:'empty_vision_response'},502,cors);
 return json({items:parsed,model:visionModelOf(env),requires_confirmation:true},200,cors)
}
function parseVision(raw){
 let value;try{value=JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/gi,''))}catch{return []}
 const source=Array.isArray(value)?value:value?.items;
 if(!Array.isArray(source))return [];
 const seen=new Set(),out=[];
 for(const x of source){
  const name=String(x?.name||'').trim().toLowerCase().replace(/[^a-z0-9 '\-]/g,'').slice(0,80);
  if(!name||seen.has(name))continue;seen.add(name);
  out.push({name,confidence:Math.max(0,Math.min(0.99,Number(x?.confidence)||0)),quantity:Math.max(.1,Math.min(99,Number(x?.quantity)||1)),unit:['piece','g','kg','ml','cup','bottle','package','bunch'].includes(x?.unit)?x.unit:'piece',evidence:String(x?.evidence||'visible in image').slice(0,160)});
  if(out.length===15)break;
 }
 return out;
}
/* Server-side speech-to-text fallback (Cloudflare Workers AI Whisper, same free daily allocation as
   AI Conversation). Used by the frontend only when the browser has no native SpeechRecognition
   (iOS Safari/WKWebView never supports it; Android WebView support is inconsistent) — never replaces
   the browser-native path, which remains unchanged. Body: raw audio bytes (any format Whisper accepts,
   e.g. webm/opus from MediaRecorder). Response: {text}. */
const DEFAULT_STT_MODEL='@cf/openai/whisper-large-v3-turbo';
function sttModelOf(env){return String(env.STT_MODEL||DEFAULT_STT_MODEL)}
async function handleSTT(request,env,cors){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return json({error:'method_not_allowed'},405,cors);
 if(!env.AI||typeof env.AI.run!=='function')return json({error:'server_not_configured'},503,cors);
 let buf;try{buf=await request.arrayBuffer()}catch{return json({error:'invalid_audio'},400,cors)}
 if(!buf||buf.byteLength<500)return json({error:'invalid_audio'},400,cors);
 if(buf.byteLength>8*1024*1024)return json({error:'audio_too_large'},413,cors);
 let data;
 try{data=await env.AI.run(sttModelOf(env),{audio:[...new Uint8Array(buf)]})}
 catch(err){const detail=String(err&&err.message||err);console.error('Workers AI STT',detail);const daily=/neuron|daily|allocation|quota|4006/i.test(detail);return json({error:daily?'ai_daily_limit':'stt_upstream_failed'},daily?429:502,cors)}
 const text=String(data?.text||data?.result?.text||'').trim();
 if(!text)return json({error:'empty_transcription'},502,cors);
 return json({text},200,cors)
}
/* Cloudflare Workers AI (free daily allocation). No paid external AI API is called. */
const DEFAULT_MODEL='@cf/openai/gpt-oss-120b';
function modelOf(env){return String(env.AI_MODEL||DEFAULT_MODEL)}
function extractReply(data){
 const raw=typeof data==='string'?data:(data?.response??data?.choices?.[0]?.message?.content??data?.result?.response??'');
 return String(raw||'').replace(/<think>[\s\S]*?<\/think>/g,'').split('\n').filter(line=>!DANGLING_LABEL.test(line)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
/* Drop feedback headings the model sometimes emits with no content (e.g. a bare "문법" line). */
const DANGLING_LABEL=/^\s*💡\s*[:：]?\s*$|^\s*[💡(（*-]*\s*(자연스러운\s*표현|문법|어휘|더\s*좋은\s*표현|피드백|학습\s*피드백|Feedback|Grammar|Vocabulary|Fluency|Coherence|Natural expression|反馈)\s*[:：]?\s*[)）*]*\s*$/iu;
function buildSystem({exam,level,scenario,track,showTranslation}){
 if(exam==='TOPIK')return `You are a Korean-language tutor for TOPIK, learner level ${level||'unknown'}, scenario ${scenario||'free'}. Speak primarily in Korean. Keep difficulty appropriate for TOPIK 1-6. Continue the role-play naturally in 1-3 short sentences, playing the other person in the scenario and responding to what the learner actually said. Then, only if the learner's last message has a real error or could sound more natural, add ONE final line exactly like "💡 문법: <구체적인 설명>" using one label from 자연스러운 표현 / 문법 / 어휘 / 더 좋은 표현. Never write a label without concrete content. If there is nothing to correct, add no feedback line. Write plain text only, no Markdown. Never overwhelm a beginner.`;
 if(exam==='IELTS')return `You are an IELTS Speaking practice tutor. Track: ${track||'General/Academic'}, mode: ${scenario||'Part 1'}, learner level: ${level||'unknown'}. Speak in English. Practice Speaking Parts 1-3 faithfully. Write plain text only: no Markdown, tables, headings, or bold. First reply in 1-3 sentences and ask the next examiner-style question. Then, only if useful, add at most 3 short lines starting with "Estimated practice feedback:" that correct real errors in the learner's last message (for example "I am study" -> "I study") and suggest one more natural expression, drawing on Grammar, Vocabulary, Fluency, Coherence, and Natural expression. Keep the whole reply under 120 words. Never claim an official band score; label any level estimate as estimated practice feedback.`;
 return `You are an HSK 1-6 Mandarin tutor. Learner level: HSK ${level||'unknown'}, scenario: ${scenario||'free'}. Use level-appropriate Chinese and short sentences for beginners. Play the other person in the scenario and respond to what the learner actually said. ${showTranslation?'Format the main tutor response as three lines: Chinese, then Pinyin, then a concise Korean meaning written only in Hangul (never use Chinese characters in the Korean line).':'Use Chinese primarily and omit translation unless needed.'} Most learner messages are already correct and need no feedback. Only when the learner's Chinese contains a clear grammar or word error, add ONE final line written in Korean (Hangul), for example: "💡 '我要去学校了昨天'은 '我昨天去学校了'라고 해야 자연스러워요." Never write feedback in English, never invent errors, and never write feedback without content. Write plain text only, no Markdown.`;
}
function json(value,status,headers){return new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
