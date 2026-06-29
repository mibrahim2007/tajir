/* Canvas App — Menu Style showcase */
function MenuStyle() {
  const {AppFrame,Card,Pill} = window.CanvasDS;
  const Ic=window.Ic, D=window.D;
  const states=[["default","Purchases",false],["hover","Sales",false],["active","Receivables",true]];
  return (
    <AppFrame active="purchase" title="Navigation Style" subtitle="Sidebar layout · Canvas direction" h={720}>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:24,height:"100%"}}>
        <div>
          <div style={{fontFamily:"var(--font-sans)",fontWeight:800,fontSize:20,letterSpacing:"-.02em",marginBottom:8}}>Left Sidebar</div>
          <div style={{fontFamily:"var(--font-sans)",fontSize:13.5,color:"var(--muted-foreground)",marginBottom:24,lineHeight:1.6}}>
            Persistent 252px warm sidebar, grouped modules, rounded pill active with a teal left accent bar (3px). Airy spacing — 40px row height. Logo at top, user profile footer.
          </div>
          <div style={{fontFamily:"var(--font-sans)",fontSize:11.5,fontWeight:700,color:"var(--muted-foreground)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:12}}>
            {D.nav.reduce((s,g)=>s+g.items.length,0)} Modules · {D.nav.length} Groups
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {D.nav.map(g=><div key={g.group} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{width:80,fontFamily:"var(--font-sans)",fontSize:11,fontWeight:700,color:"var(--faint-foreground)",textTransform:"uppercase"}}>{g.group}</span>
              {g.items.map(it=>{const Icon=Ic[it.icon]||Ic.Box;return(
                <span key={it.key} style={{display:"inline-flex",alignItems:"center",gap:6,height:30,padding:"0 10px",
                  background:"var(--surface)",border:"1px solid var(--border)",borderRadius:999,
                  fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--foreground)"}}>
                  <Icon style={{fontSize:14,color:"var(--primary)"}}/>{it.label}
                </span>);})}
            </div>)}
          </div>
        </div>
        <div>
          <div style={{fontFamily:"var(--font-sans)",fontSize:11.5,fontWeight:700,color:"var(--muted-foreground)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:10}}>Item States</div>
          <Card style={{padding:12,maxWidth:280}}>
            {states.map(([state,label,active])=>(
              <div key={state} style={{position:"relative",display:"flex",alignItems:"center",gap:11,height:42,padding:"0 10px",
                borderRadius:12,marginBottom:4,background:active?"var(--primary-soft)":"transparent",
                color:active?"var(--primary)":"var(--muted-foreground)",
                fontFamily:"var(--font-sans)",fontWeight:active?700:500,fontSize:13.5}}>
                {active&&<span style={{position:"absolute",left:0,top:10,bottom:10,width:3,borderRadius:3,background:"var(--primary)"}}/>}
                <Ic.Bag style={{fontSize:18,opacity:active?1:.7}}/>{label}
                <span style={{marginLeft:"auto",fontFamily:"var(--font-sans)",fontSize:10,color:"var(--faint-foreground)",textTransform:"uppercase",letterSpacing:".05em"}}>{state}</span>
              </div>))}
          </Card>
          <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:8}}>
            {[["nav-bg","#fff (surface)"],["active-bg","var(--primary-soft)"],["active-ink","var(--primary)"],["accent-bar","var(--primary) · 3px"],["radius","var(--radius-sm) · 12px"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-sans)",fontSize:12.5,
                padding:"7px 0",borderBottom:"1px solid var(--border-soft)"}}>
                <span style={{color:"var(--muted-foreground)"}}>{k}</span>
                <span style={{fontFamily:"var(--font-num)",fontWeight:600,color:"var(--foreground)"}}>{v}</span>
              </div>))}
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
window.CanvasScreens = window.CanvasScreens||{};
window.CanvasScreens.MenuStyle = MenuStyle;
