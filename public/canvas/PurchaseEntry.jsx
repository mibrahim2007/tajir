/* Canvas App — Purchase Entry form */
function EntryFormCanvas({kind, onConfirm, onCancel, onNavigate}) {
  const {AppFrame,Card,Btn,Field,Inp,Sel,SummaryBanner,Num,Pill} = window.CanvasDS;
  const D=window.D, Ic=window.Ic, isP=kind==="purchase";
  const lines=isP?D.purchaseLines:D.saleLines;
  const amt=l=>l.qty*l.rate*(1-l.disc/100);
  const subtotal=lines.reduce((s,l)=>s+l.qty*l.rate,0);
  const disc=lines.reduce((s,l)=>s+l.qty*l.rate*l.disc/100,0);
  const net=subtotal-disc, tax=Math.round(net*0.17), total=net+tax;

  return (
    <AppFrame active={isP?"purchase":"sale"}
      title={isP?"New Purchase":"New Sale"}
      subtitle={`${D.company} · Draft · ${isP?"PO-2419":"INV-7783"}`}
      onNavigate={onNavigate}
      actions={<><Pill tone="neutral">Draft</Pill><Btn variant="ghost" sm>Cancel</Btn></>}
      h={884}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 310px",gap:20,height:"100%"}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:18,boxShadow:"var(--shadow)",padding:20}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
              <Field label={isP?"Supplier":"Customer"}><Sel value={isP?D.suppliers[0]:D.customers[0]}/></Field>
              <Field label={isP?"PO Number":"Invoice No."}><Inp value={isP?"PO-2419":"INV-7783"} mono/></Field>
              <Field label="Date"><Inp value="20 Jun 2026"/></Field>
              <Field label={isP?"Receive At":"Dispatch From"}><Sel value={D.warehouses[0]}/></Field>
            </div>
            <div style={{fontFamily:"var(--font-sans)",fontSize:11.5,fontWeight:700,color:"var(--muted-foreground)",
              textTransform:"uppercase",letterSpacing:".05em",marginBottom:10}}>Line Items</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--border))"}}>
                {["Item","Qty","Unit","Rate","Disc%","Amount",""].map((h,i)=>(
                  <th key={i} style={{textAlign:i>=1&&i<=5?"right":"left",padding:"0 10px 8px",
                    fontFamily:"var(--font-sans)",fontSize:11,fontWeight:700,color:"var(--muted-foreground)",
                    textTransform:"uppercase",letterSpacing:".04em",width:h===""?32:undefined}}>{h}</th>))}
              </tr></thead>
              <tbody>{lines.map((l,i)=>(
                <tr key={i} style={{borderBottom:"1px solid var(--border-soft)"}}>
                  <td style={{padding:"5px 10px 5px 0"}}>
                    <div style={{height:36,display:"flex",alignItems:"center",gap:8,background:"var(--surface-alt)",
                      border:"1px solid var(--border)",borderRadius:10,padding:"0 10px"}}>
                      <Ic.Box style={{fontSize:14,color:"var(--primary)"}}/><span style={{fontFamily:"var(--font-sans)",fontSize:13}}>{l.item}</span>
                    </div>
                  </td>
                  <td style={{padding:"5px 6px",textAlign:"right"}}><Num color="var(--foreground)">{l.qty.toLocaleString("en-IN")}</Num></td>
                  <td style={{padding:"5px 6px"}}><span style={{fontFamily:"var(--font-sans)",fontSize:12.5,color:"var(--muted-foreground)"}}>{l.unit}</span></td>
                  <td style={{padding:"5px 6px",textAlign:"right"}}><Num color="var(--foreground)">{l.rate.toLocaleString("en-IN")}</Num></td>
                  <td style={{padding:"5px 6px",textAlign:"right"}}><Num color="var(--muted-foreground)">{l.disc}%</Num></td>
                  <td style={{padding:"5px 6px",textAlign:"right"}}><Num weight={700} color="var(--foreground)">{window.money(amt(l))}</Num></td>
                  <td style={{padding:"5px 0",textAlign:"center"}}><Ic.Trash style={{fontSize:15,color:"var(--faint-foreground)"}}/></td>
                </tr>))}</tbody>
            </table>
            <div style={{marginTop:10}}><Btn variant="outline" sm icon="Plus">Add Line</Btn></div>
          </div>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:18,boxShadow:"var(--shadow)",padding:20}}>
            <Field label="Notes">
              <div style={{minHeight:52,background:"var(--surface-alt)",border:"1px solid var(--border)",
                borderRadius:12,padding:"10px 12px",fontFamily:"var(--font-sans)",fontSize:13,color:"var(--faint-foreground)"}}>
                {isP?"Delivery within 10 days. Inspect on arrival.":"Free delivery. Balance due in 30 days."}
              </div>
            </Field>
          </div>
        </div>
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:18,boxShadow:"var(--shadow)",
          padding:20,display:"flex",flexDirection:"column",alignSelf:"start"}}>
          <div style={{fontFamily:"var(--font-sans)",fontWeight:800,fontSize:16,marginBottom:16,letterSpacing:"-.01em"}}>
            {isP?"Purchase Summary":"Sale Summary"}</div>
          {[["Items ("+lines.length+")",window.money(subtotal),false],
            ["Discount","− "+window.money(disc),false,"var(--neg)"],
            ["Net Amount",window.money(net),false],
            ["GST (17%)",window.money(tax),true]].map(([l,v,m,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
              <span style={{fontFamily:"var(--font-sans)",fontSize:13,color:m?"var(--muted-foreground)":"var(--foreground)"}}>{l}</span>
              <Num weight={600} color={c||"var(--foreground)"}>{v}</Num>
            </div>))}
          <div style={{height:1,background:"var(--border)",margin:"12px 0"}}/>
          <SummaryBanner tone={isP?"info":"profit"} label="Total" value={window.money(total)} size="lg"/>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:18}}>
            <Btn variant={isP?"solid":"accent"} icon="Check">{isP?"Confirm Purchase":"Confirm Sale"}</Btn>
            <Btn variant="outline">Save as Draft</Btn>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
window.EntryFormCanvas = EntryFormCanvas;
window.CanvasScreens = window.CanvasScreens||{};
window.CanvasScreens.PurchaseEntry = (props)=><EntryFormCanvas kind="purchase" {...props}/>;
