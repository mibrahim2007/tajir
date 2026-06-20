/* Canvas App — routing shell */
const VIEWS = [
  {key:"dashboard",   label:"Dashboard",    comp:"Dashboard"},
  {key:"menu",        label:"Menu Style",   comp:"MenuStyle"},
  {key:"purchase",    label:"Purchase",     comp:"PurchaseEntry"},
  {key:"sale",        label:"Sales",        comp:"SaleEntry"},
  {key:"analysis",    label:"Analysis",     comp:"Analysis"},
  {key:"stockrep",    label:"Stock Report", comp:"StockReports"},
];

function CanvasApp() {
  const [view, setView] = React.useState("dashboard");
  const [toast, setToast] = React.useState(null);
  const go = (v) => setView(v);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const current = VIEWS.find(v => v.key === view) || VIEWS[0];
  const Comp = window.CanvasScreens[current.comp];

  return (
    <div style={{minHeight:"100vh",background:"var(--background)"}}>
      {Comp && <Comp
        onNavigate={go}
        onConfirm={() => { showToast("Confirmed · record saved"); go("dashboard"); }}
        onCancel={() => go("dashboard")} />}
      {toast && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          background:"var(--primary)",color:"#fff",fontFamily:"var(--font-sans)",
          fontSize:14,fontWeight:600,padding:"12px 20px",borderRadius:12,
          boxShadow:"var(--shadow-lg)",zIndex:50}}>{toast}</div>
      )}
    </div>
  );
}
window.CanvasApp = CanvasApp;
