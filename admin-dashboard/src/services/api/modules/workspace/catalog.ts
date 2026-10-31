/**
 * Every workspace screen with the tables it shows — a copy of the backend contract
 * backend/app/contracts/screens.json (a backend test fails when the two differ; copy the file
 * again after changing screens). The sidebar is built from this list and the signed-in role's
 * permissions, so it appears without waiting for the backend.
 */
import catalog from "./screens.json";
import type { ScreenSummary } from "./consts";

const hiddenTransportScreens = new Set([
  "transport",
  "buses",
  "routes",
  "route-stops",
  "drivers",
  "driver-allocation",
  "student-allocation",
  "faculty-allocation",
  "bus-seating",
  "trips",
  "manifest",
  "transport-attendance",
  "vehicle-maintenance",
  "fuel",
  "transport-reports",
  "module-transport",
]);
export const SCREEN_CATALOG: ScreenSummary[] = catalog.filter(
  (screen) => !hiddenTransportScreens.has(screen.key),
);
