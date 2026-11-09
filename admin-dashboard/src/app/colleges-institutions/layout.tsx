import "@/styles/colleges.css";
import SelectEnhancer from "@/components/colleges/SelectEnhancer";
import "@/styles/college-erp.css";
import "@/styles/college-operations.css";
import "@/styles/academic-calendar.css";
import "@/styles/college-timetable.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SelectEnhancer />
    </>
  );
}
