import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**','node_modules/**','public/**']),
  { files:['src/components/animation-system/**','src/components/brand/CosmicScene.tsx','src/components/brand-animations/**'], rules:{
    // A mutable GSAP/R3F clock deliberately coordinates imperative rendering without React frame updates.
    'react-hooks/immutability':'off',
    'react-hooks/refs':'off',
    'react-hooks/set-state-in-effect':'off',
  }},
]);
