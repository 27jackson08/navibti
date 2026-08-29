# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey.spec.ts >> a red flag stops everything and produces no plan
- Location: e2e/journey.spec.ts:53:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/daniel\/today$/
Received string:  "http://localhost:3000/daniel/check-in"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    6 × locator resolved to <html lang="en" class="newsreader_1a0c5739-module__WLb2MW__variable public_sans_cae0568e-module__J1VP-q__variable ibm_plex_mono_b91845a2-module__RX8zca__variable h-full">…</html>
      - unexpected value "http://localhost:3000/daniel/check-in"

```

```yaml
- text: Reading comfort
- group "Screen brightness":
  - text: Screen brightness
  - button "Calm"
  - button "Dim"
  - button "Night"
- group "Text size":
  - text: Text size
  - button "A" [pressed]
  - button "A"
  - button "A"
- main:
  - navigation:
    - link "← Back to today":
      - /url: /daniel/today
    - text: About a minute
  - heading "Stop and get medical care now" [level=2]
  - paragraph: Stop and get urgent medical care now. Do not wait to see if it improves, and do not drive yourself. If symptoms are severe or worsening quickly, call emergency services.
  - list:
    - listitem: Severe or increasing headache
  - paragraph: No plan will be generated today. NaviTBI does not give guidance on a day when a red-flag symptom is reported.
  - button "Record this and continue"
  - button "I selected that by mistake"
  - paragraph: Not medical advice. If symptoms are severe or getting worse, seek medical care rather than completing this check-in.
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * The audience picker on the sharing form.
  5   |  *
  6   |  * Scoped to its fieldset rather than addressed at page level. Playwright matches
  7   |  * an accessible name by substring, so once a link exists whose default label is
  8   |  * "school link", a bare `getByRole('button', { name: 'School' })` also matches
  9   |  * "Revoke the link: school link" — an ambiguity that appears only after another
  10  |  * test has created a link, which is the worst kind to debug.
  11  |  */
  12  | function audience(page: Page, role: 'School' | 'Employer' | 'Caregiver' | 'Clinician') {
  13  |   return page.getByRole('group', { name: 'Who is this for' }).getByRole('button', { name: role });
  14  | }
  15  | 
  16  | /**
  17  |  * The critical flows. Two of these exist because getting them wrong is the
  18  |  * worst thing this product could do: generating guidance on a day when someone
  19  |  * needs an ambulance, and leaking a revoked link.
  20  |  */
  21  | 
  22  | test('a check-in produces a plan and a packet', async ({ page }) => {
  23  |   await page.goto('/act/amara');
  24  |   await page.goto('/amara/check-in');
  25  | 
  26  |   await page.getByRole('button', { name: 'None of these' }).click();
  27  | 
  28  |   await page.getByRole('button', { name: '3', exact: true }).click();
  29  |   await page.getByRole('button', { name: 'Next' }).click();
  30  | 
  31  |   await page.getByRole('button', { name: '6', exact: true }).click();
  32  |   await page.getByRole('button', { name: 'Next' }).click();
  33  | 
  34  |   await page.getByRole('button', { name: /Under an hour/ }).click();
  35  |   await page.getByRole('button', { name: 'Next' }).click();
  36  | 
  37  |   await page.getByRole('button', { name: /A bit short/ }).click();
  38  |   await page.getByRole('button', { name: 'Next' }).click();
  39  | 
  40  |   for (const choice of [/An hour or so/, /A little/, /A proper walk/, /Fairly calm/]) {
  41  |     await page.getByRole('button', { name: choice }).first().click();
  42  |     await page.getByRole('button', { name: /Next|Finish/ }).click();
  43  |   }
  44  | 
  45  |   await expect(page).toHaveURL(/\/amara\/today$/);
  46  |   await expect(page.getByRole('heading', { level: 1 })).toContainText('Today’s plan');
  47  |   await expect(page.getByRole('heading', { name: 'Today’s limits' })).toBeVisible();
  48  | 
  49  |   await page.getByRole('link', { name: /Open packet/ }).first().click();
  50  |   await expect(page.getByRole('heading', { level: 1 })).toContainText('for Amara');
  51  | });
  52  | 
  53  | test('a red flag stops everything and produces no plan', async ({ page }) => {
  54  |   await page.goto('/act/daniel');
  55  |   await page.goto('/daniel/check-in');
  56  |   await page.getByRole('button', { name: 'Severe or increasing headache' }).click();
  57  | 
  58  |   await expect(page.getByRole('heading', { level: 2 })).toContainText('get medical care now');
  59  |   await expect(page.getByText(/No plan will be generated today/)).toBeVisible();
  60  | 
  61  |   await page.getByRole('button', { name: /Record this and continue/ }).click();
> 62  |   await expect(page).toHaveURL(/\/daniel\/today$/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  63  | 
  64  |   await expect(page.getByText(/Stop — seek urgent care/i)).toBeVisible();
  65  |   await expect(page.getByText(/No plan has been generated/)).toBeVisible();
  66  |   await expect(page.getByText('Today’s limits')).toHaveCount(0);
  67  | });
  68  | 
  69  | test('every page carries the not-medical-advice framing', async ({ page }) => {
  70  |   const paths = [
  71  |     '/',
  72  |     '/maya/today',
  73  |     '/maya/check-in',
  74  |     '/maya/packet/school',
  75  |     '/maya/packet/caregiver',
  76  |     '/daniel/clinician',
  77  |   ];
  78  | 
  79  |   for (const path of paths) {
  80  |     await page.goto(path);
  81  |     await expect(page.getByText(/not (a )?(medical advice|clinical decision tool)/i).first(), path).toBeVisible();
  82  |   }
  83  | });
  84  | 
  85  | test('the caregiver packet carries the red-flag list', async ({ page }) => {
  86  |   await page.goto('/maya/packet/caregiver');
  87  |   await expect(page.getByRole('heading', { name: /Get medical help immediately/ })).toBeVisible();
  88  |   await expect(page.getByText('Seizure or convulsion')).toBeVisible();
  89  |   await expect(page.getByText('Visible deformity of the skull')).toBeVisible();
  90  | });
  91  | 
  92  | test('a revoked share link stops working immediately', async ({ page }, testInfo) => {
  93  |   // The demo store is server state shared by every browser project, so this
  94  |   // test has to own its row rather than reach for "the first Revoke button" —
  95  |   // which in a parallel run belongs to whichever project got there first.
  96  |   const label = `revoke check ${testInfo.project.name} ${testInfo.repeatEachIndex}`;
  97  | 
  98  |   await page.goto('/act/maya');
  99  |   await page.goto('/maya/sharing');
  100 |   await audience(page, 'School').click();
  101 |   await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  102 |   await page.getByRole('button', { name: 'Create link' }).click();
  103 | 
  104 |   const row = page.locator('li').filter({ hasText: label });
  105 |   await expect(row).toBeVisible();
  106 | 
  107 |   const href = await row.getByRole('link').first().getAttribute('href');
  108 |   expect(href).toBeTruthy();
  109 | 
  110 |   await page.goto(href!);
  111 |   await expect(page.getByRole('heading', { level: 1 })).toContainText('School accommodations');
  112 | 
  113 |   await page.goto('/maya/sharing');
  114 |   const sameRow = page.locator('li').filter({ hasText: label });
  115 |   await sameRow.getByRole('button', { name: /^Revoke the link/ }).click();
  116 |   await sameRow.getByRole('button', { name: /^Confirm revoking/ }).click();
  117 |   await expect(sameRow.getByText('no longer active')).toBeVisible();
  118 | 
  119 |   const response = await page.goto(href!);
  120 |   expect(response?.status()).toBe(404);
  121 | });
  122 | 
  123 | test('a school link never carries raw symptom scores', async ({ page }) => {
  124 |   await page.goto('/maya/sharing');
  125 |   await audience(page, 'School').click();
  126 | 
  127 |   const checkbox = page.getByRole('checkbox');
  128 |   await expect(checkbox).toBeDisabled();
  129 |   await expect(page.getByText(/Not available for a school link/)).toBeVisible();
  130 | });
  131 | 
  132 | test('a session cannot change a patient it is not acting as', async ({ page }, testInfo) => {
  133 |   // The hole this closes: before the acting-as gate, the share action checked
  134 |   // only that the target patient existed, so a request could mint a link for
  135 |   // somebody whose record the caller had never opened.
  136 |   await page.goto('/act/maya');
  137 | 
  138 |   await page.goto('/daniel/sharing');
  139 | 
  140 |   // Labelled per project. Counting Daniel's links globally would be measuring
  141 |   // the other browser projects too — they share one server and one in-memory
  142 |   // store, and they are creating links for Daniel at the same moment.
  143 |   const label = `cross-patient attempt ${testInfo.project.name}`;
  144 | 
  145 |   await audience(page, 'Employer').click();
  146 |   await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  147 |   await page.getByRole('button', { name: 'Create link' }).click();
  148 | 
  149 |   // Scoped to our own paragraph: Next injects an empty role="alert" route
  150 |   // announcer into every page, so getByRole('alert') alone matches two things.
  151 |   await expect(page.locator('p[role="alert"]')).toContainText('Open Daniel');
  152 | 
  153 |   await page.reload();
  154 |   await expect(page.locator('li').filter({ hasText: label })).toHaveCount(0);
  155 | });
  156 | 
  157 | test('acting as the right patient still works', async ({ page }, testInfo) => {
  158 |   await page.goto('/act/daniel');
  159 |   await page.goto('/daniel/sharing');
  160 | 
  161 |   const label = `same-patient control ${testInfo.project.name}`;
  162 |   await audience(page, 'Employer').click();
```