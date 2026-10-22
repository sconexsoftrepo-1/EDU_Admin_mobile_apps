import "@/styles/colleges.css";
import "@/styles/college-collection.css";
import "@/styles/college-erp.css";
import "@/styles/college-operations.css";
import "@/styles/college-mobile.css";
import "@/styles/college-timetable.css";
import "@/styles/college-skyline.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{document.documentElement.dataset.skylineTheme=localStorage.getItem('kc-skyline-appearance')||'system'}catch(e){document.documentElement.dataset.skylineTheme='system'}})()`,
        }}
      />
      {children}
    </>
  );
}
