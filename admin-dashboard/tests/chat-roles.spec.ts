import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");

async function setup(page: Page, group = false) {
  let label = "Accounts Manager";
  const person = () => ({ code: "OTHER", name: "Asha Rao", role: "staff", role_label: label, detail: label });
  const thread = () => ({ code: "T", kind: group ? "group" : "direct", title: group ? "College team" : "Asha Rao",
    subtitle: group ? "College staff" : label, role: group ? "group" : "staff", role_label: group ? "" : label,
    members: 2, can_post: true, last_message: "Hello", last_sender: "", last_mine: false, unread: 0,
    last_at: "2026-11-20T06:00:00Z", people: [person()] });
  await page.route("**/api/college/**", (route) => {
    const path = new URL(route.request().url()).pathname.split("/api/college/")[1];
    if (path === "auth/me") return route.fulfill({ json: {
      account: { code: "ME", login_id: "tester", role_codes: ["A"], clients: ["admin-web"], person_type: "employee", person_code: "E", workspace_scope: "college", login_code: "L" },
      roles: [{ code: "A", name: "Accounts Manager", scope: "college", permissions: { payments: ["view"], student_fee_charges: ["view"], reports: ["view"] } }],
    } });
    if (path === "dashboard/overview") return route.fulfill({ json: { viewer: { name: "Tester", roles: ["Accounts Manager"] }, academic_session: "2026-27", today: "2026-11-20", sections: {} } });
    if (path === "chat/unread") return route.fulfill({ json: { unread: 0 } });
    if (path === "chat/conversations") return route.fulfill({ json: { items: [thread()], unread: 0, can_create_groups: false } });
    if (path === "chat/conversations/T") return route.fulfill({ json: thread() });
    if (path === "chat/conversations/T/messages") return route.fulfill({ json: { items: [{ code: "M", body: "Hello", kind: "text", sent_at: "2026-11-20T06:00:00Z", mine: false, sender_code: "OTHER", sender_name: "Asha Rao", sender_role: "staff", sender_role_label: label, attachment: null }], has_more: false } });
    if (path === "chat/conversations/T/read") return route.fulfill({ json: {} });
    if (path === "chat/directory") return route.fulfill({ json: { items: [person()], everyone: true, side: "admin" } });
    return route.fulfill({ status: 503, json: { detail: "Not needed by chat test" } });
  });
  await page.goto(`${origin}/portal/accounts/dashboard`);
  await page.getByRole("button", { name: "Chats", exact: true }).click();
  await page.locator('.chat-list [role="listitem"]').first().click();
  return (value: string) => { label = value; };
}

test("open chat and directory show assigned roles and refresh changed roles without losing drafts", async ({ page }) => {
  const changeRole = await setup(page);
  const heading = page.locator(".chat-thread-title small");
  await expect(heading).toHaveText("Accounts Manager");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Unsent draft");
  changeRole("HR Manager");
  await expect(heading).toHaveText("HR Manager", { timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue("Unsent draft");
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.locator(".chat-contact-role")).toHaveText("HR Manager");
  await expect(page.getByRole("dialog", { name: "New chat", exact: true })).not.toContainText("Administration");
});

test("mobile group members and sender labels show their assigned roles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const changeRole = await setup(page, true);
  await expect(page.locator(".chat-sender-role")).toHaveText("Accounts Manager");
  changeRole("Certificate Officer");
  await page.locator(".chat-thread-title").click();
  await expect(page.locator(".chat-person-role")).toHaveText("Certificate Officer");
  expect(await page.locator(".chat-window").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
