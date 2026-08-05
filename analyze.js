export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({error:"Méthode non autorisée."});
 try{
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key) return res.status(500).json({error:"La clé Anthropic n’est pas configurée sur Vercel."});
  const d=req.body||{};
  const prompt=`Analyse technique courte en français, prudente et factuelle, 4 phrases maximum.
Instrument: ${d.symbol}; signal: ${d.signal}; prix: ${d.price}; entrée: ${d.entry}; SL: ${d.sl}; TP1: ${d.tp1}; TP2: ${d.tp2}; RSI: ${d.rsi}; confiance: ${d.confidence}%.
Explique le scénario, la condition d'invalidation et rappelle de vérifier le graphique et les nouvelles. Ne promets jamais un résultat.`;
  const api=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{
   "content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"
  },body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||"claude-sonnet-4-20250514",max_tokens:350,messages:[{role:"user",content:prompt}]})});
  const data=await api.json();
  if(!api.ok) return res.status(api.status).json({error:data.error?.message||"Erreur Anthropic."});
  const text=(data.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n").trim();
  return res.status(200).json({text:text||"Aucune analyse reçue."});
 }catch(e){return res.status(500).json({error:"Erreur serveur : "+e.message})}
}