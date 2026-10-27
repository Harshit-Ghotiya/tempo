// Tempo v0.7.8: on-device stress-signal portal and study data collection. Everything runs on-device; only derived numbers are shown or exported.
import {createTracker,isSkin} from './hr.js?v=0.7.8';
import {initAffect,evalAffect} from './affect.js?v=0.7.8';
import {createVoiceMonitor} from './voice.js?v=0.7.8';
import {createTrend,ema} from './chart.js?v=0.7.8';
import {phaseStats,directionChecks} from './summary.js?v=0.7.8';
import {createStroopTest,aggregateStroop} from './stroop.js?v=0.7.8';
import {$,stage,toast,tweenNum,drawSpark,buildRows,setRow,setDot,ring,initRate,resetRate,touched,drawer,initTheme,lightOf,lightTip,hrView,hrvShown,openDialog,closeDialog,setupDialogDismiss,renderSummary} from './ui.js?v=0.7.8';
// MediaPipe code and models come from the Tempo launcher (same origin, offline after the first run).
// Without the launcher (for example python -m http.server) they fall back to the public CDN and Google's model host.
const CDN="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14",GCS="https://storage.googleapis.com/mediapipe-models/",
 MODEL_PATH={'face_landmarker.task':'face_landmarker/face_landmarker/float16/1/face_landmarker.task','pose_landmarker_lite.task':'pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'};
const SETTLE_S=20,CAL_S=60,CAL_END=SETTLE_S+CAL_S,WIN_S=10,LOOKBACK_S=30,MIN_Q=.3,MIN_CAL_N=25,LABEL_SPAN_S=60,
 DEMO_GUNA=false, // heuristic Triguna layer: hidden and not exported until validated signals exist
 POSE_EVERY=3,G=['sattva','rajas','tamas'],
 FAST_WIN_S=4,LIVE_MS=250,TAU_S=1.2; // display-only fast track; exported data still uses WIN_S and the 1 Hz tick
const W_MOD={voice:.35,rppg:.30,face:.20,pose:.15}; // prior fusion weights: fit on study data later
// perclos is still exported raw but not modelled: it is about 0 for an alert, seated person.
// Face features are action-unit composites of MediaPipe's blendshape scores (0 to 1), averaged over the 10 s window.
const AU=[['browLower','bL'],['browRaise','bR'],['lidTight','lt'],['eyeWide','ew'],['lipTight','lp'],['lipDown','ld'],['smile','sm']];
const FEAT=Object.fromEntries([...AU.map(([k])=>[k,'face']),...['expressivity','blink','gaze','headMove'].map(k=>[k,'face']),['hr','rppg'],['hrv','rppg'],['shrug','pose'],['sway','pose'],['fidget','pose']]);
// Smallest spread a baseline may have. Without it, blendshape scores near zero make ordinary movement look extreme
// (the old lip feature sat at the +-3 clip in 48% of windows in the first real session).
const FLOOR={browLower:.03,browRaise:.012,lidTight:.03,eyeWide:.004,lipTight:.004,lipDown:.002,smile:.04,expressivity:.01,blink:4.5,gaze:.03,headMove:.18,hr:3,hrv:5,shrug:.02,sway:.08,fidget:.1};
// Facial tension index: weights on baseline z-scores, positive = more tension. Literature-based priors, not fitted or validated.
// v0.7.7: eye tightening leads (rose in the stressor in all three P001 sessions); brow lowering is halved because it moves
// with head pitch and screen position (Reddit scrolling read higher than mental maths in S03); blink is negative because
// cognitive load suppresses blinking (S01-2, S02, S03 stressor blink was below baseline). Checked on 3 sessions of one person only.
const TENSION={browLower:.5,lidTight:1,lipTight:.8,lipDown:.3,browRaise:.2,eyeWide:.2,smile:-.4,expressivity:.1,blink:-.4,gaze:.2,headMove:.1};
// Guna <- cue weights on baseline z-scores. This is the hypothesis from the mapping table; test and refit it.
const MAP={
 rajas:{hr:.8,browLower:.6,lipTight:.4,gaze:.6,headMove:.5,shrug:.6,sway:.4,fidget:.8,blink:.3},
 tamas:{perclos:1,fidget:-.5,headMove:-.5,sway:-.3,gaze:-.4,blink:-.3},
 sattva:{hr:-.4,browLower:-.5,lipTight:-.4,gaze:-.5,headMove:-.4,shrug:-.5,sway:-.4,fidget:-.5,perclos:-.3}};

const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN,
 sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))},fin=a=>a.filter(Number.isFinite);
const median=a=>{const s=[...a].sort((p,q)=>p-q),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
let use,face,pose,tracker,stream,vmon=null,running=false,start,base,lastT=-1,fc=0,pw=null,voice=null,trained=null;
let fbuf=[],pbuf=[],rgb=[],cal={},log=[],zSmooth={};
let participantId='',sessionId='',reports=[],phaseStart=CAL_END,hiddenAt=-1;
const cv=document.createElement('canvas');let cx=null;

// Hook for the existing voice model: setVoice({sattva,rajas,tamas}, quality0to1)
window.setVoice=(p,q=1)=>{voice={p,q,t:performance.now()}};
// Session clock. Browsers throttle main-thread timers and stop requestAnimationFrame in background tabs, which froze the
// tension counter when the participant switched to the stressor tab. A tiny Worker keeps ticking in the background
// (worker timers are not throttled the same way), so frames, the 1 Hz tick and the live display keep running.
// Falls back to setInterval if Workers are unavailable.
const CLOCK_MS=50,BG_FRAME_MS=66;
function createClock(onBeat){
 let w=null,id=null;
 try{
  const url=URL.createObjectURL(new Blob(['let i=null;onmessage=e=>{clearInterval(i);if(e.data>0)i=setInterval(()=>postMessage(0),e.data)}'],{type:'text/javascript'}));
  w=new Worker(url);URL.revokeObjectURL(url);w.onmessage=onBeat;
 }catch(e){w=null}
 return{
  start(){if(w)w.postMessage(CLOCK_MS);else id??=setInterval(onBeat,CLOCK_MS)},
  stop(){if(w)w.postMessage(0);if(id){clearInterval(id);id=null}}
 };
}
let lastTickAt=0,lastLiveAt=0,lastBgFrame=0;
const clock=createClock(()=>{
 if(!running)return;
 const now=performance.now();
 if(document.hidden&&now-lastBgFrame>=BG_FRAME_MS){ // rAF does not run in hidden tabs: pump frames here instead
  lastBgFrame=now;const v=$('cam');
  if(v.readyState>=2&&v.currentTime!==lastT){lastT=v.currentTime;frame(v,now)}
 }
 if(now-lastLiveAt>=LIVE_MS){lastLiveAt=now;liveTick()}
 if(now-lastTickAt>=1000){lastTickAt=now;tick()}
});
document.addEventListener('visibilitychange',()=>{if(running&&!document.hidden)trend.render?.((performance.now()-start)/1e3,.5)});
const btnPip=$('btnPip');
if(btnPip){
 if('pictureInPictureEnabled' in document){
  btnPip.onclick=async()=>{
   try{
    if(document.pictureInPictureElement)await document.exitPictureInPicture();
    else await $('cam').requestPictureInPicture();
   }catch(e){}
  };
 }else btnPip.hidden=true;
}
$('guna').hidden=!DEMO_GUNA;
initTheme($('themeBtn'));
// Tell the launcher this page is open; it quits a few minutes after the last page closes.
const ping=()=>fetch('/__alive',{cache:'no-store'}).catch(()=>{});ping();setInterval(ping,5000).unref?.();

export async function loadModel(urls=['./models.json','./artifacts/models.json','./preset_models.json']){
 for(const u of urls){
  try{
   const r=await fetch(u,{cache:'no-store'});if(!r.ok)continue;
   const m=await r.json();
   if(m?.models&&typeof m.models==='object'&&Object.keys(m.models).length){trained=m;$('guna').hidden=false;return m}
  }catch(e){}
 }
 trained=null;$('guna').hidden=!DEMO_GUNA;return null;
}
loadModel();

async function assets(){
 try{const r=await fetch('/vendor/mediapipe/vision_bundle.mjs',{method:'HEAD'});if(r.ok)return{vis:'/vendor/mediapipe',model:n=>'/models/'+n}}catch(e){}
 return{vis:CDN,model:n=>GCS+MODEL_PATH[n]};
}
async function init(){
 await loadModel();initAffect();
 const A=await assets(),{FilesetResolver,FaceLandmarker,PoseLandmarker}=await import(A.vis+'/vision_bundle.mjs');
 const fs=await FilesetResolver.forVisionTasks(A.vis+'/wasm');
 const mk=async(C,url,o)=>{let err;for(const delegate of['GPU','CPU']){try{return await C.createFromOptions(fs,{baseOptions:{modelAssetPath:url,delegate},runningMode:'VIDEO',...o})}catch(e){err=e}}throw err};
 if(!face&&(use.face||use.pulse))face=await mk(FaceLandmarker,A.model('face_landmarker.task'),{numFaces:1,outputFaceBlendshapes:true});
 if(!pose&&use.pose)pose=await mk(PoseLandmarker,A.model('pose_landmarker_lite.task'),{numPoses:1});
}

function loop(){
 if(!running)return;
 const v=$('cam'),t=performance.now();
 if(v.readyState>=2&&v.currentTime!==lastT){lastT=v.currentTime;frame(v,t)}
 requestAnimationFrame(loop);
}

export const MESH_PTS=[70,63,105,66,107,336,296,334,293,300,33,160,158,133,153,144,362,385,387,263,373,380,468,473,1,2,98,327,168,6,197,195,5,4,61,146,91,181,84,17,314,405,321,375,291,185,40,39,37,0,267,269,270,409,10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
export const BROW_PTS=new Set([70,63,105,66,107,336,296,334,293,300]);
export const EYE_PTS=new Set([33,160,158,133,153,144,362,385,387,263,373,380]);
export const LIP_PTS=new Set([61,146,91,181,84,17,314,405,321,375,291,185,40,39,37,0,267,269,270,409]);

function drawArrow(ctx,x1,y1,x2,y2,color,width=2,head=6){
 const angle=Math.atan2(y2-y1,x2-x1);
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x2,y2);
 ctx.lineTo(x2-head*Math.cos(angle-Math.PI/6),y2-head*Math.sin(angle-Math.PI/6));
 ctx.lineTo(x2-head*Math.cos(angle+Math.PI/6),y2-head*Math.sin(angle+Math.PI/6));
 ctx.closePath();ctx.fill();
}

export function drawStressMesh(mcx,L,W,H,z={},usePulse=false){
 if(!mcx||!L)return;
 mcx.clearRect(0,0,W,H);
 for(const idx of MESH_PTS){
  const pt=L[idx];if(!pt)continue;
  const px=pt.x*W,py=pt.y*H;
  let r=1.4,fill='rgba(255,255,255,0.65)';
  if(BROW_PTS.has(idx)){
   const bz=z.browLower??0;
   if(bz>0.4){r=2.0;fill=bz>1.2?'rgba(255,69,58,0.95)':'rgba(255,149,0,0.9)'}
   else fill='rgba(100,210,255,0.75)';
  }else if(EYE_PTS.has(idx)){
   const ez=z.lidTight??0;
   if(ez>0.4){r=2.0;fill=ez>1.2?'rgba(255,149,0,0.95)':'rgba(255,204,0,0.9)'}
   else fill='rgba(100,210,255,0.75)';
  }else if(LIP_PTS.has(idx)){
   const lz=z.lipTight??0,sz=z.smile??0;
   if(lz>0.6){r=1.8;fill='rgba(255,69,58,0.85)'}
   else if(sz>0.6){r=1.8;fill='rgba(52,199,89,0.85)'}
  }
  mcx.fillStyle=fill;mcx.beginPath();mcx.arc(px,py,r,0,6.283);mcx.fill();
 }
 const bz=z.browLower??0;
 if(bz>0.5&&L[107]&&L[336]&&L[168]){
  const gx=L[168].x*W,gy=L[168].y*H,mag=Math.min(1.0,bz/2.5);
  const x1=L[107].x*W,y1=L[107].y*H;
  drawArrow(mcx,x1,y1,x1+(gx-x1)*0.75*mag,y1+(gy-y1)*0.75*mag,'rgba(255,59,48,0.85)',2,5);
  const x2=L[336].x*W,y2=L[336].y*H;
  drawArrow(mcx,x2,y2,x2+(gx-x2)*0.75*mag,y2+(gy-y2)*0.75*mag,'rgba(255,59,48,0.85)',2,5);
 }
 const sz=z.smile??0;
 if(sz>0.7&&L[61]&&L[291]&&L[234]&&L[454]){
  const mag=Math.min(1.0,sz/2.5);
  const x1=L[61].x*W,y1=L[61].y*H,t1x=L[234].x*W,t1y=L[234].y*H;
  drawArrow(mcx,x1,y1,x1+(t1x-x1)*0.45*mag,y1+(t1y-y1)*0.45*mag,'rgba(52,199,89,0.85)',2,5);
  const x2=L[291].x*W,y2=L[291].y*H,t2x=L[454].x*W,t2y=L[454].y*H;
  drawArrow(mcx,x2,y2,x2+(t2x-x2)*0.45*mag,y2+(t2y-y2)*0.45*mag,'rgba(52,199,89,0.85)',2,5);
 }
 if(usePulse&&L[454]&&L[234]&&L[151]&&L[50]&&L[280]){
  mcx.strokeStyle='rgba(255,69,58,0.75)';mcx.lineWidth=1.5;
  const fw=Math.abs(L[454].x-L[234].x)*W;
  for(const[c,hx,hy]of[[L[151],.14*fw,.05*fw],[L[50],.07*fw,.07*fw],[L[280],.07*fw,.07*fw]]){
   const rx=c.x*W-hx,ry=c.y*H-hy,rw=2*hx,rh=2*hy;
   if(typeof mcx.roundRect==='function'){mcx.beginPath();mcx.roundRect(rx,ry,rw,rh,4);mcx.stroke()}
   else mcx.strokeRect(rx,ry,rw,rh);
  }
 }
 let hudText='FACS TRACKING',hudColor='rgba(255,255,255,0.9)';
 if((z.browLower??0)>1.0){hudText='AU4 BROW TENSION ▲';hudColor='#FF453A'}
 else if((z.lidTight??0)>1.0){hudText='AU7 ORBITAL SQUINT ▲';hudColor='#FF9F0A'}
 else if((z.smile??0)>1.0){hudText='AU12 SMILE ACTIVE';hudColor='#32D74B'}
 mcx.save();mcx.translate(W,0);mcx.scale(-1,1);
 mcx.font='600 10px -apple-system, BlinkMacSystemFont, sans-serif';
 const tw=mcx.measureText?(mcx.measureText(hudText)?.width||90):90;
 mcx.fillStyle='rgba(15,23,42,0.65)';
 if(typeof mcx.roundRect==='function'){mcx.beginPath();mcx.roundRect(10,H-26,tw+16,18,9);mcx.fill()}
 else mcx.fillRect(10,H-26,tw+16,18);
 mcx.fillStyle=hudColor;
 if(mcx.fillText)mcx.fillText(hudText,18,H-13);
 mcx.restore();
}

function frame(v,t){
 if(face){
  const o={t,ok:false},r=face.detectForVideo(v,t),L=r.faceLandmarks[0];
  const mcv=$('meshCv'),mcx=mcv?.getContext?.('2d');
  if(L){
   o.ok=true;
   if(use.face){
    const bs={};r.faceBlendshapes[0].categories.forEach(c=>bs[c.categoryName]=c.score);
    const a=(x,y)=>(bs[x]+bs[y])/2;
    o.bl=a('eyeBlinkLeft','eyeBlinkRight');o.bL=a('browDownLeft','browDownRight');o.bR=(bs.browInnerUp+a('browOuterUpLeft','browOuterUpRight'))/2;
    o.lt=a('eyeSquintLeft','eyeSquintRight');o.ew=a('eyeWideLeft','eyeWideRight');
    o.lp=(bs.mouthPressLeft+bs.mouthPressRight+bs.mouthRollLower+bs.mouthRollUpper)/4;o.ld=a('mouthFrownLeft','mouthFrownRight');o.sm=a('mouthSmileLeft','mouthSmileRight');
    const p=L[468],q=L[473],open=o.bl<.4; // iris centres; gaze ignored while eyes are closing
    o.gx=open?((p.x-L[33].x)/(L[133].x-L[33].x)+(q.x-L[362].x)/(L[263].x-L[362].x))/2:NaN;
    o.gy=open?((p.y-L[159].y)/(L[145].y-L[159].y)+(q.y-L[386].y)/(L[374].y-L[386].y))/2:NaN;
    const iod=Math.hypot(L[33].x-L[263].x,L[33].y-L[263].y);o.nx=L[1].x/iod;o.ny=L[1].y/iod;
   }
   if(use.pulse){ // mean skin RGB over forehead + both cheeks (hair, glasses and glare rejected)
    const W=v.videoWidth,H=v.videoHeight;if(cv.width!==W){cv.width=W;cv.height=H}
    cx??=cv.getContext('2d',{willReadFrequently:true});
    cx.drawImage(v,0,0);
    const fw=Math.abs(L[454].x-L[234].x)*W,s=[0,0,0],fb=[0,0,0];let n=0,nf=0;
    for(const [c,hx,hy] of [[L[151],.14*fw,.05*fw],[L[50],.07*fw,.07*fw],[L[280],.07*fw,.07*fw]]){
     const x=Math.max(0,Math.round(c.x*W-hx)),y=Math.max(0,Math.round(c.y*H-hy)),w=Math.min(W-x,Math.round(2*hx)),h=Math.min(H-y,Math.round(2*hy));
     if(w<2||h<2)continue;
     const d=cx.getImageData(x,y,w,h).data;
     for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      if(isSkin(r,g,b)){s[0]+=r;s[1]+=g;s[2]+=b;n++}
      if(g>25&&g<245){fb[0]+=r;fb[1]+=g;fb[2]+=b;nf++}
     }
    }
    if(n>=20)rgb.push({t,r:s[0]/n,g:s[1]/n,b:s[2]/n});
    else if(nf)rgb.push({t,r:fb[0]/nf,g:fb[1]/nf,b:fb[2]/nf});
   }
   if(mcx&&$('uMesh')?.checked){
    const W=v.videoWidth,H=v.videoHeight;
    if(mcv.width!==W||mcv.height!==H){mcv.width=W;mcv.height=H}
    drawStressMesh(mcx,L,W,H,zSmooth,use.pulse);
   }else if(mcx&&mcv.width){mcx.clearRect(0,0,mcv.width,mcv.height)}
  }else if(mcx&&mcv.width){mcx.clearRect(0,0,mcv.width,mcv.height)}
  fbuf.push(o);
 }
 if(pose&&fc++%POSE_EVERY===0){
  const o={t,ok:false},L=pose.detectForVideo(v,t).landmarks[0];
  if(L){
   const sw=Math.abs(L[11].x-L[12].x); // shoulder width normalises for camera distance
   if(sw>.05){
    o.ok=true;
    o.el=((L[11].y-L[7].y)+(L[12].y-L[8].y))/2/sw; // ear-to-shoulder gap; shrinks when shrugging
    o.sx=(L[11].x+L[12].x)/2/sw;o.sy=(L[11].y+L[12].y)/2/sw;
    const cur={};for(const i of[15,16])if((L[i].visibility??0)>.5)cur[i]=L[i];
    if(pw){const d=[];for(const i in cur)if(pw.p[i])d.push(Math.hypot(cur[i].x-pw.p[i].x,cur[i].y-pw.p[i].y)/sw/((t-pw.t)/1e3));if(d.length)o.wv=mean(d)}
    pw={t,p:cur};
   }
  }
  pbuf.push(o);
 }
 while(fbuf.length&&fbuf[0].t<t-3e4)fbuf.shift();
 while(pbuf.length&&pbuf[0].t<t-3e4)pbuf.shift();
 while(rgb.length&&rgb[0].t<t-16e3)rgb.shift();
}

function feats(winS=WIN_S,{pulse=true}={}){
 const now=performance.now(),x={},q={};
 const F=fbuf.filter(o=>o.t>now-winS*1e3),Fo=F.filter(o=>o.ok);
 if(use.face&&Fo.length>Math.max(20,6*winS)){
  q.face=Fo.length/F.length;
  const B=fbuf.filter(o=>o.ok&&o.bl!==undefined),span=B.length?(B[B.length-1].t-B[0].t)/6e4:0; // blinks use the 30 s buffer
  if(span>8/60){let c=0,s=0;for(const o of B){if(!s&&o.bl>.5){s=1;c++}else if(s&&o.bl<.3)s=0}x.blink=c/span}
  for(const [k,f] of AU)x[k]=mean(Fo.map(o=>o[f]));                     // sustained level of each action-unit composite
  x.expressivity=mean(AU.map(([,f])=>sd(Fo.map(o=>o[f]))));              // how much the face moves overall
  x.perclos=mean(Fo.map(o=>+(o.bl>.8)));                                 // exported raw, not modelled
  x.gaze=Math.hypot(sd(fin(Fo.map(o=>o.gx))),sd(fin(Fo.map(o=>o.gy))));
  x.headMove=Math.hypot(sd(Fo.map(o=>o.nx)),sd(Fo.map(o=>o.ny)));
 }
 const P=pbuf.filter(o=>o.t>now-winS*1e3),Po=P.filter(o=>o.ok);
 if(use.pose&&Po.length>Math.max(6,1.5*winS)){
  q.pose=Po.length/P.length;x.shrug=-mean(Po.map(o=>o.el));
  x.sway=Math.hypot(sd(Po.map(o=>o.sx)),sd(Po.map(o=>o.sy)));
  const w=fin(Po.map(o=>o.wv));if(w.length)x.fidget=mean(w);
 }
 if(use.pulse&&pulse){const e=tracker.update(rgb,now);q.rppg=e.q;if(e.valid){x.hr=e.hr;if(Number.isFinite(e.hrv))x.hrv=e.hrv}} // hr/hrv only for validated windows (see hr.js)
 for(const k in x)if(!Number.isFinite(x[k]))delete x[k];
 return {x,q};
}

export function modP(m,z,x={},mod=trained?.models?.[m]){ // per-modality Guna probabilities (trained model if loaded, else prior MAP)
 if(mod?.features?.length&&mod?.W?.length){
  const vs=mod.features.map(f=>f.startsWith('z_')?(z[f.slice(2)]??z[f]):(x[f]??z[f]));
  if(vs.every(v=>!Number.isFinite(v)))return null;
  const a=vs.map((v,i)=>((Number.isFinite(v)?v:(mod.imputer_median?.[i]??0))-(mod.mean?.[i]??0))/(mod.scale?.[i]||1));
  const lg=mod.W.map(r=>r.slice(1).reduce((s,w,i)=>s+w*a[i],r[0])),mx=Math.max(...lg),ex=lg.map(v=>Math.exp(v-mx)),Z=ex.reduce((s,v)=>s+v,0);
  const cls=mod.classes||G;return Object.fromEntries(cls.map((g,i)=>[g,ex[i]/Z]));
 }
 if(trained)return null; // when a trained file is active, skip modalities it did not fit
 const ks=Object.keys(z).filter(k=>FEAT[k]===m);if(!ks.length)return null;
 const e={};let Z=0;
 for(const g of G){let a=0,w=0;for(const k of ks){const c=MAP[g][k];if(c){a+=c*z[k];w+=Math.abs(c)}}e[g]=Math.exp(1.5*(w?a/w:0));Z+=e[g]}
 return Object.fromEntries(G.map(g=>[g,e[g]/Z]));
}

export function fuse(ps,fcfg=trained?.fusion){ // log-linear pool when trained fusion weights exist, else quality-weighted linear pool
 if(fcfg?.weights){
  const fw=fcfg.weights,T=fcfg.temperature>0?fcfg.temperature:1,num={sattva:0,rajas:0,tamas:0};let den=0;
  for(const m in ps){
   const w=fw[m]??(m==='voice'?W_MOD.voice*ps[m].q:0);
   if(w>0){den+=w;for(const g of G)num[g]+=w*Math.log(Math.max(1e-8,Math.min(1,ps[m].p[g])))}
  }
  if(!den)return null;
  const lg=G.map(g=>num[g]/den/T),mx=Math.max(...lg),ex=lg.map(v=>Math.exp(v-mx)),Z=ex.reduce((s,v)=>s+v,0);
  return Object.fromEntries(G.map((g,i)=>[g,ex[i]/Z]));
 }
 let Z=0;const o={sattva:0,rajas:0,tamas:0};
 for(const m in ps){const w=W_MOD[m]*ps[m].q;Z+=w;for(const g of G)o[g]+=w*ps[m].p[g]}
 return Z?Object.fromEntries(G.map(g=>[g,o[g]/Z])):null;
}

const PHASE={baseline:'Baseline',stressor:'Stressor',recovery:'Recovery'},RATE=['rStress','rSattva','rRajas','rTamas'];
const ROWS={face:[['browLower','Brow lowering'],['browRaise','Brow raise'],['lidTight','Eye tightening'],['lipTight','Lip tightening'],['lipDown','Lip corners down'],['smile','Smile'],['blink','Blink rate'],['gaze','Gaze movement'],['expressivity','Facial movement']],
 pose:[['headMove','Head motion'],['sway','Torso sway'],['shrug','Shoulder lift'],['fidget','Hand movement']]};
const phaseNow=()=>document.querySelector('input[name=phase]:checked').value;
const mmss=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const presence=()=>{const r=fbuf.slice(-30);return r.length?r.filter(o=>o.ok).length/r.length:0};
let tensionS=null;
const trend=createTrend($('trend'));
buildRows('rowsFace',ROWS.face);buildRows('rowsPose',ROWS.pose);RATE.forEach(initRate);

const MIN_CAL_RPPG=8;
export function makeBase(calObj){
 const b={};
 for(const k in calObj){
  const reqN=(k==='hr'||k==='hrv')?MIN_CAL_RPPG:MIN_CAL_N;
  if(calObj[k]?.length>=reqN){
   // No caps on the median: the v0.7.6 browLower cap (0.14) put a relaxed S03 baseline at z=+2.3.
   const m=median(calObj[k]);
   b[k]={m,s:Math.max(1.4826*median(calObj[k].map(v=>Math.abs(v-m))),.1*Math.abs(m),FLOOR[k]??1e-3)};
  }
 }
 return b;
}

export function tensionOf(z,qFace){
 const zs=Object.keys(TENSION).filter(k=>z[k]!=null);
 if((qFace??0)<MIN_Q||zs.length<4)return null;
 const den=zs.reduce((s,k)=>s+Math.abs(TENSION[k]),0);
 return den?zs.reduce((s,k)=>s+TENSION[k]*z[k],0)/den:null;
}

const EDGES=[-0.75,0.75,1.5],
 WORDS=['More relaxed than your baseline','Near your baseline','Somewhat above your baseline','Well above your baseline'],
 ZKEY=['relaxed','base','up','high'];

export function zoneIdxOf(v,prev,margin=0.1){
 if(v==null)return null;
 const z=v<EDGES[0]?0:v<=EDGES[1]?1:v<=EDGES[2]?2:3;
 if(prev==null||z===prev||Math.abs(z-prev)>1)return z;
 return Math.abs(v-EDGES[Math.min(z,prev)])<margin?prev:z;
}

let lastLive=0,calFast={},baseFast=null,fast=null,zoneIdx=null,afTrailPts=[];

function renderState(v){
 zoneIdx=zoneIdxOf(v,zoneIdx);
 $('stateWord').textContent=zoneIdx==null?'Not enough signal yet':WORDS[zoneIdx];
 const liveEl=$('live');if(liveEl)liveEl.dataset.zone=zoneIdx==null?'':ZKEY[zoneIdx];
 const fmt=n=>n==null?'–':(n>=0?'+':'−')+Math.abs(n).toFixed(1);
 tweenNum($('stateNum'),v,1,250,fmt);
}

function liveTick(){
 if(!running)return;
 const now=performance.now(),el=(now-start)/1e3,dt=lastLive?(now-lastLive)/1e3:LIVE_MS/1e3;
 lastLive=now;
 const {x,q}=feats(FAST_WIN_S,{pulse:false});
 if(el<CAL_END){
  if(el>=SETTLE_S+FAST_WIN_S){
   for(const k in x){
    if((FEAT[k]==='face'||FEAT[k]==='pose')&&(q[FEAT[k]]??0)>MIN_Q){
     (calFast[k]??=[]).push(x[k]);
    }
   }
  }
  return;
 }
 baseFast??=makeBase(calFast);
 const z={};
 for(const k in x)if(baseFast[k])z[k]=Math.max(-3,Math.min(3,(x[k]-baseFast[k].m)/baseFast[k].s));
 const raw=tensionOf(z,q.face);
 fast=raw===null?null:fast===null?raw:fast+ema(dt,TAU_S)*(raw-fast);
 trend.push(el,fast);
 renderState(fast);
 for(const [k] of [...ROWS.face,...ROWS.pose]){
  if(z[k]!=null){
   zSmooth[k]=zSmooth[k]==null?z[k]:zSmooth[k]+ema(dt,1.5)*(z[k]-zSmooth[k]);
   setRow(k,x[k],zSmooth[k]);
  }else setRow(k,x[k],null);
 }
}

let lastHr=null,lastHrv=null,calLate={hr:[],hrv:[]},hrLate=false;

function show(x,z,q,el,all,ag,tn,af,status){
 $('idxHead').classList.toggle('on',fast!==null||tn!==null);
 const pe=$('idxPulse');if(pe)pe.classList.toggle('on',fast!==null||tn!==null);
 $('pulseBox').hidden=!use.pulse;
 if(use.pulse){
  if(x.hr!=null&&Number.isFinite(x.hr))lastHr={v:x.hr,t:el};
  const view=hrView(lastHr,el);
  const box=$('pulseBox');if(box)box.dataset.state=view.state;
  tweenNum($('hrNum'),view.v);
  const hrvV=hrvShown(x.hrv,q.rppg);
  if(hrvV!=null)lastHrv={v:hrvV,t:el};
  const hrvView=hrView(lastHrv,el);
  tweenNum($('hrvNum'),hrvView.v);
  const agoEl=$('hrAgo');
  if(agoEl)agoEl.textContent=view.state==='held'&&view.age!=null?`(${Math.round(view.age)}s ago)`:'';
  const heart=$('hrHeart');
  if(heart){
   if(view.state==='live'&&view.v>0)heart.style.setProperty('--beat',(60/view.v).toFixed(2)+'s');
   else heart.style.removeProperty('--beat');
  }
  const note=view.state==='live'?'experimental estimate':view.state==='held'?'signal lost: holding last value':'no clear pulse signal';
  $('hrNote').textContent=note;
 }
 setDot($('dFace'),use.face?q.face:null);setDot($('dPulse'),use.pulse?q.rppg:null);setDot($('dPose'),use.pose?q.pose:null);
 setDot($('dVoice'),use.voice?(voice&&performance.now()-voice.t<15e3?voice.q:0.1):null);
 $('win').textContent=status;$('win').dataset.ok=status==='clean window'?'1':'0';
 $('tb').innerHTML=Object.keys(FEAT).map(k=>`<tr><td>${k}</td><td>${x[k]==null?'–':x[k].toFixed(2)}</td><td>${z[k]==null?'–':z[k].toFixed(1)}</td></tr>`).join('');
 $('v_valence').textContent=af?af.valence.toFixed(2):'–';$('v_arousal').textContent=af?af.arousal.toFixed(2):'–';$('v_affect').textContent=af?af.label:'–';
 if(af){
  const cx=Math.max(10,Math.min(90,50+af.valence*36)),cy=Math.max(10,Math.min(90,50-af.arousal*36));
  const dot=$('afDot');if(dot){dot.setAttribute('cx',cx.toFixed(1));dot.setAttribute('cy',cy.toFixed(1))}
  const trail=$('afTrail');
  if(trail){
   afTrailPts.push({x:cx,y:cy});if(afTrailPts.length>8)afTrailPts.shift();
   trail.innerHTML=afTrailPts.map((p,i)=>{
    const op=((i+1)/afTrailPts.length*0.4).toFixed(2);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="var(--accent)" opacity="${op}"/>`;
   }).join('');
  }
 }
 if(DEMO_GUNA||trained){
  for(const g of G){
   const pct=all?Math.round(100*all[g])+'%':'–';
   $('v_'+g).textContent=pct;
   const bar=$('b_'+g);if(bar)bar.style.width=all?pct:'0%';
  }
  $('ag').textContent=ag==null?'–':ag.toFixed(2);
 }
}

function setup(el,x,q,tip=null){ // setup stage: ring, wording and live checks while the baseline is being collected
 const settling=el<SETTLE_S,lv=v=>v==null?'':v>=.6?'good':v>=.3?'fair':'poor',
  row=(id,on,v,txt)=>{const r=$(id);r.hidden=!on;if(on){r.firstElementChild.dataset.q=lv(v);r.lastElementChild.textContent=txt}};
 ring(el/CAL_END);$('ringNum').textContent=mmss(Math.max(0,CAL_END-el));
 $('setupTitle').textContent=settling?'Settling in':'Calibrating';
 $('setupText').textContent=settling?'Sit comfortably and face the screen.':'Stay still and breathe normally. This becomes your personal baseline. If the pulse doesn\'t lock during setup, stay in Baseline a little longer under better light.';
 const p=presence(),still=x.headMove==null?null:x.headMove<.35?1:x.headMove<.6?.45:0;
 row('cFace',true,p,p>=.9?'Face in frame':'Move into the frame and face the screen');
 row('cPulse',use.pulse,q.rppg,tip??(q.rppg>=MIN_Q?'Pulse signal found':'Looking for a pulse: light your face evenly and hold still'));
 row('cPose',use.pose,q.pose,q.pose>=.6?'Shoulders in frame':'Sit back so your shoulders are in view');
 row('cStill',use.face&&still!==null,still,still===1?'Holding still':'Try to hold still');
}

let guidedTargetS=90,guidedPrompted=false;
const MIN_FPS=5,NEXT_STEP={baseline:'switch to Stressor and start your task',stressor:'switch to Recovery and start your music',recovery:'stop the camera and export'};
// Reminder state: the Check in button pulses and the tab title flags it so it is visible from another tab.
const BASE_TITLE=document.title;
function nudge(on){
 $('openReport')?.classList.toggle('nudge',!!on);
 document.title=on?'⏰ Check in · '+BASE_TITLE:BASE_TITLE;
}

function chime(){
 try{
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
  const ac=new AC(),now=ac.currentTime,o1=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain();
  o1.frequency.value=523.25;o2.frequency.value=659.25;
  g.gain.setValueAtTime(0.08,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.8);
  o1.connect(g);o2.connect(g);g.connect(ac.destination);
  o1.start(now);o2.start(now);o1.stop(now+0.8);o2.stop(now+0.8);
  setTimeout(()=>ac.close(),1000);
 }catch(e){}
}

function tick(){
 const el=(performance.now()-start)/1e3,{x,q}=feats(),pre=el<CAL_END,phase=el<SETTLE_S?'settle':pre?'calibration':phaseNow();
 // Windows are only clean if frames kept arriving: below MIN_FPS (for example a throttled background tab) blink and
 // movement features are unreliable, so the next LOOKBACK_S seconds are flagged as transition.
 const f2s=fbuf.filter(o=>o.t>performance.now()-2000).length,fps=f2s/2;
 if(!pre&&fps<MIN_FPS)hiddenAt=el;
 const ws=Math.max(0,el-WIN_S),fs0=el-LOOKBACK_S,inside=!pre&&fs0>=phaseStart&&fs0>hiddenAt; // features look back up to LOOKBACK_S
 let z={},ps={},all=null,ag=null,tn=null,af=null,light=null,tip=null;
 if(use.pulse){
  light=lightOf(rgb,performance.now());
  tip=lightTip(light);
  const tipEl=$('lightTip');
  if(tipEl){if(tip){tipEl.textContent=tip;tipEl.hidden=false}else tipEl.hidden=true}
 }
 if(pre){
  // Baseline only from settled, good-quality windows: the first seconds of a session are mostly movement.
  if(el>=SETTLE_S+WIN_S)for(const k in x)if(FEAT[k]&&(q[FEAT[k]]??0)>MIN_Q)(cal[k]??=[]).push(x[k]);
  setup(el,x,q,tip);
 }else{
  if(document.body.dataset.stage==='setup'){stage('live');toast('Baseline set. You are live.');trend.mark(el,'baseline')}
  // Robust baseline: median and MAD, floored at 10% of the median because overlapping windows understate spread.
  base??=makeBase(cal);
  // Late HR baseline if calibration missed it but user is in baseline phase under better light
  if(use.pulse&&base&&!base.hr&&!hrLate&&phase==='baseline'&&inside){
   if(x.hr!=null&&(q.rppg??0)>MIN_Q){
    (calLate.hr??=[]).push(x.hr);
    if(x.hrv!=null)(calLate.hrv??=[]).push(x.hrv);
    if(calLate.hr.length>=MIN_CAL_RPPG){
     Object.assign(base,makeBase(calLate));
     hrLate=true;
     toast('Pulse baseline set from Baseline phase.');
    }
   }
  }
  const CORE_FACE=['browLower','lidTight','smile','expressivity'];
  const miss=CORE_FACE.filter(k=>use.face&&!base[k]);
  $('st').textContent=miss.length?`Face calibration incomplete (${miss.join(', ')}). Check lighting and framing, then restart setup.`:'';
  for(const k in x)if(base[k])z[k]=Math.max(-3,Math.min(3,(x[k]-base[k].m)/base[k].s));
  // Facial tension index: needs a usable face signal and at least 4 features with a baseline; smoothed so it does not flicker.
  const raw=tensionOf(z,q.face);
  tensionS=raw===null?null:tensionS===null?raw:tensionS+.3*(raw-tensionS);tn=tensionS;
  if(q.face>=MIN_Q)af=evalAffect(x,z);
  if(DEMO_GUNA||trained){
   for(const m of['face','rppg','pose']){const p=modP(m,z,x);if(p&&q[m]>MIN_Q)ps[m]={p,q:q[m]}}
   const vis=fuse(ps),vo=voice&&performance.now()-voice.t<15e3?voice:null;
   all=fuse(vo?{...ps,voice:{p:vo.p,q:vo.q}}:ps);
   if(vo&&vis)ag=1-.5*G.reduce((s,g)=>s+Math.abs(vo.p[g]-vis[g]),0);
  }
 }
 if(!pre){
  $('phaseTime').textContent=mmss(Math.max(0,el-phaseStart));
  // Guided protocol is a reminder only: it never opens the drawer or changes phase, so the participant decides
  // when to switch to the stressor or the music.
  const isGuided=!!$('uGuided')?.checked,gBar=$('guidedBar');
  if(gBar)gBar.hidden=!isGuided;
  if(isGuided){
   guidedTargetS=Number($('guidedSecs')?.value||90);
   const phaseElapsed=Math.max(0,el-phaseStart),done=phaseElapsed>=guidedTargetS;
   const gFill=$('guidedFill');
   if(gFill)gFill.style.width=`${Math.min(100,(phaseElapsed/guidedTargetS)*100)}%`;
   if(gBar)gBar.dataset.done=done?'1':'0';
   if(done&&!guidedPrompted){
    guidedPrompted=true;
    chime();nudge(true);
    const next=NEXT_STEP[phaseNow()];
    toast(`${guidedTargetS} s of ${PHASE[phaseNow()]} done. Check in, then ${next} when you are ready.`,8000);
   }
  }
 }
 const fpsEl=$('fpsNum');if(fpsEl)fpsEl.textContent=Math.round(fps)||'–';
 show(x,z,q,el,all,ag,tn,af,pre?'setting up':inside?'clean window':fs0<phaseStart?'wait: phase changed':fs0<=hiddenAt?'wait: low frame rate':'wait');
 log.push({
  participant_id:participantId,session_id:sessionId,t:+el.toFixed(1),
  window_start_s:+ws.toFixed(1),window_end_s:+el.toFixed(1),feature_start_s:+Math.max(0,fs0).toFixed(1),phase,phase_start_s:+phaseStart.toFixed(1),
  transition:!pre&&!inside,tension_idx:tn??'',tension_fast:fast==null?'':+fast.toFixed(3),valence:af?+af.valence.toFixed(3):'',arousal:af?+af.arousal.toFixed(3):'',
  skin_luma:light?+light.luma.toFixed(1):'',skin_rg:light?+light.rg.toFixed(2):'',hr_baseline_late:hrLate,
  stroop_active:stroopTest?.isActive?.()?1:0,
  fps:+fps.toFixed(1),tab_hidden:document.hidden,
  ...x,...Object.fromEntries(Object.entries(z).map(([k,v])=>['z_'+k,v])),
  ...(all?{p_sattva:all.sattva,p_rajas:all.rajas,p_tamas:all.tamas}:{}),
  face_quality:q.face??'',rppg_quality:q.rppg??'',pose_quality:q.pose??'',agree:ag
 });
}

// Phase control and check-in drawer
$('phaseSeg').addEventListener('change',()=>{
 phaseStart=Math.max(CAL_END,(performance.now()-start)/1e3);
 $('reportPhase').textContent=PHASE[phaseNow()];
 trend.mark(phaseStart,phaseNow());
 guidedPrompted=false;nudge(false);
 $('btnStroop')?.classList.toggle('active-hint',phaseNow()==='stressor');
 toast(`Phase: ${PHASE[phaseNow()]}. Check in at its end, before you switch.`);
});
const closeDrawer=()=>drawer(false);
$('openReport').onclick=()=>{$('reportMsg').textContent='';drawer(true)};
$('cancelReport').onclick=closeDrawer;$('scrim').onclick=closeDrawer;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
$('saveReport').onclick=()=>{
 if(!RATE.every(touched)){$('reportMsg').textContent='Slide each of the four bars to set a rating.';return}
 const [st,s,r,t]=RATE.map(id=>Number($(id).value));
 if(s+r+t===0){$('reportMsg').textContent='Calm, restless and dull cannot all be zero.';return}
 const tt=(performance.now()-start)/1e3,phase=phaseNow();
 if(tt<CAL_END){$('reportMsg').textContent='Wait until setup has finished.';return}
 const sum=s+r+t;
 reports.push({sattva:s/sum,rajas:r/sum,tamas:t/sum,raw_sattva:s,raw_rajas:r,raw_tamas:t,raw_stress:st,stress_label:st/10,t:tt,phase});
 trend.check(tt,st);
 RATE.forEach(resetRate);closeDrawer();
 toast(`Check-in saved for ${PHASE[phase]}. It labels the last ${LABEL_SPAN_S} s of this phase.`);
 nudge(false);
};

const chk=()=>{$('go').disabled=!($('ok').checked&&($('uFace').checked||$('uPulse').checked||$('uPose').checked||$('uVoice').checked))};
['ok','uFace','uPulse','uPose','uVoice'].forEach(id=>{const el=$(id);el.onchange=chk;el.oninput=chk;el.onclick=chk});
['participantId','sessionId'].forEach(id=>$(id).oninput=chk);
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pageshow',chk);
chk();

$('go').onclick=async()=>{
 const goBtn=$('go');
 if(goBtn.disabled)return;
 use={face:$('uFace').checked,pulse:$('uPulse').checked,pose:$('uPose').checked,voice:$('uVoice').checked};
 participantId=$('participantId').value.trim();sessionId=$('sessionId').value.trim();
 if(!participantId||!sessionId){$('msg').textContent='Enter a participant ID and a session ID.';return}
 goBtn.disabled=true;
 goBtn.textContent='Starting...';
 $('msg').textContent='Starting the camera and loading models. The very first run downloads two small model files, which can take a minute.';
 let userAudioCtx=null;
 try{
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(AC){userAudioCtx=new AC();if(userAudioCtx.state==='suspended')userAudioCtx.resume();}
 }catch(e){}
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,frameRate:30},audio:use.voice});
  const v=$('cam');v.srcObject=stream;await v.play();
  await init();
 }catch(e){
  $('msg').textContent='Could not start: '+e.message+'. Allow camera access in the browser. If this is the first run, connect to the internet once so the models can download.';
  goBtn.disabled=false;
  goBtn.textContent='Start setup';
  if(stream)stream.getTracks().forEach(t=>t.stop());return;
 }
 clock.stop();
 fbuf=[];pbuf=[];rgb=[];cal={};log=[];tracker=createTracker();base=null;pw=null;hiddenAt=-1;
 calFast={};baseFast=null;fast=null;lastLive=0;zoneIdx=null;afTrailPts=[];
 lastHr=null;lastHrv=null;calLate={hr:[],hrv:[]};hrLate=false;guidedPrompted=false;zSmooth={};nudge(false);latestStroop=null;$('btnStroop')?.classList.remove('active-hint');
 if(vmon)vmon.stop();vmon=use.voice?createVoiceMonitor(stream,(p,q)=>window.setVoice(p,q),userAudioCtx):null;
 reports=[];tensionS=null;phaseStart=CAL_END;
 renderState(null);
 const trail=$('afTrail');if(trail)trail.innerHTML='';
 const dot=$('afDot');if(dot){dot.setAttribute('cx','50');dot.setAttribute('cy','50')}
 const tipEl=$('lightTip');if(tipEl)tipEl.hidden=true;
 const agoEl=$('hrAgo');if(agoEl)agoEl.textContent='';
 trend.reset();trend.start(()=>(performance.now()-start)/1e3);
 document.querySelector('input[name=phase][value=baseline]').checked=true;$('reportPhase').textContent='Baseline';
 $('who').textContent=`${participantId} (${sessionId})`;$('cam').classList.add('on');
 stage('setup');
 goBtn.textContent='Start setup';
 start=performance.now();running=true;lastTickAt=lastLiveAt=start;loop();clock.start();
};

$('stop').onclick=()=>{
 running=false;clock.stop();trend.stop();nudge(false);stroopTest?.stop?.();$('btnStroop')?.classList.remove('active-hint');
 if(vmon){vmon.stop();vmon=null}if(stream)stream.getTracks().forEach(t=>t.stop());
 const mcv=$('meshCv');mcv?.getContext?.('2d')?.clearRect(0,0,mcv.width||640,mcv.height||480);
 $('cam').srcObject=null;$('cam').classList.remove('on');
 $('st').textContent='Camera stopped. Export your data, or reload the page to start again.';$('win').textContent='stopped';$('win').dataset.ok='0';
 chk();
 if(reports.length>0)showSummary();
};

const showSummary=()=>{
 const dur=start?(performance.now()-start)/1e3:0;
 const stats=phaseStats(log,reports);
 const checks=directionChecks(stats);
 renderSummary(stats,checks,log,{participantId,sessionId,durationS:dur,reportCount:reports.length,stroop:latestStroop});
 openDialog($('summary'));
};

setupDialogDismiss($('summary'));
$('sumClose').onclick=()=>closeDialog($('summary'));
$('sumDone').onclick=()=>closeDialog($('summary'));
$('sumPrint').onclick=()=>window.print();
$('openSummary').onclick=showSummary;

// Built-in Stroop cognitive stressor
let latestStroop=null;
let sharedAudioCtx=null;

function getSharedAudioCtx(){
 if(!sharedAudioCtx){
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(AC)sharedAudioCtx=new AC();
 }
 if(sharedAudioCtx&&sharedAudioCtx.state==='suspended')sharedAudioCtx.resume();
 return sharedAudioCtx;
}

function playSweetChime(){
 try{
  const ac=getSharedAudioCtx();if(!ac)return;
  const now=ac.currentTime;
  const notes=[783.99,1046.50,1318.51];
  notes.forEach((freq,idx)=>{
   const osc=ac.createOscillator(),gain=ac.createGain();
   osc.type='sine';
   osc.frequency.setValueAtTime(freq,now+idx*0.055);
   gain.gain.setValueAtTime(0.001,now+idx*0.055);
   gain.gain.exponentialRampToValueAtTime(0.09,now+idx*0.055+0.012);
   gain.gain.exponentialRampToValueAtTime(0.001,now+idx*0.055+0.32);
   osc.connect(gain);gain.connect(ac.destination);
   osc.start(now+idx*0.055);osc.stop(now+idx*0.055+0.33);
  });
 }catch(e){}
}

function playHapticThud(){
 try{if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate([40,30,40])}catch(e){}
 try{
  const ac=getSharedAudioCtx();if(!ac)return;
  const now=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();
  osc.type='sine';
  osc.frequency.setValueAtTime(75,now);
  osc.frequency.exponentialRampToValueAtTime(32,now+0.045);
  gain.gain.setValueAtTime(0.18,now);
  gain.gain.exponentialRampToValueAtTime(0.001,now+0.045);
  osc.connect(gain);gain.connect(ac.destination);
  osc.start(now);osc.stop(now+0.05);
 }catch(e){}
}

const updateStroopFeedback=ok=>{
 const box=$('stroopWordBox');
 if(!box)return;
 box.classList.remove('err-shake','correct-flare');
 void box.offsetWidth;
 if(ok){
  box.classList.add('correct-flare');
  playSweetChime();
 }else{
  box.classList.add('err-shake');
  playHapticThud();
 }
};

const updateStroopStats=resList=>{
 const agg=aggregateStroop(resList);
 const sc=$('stroopScoreNum'),ac=$('stroopAccNum'),rt=$('stroopRtNum');
 if(sc)sc.textContent=agg.correct;
 if(ac)ac.textContent=agg.accuracy+'%';
 if(rt)rt.textContent=agg.meanRtMs?`${agg.meanRtMs} ms`:'–';
};

const renderStroopTrial=(trial,trialIndex)=>{
 const word=$('stroopWord');
 if(word){
  word.textContent=trial.word;
  word.style.color=trial.inkHex||trial.colorHex;
 }
 const tr=$('stroopTrialNum');
 if(tr)tr.textContent=trialIndex+1;

 if(trial.buttonOptions){
  trial.buttonOptions.forEach((opt,idx)=>{
   const btn=$(`stroopBtn${idx+1}`);
   if(btn){
    btn.className=`stroop-btn ${opt.class||''}`;
    const nameEl=btn.querySelector('.sname');
    if(nameEl)nameEl.textContent=opt.name;
    btn.onclick=()=>{
     const res=stroopTest.answer(opt.name);
     if(res){
      updateStroopFeedback(res.ok);
      updateStroopStats(stroopTest.getResults());
     }
    };
   }
  });
 }
};

export const stroopTest=createStroopTest({
 durationS:60,
 onTrial(trial,trialIndex){
  renderStroopTrial(trial,trialIndex);
 },
 onTick(remainingS,totalS){
  const s=$('stroopSecs');
  if(s)s.textContent=remainingS;
  const fill=$('stroopProgressFill');
  if(fill)fill.style.width=`${Math.max(0,Math.min(100,(remainingS/totalS)*100))}%`;
 },
 onFinish(summary){
  latestStroop=summary;
  const act=$('stroopActive'),sum=$('stroopSummary');
  if(act)act.hidden=true;
  if(sum)sum.hidden=false;
  const fa=$('stroopFinalAcc'),ft=$('stroopFinalTrials'),fr=$('stroopFinalRt'),fi=$('stroopFinalInterference');
  if(fa)fa.textContent=summary.accuracy+'%';
  if(ft)ft.textContent=summary.trials;
  if(fr)fr.textContent=summary.meanRtMs?`${summary.meanRtMs} ms`:'–';
  if(fi)fi.textContent=summary.interferenceMs>0?`+${summary.interferenceMs} ms`:'0 ms';
  chime();
  toast(`Stroop challenge complete (${summary.trials} trials, ${summary.accuracy}% accuracy). Check in to rate your stress.`);
 }
});

const btnNone=$('stroopBtnNone');
if(btnNone){
 btnNone.onclick=()=>{
  const res=stroopTest.answer('None');
  if(res){
   updateStroopFeedback(res.ok);
   updateStroopStats(stroopTest.getResults());
  }
 };
}

const btnStroop=$('btnStroop');
if(btnStroop){
 btnStroop.onclick=()=>{
  if(running&&phaseNow()!=='stressor'){
   const r=document.querySelector('input[name=phase][value=stressor]');
   if(r){r.checked=true;r.dispatchEvent(new Event('change'))}
  }
  const intro=$('stroopIntro'),act=$('stroopActive'),sum=$('stroopSummary'),sec=$('stroopSecs');
  if(intro)intro.hidden=false;
  if(act)act.hidden=true;
  if(sum)sum.hidden=true;
  if(sec)sec.textContent='60';
  openDialog($('stroopModal'));
 };
}

const stroopStartBtn=$('stroopStartBtn');
if(stroopStartBtn){
 stroopStartBtn.onclick=()=>{
  const intro=$('stroopIntro'),act=$('stroopActive'),sum=$('stroopSummary');
  if(intro)intro.hidden=true;
  if(act)act.hidden=false;
  if(sum)sum.hidden=true;
  stroopTest.start();
 };
}

document.addEventListener('keydown',e=>{
 const modal=$('stroopModal');
 if(modal&&modal.open&&stroopTest.isActive()){
  const res=stroopTest.handleKey(e);
  if(res){
   updateStroopFeedback(res.ok);
   updateStroopStats(stroopTest.getResults());
  }
 }
});

setupDialogDismiss($('stroopModal'));
const stroopClose=$('stroopClose');
if(stroopClose){
 stroopClose.onclick=()=>{
  stroopTest.stop();
  closeDialog($('stroopModal'));
 };
}
const stroopDoneBtn=$('stroopDoneBtn');
if(stroopDoneBtn)stroopDoneBtn.onclick=()=>closeDialog($('stroopModal'));
const stroopCheckinBtn=$('stroopCheckinBtn');
if(stroopCheckinBtn){
 stroopCheckinBtn.onclick=()=>{
  closeDialog($('stroopModal'));
  $('openReport')?.click();
 };
}

// Retrospective labelling, applied at export (a label needs a report that arrives after the window).
// A window takes a self-report's label only if it lies wholly inside the reported phase, shares its phase,
// and ends within LABEL_SPAN_S before the report. The nearest later report wins. Nothing is carried forward.
function labelled(){
 const b=reports.filter(p=>p.phase==='baseline').sort((a,c)=>a.t-c.t)[0]; // own baseline report, for change-from-baseline targets
 return log.map(r=>{
  const c=reports.filter(p=>p.phase===r.phase&&!['settle','calibration'].includes(r.phase)&&!r.transition&&
   r.window_start_s>=p.t-LABEL_SPAN_S&&r.window_end_s<=p.t).sort((a,d)=>a.t-d.t)[0];
  const o={...r,max_label_lag_s:LABEL_SPAN_S,eligible_for_training:!!c,
   ...(b?{baseline_raw_sattva:b.raw_sattva,baseline_raw_rajas:b.raw_rajas,baseline_raw_tamas:b.raw_tamas,baseline_raw_stress:b.raw_stress}:{})};
  return c?{...o,sattva_label:c.sattva,rajas_label:c.rajas,tamas_label:c.tamas,
   raw_sattva:c.raw_sattva,raw_rajas:c.raw_rajas,raw_tamas:c.raw_tamas,raw_stress:c.raw_stress,stress_label:c.stress_label,
   report_t_s:+c.t.toFixed(1),report_phase:c.phase,label_window_start_s:+(c.t-LABEL_SPAN_S).toFixed(1),
   label_window_end_s:+c.t.toFixed(1),label_lag_s:+(c.t-r.window_end_s).toFixed(1)}:o;
 });
}

$('exp').onclick=()=>{
 const rows=labelled(),ks=[...new Set(rows.flatMap(Object.keys))],
  esc=v=>{if(v==null)return '';const s=String(v);return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s},
  csv=[ks.join(','),...rows.map(r=>ks.map(k=>esc(r[k])).join(','))].join('\n'),
  a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
 a.href=url;a.download=`${participantId}_${sessionId}_session.csv`;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast(`Exported ${rows.filter(r=>r.eligible_for_training).length} labelled windows from ${reports.length} check-in(s).`);
};
