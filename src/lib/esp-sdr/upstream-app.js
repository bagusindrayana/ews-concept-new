'use strict';
const $=id=>document.getElementById(id);
let gainMode='HARDWARE';
function preferredSampleRate(rates=radio.rxRates){return rates.includes(80000000)?80000000:Math.max(...rates);}
function applyRadioProfile(){
 const tuning=radio.frequencyInput();$('frequency').min=tuning.min;$('frequency').max=tuning.max;$('frequency').step=tuning.step;
 $('gain').min=radio.gainMin;$('gain').max=radio.gainMax;$('gain').step=radio.gainStep;$('gain').value=Math.min(Math.max(40,radio.gainMin),radio.gainMax);$('gainValue').textContent=`${$('gain').value} / ${radio.gainMax}`;
 if(!radio.hasGain||(!radio.hasHardwareAgc&&gainMode==='HARDWARE'))gainMode='MANUAL';
 for(const [id,rates] of [['rate',radio.rxRates]]){
  for(const o of $(id).options)o.disabled=!rates.includes(Number(o.value));
  $(id).value=String(preferredSampleRate(rates));
 }
 const bandwidth=radio.bandwidthRange;
 analogBandwidth=bandwidth?(bandwidth[0]<=20&&bandwidth[1]>=20&&(20-bandwidth[0])%bandwidth[2]===0?20:bandwidth[3]):0;
 $('bandwidthControl').hidden=!bandwidth;
 if(bandwidth){$('bandwidth').min=bandwidth[0];$('bandwidth').max=bandwidth[1];$('bandwidth').step=bandwidth[2];$('bandwidth').value=analogBandwidth||bandwidth[1];}
 for(const option of $('bits').options)option.disabled=!radio.sampleBits.includes(Number(option.value));
 if(!radio.sampleBits.includes(Number($('bits').value)))$('bits').value=String(radio.sampleBits[0]);

 if(!radio.validFrequency(tuneFrequency)){tuneFrequency=2412;$('frequency').value='2412';}
 state();labels();
}
let spectrumMode=false,connectionBusy=false,firmwareHandoff=false;
let firmwareCheck=0,firmwareUpdate=null;
let connected=false,paused=false,latest=null,trace=null,maximum=null,previous=0,key='',running=false,tuneFrequency=2412,analogBandwidth=20;
let loopDone=Promise.resolve();
const spec=$('spectrum'),water=$('waterfall'),sc=spec.getContext('2d'),wc=water.getContext('2d');
const lut=Array.from({length:256},(_,i)=>{const stops=[[3,8,23],[18,31,81],[38,63,153],[30,139,181],[66,213,174],[217,237,103],[255,162,61],[255,244,228]];const p=i/255*(stops.length-1),j=Math.min(stops.length-2,Math.floor(p)),t=p-j;return stops[j].map((v,k)=>Math.round(v*(1-t)+stops[j+1][k]*t));});

// ---- display zoom (wheel), pan (drag), reset (double-click) -------------
// view = visible fraction [a, b] of the received span; the waterfall keeps its
// rows (newest first) so it can be redrawn for any view.
let view={a:0,b:1},waterHist=[],drag=null,suppressClick=false,keepView=false,tuneClick=null;
var specCov=0; // fraction of the received samples that went through an on-chip FFT
function viewFrac(x,el){const r=el.getBoundingClientRect();return view.a+(x-r.left)/r.width*(view.b-view.a);}
function setView(a,b,free){const nb=(latest&&latest.fft)||2048,minW=Math.max(8/nb,1/1024);let w=Math.max(minW,Math.min(1,b-a));
 if(free){b=a+w;}else if(w>=1){a=0;b=1;}else{a=Math.max(0,Math.min(1-w,a));b=a+w;}view={a,b};redrawWater();draw();labels();}
// released beyond the received span: retune the LO by whole MHz so the view centre is covered
function retuneToView(){const c=latest||config(),span=c.rate/1e6,shift=Math.round(((view.a+view.b)/2-.5)*span);
 if(!connected||!shift){setView(view.a,view.b);return;}const lo0=loFrequency();tuneFrequency=radio.nearestFrequency(tuneFrequency+shift);$('frequency').value=tuneFrequency;
 const d=(loFrequency()-lo0)/span;keepView=true;setView(view.a-d,view.b-d);}
function wmap(W,nb){if(!waterMap||waterMap.W!==W||waterMap.nb!==nb||waterMap.a!==view.a||waterMap.b!==view.b){
 const lo=new Uint16Array(W),hi=new Uint16Array(W),span=view.b-view.a;
 for(let x=0;x<W;x++){const f0=view.a+x/W*span,f1=view.a+(x+1)/W*span;lo[x]=Math.max(0,Math.min(nb,Math.floor(f0*nb)));hi[x]=Math.max(lo[x],Math.min(nb,Math.ceil(f1*nb)));}
 waterMap={W,nb,a:view.a,b:view.b,lo,hi};}return waterMap;}
function paintRows(rows,y0){const n=rows.length;if(!n)return;const W=water.width,nb=rows[0].length,m=wmap(W,nb),floor=Number($('floor').value),range=Number($('range').value),scale=255/range;
 if(!lut32){lut32=new Uint32Array(256);for(let i=0;i<256;i++){const [r,g,b]=lut[i];lut32[i]=(255<<24|b<<16|g<<8|r)>>>0;}}
 const img=wc.createImageData(W,n),px=new Uint32Array(img.data.buffer),lo=m.lo,hi=m.hi;
 for(let r=0;r<n;r++){const row=rows[r],base=r*W;for(let x=0;x<W;x++){let v=hi[x]>lo[x]?row[lo[x]]:-Infinity;for(let j=lo[x]+1;j<hi[x];j++)if(row[j]>v)v=row[j];let q=(v-floor)*scale;q=q<0?0:q>255?255:q|0;px[base+x]=lut32[q];}}
 wc.putImageData(img,0,y0);}
function pushWater(rowsNewestFirst){waterHist=rowsNewestFirst.concat(waterHist);if(waterHist.length>water.height)waterHist.length=water.height;}
function redrawWater(){wc.fillStyle='#11191e';wc.fillRect(0,0,water.width,water.height);paintRows(waterHist.slice(0,water.height),0);}
for(const el of [spec,water,$('axisCanvas')]){
 el.addEventListener('wheel',e=>{clearTimeout(tuneClick);e.preventDefault();const f=viewFrac(e.clientX,el),k=e.deltaY<0?0.8:1.25,a=f-(f-view.a)*k;setView(a,a+(view.b-view.a)*k);},{passive:false});
 el.addEventListener('mousedown',e=>{clearTimeout(tuneClick);if(e.button===0)drag={x:e.clientX,a:view.a,b:view.b,el,moved:false};});
 el.addEventListener('dblclick',e=>{clearTimeout(tuneClick);e.preventDefault();setView(0,1);});
 el.title='Wheel: zoom · drag: pan (past the edge = retune) · double-click: full span · click: tune';
}
window.addEventListener('mousemove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(!drag.moved&&Math.abs(dx)<4)return;drag.moved=true;
 const r=drag.el.getBoundingClientRect(),d=dx/r.width*(drag.b-drag.a);setView(drag.a-d,drag.b-d,connected);});
window.addEventListener('mouseup',()=>{if(drag&&drag.moved)suppressClick=true;const was=drag&&drag.moved;drag=null;if(was&&(view.a<-1e-9||view.b>1+1e-9))retuneToView();});
// ---- frequency axis: nice 1-2-5 ticks, shared with the spectrum grid -------
function axisTicks(c,W){const span=(view.b-view.a)*c.rate,f0=c.frequency*1e6+(view.a-.5)*c.rate,f1=f0+span;
 const raw=span/Math.max(2,W/110),p=10**Math.floor(Math.log10(raw)),m=raw/p,step=(m<1.5?1:m<3.5?2:m<7.5?5:10)*p,minor=step/(step/p===2?4:5);
 const x=f=>(f-f0)/span*W,major=[],minors=[];for(let f=Math.ceil(f0/minor)*minor;f<=f1;f+=minor){const r=Math.round(f/minor)*minor;if(Math.abs(r/step-Math.round(r/step))<1e-6)major.push(r);else minors.push(r);}
 return {step,major,minors,x};}
function drawAxis(c){const el=$('axisCanvas');if(!el)return;const d=Math.min(devicePixelRatio||1,2),W=Math.round(el.clientWidth*d),H=Math.round(el.clientHeight*d);
 if(el.width!==W||el.height!==H){el.width=W;el.height=H;}const g=el.getContext('2d');g.fillStyle='#182126';g.fillRect(0,0,W,H);if(!c||!c.rate)return;
 const t=axisTicks(c,W),dec=Math.max(0,Math.ceil(-Math.log10(t.step/1e6)-1e-9));g.strokeStyle='#5b686e';g.lineWidth=d;g.beginPath();
 for(const f of t.minors){const x=Math.round(t.x(f))+.5;g.moveTo(x,0);g.lineTo(x,4*d);}g.stroke();g.strokeStyle='#a1adb2';g.beginPath();
 for(const f of t.major){const x=Math.round(t.x(f))+.5;g.moveTo(x,0);g.lineTo(x,9*d);}g.stroke();
 g.font=`${13*d}px Carlito,sans-serif`;g.fillStyle='#c0c9cd';g.textBaseline='bottom';
 for(const f of t.major){const s=(f/1e6).toFixed(dec),tw=g.measureText(s).width;g.fillText(s,Math.max(2*d,Math.min(W-tw-2*d,t.x(f)-tw/2)),H-3*d);}
 const mark=(fMHz,col)=>{const x=t.x(fMHz*1e6);if(x<0||x>W)return;g.fillStyle=col;g.beginPath();g.moveTo(x-5*d,0);g.lineTo(x+5*d,0);g.lineTo(x,7*d);g.closePath();g.fill();};
 mark(c.frequency,'#e0a040');if(tuneFrequency!==c.frequency)mark(tuneFrequency,'#37c964');}
// ---- 0 Hz handling / offset LO ---------------------------------------------
try{const v=localStorage.getItem('espSdrDcMode');if(v&&$('dcMode').querySelector(`option[value="${v}"]`))$('dcMode').value=v;}catch(e){}
function loOffset(rate){return $('dcMode').value==='offset'?(rate>=40000000?5:2):0;}
function loFrequency(){const o=loOffset(Number($('rate').value));if(!o)return tuneFrequency;
 for(const f of [tuneFrequency-o,tuneFrequency+o])if(radio.validFrequency(f))return f;return tuneFrequency;}
$('dcMode').onchange=()=>{try{localStorage.setItem('espSdrDcMode',$('dcMode').value);}catch(e){}labels();draw();};

async function api(path,body){let value;
 if(path==='connect')value=await radio.connect({port:body.port});
 else if(path==='disconnect'){value=await radio.run(()=>radio.close());}
 else if(path==='frame')value=await radio.capture(body);
 else throw Error('Unknown operation');
 return {json:async()=>value};
}
function error(e,communication=false){
 const box=$('error'),text=$('errorText');text.textContent=e?.message||e;box.hidden=!e;
 if(e&&communication){const link=document.createElement('a');link.href='flash.html';link.textContent='Install / update ESP-SDR firmware';link.onclick=openFirmwareInstaller;text.append(' ',link);}
}
$('dismissError').onclick=()=>error('');
function config(){return {frequency:loFrequency(),rate:Number($('rate').value),bits:Number($('bits').value),fft:Number($('fft').value),bandwidth:analogBandwidth,gainMode:gainMode,gain:Number($('gain').value),trigger:{mode:'free'}};}
function clear(){trace=null;maximum=null;waterHist=[];if(!keepView)view={a:0,b:1};keepView=false;wc.fillStyle='#11191e';wc.fillRect(0,0,water.width,water.height);draw();}
function resize(){const d=Math.min(devicePixelRatio||1,2);spec.width=Math.round(spec.clientWidth*d);spec.height=Math.round(spec.clientHeight*d);water.width=Math.round(water.clientWidth);water.height=Math.round(water.clientHeight);wc.fillStyle='#11191e';wc.fillRect(0,0,water.width,water.height);redrawWater();draw();labels();}
function fmtHz(hz){const a=Math.abs(hz);return a>=1e9?(hz/1e9).toFixed(6)+' GHz':a>=1e6?(hz/1e6).toFixed(3)+' MHz':a>=1e3?(hz/1e3).toFixed(1)+' kHz':hz.toFixed(0)+' Hz';}
function measBar(c){
 const spec=connected&&spectrumMode,n=spec?specConfig().fft:c.fft,center=c.frequency*1e6,span=c.rate;
 // Hann window: 3 dB bandwidth 1.44 bins
 const rbw=1.44*c.rate/n,top=Number($('floor').value)+Number($('range').value),div=Number($('range').value)/4;
 const det=spec?($('specDetector').value==='max'?'max-hold':'average'):'average';
 const acq=spec?(specLast?`${(specLast.pairs/c.rate*1e3).toFixed(2)} ms · ${specLast.ffts} FFT · ${radio.spectrumContinuous(Number($('rate').value),Number($('fft').value))?'continuous capture':'snapshot'}`:'—')
  :(latest?.samples?`${(latest.samples/c.rate*1e3).toFixed(3)} ms burst`:'—');
 const item=(k,v)=>`<span>${k} <b style="color:#e8eef0;font-weight:600">${v}</b></span>`;
 $('meas').innerHTML=[item('Start',fmtHz(center-span/2)),item('Center',fmtHz(center)),item('Span',fmtHz(span)),item('Stop',fmtHz(center+span/2)),
  item('RBW',fmtHz(rbw)),item('Bins',`${n}`),item('Ref',`${top} dBFS`),item('Div',`${div} dB`),item('Det',det),item('Acq',acq),item('Mode',spec?'SPEC on-chip':'burst IQ')].join('');
}
function labels(f){tuningWarning();const c=f||config();drawAxis(c);measBar(c);}
function draw(){const w=spec.width,h=spec.height,d=Math.min(devicePixelRatio||1,2),floor=Number($('floor').value),range=Number($('range').value);sc.fillStyle='#182126';sc.fillRect(0,0,w,h);sc.lineWidth=d;sc.font=`${14*d}px Carlito,sans-serif`;
for(let i=0;i<=4;i++){const y=i*h/4;sc.strokeStyle='#344047';sc.beginPath();sc.moveTo(0,y);sc.lineTo(w,y);sc.stroke();sc.fillStyle='#a1adb2';sc.fillText(`${Math.round(floor+range-i*range/4)}`,8*d,Math.max(16*d,y-5*d));}
{const c=latest?{frequency:latest.frequency,rate:latest.rate}:config(),t=axisTicks(c,w);sc.strokeStyle='#202a2f';sc.beginPath();for(const f of t.minors){const x=Math.round(t.x(f))+.5;sc.moveTo(x,0);sc.lineTo(x,h);}sc.stroke();sc.strokeStyle='#33424a';sc.beginPath();for(const f of t.major){const x=Math.round(t.x(f))+.5;sc.moveTo(x,0);sc.lineTo(x,h);}sc.stroke();if(tuneFrequency!==c.frequency){const x=t.x(tuneFrequency*1e6);sc.save();sc.setLineDash([4*d,4*d]);sc.strokeStyle='#37c96490';sc.beginPath();sc.moveTo(x,0);sc.lineTo(x,h);sc.stroke();sc.restore();}drawAxis(c);}
function line(values,color,fill){if(!values)return;sc.beginPath();const L=values.length-1,sp=view.b-view.a,i0=Math.max(0,Math.floor(view.a*L)-1),i1=Math.min(L,Math.ceil(view.b*L)+1);for(let i=i0;i<=i1;i++){const v=values[i],x=(i/L-view.a)/sp*w,y=Math.max(0,Math.min(h,(1-(v-floor)/range)*h));if(i>i0)sc.lineTo(x,y);else sc.moveTo(x,y);}sc.strokeStyle=color;sc.lineWidth=1.2*d;sc.stroke();if(fill){sc.lineTo(w,h);sc.lineTo(0,h);sc.closePath();const g=sc.createLinearGradient(0,0,0,h);g.addColorStop(0,'#37c96445');g.addColorStop(1,'#37c96403');sc.fillStyle=g;sc.fill();}}
if($('hold').checked)line(maximum,'#e6b969',false);line(trace,'#37c964',true);}
function render(f){const k=[f.frequency,f.rate,f.bits,f.fft,f.bandwidth,f.gainMode,f.gainMode==='MANUAL'?f.gain:'HARDWARE'].join('/');if(key!==k){key=k;clear();}latest=f;const a=Number($('average').value);trace=f.spectrum.map((v,i)=>trace?10*Math.log10(a*10**(trace[i]/10)+(1-a)*10**(v/10)):v);maximum=f.spectrum.map((v,i)=>maximum?Math.max(maximum[i],v):v);draw();
wc.drawImage(water,0,0,water.width,water.height-1,0,1,water.width,water.height-1);pushWater([Float32Array.from(f.spectrum)]);paintRows([waterHist[0]],0);autoScale(trace);
$('gainStatus').textContent=f.gain_actual?.mode==='HARDWARE'?'Hardware AGC':f.gain_actual?`Manual · index ${f.gain_actual.index}`:'Update SDR firmware for gain control.';$('empty').hidden=true;labels(f);$('fpsLabel').textContent='frames/s';$('throughputLabel').textContent='kS/s delivered';$('latencyLabel').textContent='ms / capture + transfer';const now=performance.now();$('fps').textContent=previous?(1000/(now-previous)).toFixed(1):'—';previous=now;$('throughput').textContent=f.delivered_ksps.toFixed(1);$('latency').textContent=f.elapsed_ms.toFixed(1);$('peak').textContent=(f.peak_hz/1e6).toFixed(4);$('crc').textContent=`CRC OK · #${f.sequence}${f.dropped_captures?` · ${f.dropped_captures} dropped · ${f.samples} samples`:''}`;}
async function loop(){
 if(running)return loopDone;
 running=true;
 let finishLoop;loopDone=new Promise(resolve=>{finishLoop=resolve;});
 try{
  while(connected&&!paused){
   try{
    if(spectrumMode&&radio.hasSpec)await specLoop();
    else{
    const f=await(await api('frame',config())).json();
    if(connected&&!paused&&!radio.changingBaud&&selectRxFrame(f))render(f);
    }
    if(!radio.changingBaud)error('');
   }catch(e){
    if(radio.changingBaud)break;
    paused=true;
    const disconnected=!!radio.failed;
    if(disconnected){connected=false;await radio.run(()=>radio.close()).catch(()=>{});}
    state();
    error(disconnected?e:`${e?.message||e} Change the settings and select Resume.`,disconnected);
    break;
   }
   if(connected&&!paused)await new Promise(r=>setTimeout(r,10));
  }
 }finally{running=false;finishLoop();}
}
let serialWarningDismissedAt=0;
function serialWarning(){
 const warning=$('serialWarning'),button=$('lowerBaud');
 const errors=radio.droppedCaptures+radio.spectrumCrcErrors;
 // Counters reset on a new device identity; dismissal never clears diagnostics.
 if(!connected||errors<serialWarningDismissedAt)serialWarningDismissedAt=0;
 warning.hidden=!connected||errors-serialWarningDismissedAt<3;
 const available=radio.supportsBaudChange&&radio.transport==='UART'&&radio.baudRate>1000000;
 button.hidden=!available;button.disabled=(!!radio.changingBaud||!!radio.changingGpio);
 button.textContent=radio.changingBaud?'Switching…':'Switch to 1 MBaud';
 $('serialWarningText').textContent=available
  ?'Repeated capture / CRC errors. A slower serial connection may help; the RF sample rate stays the same.'
  :radio.transport==='UART'&&radio.baudRate===1000000
   ?'Capture / CRC errors continue at 1 MBaud. Check the USB connection or try a smaller FFT.'
   :radio.transport==='USB'?'Repeated capture / CRC errors. Check the USB connection or try a smaller FFT.'
   :'Repeated capture / CRC errors. Check the USB connection. Updated firmware enables a slower UART connection.';
}
$('dismissSerialWarning').onclick=()=>{
 serialWarningDismissedAt=radio.droppedCaptures+radio.spectrumCrcErrors;
 serialWarning();
};
function state(){
 firmwareWarning();
 updateGpioControls();
 if(!connected||!spectrumMode)$('chipStats').hidden=true;
 serialWarning();
 $('baudStatus').hidden=!connected||radio.transport!=='UART';
 $('baudStatus').textContent=radio.transport==='UART'?`${radio.baudRate/1000000} MBaud`:'';
 $('connect').disabled=connectionBusy||(!!radio.changingBaud||!!radio.changingGpio);
 $('openOther').disabled=connected||$('connect').disabled||!navigator.serial;
 $('openUSB').disabled=connected||$('connect').disabled||!navigator.usb;
 $('openRecent').disabled=connected||$('connect').disabled||!savedPort();
 tuningWarning();
 for(const control of document.querySelectorAll('aside input,aside select'))control.disabled=!connected||(!!radio.changingBaud||!!radio.changingGpio);
 const specOk=connected&&radio.canStreamSpectrum;
 $('specControls').hidden=!specOk;$('specMode').disabled=!specOk||(!!radio.changingBaud||!!radio.changingGpio);
 $('iqMode').disabled=!connected||(!!radio.changingBaud||!!radio.changingGpio);
 if(!specOk)spectrumMode=false;
 $('iqMode').setAttribute('aria-pressed',String(!spectrumMode));$('specMode').setAttribute('aria-pressed',String(spectrumMode));
 $('iqControls').hidden=spectrumMode;$('specOptions').hidden=!spectrumMode;
 const options=$(spectrumMode?'specOptions':'iqControls');
 if($('fftControl').parentElement!==options)options.prepend($('fftControl'));
 $('specRow').disabled=!specOk||!spectrumMode||(!!radio.changingBaud||!!radio.changingGpio);$('specDetector').disabled=$('specRow').disabled;
 if(connected&&spectrumMode)$('bits').disabled=true;
 {const specOn=connected&&spectrumMode;
  for(const o of $('rate').options){o.disabled=specOn&&!radio.spectrumProfiles(Number(o.value)).length;o.hidden=o.disabled;}
  if(specOn&&!radio.spectrumProfiles(Number($('rate').value)).length)$('rate').value=String(radio.specCapabilities.profiles[0][0]);
  const sizes=specOn?specSizes(Number($('rate').value)):[512,1024,2048,4096];
  for(const o of $('fft').options){o.disabled=!sizes.includes(Number(o.value));o.hidden=o.disabled;}
  $('specNote').hidden=!specOn;
  $('specNote').textContent=radio.spectrumContinuous(Number($('rate').value),Number($('fft').value))
   ?'Continuous RF capture; only selected FFT windows are analyzed. Skipped work and dropped frames are reported.'
   :'On-chip FFT of repeated snapshots. Reception has gaps between snapshots.';
  if(!sizes.includes(Number($('fft').value)))$('fft').value=String(specOn?sizes[sizes.length-1]:2048);}
 $('deviceModel').textContent=connected?(radio.deviceName||'ESP32-'+radio.family):'';$('deviceModel').hidden=!connected;$('chipIdentity').hidden=!connected;
 $('status').textContent=connected?(paused?'Paused':'Receiving'):'Disconnected';
 $('connect').textContent=connected?'Disconnect':'Connect ESP-SDR';$('light').classList.toggle('on',connected&&!paused);
 $('pause').disabled=!connected||(!!radio.changingBaud||!!radio.changingGpio);$('pause').textContent=paused?'Resume':'Pause';
 
 for(const b of document.querySelectorAll('[data-freq]'))b.disabled=!connected||(!!radio.changingBaud||!!radio.changingGpio)||(+b.dataset.freq===5500&&radio.family!=='C5')||!radio.validFrequency(+b.dataset.freq);
 const gainDisabled=!connected||(!!radio.changingBaud||!!radio.changingGpio)||!radio.hasGain;
 $('gainAgc').disabled=gainDisabled||!radio.hasHardwareAgc;$('gainManual').disabled=gainDisabled;
 $('gainAgc').setAttribute('aria-pressed',String(gainMode==='HARDWARE'));$('gainManual').setAttribute('aria-pressed',String(gainMode==='MANUAL'));
 $('gain').disabled=!connected||(!!radio.changingBaud||!!radio.changingGpio)||gainMode!=='MANUAL'||!radio.hasGain;
 const bandwidthDisabled=!connected||(!!radio.changingBaud||!!radio.changingGpio)||!radio.bandwidthRange;
 $('bandwidthOpen').disabled=bandwidthDisabled;$('bandwidthFilter').disabled=bandwidthDisabled;
 $('bandwidthOpen').setAttribute('aria-pressed',String(analogBandwidth===0));$('bandwidthFilter').setAttribute('aria-pressed',String(analogBandwidth!==0));
 $('bandwidth').disabled=bandwidthDisabled||analogBandwidth===0;
}
let dismissedTuningFrequency=null;
function tuningWarning(){
 const warning=connected?radio.frequencyWarning(tuneFrequency):'';
 if(!warning)dismissedTuningFrequency=null;
 $('tuningWarningText').textContent=warning;
 $('tuningWarning').hidden=!warning||dismissedTuningFrequency===tuneFrequency;
 $('frequency').classList.toggle('offband',!!warning);$('frequency').title=warning;
}
$('dismissTuningWarning').onclick=()=>{dismissedTuningFrequency=tuneFrequency;tuningWarning();};
let dismissedFirmwareVersion=null;
function firmwareWarning(){
 const version=radio.firmwareVersion,panel=$('firmwareWarning');
 if(!connected)dismissedFirmwareVersion=null;
 panel.hidden=!connected||!version||version===dismissedFirmwareVersion;
 $('deviceModel').title=connected&&version?.status==='known'?`Firmware: ${version.revision}\nBuilt: ${version.build_timestamp}`:'';
 if(panel.hidden)return;
 const result=version.status==='missing'
  ?{status:'outdated',message:'This firmware does not report its version. Update the firmware to the latest build.'}
  :firmwareUpdate;
 panel.hidden=result?.status!=='outdated';
 $('firmwareWarningText').textContent=result?.message||'';
}
$('dismissFirmwareWarning').onclick=()=>{dismissedFirmwareVersion=radio.firmwareVersion;firmwareWarning();};
async function checkFirmwareUpdate(){
 const check=++firmwareCheck,installed=radio.firmwareVersion;
 firmwareUpdate=null;firmwareWarning();
 if(!installed||installed.status==='missing')return;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 let result;
 try{
  const response=await fetch('firmware/manifest.json',{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('Firmware catalog unavailable');
  result=firmwareUpdateStatus(installed,await response.json());
 }catch{result={status:'unknown',message:'Firmware update check unavailable.'};}
 finally{clearTimeout(timeout);}
 // An old connection's request must never update a newly connected device.
 if(check!==firmwareCheck||!connected||radio.firmwareVersion!==installed)return;
 firmwareUpdate=result;firmwareWarning();
}
function updateGpioControls(){
 const panel=$('gpioControls');panel.hidden=!connected||!radio.hasGpio;
 if(panel.hidden)return;
 const list=$('gpioPins'),pins=radio.gpioPins;
 const signature=pins.map(p=>p.pin).join(',');
 if(list.dataset.pins!==signature){
  list.replaceChildren();list.dataset.pins=signature;
  for(const {pin} of pins){
   const row=document.createElement('div');row.className='gpio-row';
   const label=document.createElement('span');label.id=`gpioLabel${pin}`;label.textContent=`GPIO ${pin}`;
   const buttons=document.createElement('div');buttons.className='gain-modes gpio-modes';
   buttons.setAttribute('role','group');buttons.setAttribute('aria-labelledby',label.id);
   for(const value of ['Z','0','1']){
    const button=document.createElement('button');button.type='button';button.textContent=value;
    button.dataset.pin=String(pin);button.dataset.state=value;
    button.title=value==='Z'?'High impedance (no pulls)':value==='0'?'Drive low':'Drive high';
    button.onclick=()=>changeGpio(pin,value);buttons.append(button);
   }
   row.append(label,buttons);list.append(row);
  }
 }
 for(const button of list.querySelectorAll('button')){
  const entry=pins.find(p=>p.pin===Number(button.dataset.pin));
  button.setAttribute('aria-pressed',String(entry.state===button.dataset.state));
  button.disabled=connectionBusy||!!radio.changingBaud||!!radio.changingGpio;
 }
 $('gpioEmpty').hidden=pins.length!==0;
}
async function changeGpio(pin,value){
 if(!connected||connectionBusy||radio.changingBaud||radio.changingGpio)return;
 const wasPaused=paused;let succeeded=false;paused=true;radio.changingGpio=true;state();
 try{
  // Let the current burst finish, or stop/drain a spectrum stream, before
  // issuing a text command. Keep the acknowledged selection until success.
  await loopDone;
  if(!connected||radio.failed)throw radio.failed||Error('Disconnected');
  await radio.setGpio(pin,value);
  clear();error('');succeeded=true;
 }catch(e){
  if(radio.failed){connected=false;await radio.run(()=>radio.close()).catch(()=>{});}
  error(e);
 }
 finally{
  radio.changingGpio=false;paused=succeeded?wasPaused:true;previous=0;state();
  if(connected&&!paused)loop();
 }
}
function bandwidthChanged(){if($('bandwidth').disabled)return;if(!$('bandwidth').checkValidity()){$('bandwidth').reportValidity();return;}analogBandwidth=Number($('bandwidth').value);state();clear();}
$('bandwidthOpen').onclick=()=>{if($('bandwidthOpen').disabled||analogBandwidth===0)return;$('bandwidth').value=analogBandwidth;analogBandwidth=0;state();clear();};
$('bandwidthFilter').onclick=()=>{if($('bandwidthFilter').disabled||analogBandwidth!==0)return;$('bandwidth').disabled=false;bandwidthChanged();};
$('bandwidth').onchange=bandwidthChanged;
$('bandwidth').closest('label').addEventListener('wheel',e=>{
 const input=$('bandwidth');if(input.disabled||!e.deltaY||e.ctrlKey)return;
 e.preventDefault();const previous=input.value;
 if(e.deltaY<0)input.stepUp();else input.stepDown();
 if(input.value!==previous)bandwidthChanged();
},{passive:false});
$('gainAgc').onclick=()=>{if($('gainAgc').disabled)return;gainMode='HARDWARE';state();clear();};
$('gainManual').onclick=()=>{if($('gainManual').disabled)return;gainMode='MANUAL';state();clear();};
$('gain').oninput=()=>{$('gainValue').textContent=`${$('gain').value} / ${radio.gainMax}`;clear();};
radio.onCaptureError=serialWarning;
$('lowerBaud').onclick=async()=>{
 if(!connected||radio.changingBaud||radio.changingGpio)return;
 paused=true;radio.changingBaud=true;state();
 try{
  await radio.setBaudRate(1000000);
  checkFirmwareUpdate();
  paused=false;previous=0;latest=null;clear();error('');
 }catch(e){connected=!!radio.port&&!radio.failed;error(e,!connected);}
 finally{radio.changingBaud=false;state();if(connected&&!paused)loop();}
};
// Reuse a previously granted port only when its USB identity is unambiguous.
// The picker includes UART bridges as well as native USB boards.
const PORT_KEY='espSdrPort';
function savedPort(){try{return JSON.parse(localStorage.getItem(PORT_KEY)||'null');}catch(e){return null;}}
function rememberPort(p){try{const i=p.getInfo?.()||{};if(i.usbVendorId)localStorage.setItem(PORT_KEY,JSON.stringify({vid:i.usbVendorId,pid:i.usbProductId,kind:SerialConnection.kind(p)}));}catch(e){}}
async function choosePort(ev){
 if(!SerialConnection.supported())throw Error('WebSerial or WebUSB support is required in this browser.');
 if(!ev?.choosePort){const saved=savedPort(),ports=await SerialConnection.getPorts(saved?.kind);
  const matches=saved?ports.filter(p=>{const i=p.getInfo?.()||{};return i.usbVendorId===saved.vid&&i.usbProductId===saved.pid;}):[];
  if(matches.length===1)return matches[0];if(ev?.auto)return null;}
 return SerialConnection.requestPort(ev?.kind);
}
$('connect').title='Connect to the remembered port';
function closeConnectMenu(focus=false){$('connectMenu').hidden=true;$('choosePort').setAttribute('aria-expanded','false');if(focus)$('choosePort').focus();}
function openConnectMenu(){state();$('connectMenu').hidden=false;$('choosePort').setAttribute('aria-expanded','true');$('connectMenu').querySelector('button:not(:disabled),a').focus();}
$('choosePort').onclick=()=>{$('connectMenu').hidden?openConnectMenu():closeConnectMenu(true);};
$('choosePort').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();openConnectMenu();}};
$('openRecent').onclick=()=>{closeConnectMenu(true);return $('connect').onclick();};
$('openOther').onclick=()=>{closeConnectMenu(true);return $('connect').onclick({choosePort:true,kind:'webserial'});};
$('openUSB').onclick=()=>{closeConnectMenu(true);return $('connect').onclick({choosePort:true,kind:'webusb'});};
$('openFlasher').onclick=openFirmwareInstaller;
$('updateFirmware').onclick=openFirmwareInstaller;
$('connectMenu').onkeydown=e=>{
 if(e.key==='Escape'){e.preventDefault();closeConnectMenu(true);}
 else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
  e.preventDefault();const items=Array.from($('connectMenu').querySelectorAll('button:not(:disabled),a')),at=items.indexOf(document.activeElement);
  items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
 }
};
document.addEventListener('click',e=>{if(!e.target.closest('.connect-buttons'))closeConnectMenu();});
document.addEventListener('focusin',e=>{if(!e.target.closest('.connect-buttons'))closeConnectMenu();});
async function disconnectRadio(){
 connected=false;state();
 const done=api('disconnect',{});let timer;
 try{
  const timedOut=await Promise.race([done.then(()=>false),new Promise(resolve=>{timer=setTimeout(()=>resolve(true),2000);})]);
  if(timedOut){await radio.closePort();await done.catch(()=>{});}
 }finally{clearTimeout(timer);}
}
async function openFirmwareInstaller(event){
 event.preventDefault();closeConnectMenu(true);
 if(connectionBusy||radio.changingBaud||radio.changingGpio){error('Wait for the current device operation to finish, then open the firmware installer again.');return;}
 const url=event.currentTarget.href;
 connectionBusy=true;firmwareHandoff=true;
 let installer;
 try{
  // Open a blank tab during the click, then load the installer only after USB is free.
  installer=window.open('about:blank','_blank');
  if(installer)installer.opener=null;
  if(connected||radio.port)await disconnectRadio();
  if(installer&&!installer.closed)installer.location.replace(url);
  else window.location.assign(url);
 }catch(e){installer?.close();firmwareHandoff=false;error(e);}
 finally{connectionBusy=false;state();}
}
$('connect').onclick=async(ev)=>{closeConnectMenu();if(connectionBusy||radio.changingBaud||radio.changingGpio||(ev?.auto&&(connected||firmwareHandoff)))return;if(!ev?.auto)firmwareHandoff=false;connectionBusy=true;state();try{if(connected){await disconnectRadio();}else{const port=await choosePort(ev);if(!port)return;await api('connect',{port});rememberPort(port);connected=true;checkFirmwareUpdate();spectrumMode=radio.canStreamSpectrum;applyRadioProfile();paused=false;previous=0;latest=null;clear();loop();}error('');}catch(e){error(e,!['NotFoundError','AbortError'].includes(e?.name));}finally{connectionBusy=false;state();}};
$('pause').onclick=()=>{paused=!paused;previous=0;state();if(!paused){error('');loop();}};$('clear').onclick=clear;
for(const id of ['rate','bits','fft'])$(id).onchange=()=>{state();labels();};
$('frequency').onchange=()=>{tuneFrequency=Number($('frequency').value);labels();};
$('frequency').onkeydown=e=>{if(e.key==='Enter')$('frequency').blur();};
$('frequency').closest('label').addEventListener('wheel',e=>{
 const input=$('frequency');if(input.disabled||!e.deltaY||e.ctrlKey)return;
 e.preventDefault();
 const value=Number(input.value),current=input.value!==''&&Number.isFinite(value)?value:tuneFrequency;
 tuneFrequency=radio.nearestFrequency(Math.round(current)-Math.sign(e.deltaY));
 input.value=tuneFrequency;labels();
},{passive:false});
for(const b of document.querySelectorAll('[data-freq]'))b.onclick=()=>{$('frequency').value=b.dataset.freq;tuneFrequency=Number(b.dataset.freq);labels();};
for(const id of ['floor','range'])$(id).oninput=()=>{$('floorValue').textContent=$('floor').value+' dBFS';$('rangeValue').textContent=$('range').value+' dB';$('scale').textContent=`${$('floor').value} ? ${Number($('floor').value)+Number($('range').value)} dBFS`;redrawWater();draw();};
$('hold').onchange=()=>{maximum=null;draw();};
spec.onmousemove=e=>{if(!latest)return;const x=viewFrac(e.clientX,spec),i=Math.max(0,Math.min(latest.fft-1,Math.floor(x*latest.fft)));$('cursor').textContent=`${((latest.frequency*1e6+(x-.5)*latest.rate)/1e6).toFixed(5)} MHz · ${latest.spectrum[i].toFixed(1)} dBFS`;};
function queueTune(e,el){if(suppressClick){suppressClick=false;return;}if(e.detail>1)return;clearTimeout(tuneClick);const x=e.clientX;tuneClick=setTimeout(()=>{if(connected&&latest){tuneFrequency=radio.nearestFrequency(latest.frequency+(viewFrac(x,el)-.5)*latest.rate/1e6);$('frequency').value=tuneFrequency;labels();}},250);}
spec.onclick=e=>queueTune(e,spec);
water.onclick=e=>queueTune(e,water);$('axisCanvas').onclick=e=>queueTune(e,$('axisCanvas'));
new ResizeObserver(resize).observe(spec);labels();state();

// Keep a frame-selection boundary for future signal-based triggering.
function selectRxFrame(f){
 return f.frequency===loFrequency()&&f.rate===Number($('rate').value)&&
  (!f.trigger||f.trigger.mode==='free');
}

// Firmware-computed spectrum stream.
let specPending=[],specLast=null,specRAF=0,specCount=[],specInfo=null,autoT=0,waterMap=null,lut32=null;
// Firmware bins are |FFT(I+jQ)|^2 in FFT order; this app displays conj(I+jQ)
// (see capture(): q is negated), so web bin j holds firmware bin (n/2-j) mod n.
// code/step = 10log10|X|^2 with X = FFT(IQ10*64*hann)/n; 84.3 dB maps that to
// the dBFS scale of spectrum() (full scale 512, Hann power normalization), for any n.
// Code 0 includes below-floor powers; display it at the nominal encoding floor.
function specToDbfs(bins,step,n){const out=new Float32Array(n);for(let j=0;j<n;j++){const v=bins[(n/2-j+n)%n];out[j]=v/step-84.3;}
 // zero-IF DC offset / LO leakage (35-45 dB over the floor, VSG60 test): bridge DC +-1 bin
 if($('dcMode').value==='fill'){const c=n/2,m=10*Math.log10((10**(out[c-2]/10)+10**(out[c+2]/10))/2);out[c-1]=out[c]=out[c+1]=m;}return out;}
function specSizes(rate){return radio.spectrumProfiles(rate).map(p=>p[2]);}
function specDisplayKey(c){return ['spec',c.rate,c.fft,c.frequency,c.bandwidth,c.gainMode,c.gain,c.maxHold,$('dcMode').value,$('specRow').value].join('/');}
function specConfig(){
 const c=config(),profiles=radio.spectrumProfiles(c.rate);
 const profile=profiles.find(p=>p[2]===c.fft)||profiles[0];
 if(!profile)return {...c,stride:1,upf:1};
 const [rate,,fft,stride,upf0]=profile;
 // S3/S31 continuous: one bank unit is 12288 pairs (0.77 ms at 16 MS/s). ~2 frames per
 // waterfall row are enough; the chip merges the rest (far less dB coding/CRC/USB work).
 const unitMs=12288e3/rate,rowMs=Number($('specRow').value)||0;
 const upf=['S3','S31'].includes(radio.family)&&radio.spectrumContinuous(rate,fft)?Math.min(1000,Math.max(upf0,Math.floor(rowMs/unitMs/2))):upf0;
 return {...c,rate,fft,bits:10,stride,upf,maxHold:$('specDetector').value==='max'};
}
async function specLoop(){
 specPending=[];specLast=null;specCount=[];specCov=null;
 const c=specConfig(),n=c.fft,rowMs=Number($('specRow').value),agg=new SpectrumAccumulator(n,c.maxHold),dcMode=$('dcMode').value;let aggT=0;
 const displayKey=specDisplayKey(c),queueRow=()=>{const row=agg.finish();if(row){row.key=displayKey;specPending.push(row);}};
 const changed=()=>{const m=specConfig();return $('dcMode').value!==dcMode||m.frequency!==c.frequency||m.gainMode!==c.gainMode||m.gain!==c.gain||m.bandwidth!==c.bandwidth||m.maxHold!==c.maxHold||m.rate!==c.rate||m.fft!==c.fft||Number($('specRow').value)!==rowMs;};
 if(!specRAF)specRAF=requestAnimationFrame(specFrame);
 specInfo=await radio.spec(c,(h,bins,info)=>{
  if(changed())return;
  specInfo=info;if(info.stats)specCov=info.stats.coverage/100;else if(h.pairs&&radio.spectrumContinuous(c.rate,n))specCov=h.ffts*n/h.pairs;else specCov=null;const s=specToDbfs(bins,h.step,n);
  if(!agg.weight)aggT=h.t;
  agg.add(s,h.ffts);
  specLast=h;specCount.push(performance.now());
  // A frame's timestamp is its start, not its end. Include its sample span.
  if(agg.weight&&h.t+h.pairs/c.rate-aggT>=rowMs/1000)queueRow();
  // hidden tab: no animation frames, so bound the backlog here
  if(specPending.length>1024)specPending.splice(0,specPending.length-512);
  if(specCount.length>4096){const t=performance.now()-1000;let i=0;while(i<specCount.length&&specCount[i]<t)i++;specCount.splice(0,i);}
 },()=>!connected||paused||!spectrumMode||changed());
 if(!changed()&&spectrumMode){queueRow();if(specPending.length&&!specRAF)specRAF=requestAnimationFrame(specFrame);}
}
function specFrame(){specRAF=0;if(specPending.length){const rows=specPending;specPending=[];renderSpec(rows);}if(connected&&!paused&&spectrumMode)specRAF=requestAnimationFrame(specFrame);}
function renderSpec(rows){
 const c=specConfig(),k=specDisplayKey(c);
 rows=rows.filter(row=>row.key===k);
 if(!spectrumMode||!rows.length)return;
 const nb=rows[0].bins.length;
 if(key!==k){key=k;clear();}
 const batch=new SpectrumAccumulator(nb,c.maxHold);
 for(const r of rows)batch.add(r.bins,r.weight);
 const cur=batch.finish().bins;
 const a=Number($('average').value);
 if(trace&&trace.length!==nb){trace=null;maximum=null;}
 trace=Array.from(cur,(v,i)=>trace?10*Math.log10(a*10**(trace[i]/10)+(1-a)*10**(v/10)):v);
 // Preserve brief peaks even when several spectra/rows arrive in one paint.
 if(!maximum)maximum=Array(nb).fill(-Infinity);
 for(const r of rows)for(let i=0;i<nb;i++)maximum[i]=Math.max(maximum[i],r.peak[i]);
 latest={frequency:c.frequency,rate:c.rate,fft:nb,spectrum:trace};draw();
 const n=Math.min(rows.length,water.height),floor=Number($('floor').value),range=Number($('range').value),W=water.width;
 wc.drawImage(water,0,0,W,water.height-n,0,n,W,water.height-n);
 // one pixel column = max of the bins it covers in the current view
 const newest=[];for(let r=0;r<n;r++)newest.push(rows[rows.length-1-r].bins);pushWater(newest);paintRows(newest,0);
 autoScale(trace);
 let peak=0;for(let j=1;j<nb;j++)if(cur[j]>cur[peak])peak=j;
 const now=performance.now();while(specCount.length&&specCount[0]<now-1000)specCount.shift();
 $('empty').hidden=true;labels(c);
 $('fps').textContent=`${specCount.length}`;$('fpsLabel').textContent='spectra/s';
 {const st=specInfo&&specInfo.stats,el=$('chipStats');el.hidden=!st||performance.now()-st.t>3000;if(!el.hidden)el.textContent=`Core 0: ${st.core0.toFixed(0)} % · Core 1: ${st.dual?st.core1.toFixed(0)+' %':'off'}\nFFT coverage: ${st.coverage.toFixed(1)} % (${(st.fftsPerS/1e3).toFixed(1)} k/s)\nRAM free: ${(st.heapFree/1024).toFixed(0)} KB · Largest block: ${(st.heapLargest/1024).toFixed(0)} KB\nMax lateness: ${st.lateMax} · Skipped: ${st.abandoned}\nQueue: ${st.queue.toFixed(0)} %`;}
 $('throughput').textContent=(specCount.length*(32+nb)/1e3).toFixed(0);$('throughputLabel').textContent=`kB/s over ${radio.transport} · ${c.rate/1e6} MS/s on chip${specCov===null?'':` · FFT on ${Math.round(specCov*100)} % of samples`}`;
 $('latency').textContent=specLast?(specLast.pairs/c.rate*1e3).toFixed(2):'—';$('latencyLabel').textContent=`ms / spectrum · ${c.maxHold?'max':'mean'} of ${specLast?.ffts??'—'} FFT`;
 $('peak').textContent=((c.frequency*1e6+(peak-nb/2)*c.rate/nb)/1e6).toFixed(4);
 const g=specInfo?.gain;$('gainStatus').textContent=(g?.mode==='HARDWARE'?'Hardware AGC':g?`Manual · index ${g.index}`:'');
 $('crc').textContent=`SPEC · ${radio.spectrumContinuous(Number($('rate').value),Number($('fft').value))?'continuous capture':'snapshots with gaps'} · #${specLast?.frame??0}${specLast?.drops?` · ${specLast.drops} dropped`:''}${specInfo?.crcErrors?` · ${specInfo.crcErrors} CRC err`:''}${specInfo?.hostDropped?` · ${Math.round(specInfo.hostDropped/1024)} kB skipped (page busy)`:''}`;
}
$('iqMode').onclick=()=>{spectrumMode=false;state();labels();};
$('specMode').onclick=()=>{if(!radio.canStreamSpectrum)return;spectrumMode=true;state();labels();};
// Auto scale: floor a little under the noise (20th percentile), top a little
// above the strongest bin; applied at most twice a second, smoothed, without
// clearing the waterfall.
let autoPk=null;
// Calm auto scale: floor = 20th percentile - 10 dB in 5 dB steps (4 dB hysteresis),
// top = slowly decaying peak hold + 5 dB in 10 dB steps; evaluated once a second.
function autoScale(values){
 if(!$('autoscale').checked||!values?.length)return;
 const now=performance.now();if(now-autoT<1000)return;autoT=now;
 const v=Array.from(values).filter(Number.isFinite).sort((a,b)=>a-b);if(v.length<8)return;
 const nf=v[Math.floor(v.length*.2)]-10,pk=v[v.length-1];autoPk=autoPk===null?pk:Math.max(pk,autoPk-2);
 const f0=Number($('floor').value),r0=Number($('range').value);
 let floor=Math.abs(nf-f0)>4?Math.round(nf/5)*5:f0,top=f0+r0;
 if(autoPk+5>top||autoPk+25<top)top=Math.ceil((autoPk+5)/10)*10;
 floor=Math.max(-140,Math.min(-40,floor));const range=Math.max(20,Math.min(120,top-floor));
 if(floor===f0&&range===r0)return;
 $('floor').value=floor;$('range').value=range;
 $('floorValue').textContent=floor+' dBFS';$('rangeValue').textContent=range+' dB';
 $('scale').textContent=`${floor} ? ${floor+range} dBFS`;redrawWater();draw();
}
$('autoscale').onchange=()=>{autoT=0;autoPk=null;};
// ---- spectrum / waterfall splitter ----------------------------------------
{const sp=$('splitter'),def=[220,380],set=(hs,hw)=>{spec.style.height=hs+'px';water.style.height=hw+'px';resize();redrawWater();};
 try{const v=JSON.parse(localStorage.getItem('espSdrSplit')||'null');if(Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=80&&n<=1200))set(v[0],v[1]);}catch(e){}
 let sd=null;sp.addEventListener('pointerdown',e=>{sd={y:e.clientY,hs:spec.clientHeight,hw:water.clientHeight};sp.setPointerCapture(e.pointerId);sp.classList.add('drag');e.preventDefault();});
 sp.addEventListener('pointermove',e=>{if(!sd)return;const tot=sd.hs+sd.hw,hs=Math.max(80,Math.min(tot-80,sd.hs+e.clientY-sd.y));set(hs,tot-hs);});
 sp.addEventListener('pointercancel',()=>{sd=null;sp.classList.remove('drag');});
 sp.addEventListener('pointerup',()=>{if(!sd)return;sd=null;sp.classList.remove('drag');try{localStorage.setItem('espSdrSplit',JSON.stringify([spec.clientHeight,water.clientHeight]));}catch(e){}});
 sp.addEventListener('dblclick',()=>{set(def[0],def[1]);try{localStorage.removeItem('espSdrSplit');}catch(e){}});}

// Start without a click: connect to the remembered port as soon as the page
// loads and whenever a device is plugged in (only ports this site was granted).
if(SerialConnection.supported()){SerialConnection.onConnect(()=>setTimeout(()=>$('connect').onclick({auto:true}),500));
 setTimeout(()=>$('connect').onclick({auto:true}),300);}

