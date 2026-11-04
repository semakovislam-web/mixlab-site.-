const $ = (id) => document.getElementById(id);
const ids = ["volume","speed","duration","intensity","g1","g2","c1","c2","c0","target"];
const defaults = {volume:10,speed:300,duration:8,intensity:1,g1:2,g2:1,c1:5,c2:100,c0:10,target:90};
let timeChart, speedChart, latestExperiments = [];

function readInputs(){
  const v = {};
  ids.forEach(id => v[id] = Number($(id).value));
  return v;
}
function validate(v){
  const ranges = {volume:[5,100],speed:[100,500],duration:[1,20],intensity:[.5,2],g1:[.1,20],g2:[.1,20],c1:[0,100],c2:[0,100],c0:[0,100],target:[50,99]};
  for(const [key,[min,max]] of Object.entries(ranges)){
    if(!Number.isFinite(v[key]) || v[key] < min || v[key] > max) return `Проверьте поле «${key}»: допустимый диапазон ${min}–${max}.`;
  }
  return "";
}
function calculate(v, speed=v.speed, time=v.duration){
  const G=v.g1+v.g2;
  const Pi=(v.g1*v.c1+v.g2*v.c2)/G;
  const Tbase=v.volume/G;
  // Учебное допущение: интенсивность и скорость влияют на эффективную постоянную времени.
  const Teff=Tbase*(300/speed)/v.intensity;
  const decay=Math.exp(-time/Teff);
  const concentration=v.c0*decay+Pi*(1-decay);
  const homogeneity=100*(1-decay);
  const energy=v.volume*Math.pow(speed/300,2)*time;
  return {G,Pi,Tbase,Teff,concentration,homogeneity,energy};
}
function fmt(n,d=1){return Number(n).toFixed(d).replace(".",",")}
function setRangeLabels(v){
  $("volumeOut").textContent=`${fmt(v.volume,0)} л`;
  $("speedOut").textContent=`${fmt(v.speed,0)} об/мин`;
  $("durationOut").textContent=`${fmt(v.duration,1)} мин`;
  $("intensityOut").textContent=fmt(v.intensity,1);
}
function chartOptions(yTitle){
  return {responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:"index"},plugins:{legend:{display:false},tooltip:{backgroundColor:"#17271f",padding:10,titleFont:{family:"Manrope"},bodyFont:{family:"Manrope"}}},scales:{x:{grid:{display:false},ticks:{color:"#8b978e",font:{size:9}},title:{display:true,text:"Параметр",color:"#89958c",font:{size:9}}},y:{beginAtZero:true,max:100,grid:{color:"#edf1eb"},ticks:{color:"#8b978e",font:{size:9}},title:{display:true,text:yTitle,color:"#89958c",font:{size:9}}}}};
}
function makeCharts(v){
  const labels=Array.from({length:21},(_,i)=>i);
  const timeData=labels.map(t=>calculate(v,v.speed,t).homogeneity);
  const speedLabels=[100,150,200,250,300,350,400,450,500];
  const speedData=speedLabels.map(s=>calculate(v,s,v.duration).homogeneity);
  if(timeChart)timeChart.destroy();
  if(speedChart)speedChart.destroy();
  timeChart=new Chart($("timeChart"),{type:"line",data:{labels,datasets:[{data:timeData,borderColor:"#86a94b",backgroundColor:"rgba(175,207,120,.17)",fill:true,tension:.35,pointRadius:0,borderWidth:2},{data:labels.map(()=>v.target),borderColor:"#d8a16f",borderDash:[5,5],pointRadius:0,borderWidth:1.5}]},options:{...chartOptions("Однородность, %"),scales:{...chartOptions("").scales,x:{...chartOptions("").scales.x,title:{display:true,text:"Время, мин"}},y:chartOptions("").scales.y}}});
  speedChart=new Chart($("speedChart"),{type:"line",data:{labels:speedLabels,datasets:[{data:speedData,borderColor:"#6d9eaa",backgroundColor:"rgba(109,158,170,.13)",fill:true,tension:.3,pointRadius:3,pointBackgroundColor:"#6d9eaa",borderWidth:2}]},options:{...chartOptions("Однородность, %"),scales:{...chartOptions("").scales,x:{...chartOptions("").scales.x,title:{display:true,text:"Скорость, об/мин"}}}}});
}
function updateTable(v){
  const settings=[[100,8],[150,8],[200,8],[300,8],[400,8],[300,4],[300,12]];
  latestExperiments=settings.map(([s,t])=>({s,t,...calculate(v,s,t)}));
  $("experimentTable").innerHTML=latestExperiments.map((r,i)=>`<tr><td>${String(i+1).padStart(2,"0")}</td><td>${r.s}</td><td>${fmt(r.t,1)}</td><td><span class="status-pill">${fmt(r.homogeneity,1)}%</span></td><td>${fmt(r.concentration,2)}</td><td>${fmt(r.energy,2)}</td></tr>`).join("");
}
function render(){
  const v=readInputs(), error=validate(v);
  $("errorMessage").textContent=error;
  if(error)return;
  setRangeLabels(v);
  const r=calculate(v);
  $("homogeneity").innerHTML=`${fmt(r.homogeneity,1)}<small>%</small>`;
  $("concentration").innerHTML=`${fmt(r.concentration,2)}<small>%</small>`;
  $("tau").innerHTML=`${fmt(r.Teff,2)}<small> мин</small>`;
  $("energy").textContent=fmt(r.energy,2);
  makeCharts(v);updateTable(v);
}
function optimize(){
  const v=readInputs(), error=validate(v);
  $("errorMessage").textContent=error;
  if(error)return;
  let best=null;
  for(let speed=100;speed<=500;speed+=10){
    const G=v.g1+v.g2,Tbase=v.volume/G,Teff=Tbase*(300/speed)/v.intensity;
    const requiredTime=-Teff*Math.log(1-v.target/100);
    const time=Math.max(1,requiredTime);
    if(time>20)continue;
    const r=calculate(v,speed,time);
    if(r.homogeneity+1e-8>=v.target && (!best || r.energy<best.energy))best={speed,time,...r};
  }
  if(!best){
    $("optResult").innerHTML=`<div class="opt-empty"><div class="target-icon">!</div><b>Не удалось выполнить ограничение</b><span>При заданных параметрах целевая однородность не достигается за 20 минут. Увеличьте интенсивность или измените состав/объём.</span></div>`;
    return;
  }
  $("optResult").innerHTML=`<div class="opt-found"><span class="found-title">РАСЧЁТНЫЙ ОПТИМАЛЬНЫЙ РЕЖИМ</span><div class="opt-values"><div><span>Скорость</span><b>${best.speed} <small>об/мин</small></b></div><div><span>Время</span><b>${fmt(best.time,2)} <small>мин</small></b></div><div><span>Однородность</span><b>${fmt(best.homogeneity,1)}<small>%</small></b></div><div><span>Затраты</span><b>${fmt(best.energy,2)} <small>ед.</small></b></div></div><p>При текущих исходных данных найден режим с минимальным значением критерия E среди проверенных скоростей. Для переноса режима в симулятор нажмите «Применить».</p><button class="btn btn-primary" id="applyOpt" style="margin-top:13px">Применить режим →</button></div>`;
  $("applyOpt").addEventListener("click",()=>{$("speed").value=best.speed;$("duration").value=Math.min(20,Math.max(1,best.time));render();$("simulator").scrollIntoView({behavior:"smooth"});});
}
function reset(){ids.forEach(id=>$(id).value=defaults[id]);$("optResult").innerHTML=`<div class="opt-empty"><div class="target-icon">⌖</div><b>Оптимальный режим ещё не найден</b><span>Нажмите кнопку, чтобы запустить перебор параметров.</span></div>`;render();}
function exportCSV(){
  const header=["Номер","Скорость, об/мин","Время, мин","Однородность, %","Концентрация C(t), %","Условные затраты, ед."];
  const rows=latestExperiments.map((r,i)=>[i+1,r.s,r.t,r.homogeneity.toFixed(2),r.concentration.toFixed(2),r.energy.toFixed(2)]);
  const csv=[header,...rows].map(row=>row.join(";")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="rezultaty_modelirovaniya_lkm.csv";a.click();URL.revokeObjectURL(url);
}
ids.forEach(id=>$(id).addEventListener("input",render));
$("calculateBtn").addEventListener("click",render);
$("resetBtn").addEventListener("click",reset);
$("optimizeBtn").addEventListener("click",optimize);
$("exportBtn").addEventListener("click",exportCSV);
$("menuToggle").addEventListener("click",()=>$("nav").classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>$("nav").classList.remove("open")));
render();