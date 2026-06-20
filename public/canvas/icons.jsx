/* Lucide icons (MIT), no fill, round caps. window.Ic. Stroke 1.75 reads well
   at desktop UI sizes. */
const mk = (children, sw = 1.75) => (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...props}>
    {children}
  </svg>
);
window.Ic = {
  Grid:   mk(<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>),
  Pulse:  mk(<><path d="M3 12h4l3 8 4-16 3 8h4"/></>),
  Cart:   mk(<><circle cx="8" cy="21" r="1.4"/><circle cx="18" cy="21" r="1.4"/><path d="M2 3h2.4l2.2 12.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 7H5.1"/></>),
  Truck:  mk(<><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></>),
  Bag:    mk(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></>),
  Box:    mk(<><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>),
  Boxes:  mk(<><path d="M3 8 12 3l9 5v8l-9 5-9-5Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v9"/></>),
  Ware:   mk(<><path d="M22 8.3V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.3a2 2 0 0 1 1.3-1.8l8-3.2a2 2 0 0 1 1.4 0l8 3.2A2 2 0 0 1 22 8.3Z"/><path d="M6 14h12M6 18h12"/><rect x="6" y="10" width="12" height="12"/></>),
  Swap:   mk(<><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></>),
  Sliders:mk(<><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></>),
  In:     mk(<><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>),
  Out:    mk(<><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>),
  Wallet: mk(<><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v3"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/><path d="M18 12a2 2 0 0 0 0 4h3v-4Z"/></>),
  Bank:   mk(<><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></>),
  Receipt:mk(<><path d="M4 2v20l2.5-1.5L9 22l3-1.5L15 22l2.5-1.5L20 22V2l-2.5 1.5L15 2l-3 1.5L9 2 6.5 3.5Z"/><path d="M8 8h8M8 12h8M8 16h5"/></>),
  Doc:    mk(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6"/></>),
  Report: mk(<><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/></>),
  Pie:    mk(<><path d="M21 12A9 9 0 1 1 11 3v9Z"/><path d="M21.2 9A9 9 0 0 0 15 2.8V9Z"/></>),
  Users:  mk(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  Gear:   mk(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></>),
  Search: mk(<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>),
  Bell:   mk(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>),
  Plus:   mk(<><path d="M5 12h14M12 5v14"/></>),
  Down:   mk(<><path d="m6 9 6 6 6-6"/></>),
  Right:  mk(<><path d="m9 18 6-6-6-6"/></>),
  Up:     mk(<><path d="m18 15-6-6-6 6"/></>),
  Trend:  mk(<><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></>),
  Calendar: mk(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></>),
  Filter: mk(<><polygon points="22 3 2 3 10 12 10 19 14 21 14 12 22 3"/></>),
  Export: mk(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>),
  Print:  mk(<><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>),
  Trash:  mk(<><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
  Alert:  mk(<><path d="m10.3 4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>),
  Dot:    mk(<><circle cx="12" cy="12" r="3"/></>),
  Logout: mk(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>),
  Check:  mk(<><path d="M20 6 9 17l-5-5"/></>),
  Store:  mk(<><path d="M4 9.5 5.2 4.5A1 1 0 0 1 6.2 4h11.6a1 1 0 0 1 1 .5L20 9.5"/><path d="M4 9.5h16v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-4 0Z"/><path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></>),
  Menu:   mk(<><path d="M3 6h18M3 12h18M3 18h18"/></>),
};
