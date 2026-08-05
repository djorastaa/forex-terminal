const PAIRS = new Set(["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CHF","USD/CAD","XAU/USD"]);

function ema(values, period){
  const k=2/(period+1), out=[]; let e=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=0;i<values.length;i++){
    if(i<period-1) out.push(null);
    else if(i===period-1) out.push(e);
    else { e=values[i]*k+e*(1-k); out.push(e); }
  }
  return out;
}

function rsi(values,p=14){
  let g=0,l=0;
  for(let i=1;i<=p;i++){
    const d=values[i]-values[i-1];
    g+=Math.max(d,0); l+=Math.max(-d,0);
  }
  g/=p; l/=p;
  let val=l===0?100:100-100/(1+g/l);
  for(let i=p+1;i<values.length;i++){
    const d=values[i]-values[i-1];
    g=(g*(p-1)+Math.max(d,0))/p;
    l=(l*(p-1)+Math.max(-d,0))/p;
    val=l===0?100:100-100/(1+g/l);
  }
  return val;
}

function atr(c,p=14){
  const tr=[];
  for(let i=1;i<c.length;i++){
    tr.push(Math.max(
      c[i].high-c[i].low,
      Math.abs(c[i].high-c[i-1].close),
      Math.abs(c[i].low-c[i-1].close)
    ));
  }
  let a=tr.slice(0,p).reduce((x,y)=>x+y,0)/p;
  for(let i=p;i<tr.length;i++) a=(a*(p-1)+tr[i])/p;
  return a;
}

function average(values){
  return values.reduce((a,b)=>a+b,0)/values.length;
}

export default async function handler(req,res){
 try{
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key) return res.status(500).json({error:"La clé Twelve Data n’est pas configurée sur Vercel."});

  const symbol=String(req.query.symbol||"EUR/USD").toUpperCase();
  if(!PAIRS.has(symbol)) return res.status(400).json({error:"Paire non autorisée."});

  const url=`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1h&outputsize=210&apikey=${encodeURIComponent(key)}`;
  const api=await fetch(url);
  const data=await api.json();

  if(!api.ok || data.status==="error" || !Array.isArray(data.values)){
    return res.status(502).json({error:data.message||"Twelve Data n’a pas renvoyé de données."});
  }

  const c=data.values.map(v=>({
    close:+v.close, high:+v.high, low:+v.low, open:+v.open
  })).reverse();

  const closes=c.map(x=>x.close);
  const highs=c.map(x=>x.high);
  const lows=c.map(x=>x.low);

  const ema20=ema(closes,20);
  const ema50=ema(closes,50);
  const price=closes.at(-1);
  const e20=ema20.at(-1);
  const e50=ema50.at(-1);
  const rv=rsi(closes);
  const av=atr(c);

  const last=c.at(-1);
  const prev=c.at(-2);
  const recentHigh=Math.max(...highs.slice(-21,-1));
  const recentLow=Math.min(...lows.slice(-21,-1));
  const atrHistory=[];
  for(let i=30;i<c.length;i++) atrHistory.push(atr(c.slice(0,i+1)));
  const avgAtr=average(atrHistory.slice(-30));

  let direction=0;
  if(price>e20 && e20>e50) direction=1;
  if(price<e20 && e20<e50) direction=-1;

  let stars=0;
  const reasons=[];

  // 1 étoile : tendance claire EMA20/EMA50 + prix aligné
  if(direction!==0){
    stars++;
    reasons.push("Tendance H1 alignée");
  }

  // 2e étoile : momentum cohérent
  const momentumOk=(direction===1 && rv>=52 && rv<=68) || (direction===-1 && rv<=48 && rv>=32);
  if(momentumOk){
    stars++;
    reasons.push("Momentum RSI confirmé");
  }

  // 3e étoile : vraie confirmation par cassure ou rejet propre
  const bullishBreak=direction===1 && price>recentHigh && last.close>last.open;
  const bearishBreak=direction===-1 && price<recentLow && last.close<last.open;
  const bullishReject=direction===1 && prev.low<=e20 && last.close>e20 && last.close>last.open;
  const bearishReject=direction===-1 && prev.high>=e20 && last.close<e20 && last.close<last.open;
  const confirmationOk=bullishBreak||bearishBreak||bullishReject||bearishReject;
  if(confirmationOk){
    stars++;
    reasons.push("Cassure ou rejet confirmé");
  }

  // 4e étoile : volatilité suffisante, sans marché mort
  const volatilityOk=Number.isFinite(avgAtr) && av>=avgAtr*0.85 && av<=avgAtr*1.8;
  if(volatilityOk){
    stars++;
    reasons.push("Volatilité exploitable");
  }

  // 5e étoile : bougie de confirmation nette et espace avant objectif
  const body=Math.abs(last.close-last.open);
  const range=Math.max(last.high-last.low, Number.EPSILON);
  const candleQuality=body/range>=0.55;
  if(candleQuality){
    stars++;
    reasons.push("Bougie de confirmation nette");
  }

  // Règle stricte demandée : aucun BUY/SELL sous 4 étoiles
  let signal="WAIT";
  if(stars>=4 && direction===1) signal="BUY";
  if(stars>=4 && direction===-1) signal="SELL";

  const confidence = stars===5 ? 88 : stars===4 ? 76 : stars===3 ? 58 : stars===2 ? 42 : 25;

  const entry=price;
  const sl=signal==="BUY"?entry-1.25*av:signal==="SELL"?entry+1.25*av:entry;
  const tp1=signal==="BUY"?entry+1.25*av:signal==="SELL"?entry-1.25*av:entry;
  const tp2=signal==="BUY"?entry+2.5*av:signal==="SELL"?entry-2.5*av:entry;

  res.setHeader("Cache-Control","s-maxage=45, stale-while-revalidate=15");
  return res.status(200).json({
    signal, confidence, stars, reasons,
    price, entry, sl, tp1, tp2, rsi:rv, atr:av,
    confirmation: confirmationOk
  });
 }catch(e){
  return res.status(500).json({error:"Erreur serveur : "+e.message});
 }
}