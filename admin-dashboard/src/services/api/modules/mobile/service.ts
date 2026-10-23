/** Personal portal endpoints (backend: app/modules/mobile/workspace). */
import { apiRequest } from "../../client";
import type {
  PersonalActionPayload,
  PersonalActionResult,
  PersonalScreenData,
  PersonalScreensResponse,
} from "./consts";

export const MOBILE_ENDPOINTS = {
  screens: "mobile/workspace/screens",
  screen: (screen: string) => `mobile/workspace/${encodeURIComponent(screen)}`,
  action: (screen: string, action: string) =>
    `mobile/workspace/${encodeURIComponent(screen)}/actions/${encodeURIComponent(action)}`,
} as const;

export class MobileWorkspaceService {
  screens() {
    return apiRequest<PersonalScreensResponse>(MOBILE_ENDPOINTS.screens);
  }

  /** Screen data; parents pass the child's student code. */
  screen(screen: string, studentCode?: string) {
    return apiRequest<PersonalScreenData>(MOBILE_ENDPOINTS.screen(screen), {
      query: { student_code: studentCode },
    });
  }

  runAction(screen: string, action: string, payload: PersonalActionPayload) {
    return apiRequest<PersonalActionResult>(
      MOBILE_ENDPOINTS.action(screen, action),
      {
        method: "POST",
        body: payload,
      },
    );
  }
}

export const mobileWorkspaceService = new MobileWorkspaceService();
