/* Rich shared data for an SCM + Finance ERP. Building-materials wholesaler.
   Currency PKR (Rs), Indian/Pakistani grouping. English UI. window.D + helpers. */
window.money = (n) => "Rs " + Math.round(n).toLocaleString("en-IN");
window.short = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + "Cr";
  if (a >= 1e5) return (n / 1e5).toFixed(2).replace(/\.?0+$/, "") + "L";
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
};
window.shortRs = (n) => "Rs " + window.short(n);

window.D = {
  company: "Sapphire Distribution",
  user: { name: "Imran Sheikh", role: "Owner", initials: "IS" },
  period: "June 2026",

  months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  revenue:   [4.2, 3.8, 4.6, 5.1, 4.9, 5.6, 5.2, 5.0, 6.1, 6.6, 7.0, 7.64].map((x) => x * 1e6),
  purchases: [3.0, 2.9, 3.4, 3.7, 3.6, 4.0, 3.8, 3.7, 4.4, 4.7, 4.9, 5.23].map((x) => x * 1e6),

  kpis: [
    { key: "rev",   label: "Revenue (MTD)",     value: 7640000,  delta: 12.4, up: true,  spark: [4.9, 5.6, 5.2, 5.0, 6.1, 6.6, 7.0, 7.64] },
    { key: "gp",    label: "Gross Profit",       value: 2410000,  delta: 18.2, up: true,  spark: [1.4, 1.6, 1.5, 1.5, 1.9, 2.0, 2.2, 2.41] },
    { key: "pur",   label: "Purchases (MTD)",    value: 5230000,  delta: 8.1,  up: true,  spark: [3.6, 4.0, 3.8, 3.7, 4.4, 4.7, 4.9, 5.23] },
    { key: "recv",  label: "Receivables",        value: 12410000, delta: -3.1, up: false, spark: [13.6, 13.1, 12.9, 13.2, 12.8, 12.7, 12.6, 12.41] },
    { key: "pay",   label: "Payables",           value: 7860000,  delta: 4.6,  up: false, spark: [6.9, 7.1, 7.0, 7.3, 7.4, 7.6, 7.7, 7.86] },
    { key: "stock", label: "Stock Value",        value: 48620000, delta: 3.2,  up: true,  spark: [44, 45, 45.5, 46, 47, 47.5, 48, 48.62] },
  ],

  // recent transactions for dashboard
  txns: [
    { date: "14 Jun", type: "Sale",     party: "Meezan Builders",    ref: "INV-7782", amount: 1840000, status: "Paid" },
    { date: "14 Jun", type: "Purchase", party: "Lucky Cement Ltd.",  ref: "PO-2418",  amount: 1840000, status: "Received" },
    { date: "13 Jun", type: "Sale",     party: "DHA Developments",   ref: "INV-7779", amount: 2460000, status: "Overdue" },
    { date: "12 Jun", type: "Payment",  party: "Indus Steel Works",  ref: "PAY-553",  amount: 920000,  status: "Done" },
    { date: "11 Jun", type: "Sale",     party: "Bahria Town Const.", ref: "INV-7771", amount: 980000,  status: "Partial" },
    { date: "10 Jun", type: "Receipt",  party: "Saif Group",         ref: "RCP-318",  amount: 640000,  status: "Done" },
  ],

  categories: [
    { name: "Cement",  value: 38 },
    { name: "Steel",   value: 29 },
    { name: "Paint",   value: 14 },
    { name: "Pipes",   value: 11 },
    { name: "Wiring",  value: 8 },
  ],
  byWarehouse: [
    { name: "Karachi DC",       value: 52 },
    { name: "Lahore Hub",       value: 31 },
    { name: "Faisalabad Depot", value: 17 },
  ],
  topProducts: [
    { name: "OPC Cement 50kg",       qty: "12,400 bags", revenue: 17980000, margin: 14 },
    { name: "Rebar 12mm Grade 60",   qty: "640 ton",     revenue: 19072000, margin: 9 },
    { name: "Porcelain Tile 60×60",  qty: "8,200 box",   revenue: 9840000,  margin: 22 },
    { name: "Concrete Admixture",    qty: "1,120 drum",  revenue: 4480000,  margin: 31 },
    { name: "PVC Pipe 110mm",        qty: "5,300 pc",    revenue: 2862000,  margin: 18 },
  ],

  // entry-form line items
  purchaseLines: [
    { item: "OPC Cement 50kg",     qty: 2000, unit: "bag", rate: 1450, disc: 2 },
    { item: "Rebar 12mm Grade 60", qty: 40,   unit: "ton", rate: 298000, disc: 0 },
    { item: "Concrete Admixture 25L", qty: 60, unit: "drum", rate: 3800, disc: 5 },
  ],
  saleLines: [
    { item: "OPC Cement 50kg",     qty: 850,  unit: "bag", rate: 1620, disc: 0 },
    { item: "Porcelain Tile 60×60", qty: 320, unit: "box", rate: 2950, disc: 3 },
    { item: "PVC Pipe 110mm",      qty: 400,  unit: "pc",  rate: 690,  disc: 0 },
  ],
  suppliers: ["Lucky Cement Ltd.", "Indus Steel Works", "Pak Polymers (Pvt)", "Sitara Chemicals", "Karachi Packaging Co."],
  customers: ["Meezan Builders", "DHA Developments", "Bahria Town Const.", "Habib Construction", "Saif Group"],
  warehouses: ["Karachi DC", "Lahore Hub", "Faisalabad Depot"],

  stock: [
    { sku: "CEM-OPC-50",  name: "OPC Cement 50kg",        cat: "Cement", wh: "Karachi DC",       onHand: 4200,  reserved: 600,  reorder: 1000, cost: 1450,   value: 6090000 },
    { sku: "STL-RB-12",   name: "Rebar 12mm · Grade 60",  cat: "Steel",  wh: "Karachi DC",       onHand: 180,   reserved: 120,  reorder: 200,  cost: 298000, value: 53640000 },
    { sku: "STL-RB-16",   name: "Rebar 16mm · Grade 60",  cat: "Steel",  wh: "Lahore Hub",       onHand: 96,    reserved: 84,   reorder: 150,  cost: 312000, value: 29952000 },
    { sku: "TIL-PRC-60",  name: "Porcelain Tile 60×60",   cat: "Tiles",  wh: "Faisalabad Depot", onHand: 1240,  reserved: 1180, reorder: 600,  cost: 2400,   value: 2976000 },
    { sku: "CHM-ADM-25",  name: "Concrete Admixture 25L", cat: "Chem.",  wh: "Lahore Hub",       onHand: 540,   reserved: 90,   reorder: 200,  cost: 3800,   value: 2052000 },
    { sku: "PLY-PVC-110", name: "PVC Pipe 110mm",         cat: "Pipes",  wh: "Faisalabad Depot", onHand: 0,     reserved: 0,    reorder: 300,  cost: 540,    value: 0 },
    { sku: "PKG-BAG-LD",  name: "LD Woven Bag",           cat: "Packg.", wh: "Karachi DC",       onHand: 28000, reserved: 4000, reorder: 8000, cost: 40,     value: 1120000 },
    { sku: "WIR-CU-25",   name: "Copper Wire 2.5mm",      cat: "Wiring", wh: "Karachi DC",       onHand: 320,   reserved: 60,   reorder: 120,  cost: 870,    value: 278400 },
  ],

  // navigation modules for the Menu Style screen + app frame
  nav: [
    { group: "Overview", items: [
      { key: "dashboard", label: "Dashboard", icon: "Grid" },
      { key: "analysis",  label: "Analysis",  icon: "Pulse" },
    ]},
    { group: "Trading", items: [
      { key: "purchase",  label: "Purchases", icon: "Truck" },
      { key: "sale",      label: "Sales",     icon: "Bag" },
      { key: "returns",   label: "Returns",   icon: "Swap" },
    ]},
    { group: "Inventory", items: [
      { key: "stock",     label: "Stock",      icon: "Box" },
      { key: "warehouse", label: "Warehouses", icon: "Ware" },
      { key: "transfer",  label: "Transfers",  icon: "Boxes" },
    ]},
    { group: "Finance", items: [
      { key: "recv",      label: "Receivables", icon: "In" },
      { key: "pay",       label: "Payables",    icon: "Out" },
      { key: "ledger",    label: "Ledger",      icon: "Bank" },
      { key: "expense",   label: "Expenses",    icon: "Receipt" },
    ]},
    { group: "Reports", items: [
      { key: "stockrep",  label: "Stock Report", icon: "Report" },
      { key: "pl",        label: "Profit & Loss", icon: "Trend" },
      { key: "aging",     label: "Aging",        icon: "Pie" },
    ]},
  ],
};
