/* Canvas App — Dashboard screen */
function Dashboard({onNavigate}) {
  const {AppFrame,Card,KpiCard,SectionHead,Btn,DataTable,Pill,Num,AreaChart,Donut} = window.CanvasDS;
  const D=window.D, Ic=window.Ic;
  const kpis=D.kpis.filter(k=>["rev","gp","recv","stock"].includes(k.key));
  const txnCols=[
    {label:"Date",key:"date",color:()=>"var(--muted-foreground)"},
    {label:"Type",render:r=><span style={{fontWeight:700,color:r.type==="Sale"?"var(--pos)":r.type==="Purchase"?"var(--primary)":"var(--muted-foreground)"}}>{r.type}</span>},
    {label:"Party",key:"party",strong:true},
    {label:"Reference",render:r=><Num color="var(--muted-foreground)">{r.ref}</Num>},
    {label:"Amount",align:"right",mono:true,strong:true,render:r=>window.money(r.amount)},
    {label:"Status",align:"right",render:r=><Pill>{r.status}</Pill>},
  ];
  return (
    <AppFrame active="dashboard" title="Dashboard" subtitle={`${D.company} · ${D.period}`}
      onNavigate={onNavigate}
      actions={<><Btn variant="outline" icon="Calendar">{D.period}</Btn><Btn icon="Plus">New Entry</Btn></>}>
      <div style={{display:"flex",flexDirection:"column",gap:20,height:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {kpis.map(k=><Card key={k.key}><KpiCard label={k.label} value={window.shortRs(k.value)} delta={k.delta} up={k.up} spark={k.spark}/></Card>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1.7fr 1fr",gap:16}}>
          <Card style={{padding:20}}>
            <SectionHead title="Revenue vs Purchases" sub="Last 12 months (PKR)"
              right={<div style={{display:"flex",gap:14}}>
                {[["#0d9488","Revenue",false],["var(--faint-foreground)","Purchases",true]].map(([c,l,d])=>
                  <span key={l} style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"var(--font-sans)",fontSize:12,color:"var(--muted-foreground)"}}>
                    <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={c} strokeWidth="2.5" strokeDasharray={d?"4 3":"0"} strokeLinecap="round"/></svg>{l}
                  </span>)}
              </div>}/>
            <AreaChart months={D.months} w={640} h={236}
              series={[{data:D.revenue,color:"#0d9488",fill:true},{data:D.purchases,color:"var(--faint-foreground)",dash:"5 4"}]}/>
          </Card>
          <Card style={{padding:20}}>
            <SectionHead title="Stock by Warehouse"/>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <Donut data={D.byWarehouse} size={150} thickness={24}/>
              <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
                {D.byWarehouse.map((s,i)=>{const cs=["#0d9488","#ea8c2a","#14b8a6"];return(
                  <div key={s.name} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:10,height:10,borderRadius:3,background:cs[i],flexShrink:0}}/>
                    <span style={{fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--muted-foreground)",flex:1}}>{s.name}</span>
                    <Num weight={700}>{s.value}%</Num>
                  </div>);})}
              </div>
            </div>
          </Card>
        </div>
        <Card style={{padding:20,flex:1}}>
          <SectionHead title="Recent Transactions" sub="Sales, purchases & payments"
            right={<Btn variant="ghost" sm>View all <Ic.Right style={{fontSize:14}}/></Btn>}/>
          <DataTable cols={txnCols} rows={D.txns} dense/>
        </Card>
      </div>
    </AppFrame>
  );
}
window.CanvasScreens = window.CanvasScreens||{};
window.CanvasScreens.Dashboard = Dashboard;
