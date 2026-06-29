/* Canvas App — Stock Reports */
function StockReports() {
  const {AppFrame,Card,Btn,DataTable,Pill,Num} = window.CanvasDS;
  const D=window.D, Ic=window.Ic;
  const rows=D.stock.map(s=>({...s,available:s.onHand-s.reserved,
    status:s.onHand===0?"Out":s.onHand-s.reserved<=s.reorder?"Low":"In Stock"}));
  const totalValue=rows.reduce((s,r)=>s+r.value,0);
  const lowOut=rows.filter(r=>r.status!=="In Stock").length;
  const reserved=rows.reduce((s,r)=>s+r.reserved,0);
  const cols=[
    {label:"SKU",render:r=><Num color="var(--muted-foreground)" size={12}>{r.sku}</Num>,width:120},
    {label:"Item",key:"name",strong:true},
    {label:"Category",render:r=><span style={{fontFamily:"var(--font-sans)",fontSize:12,color:"var(--muted-foreground)"}}>{r.cat}</span>},
    {label:"Warehouse",render:r=><span style={{fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--muted-foreground)"}}>{r.wh}</span>},
    {label:"On Hand",align:"right",mono:true,render:r=>r.onHand.toLocaleString("en-IN")},
    {label:"Reserved",align:"right",mono:true,color:()=>"var(--muted-foreground)",render:r=>r.reserved.toLocaleString("en-IN")},
    {label:"Available",align:"right",mono:true,strong:true,
      color:r=>r.status==="In Stock"?"var(--foreground)":"var(--neg)",render:r=>r.available.toLocaleString("en-IN")},
    {label:"Value (PKR)",align:"right",mono:true,strong:true,render:r=>r.value?window.money(r.value):"—"},
    {label:"Status",align:"right",render:r=><Pill>{r.status}</Pill>},
  ];
  return (
    <AppFrame active="stockrep" title="Stock Report" subtitle={`${rows.length} SKUs · 20 Jun 2026`}
      actions={<><Btn variant="outline" icon="Print">Print</Btn><Btn variant="outline" icon="Export">Export Excel</Btn></>}>
      <div style={{display:"flex",flexDirection:"column",gap:16,height:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          {[[`${window.shortRs(totalValue)}`,"Total Stock Value","var(--foreground)"],
            [String(rows.length),"SKUs Tracked","var(--foreground)"],
            [String(lowOut),"Low / Out","var(--neg)"],
            [reserved.toLocaleString("en-IN"),"Reserved Units","var(--warn)"]
          ].map(([v,l,c])=>(
            <div key={l} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:18,boxShadow:"var(--shadow)",padding:"13px 16px"}}>
              <div style={{fontFamily:"var(--font-sans)",fontSize:11.5,fontWeight:700,color:"var(--muted-foreground)",textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
              <div style={{marginTop:8,fontFamily:"var(--font-num)",fontWeight:800,fontSize:22,color:c,fontVariantNumeric:"tabular-nums",letterSpacing:"-.01em"}}>{v}</div>
            </div>))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,height:36,width:210,padding:"0 12px",
            background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12}}>
            <Ic.Search style={{fontSize:15,color:"var(--faint-foreground)"}}/><span style={{fontFamily:"var(--font-sans)",fontSize:13,color:"var(--faint-foreground)"}}>Search SKU or item…</span>
          </div>
          {["Warehouse","Category","Status"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:8,height:36,padding:"0 12px",
              background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12}}>
              <span style={{fontFamily:"var(--font-sans)",fontSize:11.5,fontWeight:700,color:"var(--faint-foreground)",textTransform:"uppercase",letterSpacing:".03em"}}>{f}</span>
              <span style={{fontFamily:"var(--font-sans)",fontSize:13,color:"var(--foreground)"}}>All</span>
              <Ic.Down style={{fontSize:14,color:"var(--faint-foreground)"}}/>
            </div>))}
          <div style={{marginLeft:"auto"}}><Btn variant="ghost" sm icon="Filter">More filters</Btn></div>
        </div>
        <Card style={{padding:20,flex:1,display:"flex",flexDirection:"column"}}>
          <DataTable cols={cols} rows={rows} dense/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,
            paddingTop:12,borderTop:"1px solid var(--border)"}}>
            <span style={{fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--muted-foreground)"}}>Showing {rows.length} of {rows.length} items</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:"var(--font-sans)",fontSize:13,fontWeight:700,color:"var(--muted-foreground)"}}>Total Value</span>
              <span style={{fontFamily:"var(--font-num)",fontWeight:800,fontSize:17,color:"var(--foreground)",fontVariantNumeric:"tabular-nums"}}>{window.money(totalValue)}</span>
            </div>
          </div>
        </Card>
      </div>
    </AppFrame>
  );
}
window.CanvasScreens = window.CanvasScreens||{};
window.CanvasScreens.StockReports = StockReports;
