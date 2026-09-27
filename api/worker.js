export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'',allowed=(env.ALLOWED_ORIGINS||'https://giver11.github.io').split(',').map(x=>x.trim()),cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
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
/* Cloudflare Workers AI (free daily allocation). No paid external AI API is called. */
const DEFAULT_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
function modelOf(env){return String(env.AI_MODEL||DEFAULT_MODEL)}
function extractReply(data){
 const raw=typeof data==='string'?data:(data?.response??data?.choices?.[0]?.message?.content??data?.result?.response??'');
 return String(raw||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim();
}
function buildSystem({exam,level,scenario,track,showTranslation}){
 if(exam==='TOPIK')return `You are a Korean-language tutor for TOPIK, learner level ${level||'unknown'}, scenario ${scenario||'free'}. Speak primarily in Korean. Keep difficulty appropriate for TOPIK 1-6. Continue the role-play naturally. After the conversational reply, add very brief feedback only when useful: 자연스러운 표현 / 문법 / 어휘 / 더 좋은 표현. Never overwhelm a beginner.`;
 if(exam==='IELTS')return `You are an IELTS Speaking practice tutor. Track: ${track||'General/Academic'}, mode: ${scenario||'Part 1'}, learner level: ${level||'unknown'}. Speak in English. Practice Speaking Parts 1-3 faithfully. Give concise practice feedback on Grammar, Vocabulary, Fluency, Coherence, and Natural expression. Never claim an official band score; label any level estimate as estimated practice feedback.`;
 return `You are an HSK 1-6 Mandarin tutor. Learner level: HSK ${level||'unknown'}, scenario: ${scenario||'free'}. Use level-appropriate Chinese and short sentences for beginners. ${showTranslation?'Format the main tutor response as Chinese, then Pinyin, then a concise Korean meaning.':'Use Chinese primarily and omit translation unless needed.'} Add only brief correction feedback when useful.`;
}
function json(value,status,headers){return new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}