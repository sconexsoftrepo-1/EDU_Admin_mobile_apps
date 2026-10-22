import { brandConfig } from "@/components/brand/config/brandConfig";
import TemplateCatalogue from "@/components/showcase/TemplateCatalogue";
export const metadata = {
  title: `Templates | ${brandConfig.wordmark}`,
  description:
    "Explore dental, ortho and child care, e-commerce, clinic, and portfolio website templates by K. Chaitanya.",
};
export default function Page() {
  return <TemplateCatalogue />;
}
