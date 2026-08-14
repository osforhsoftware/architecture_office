import { SIDEBAR_COLLAPSED_KEY, SIDEBAR_INIT_STYLE_ID } from "@/lib/sidebar-storage"

export function SidebarCollapseScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var c=localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_KEY)})==='true';if(!c)return;var s=document.createElement('style');s.id=${JSON.stringify(SIDEBAR_INIT_STYLE_ID)};s.textContent='@media (min-width:768px){[data-dashboard-sidebar]{width:72px!important;min-width:72px!important;flex-shrink:0}}';(document.head||document.documentElement).appendChild(s)}catch(e){}})();`,
      }}
    />
  )
}
