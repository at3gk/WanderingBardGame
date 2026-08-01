const { BASE_URL, launch } = await import('file:///G:/WanderingBardGame/tools/browser.mjs');
const SHOTS = [
  { name: '01-dawn', s: 60, day: 0.24, phase: 'walking' },
  { name: '02-morn', s: 265, day: 0.42, phase: 'walking' },
  { name: '03-noon', s: 620, day: 0.55, phase: 'walking' },
  { name: '04-gold', s: 900, day: 0.8, phase: 'vista' },
  { name: '10-tab', s: 700, day: 0.7, phase: 'walking' },
];
const browser = await launch();
const out = [];
for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.bard?.pose !== undefined, null, { timeout: 60000 });
  await page.evaluate((s) => window.bard.pose({ s: s.s, dayFraction: s.day, phase: s.phase }), shot);
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => {
    const app = window.bard.app, stage = window.bard.stage, g = stage.bard.group;
    const gl = app.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const grab = () => { app.renderer.render(stage.scene, stage.camera);
      const px = new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px); return px; };
    const sr=(c)=>{const s=c/255;return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4);};
    const Ls=(r,gg,b)=>{const Y=0.2126*sr(r)+0.7152*sr(gg)+0.0722*sr(b);return Y>0.008856?116*Math.cbrt(Y)-16:903.3*Y;};
    const A = grab();
    g.visible = false; const B = grab(); g.visible = true;
    // silhouette mask
    const mask = new Uint8Array(w*h); let n=0, minY=h, maxY=-1, minX=w, maxX=-1;
    for (let i=0,p=0;i<w*h;i++,p+=4){ const d=Math.abs(A[p]-B[p])+Math.abs(A[p+1]-B[p+1])+Math.abs(A[p+2]-B[p+2]);
      if(d>12){mask[i]=1;n++;const x=i%w,y=(i/w)|0;if(y<minY)minY=y;if(y>maxY)maxY=y;if(x<minX)minX=x;if(x>maxX)maxX=x;} }
    const rc=new Int32Array(h); for(let i=0;i<w*h;i++) if(mask[i]) rc[(i/w)|0]++;
    let c=0,p02=minY,p98=maxY; for(let y=0;y<h;y++){c+=rc[y];if(c>=n*0.02){p02=y;break;}}
    c=0; for(let y=0;y<h;y++){c+=rc[y];if(c>=n*0.98){p98=y;break;}}
    minY=p02;maxY=p98; const bh=maxY-minY+1, y1=minY+Math.round(bh*0.40);
    const band=(px,use)=>{let s=0,k=0;for(let y=minY;y<=y1;y++)for(let x=minX;x<=maxX;x++){const i=y*w+x;
      if(use==='fig'&&!mask[i])continue; if(use==='gnd'&&mask[i])continue;
      const p=i*4; s+=Ls(px[p],px[p+1],px[p+2]); k++;} return k?s/k:0;};
    const figReal = band(A,'fig'), gndReal = band(B,'gnd');
    // flood every material on the figure to white albedo
    const saved=[];
    g.traverse((o)=>{ if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material];
      for(const m of ms){ const u=m.uniforms&&m.uniforms.uColor; if(u&&u.value&&u.value.setRGB){
        saved.push([u,u.value.clone()]); u.value.setRGB(1,1,1);
        const v=m.uniforms.uColorVariant; if(v&&v.value){saved.push([v,v.value.clone()]);v.value.setRGB(1,1,1);} } } } });
    const C = grab();
    for(const [u,col] of saved) u.value.copy(col);
    const figWhite = band(C,'fig');
    // Partition the lower-band mask: pixels that MOVED under the albedo flood
    // are the figure's own surfaces; pixels that did not are its cast shadow
    // on the ground (hiding the bard removes the shadow too, so the
    // visible/hidden diff cannot tell them apart).
    let selfPx=0, shadPx=0, shadL=0, selfL=0;
    for(let y=minY;y<=y1;y++)for(let x=minX;x<=maxX;x++){ const i=y*w+x; if(!mask[i])continue; const p=i*4;
      const d=Math.abs(C[p]-A[p])+Math.abs(C[p+1]-A[p+1])+Math.abs(C[p+2]-A[p+2]);
      if(d>10){selfPx++; selfL+=Ls(A[p],A[p+1],A[p+2]);} else {shadPx++; shadL+=Ls(A[p],A[p+1],A[p+2]);} }
    const r1=(v)=>Math.round(v*10)/10;
    return { figReal:r1(figReal), figWhite:r1(figWhite), gndReal:r1(gndReal),
             albedoDrop:r1(figWhite-figReal), lightRatio:r1(figWhite/Math.max(0.01,gndReal)), mats:saved.length, selfPx, shadPx, selfShare:r1(100*selfPx/Math.max(1,selfPx+shadPx)), selfL:r1(selfL/Math.max(1,selfPx)), shadL:r1(shadL/Math.max(1,shadPx)) };
  });
  out.push({ n: shot.name, ...r });
  await page.close();
}
await browser.close();
console.log('shot    figReal figWhite gndReal  drop  figW/gnd | lowerband: %self  selfL  shadowL   gndL');
for(const r of out) console.log(r.n.padEnd(8)+String(r.figReal).padStart(7)+String(r.figWhite).padStart(9)+String(r.gndReal).padStart(8)+String(r.albedoDrop).padStart(6)+String(r.lightRatio).padStart(10)+' |'+String(r.selfShare).padStart(15)+String(r.selfL).padStart(7)+String(r.shadL).padStart(9)+String(r.gndReal).padStart(7));
