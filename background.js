
(()=>{
const c=document.getElementById('particle-bg');
if(!c)return;
const ctx=c.getContext('2d');
let w,h,dots=[];
function resize(){
 w=c.width=innerWidth;
 h=c.height=innerHeight;
 dots=[];
 const gap=innerWidth<768?40:28;
 for(let x=0;x<w;x+=gap){
  for(let y=0;y<h;y+=gap){
   dots.push({x,y,ox:x,oy:y,vx:0,vy:0});
  }
 }
}
addEventListener('resize',resize);
let mouse={x:-9999,y:-9999};
addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
function loop(){
 ctx.clearRect(0,0,w,h);
 for(const d of dots){
  const dx=d.x-mouse.x,dy=d.y-mouse.y;
  const dist=Math.hypot(dx,dy);
  if(dist<120){
   const f=(120-dist)/120;
   d.vx+=(dx/(dist||1))*f*0.5;
   d.vy+=(dy/(dist||1))*f*0.5;
  }
  d.vx*=0.92; d.vy*=0.92;
  d.x+=d.vx; d.y+=d.vy;
  d.x+=(d.ox-d.x)*0.05;
  d.y+=(d.oy-d.y)*0.05;

  ctx.fillStyle='rgba(122,162,247,.55)';
  ctx.fillRect(d.x,d.y,1.5,1.5);
 }
 requestAnimationFrame(loop);
}
resize();loop();
})();

