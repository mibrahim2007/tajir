/* Canvas App — Analysis Dashboard */
function Analysis() {
  const {AppFrame,Card,KpiCard,SectionHead,Btn,DataTable,Num,AreaChart,Bars,Donut,MiniBar} = window.CanvasDS;
  const D=window.D, Ic=window.Ic;
  const metrics=[
    {label:"Revenue (MTD)",value:window.shortRs(7640000),delta:12.4,up:true},
    {label:"Gross Margin",value:"31.6%",delta:1.8,up:true},
    {label:"Avg Order Value",value:window.shortRs(184000),delta:5.2,up:true},
    {label:"Sell-through",value:"78%",delta:4.0,up:true},
  ];
  const prodCols=[
    {label:"Product",key:"name",strong:true},
    {label:"Qty Sold",render:r=><Num color="var(--muted-foreground)">{r.qty}</Num>},
    {label:"Revenue",align:"right",mono:true,strong:true,render:r=>window.money(r.revenue)},
    {label:"Margin",align:"right",width:130,render:r=>(
      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
        <div style={{width:52}}><MiniBar value={r.margin} max={35}/></div>
        <Num weight={700}>{r.margin}%</Num>
      </div>)},
  ];
  return (
    <AppFrame active="analysis" title="Analysis" subtitle="Performance & trends"
      actions={<><Btn variant="outline" icon="Calendar">FY 2025–26</Btn><Btn variant="outline" icon="Export">Export</Btn></>}
      h={864}>
      <div style={{display:"flex",flexDirection:"column",gap:16,height:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {metrics.map(m=><Card key={m.label}><KpiCard label={m.label} value={m.value} delta={m.delta} up={m.up}/></Card>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1.7fr 1fr",gap:16}}>
          <Card style={{padding:20}}>
            <SectionHead title="Sales Trend" sub="Revenue vs purchases — 12 months"/>
            <AreaChart months={D.months} w={640} h={220}
              series={[{data:D.revenue,color:"#0d9488",fill:true},{data:D.purchases,color:"var(--faint-foreground)",dash:"5 4"}]}/>
          </Card>
          <Card style={{padding:20}}>
            <SectionHead title="Sales by Category"/>
            <Bars data={D.categories} w={300} h={196} horizontal/>
          </Card>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1.7fr 1fr",gap:16,flex:1}}>
          <Card style={{padding:20}}>
            <SectionHead title="Top Products" sub="By revenue contribution"
              right={<Btn variant="ghost" sm>View all <Ic.Right style={{fontSize:14}}/></Btn>}/>
            <DataTable cols={prodCols} rows={D.topProducts} dense/>
          </Card>
          <Card style={{padding:20}}>
            <SectionHead title="Revenue Mix"/>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <Donut data={D.categories} size={148} thickness={22}/>
              <div style={{display:"flex",flexDirection:"column",gap:9,flex:1}}>
                {D.categories.map((s,i)=>{const cs=["#0d9488","#ea8c2a","#14b8a6","#f59e0b","#ccfbf1"];return(
                  <div key={s.name} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:10,height:10,borderRadius:3,background:cs[i],flexShrink:0}}/>
                    <span style={{fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--muted-foreground)",flex:1}}>{s.name}</span>
                    <Num weight={700}>{s.value}%</Num>
                  </div>);})}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
}
window.CanvasScreens = window.CanvasScreens||{};
window.CanvasScreens.Analysis = Analysis;
