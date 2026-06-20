/* Canvas Design System — self-contained component bridge for the UI kit.
   Provides all components via window.CanvasDS and a theme-ish config via window.CVS.
   Replaces the compiled _ds_bundle.js for local preview. */

/* Theme constants — CSS vars resolved at runtime */
window.CVS = {
  font:"var(--font-sans)", num:"var(--font-num)",
  ink:"var(--foreground)", inkSoft:"var(--muted-foreground)", inkFaint:"var(--faint-foreground)",
  line:"var(--border)", lineSoft:"var(--border-soft)",
  surface:"var(--surface)", surfaceAlt:"var(--surface-alt)", bg:"var(--background)",
  brand:"var(--primary)", brandSoft:"var(--primary-soft)", onBrand:"#fff",
  accent:"var(--accent)", accentSoft:"var(--accent-soft)",
  pos:"var(--pos)", posSoft:"var(--pos-soft)", neg:"var(--neg)", negSoft:"var(--neg-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  cardBorder:"1px solid var(--border)", cardShadow:"var(--shadow)",
  radius:18, radiusSm:12, radiusLg:24, radiusPill:9999, radiusXs:6,
  fs:14, rowH:48, gap:20, pad:24, wSemi:600, wBold:700, wMax:700,
  tableHeadBg:"var(--surface-alt)", tableZebra:"transparent",
  chart:{
    line:"#0d9488", line2:"#a89e90", fill:"rgba(13,148,136,.13)",
    bars:"#0d9488", barsAlt:"#d7f0ec",
    donut:["#0d9488","#ea8c2a","#14b8a6","#f59e0b","#ccfbf1"],
    grid:"var(--border-soft)"
  }
};

/* ---------- helpers ---------- */
function Money({amount, size, color, weight, full}) {
  const t = full ? window.money(amount) : window.shortRs(amount);
  return <span style={{fontFamily:"var(--font-num)",fontWeight:weight||700,fontSize:size||14,
    color,fontVariantNumeric:"tabular-nums",letterSpacing:"-.01em",whiteSpace:"nowrap"}}>{t}</span>;
}
function Num({children, size, color, weight}) {
  return <span style={{fontFamily:"var(--font-num)",fontWeight:weight||600,fontSize:size||14,
    color,fontVariantNumeric:"tabular-nums",letterSpacing:"-.01em"}}>{children}</span>;
}
function Delta({v, up}) {
  const c=up?"var(--pos)":"var(--neg)", bg=up?"var(--pos-soft)":"var(--neg-soft)";
  const Arrow=up?()=><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>:()=><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontFamily:"var(--font-num)",
    fontWeight:700,fontSize:11.5,color:c,background:bg,padding:"2px 7px",borderRadius:999}}><Arrow/>{Math.abs(v)}%</span>;
}
function Card({children, style}) {
  return <div style={{background:"var(--surface)",border:"1px solid var(--border)",
    borderRadius:18,boxShadow:"var(--shadow)",...style}}>{children}</div>;
}
function Pill({children, tone}) {
  const map={pos:["var(--pos)","var(--pos-soft)"],neg:["var(--neg)","var(--neg-soft)"],
    warn:["var(--warn)","var(--warn-soft)"],brand:["var(--primary)","var(--primary-soft)"],
    neutral:["var(--muted-foreground)","var(--surface-alt)"]};
  const STATUS={Paid:"pos",Done:"pos",Received:"pos","In Stock":"pos",
    Overdue:"neg",Out:"neg","Out of Stock":"neg",Partial:"warn",Low:"warn",Draft:"neutral"};
  const t=STATUS[children]||tone||"neutral";
  const [c,bg]=map[t]||map.neutral;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,fontFamily:"var(--font-sans)",
    fontWeight:700,fontSize:11.5,color:c,background:bg,padding:"3px 9px",borderRadius:999}}>{children}</span>;
}
function Btn({children, variant="solid", icon, sm}) {
  const Icon=icon?window.Ic[icon]:null;
  const styles={
    solid:{background:"var(--primary)",color:"#fff"},
    accent:{background:"var(--accent)",color:"#fff"},
    outline:{background:"var(--surface)",color:"var(--foreground)",border:"1px solid var(--border)"},
    ghost:{background:"transparent",color:"var(--muted-foreground)"},
  };
  return <button style={{display:"inline-flex",alignItems:"center",gap:7,fontFamily:"var(--font-sans)",
    fontWeight:700,fontSize:sm?12.5:13.5,height:sm?32:40,padding:sm?"0 10px":"0 16px",
    borderRadius:12,cursor:"pointer",whiteSpace:"nowrap",border:"1px solid transparent",lineHeight:1,
    ...styles[variant]}}>{Icon&&<Icon style={{fontSize:16}}/>}{children}</button>;
}
function Field({label, children, w}) {
  return <label style={{display:"flex",flexDirection:"column",gap:6,width:w||"auto",flex:w?"none":1}}>
    <span style={{fontFamily:"var(--font-sans)",fontSize:11.5,fontWeight:700,color:"var(--muted-foreground)",
      textTransform:"uppercase",letterSpacing:".04em"}}>{label}</span>
    {children}
  </label>;
}
function Inp({value, placeholder, mono}) {
  return <div style={{display:"flex",alignItems:"center",height:40,background:"var(--surface)",
    border:"1px solid var(--border)",borderRadius:12,padding:"0 12px",
    fontFamily:mono?"var(--font-num)":"var(--font-sans)",fontSize:13.5,
    fontWeight:500,color:value?"var(--foreground)":"var(--faint-foreground)",
    fontVariantNumeric:mono?"tabular-nums":"normal"}}>
    {value||placeholder}
  </div>;
}
function Sel({value, placeholder}) {
  return <Inp value={value} placeholder={placeholder} />;
}

/* ---------- DataTable ---------- */
function DataTable({cols, rows, dense}) {
  const rh=dense?36:48;
  return <div style={{width:"100%",overflow:"hidden",borderRadius:14,border:"1px solid var(--border)"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"var(--font-sans)"}}>
      <thead><tr style={{background:"var(--surface-alt)"}}>
        {cols.map((c,i)=><th key={i} style={{textAlign:c.align||"left",padding:"0 14px",height:36,
          fontSize:11,fontWeight:700,color:"var(--muted-foreground)",textTransform:"uppercase",
          letterSpacing:".04em",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",width:c.width}}>{c.label}</th>)}
      </tr></thead>
      <tbody>{rows.map((r,ri)=>(
        <tr key={ri} style={{background:"transparent"}}>
          {cols.map((c,ci)=><td key={ci} style={{textAlign:c.align||"left",padding:"0 14px",height:rh,
            borderBottom:ri===rows.length-1?"none":"1px solid var(--border-soft)",
            fontFamily:c.mono?"var(--font-num)":"var(--font-sans)",fontSize:13,
            fontWeight:c.strong?600:500,color:c.color?c.color(r):"var(--foreground)",
            fontVariantNumeric:c.mono?"tabular-nums":"normal",whiteSpace:"nowrap"}}>
            {c.render?c.render(r):r[c.key]}
          </td>)}
        </tr>))}</tbody>
    </table>
  </div>;
}

/* ---------- Patterns ---------- */
function PageHeader({title, subtitle, action}) {
  return <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
    gap:16,marginBottom:24}}>
    <div>
      <h1 style={{fontFamily:"var(--font-sans)",fontWeight:800,fontSize:24,
        letterSpacing:"-.02em",color:"var(--foreground)",margin:0,lineHeight:1.15}}>{title}</h1>
      {subtitle&&<p style={{fontFamily:"var(--font-sans)",fontSize:13,color:"var(--muted-foreground)",
        margin:"4px 0 0"}}>{subtitle}</p>}
    </div>
    {action&&<div style={{flexShrink:0,display:"flex",alignItems:"center",gap:8}}>{action}</div>}
  </div>;
}
function KpiCard({label, value, delta, up, spark}) {
  return <div style={{padding:"16px 18px"}}>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
      <span style={{fontFamily:"var(--font-sans)",fontSize:12,fontWeight:700,color:"var(--muted-foreground)",
        textTransform:"uppercase",letterSpacing:".05em"}}>{label}</span>
      {delta!==undefined&&<Delta v={delta} up={up}/>}
    </div>
    <div style={{marginTop:10,fontFamily:"var(--font-num)",fontWeight:800,fontSize:24,
      color:"var(--foreground)",letterSpacing:"-.015em",fontVariantNumeric:"tabular-nums"}}>{value}</div>
    {spark&&<Spark data={spark} color={up?"var(--pos)":"var(--neg)"} w={140} h={28}/>}
  </div>;
}
function SummaryBanner({label, value, tone="neutral", size="default"}) {
  const tones={profit:{bg:"var(--pos-soft)",c:"var(--pos)"},loss:{bg:"var(--neg-soft)",c:"var(--neg)"},
    info:{bg:"var(--primary-soft)",c:"var(--primary)"},accent:{bg:"var(--accent-soft)",c:"var(--accent)"},
    neutral:{bg:"var(--surface-alt)",c:"var(--foreground)"}};
  const {bg,c}=tones[tone]||tones.neutral, lg=size==="lg";
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
    padding:"12px 16px",borderRadius:12,background:bg,color:c}}>
    <span style={{fontFamily:"var(--font-sans)",fontWeight:lg?700:600,fontSize:lg?15:14}}>{label}</span>
    <span style={{fontFamily:"var(--font-num)",fontVariantNumeric:"tabular-nums",
      fontWeight:700,fontSize:lg?20:14,letterSpacing:"-.01em"}}>{value}</span>
  </div>;
}
function EmptyState({message="No data.", hint, action}) {
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",
    gap:12,padding:"48px 24px",border:"2px dashed var(--border)",borderRadius:18,textAlign:"center"}}>
    <div style={{fontFamily:"var(--font-sans)",fontWeight:600,fontSize:14,color:"var(--muted-foreground)"}}>{message}</div>
    {hint&&<div style={{fontFamily:"var(--font-sans)",fontSize:13,color:"var(--faint-foreground)"}}>{hint}</div>}
    {action}
  </div>;
}
function SectionHead({title, sub, right}) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
    <div>
      <div style={{fontFamily:"var(--font-sans)",fontWeight:700,fontSize:15,color:"var(--foreground)",letterSpacing:"-.01em"}}>{title}</div>
      {sub&&<div style={{fontFamily:"var(--font-sans)",fontSize:12,color:"var(--muted-foreground)",marginTop:2}}>{sub}</div>}
    </div>
    {right}
  </div>;
}

/* ---------- Charts ---------- */
function path(pts){return pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");}
function Spark({data=[],color,w=100,h=28}) {
  if(!data.length) return null;
  const mn=Math.min(...data),mx=Math.max(...data),r=mx-mn||1;
  const pts=data.map((v,i)=>[i/(data.length-1)*w,h-3-((v-mn)/r)*(h-6)]);
  const d=path(pts); const id="ks"+Math.random().toString(36).slice(2);
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:"block"}}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity=".2"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
    </linearGradient></defs>
    <path d={d+` L${w} ${h} L0 ${h}Z`} fill={`url(#${id})`}/>
    <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function AreaChart({months,series,w=640,h=230}) {
  const pL=44,pB=24,pT=10,pR=8,iw=w-pL-pR,ih=h-pT-pB;
  const all=series.flatMap(s=>s.data); const max=Math.max(...all)*1.1,r=max||1;
  const x=(i,n)=>pL+(i/(n-1))*iw, y=v=>pT+ih-((v)/r)*ih;
  const id="ar"+Math.random().toString(36).slice(2);
  return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{display:"block"}}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#0d9488" stopOpacity=".16"/><stop offset="100%" stopColor="#0d9488" stopOpacity="0"/>
    </linearGradient></defs>
    {[0,1,2,3,4].map(i=>{const gy=pT+(ih/4)*i;return<g key={i}>
      <line x1={pL} y1={gy} x2={w-pR} y2={gy} stroke="var(--border-soft)" strokeWidth="1"/>
      <text x={pL-6} y={gy+4} textAnchor="end" fontSize="10" fontFamily="var(--font-num)" fill="var(--faint-foreground)">{window.short(max-max/4*i)}</text>
    </g>;})}
    {series.map((s,si)=>{const pts=s.data.map((v,i)=>[x(i,s.data.length),y(v)]);return<g key={si}>
      {s.fill&&<path d={path(pts)+` L${x(s.data.length-1,s.data.length)} ${pT+ih} L${pL} ${pT+ih}Z`} fill={`url(#${id})`}/>}
      <path d={path(pts)} fill="none" stroke={s.color} strokeWidth={s.fill?2.5:1.75} strokeDasharray={s.dash||"0"} strokeLinecap="round" strokeLinejoin="round"/>
    </g>;})}
    {months.map((m,i)=><text key={i} x={x(i,months.length)} y={h-6} textAnchor="middle" fontSize="10.5" fontFamily="var(--font-sans)" fill="var(--faint-foreground)">{m}</text>)}
  </svg>;
}
function Bars({data,w=300,h=180,horizontal}) {
  const max=Math.max(...data.map(d=>d.value))*1.05||1;
  if(horizontal){const rh=h/data.length;return<svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{display:"block"}}>
    {data.map((d,i)=>{const bw=(d.value/max)*(w-120),cy=i*rh+rh/2;return<g key={i}>
      <text x={0} y={cy+4} fontSize="11.5" fontFamily="var(--font-sans)" fill="var(--muted-foreground)">{d.name}</text>
      <rect x={90} y={cy-8} width={w-120} height={17} rx={6} fill="var(--border-soft)"/>
      <rect x={90} y={cy-8} width={bw} height={17} rx={6} fill="#0d9488"/>
      <text x={w} y={cy+4} textAnchor="end" fontSize="11" fontFamily="var(--font-num)" fontWeight="600" fill="var(--foreground)">{d.value}%</text>
    </g>;})}
  </svg>;}
  const bw=(w/data.length)*0.5,gap=w/data.length;
  return<svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{display:"block"}}>
    {data.map((d,i)=>{const bh=(d.value/max)*(h-24),bx=i*gap+(gap-bw)/2;return<g key={i}>
      <rect x={bx} y={h-20-bh} width={bw} height={bh} rx={6} fill="#0d9488"/>
      <text x={bx+bw/2} y={h-4} textAnchor="middle" fontSize="10.5" fontFamily="var(--font-sans)" fill="var(--faint-foreground)">{d.name}</text>
    </g>;})}
  </svg>;
}
function Donut({data,size=160,thickness=24}) {
  const total=data.reduce((s,d)=>s+d.value,0);
  const R=size/2-thickness/2,C=2*Math.PI*R;
  let off=0;
  const colors=["#0d9488","#ea8c2a","#14b8a6","#f59e0b","#ccfbf1"];
  return<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block"}}>
    <g transform={`rotate(-90 ${size/2} ${size/2})`}>
      {data.map((d,i)=>{const len=(d.value/total)*C;const el=<circle key={i} cx={size/2} cy={size/2} r={R} fill="none"
        stroke={colors[i%colors.length]} strokeWidth={thickness} strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-off}/>;
        off+=len;return el;})}
    </g>
    <text x={size/2} y={size/2-1} textAnchor="middle" fontSize="20" fontFamily="var(--font-num)" fontWeight="700" fill="var(--foreground)">{total}%</text>
    <text x={size/2} y={size/2+15} textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--faint-foreground)">total</text>
  </svg>;
}
function MiniBar({value,max,color}) {
  return<div style={{height:5,borderRadius:999,background:"var(--border-soft)",overflow:"hidden",width:"100%"}}>
    <div style={{width:Math.min(100,(value/max)*100)+"%",height:"100%",borderRadius:999,background:color||"var(--primary)"}}/>
  </div>;
}

/* ---------- AppFrame (sidebar style) ---------- */
const NAV_DATA = window.D ? window.D.nav : [];
function AppSidebar({active}) {
  const Ic=window.Ic;
  const ICONS={Grid:"Grid",Pulse:"Pulse",Truck:"Truck",Bag:"Bag",Swap:"Swap",Box:"Box",
    Ware:"Ware",Boxes:"Boxes",In:"In",Out:"Out",Bank:"Bank",Receipt:"Receipt",
    Report:"Report",Trend:"Trend",Pie:"Pie"};
  return <aside style={{width:252,minWidth:252,background:"var(--surface)",
    borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{padding:"20px 18px 14px",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:30,height:30,minWidth:30,borderRadius:10,background:"var(--primary)",
        display:"grid",placeItems:"center",color:"#fff"}}>
        <Ic.Boxes style={{fontSize:17}}/>
      </div>
      <span style={{fontFamily:"var(--font-sans)",fontWeight:800,fontSize:16,letterSpacing:"-.02em",color:"var(--foreground)"}}>
        Sapphire<span style={{color:"var(--primary)"}}>.</span>
      </span>
    </div>
    <nav style={{flex:1,overflow:"hidden",padding:"2px 12px"}}>
      {NAV_DATA.map(g=><div key={g.group} style={{marginBottom:16}}>
        <div style={{fontFamily:"var(--font-sans)",fontSize:10.5,fontWeight:700,color:"var(--faint-foreground)",
          textTransform:"uppercase",letterSpacing:".08em",padding:"0 10px 6px"}}>{g.group}</div>
        {g.items.map(it=>{const on=it.key===active;const Icon=Ic[it.icon]||Ic.Box;return(
          <div key={it.key} style={{position:"relative",display:"flex",alignItems:"center",gap:11,height:40,
            padding:"0 10px",borderRadius:12,marginBottom:2,
            background:on?"var(--primary-soft)":"transparent",
            color:on?"var(--primary)":"var(--muted-foreground)",
            fontFamily:"var(--font-sans)",fontWeight:on?700:500,fontSize:13.5}}>
            {on&&<span style={{position:"absolute",left:0,top:9,bottom:9,width:3,borderRadius:3,background:"var(--primary)"}}/>}
            <Icon style={{fontSize:18,opacity:on?1:.75}}/>{it.label}
          </div>);})}
      </div>)}
    </nav>
    <div style={{padding:12,borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:34,height:34,minWidth:34,borderRadius:999,background:"var(--primary-soft)",
        color:"var(--primary)",display:"grid",placeItems:"center",fontFamily:"var(--font-sans)",fontWeight:700,fontSize:13}}>IS</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:"var(--font-sans)",fontWeight:700,fontSize:13,color:"var(--foreground)"}}>Imran Sheikh</div>
        <div style={{fontFamily:"var(--font-sans)",fontSize:11,color:"var(--faint-foreground)"}}>Owner</div>
      </div>
    </div>
  </aside>;
}
function AppHeaderBar({title,subtitle,actions}) {
  const Ic=window.Ic;
  return <header style={{height:64,background:"var(--surface)",borderBottom:"1px solid var(--border)",
    display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",flexShrink:0}}>
    <div>
      <div style={{fontFamily:"var(--font-sans)",fontWeight:800,fontSize:20,color:"var(--foreground)",letterSpacing:"-.02em",lineHeight:1}}>{title}</div>
      {subtitle&&<div style={{fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--muted-foreground)",marginTop:2}}>{subtitle}</div>}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,height:38,width:190,padding:"0 12px",
        background:"var(--surface-alt)",border:"1px solid var(--border)",borderRadius:12}}>
        <Ic.Search style={{fontSize:15,color:"var(--faint-foreground)"}}/><span style={{fontFamily:"var(--font-sans)",fontSize:13,color:"var(--faint-foreground)"}}>Search…</span>
      </div>
      {actions}<Ic.Bell style={{fontSize:19,color:"var(--muted-foreground)"}}/>
    </div>
  </header>;
}
function AppFrame({active,title,subtitle,actions,children,w=1300,h=840}) {
  return <div style={{width:w,height:h,background:"var(--background)",fontFamily:"var(--font-sans)",
    color:"var(--foreground)",display:"flex",overflow:"hidden",fontSize:14}}>
    <AppSidebar active={active}/>
    <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <AppHeaderBar title={title} subtitle={subtitle} actions={actions}/>
      <div style={{flex:1,overflow:"hidden",padding:24}}>{children}</div>
    </div>
  </div>;
}

window.CanvasDS = {
  Money,Num,Delta,Card,Pill,Btn,Field,Inp,Sel,
  DataTable,PageHeader,KpiCard,SummaryBanner,EmptyState,SectionHead,
  Spark,AreaChart,Bars,Donut,MiniBar,
  AppSidebar,AppHeaderBar,AppFrame,
};
