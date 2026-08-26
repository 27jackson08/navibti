import { expect, test } from '@playwright/test';

/**
 * The critical flows. Two of these exist because getting them wrong is the
 * worst thing this product could do: generating guidance on a day when someone
 * needs an ambulance, and leaking a revoked link.
 */

test('a check-in produces a plan and a packet', async ({ page }) => {
  await page.goto('/act/amara');
  await page.goto('/amara/check-in');

  await page.getByRole('button', { name: 'None of these' }).click();

  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: '6', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: /Under an hour/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: /A bit short/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  for (const choice of [/An hour or so/, /A little/, /A proper walk/, /Fairly calm/]) {
    await page.getByRole('button', { name: choice }).first().click();
    await page.getByRole('button', { name: /Next|Finish/ }).click();
  }

  await expect(page).toHaveURL(/\/amara\/today$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Today’s plan');
  await expect(page.getByRole('heading', { name: 'Today’s limits' })).toBeVisible();

  await page.getByRole('link', { name: /Open packet/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('for Amara');
});

test('a red flag stops everything and produces no plan', async ({ page }) => {
  await page.goto('/act/daniel');
  await page.goto('/daniel/check-in');
  await page.getByRole('button', { name: 'Severe or increasing headache' }).click();

  await expect(page.getByRole('heading', { level: 2 })).toContainText('get medical care now');
  await expect(page.getByText(/No plan will be generated today/)).toBeVisible();

  await page.getByRole('button', { name: /Record this and continue/ }).click();
  await expect(page).toHaveURL(/\/daniel\/today$/);

  await expect(page.getByText(/Stop — seek urgent care/i)).toBeVisible();
  await expect(page.getByText(/No plan has been generated/)).toBeVisible();
  await expect(page.getByText('Today’s limits')).toHaveCount(0);
});

test('every page carries the not-medical-advice framing', async ({ page }) => {
  const paths = [
    '/',
    '/maya/today',
    '/maya/check-in',
    '/maya/packet/school',
    '/maya/packet/caregiver',
    '/daniel/clinician',
  ];

  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByText(/not (a )?(medical advice|clinical decision tool)/i).first(), path).toBeVisible();
  }
});

test('the caregiver packet carries the red-flag list', async ({ page }) => {
  await page.goto('/maya/packet/caregiver');
  await expect(page.getByRole('heading', { name: /Get medical help immediately/ })).toBeVisible();
  await expect(page.getByText('Seizure or convulsion')).toBeVisible();
  await expect(page.getByText('Visible deformity of the skull')).toBeVisible();
});

test('a revoked share link stops working immediately', async ({ page }, testInfo) => {
  // The demo store is server state shared by every browser project, so this
  // test has to own its row rather than reach for "the first Revoke button" —
  // which in a parallel run belongs to whichever project got there first.
  const label = `revoke check ${testInfo.project.name} ${testInfo.repeatEachIndex}`;

  await page.goto('/act/maya');
  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'School' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  const row = page.locator('li').filter({ hasText: label });
  await expect(row).toBeVisible();

  const href = await row.getByRole('link').first().getAttribute('href');
  expect(href).toBeTruthy();

  await page.goto(href!);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('School accommodations');

  await page.goto('/maya/sharing');
  const sameRow = page.locator('li').filter({ hasText: label });
  await sameRow.getByRole('button', { name: 'Revoke' }).click();
  await sameRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(sameRow.getByText('no longer active')).toBeVisible();

  const response = await page.goto(href!);
  expect(response?.status()).toBe(404);
});

test('a school link never carries raw symptom scores', async ({ page }) => {
  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'School' }).click();

  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).toBeDisabled();
  await expect(page.getByText(/Not available for a school link/)).toBeVisible();
});

test('a session cannot change a patient it is not acting as', async ({ page }, testInfo) => {
  // The hole this closes: before the acting-as gate, the share action checked
  // only that the target patient existed, so a request could mint a link for
  // somebody whose record the caller had never opened.
  await page.goto('/act/maya');

  await page.goto('/daniel/sharing');

  // Labelled per project. Counting Daniel's links globally would be measuring
  // the other browser projects too — they share one server and one in-memory
  // store, and they are creating links for Daniel at the same moment.
  const label = `cross-patient attempt ${testInfo.project.name}`;

  await page.getByRole('button', { name: 'Employer' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  // Scoped to our own paragraph: Next injects an empty role="alert" route
  // announcer into every page, so getByRole('alert') alone matches two things.
  await expect(page.locator('p[role="alert"]')).toContainText('Open Daniel');

  await page.reload();
  await expect(page.locator('li').filter({ hasText: label })).toHaveCount(0);
});

test('acting as the right patient still works', async ({ page }, testInfo) => {
  await page.goto('/act/daniel');
  await page.goto('/daniel/sharing');

  const label = `same-patient control ${testInfo.project.name}`;
  await page.getByRole('button', { name: 'Employer' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  await expect(page.locator('li').filter({ hasText: label })).toBeVisible();
  await expect(page.locator('p[role="alert"]')).toHaveCount(0);
});

test('a recipient can answer, and the plan changes', async ({ page }, testInfo) => {
  // The coordinator half of the claim, end to end: the workplace says it cannot
  // do something, and the patient's limits move.
  const label = `response loop ${testInfo.project.name}`;

  await page.goto('/act/tom');
  await page.goto('/tom/sharing');
  await page.getByRole('button', { name: 'Employer' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  const row = page.locator('li').filter({ hasText: label });
  const href = await row.getByRole('link').first().getAttribute('href');
  expect(href).toBeTruthy();

  // What the plan says before anyone answers.
  await page.goto('/tom/today');
  const before = await page
    .locator('article')
    .filter({ hasText: 'Thinking and concentration' })
    .locator('.tabular-nums')
    .first()
    .textContent();

  // The manager opens the link and reports one adjustment as impossible.
  await page.goto(href!);
  await page.getByRole('button', { name: /Confirm we.{1,3}ve received this/ }).click();
  await expect(page.getByText(/Receipt confirmed/)).toBeVisible();

  const item = page.locator('li').filter({ hasText: 'No back-to-back meetings' });
  await item.getByRole('button', { name: /We can.{1,3}t do this/ }).click();
  await item.getByRole('button', { name: 'We do not have the staff to cover it' }).click();

  await expect(page.getByText(/aren.{1,3}t possible/)).toBeVisible();

  // And the patient's plan has moved.
  await page.goto('/tom/today');
  await expect(page.getByText('Reported unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText(/limits have been lowered/)).toBeVisible();

  const after = await page
    .locator('article')
    .filter({ hasText: 'Thinking and concentration' })
    .locator('.tabular-nums')
    .first()
    .textContent();

  expect(Number(after)).toBeLessThan(Number(before));
});

test('a recipient cannot flag an item from someone else’s packet', async ({ page }, testInfo) => {
  const label = `scope check ${testInfo.project.name}`;

  await page.goto('/act/maya');
  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'Caregiver' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  const href = await page
    .locator('li')
    .filter({ hasText: label })
    .getByRole('link')
    .first()
    .getAttribute('href');

  await page.goto(href!);
  // A caregiver packet contains no school accommodations, so none of the school
  // controls should be reachable from here.
  await expect(page.locator('li').filter({ hasText: 'Permit sunglasses' })).toHaveCount(0);
});

test('only a clinician link can record clearance', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;

  // An employer link is not a route to unlocking contact sport.
  await page.goto('/act/maya');
  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'School' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(`school link ${suffix}`);
  await page.getByRole('button', { name: 'Create link' }).click();

  const schoolHref = await page
    .locator('li')
    .filter({ hasText: `school link ${suffix}` })
    .getByRole('link')
    .first()
    .getAttribute('href');

  await page.goto(schoolHref!);
  await expect(page.getByRole('heading', { name: /Record a clearance decision/ })).toHaveCount(0);

  // A clinician link is.
  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'Clinician' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(`clinic link ${suffix}`);
  await page.getByRole('button', { name: 'Create link' }).click();

  const clinicHref = await page
    .locator('li')
    .filter({ hasText: `clinic link ${suffix}` })
    .getByRole('link')
    .first()
    .getAttribute('href');

  await page.goto(clinicHref!);
  await expect(page.getByRole('heading', { name: /Record a clearance decision/ })).toBeVisible();

  await page.getByPlaceholder('Dr Amara Reyes').fill(`Dr Reyes ${suffix}`);
  await page.getByRole('button', { name: /Step 4/ }).click();
  await page.getByRole('button', { name: 'Record clearance' }).click();

  await expect(page.getByText(/Currently cleared up to step 4/)).toBeVisible();
  await expect(page.getByText(`recorded by Dr Reyes ${suffix}`)).toBeVisible();
});

test('the mechanism page explains every domain and cites it', async ({ page }) => {
  await page.goto('/how-it-works');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('budget');

  for (const domain of [
    'Thinking and concentration',
    'Screens, motion and busy spaces',
    'Physical activity',
    'Sleep and fatigue',
    'Stress, noise and social load',
  ]) {
    await expect(page.getByRole('heading', { name: domain })).toBeVisible();
  }

  // The gaps are stated rather than left implied.
  await expect(page.getByRole('heading', { name: /What this does not track/ })).toBeVisible();
  await expect(page.getByText(/Giza CC, Hovda DA/)).toBeVisible();
  await expect(page.getByText(/Lumba-Brown A/)).toBeVisible();

  // Describes a resemblance, never assigns a subtype.
  // Present on every domain, which is the point — assert at least one.
  await expect(page.getByText(/does not assign anyone a subtype/).first()).toBeVisible();
});

test('a patient can see whether they are getting better', async ({ page }) => {
  await page.goto('/act/tom');
  await page.goto('/tom/today');

  await page.getByRole('link', { name: /Progress/ }).click();
  await expect(page).toHaveURL(/\/tom\/history$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('recovery so far');

  // Each domain gets its own chart, because they are on different units.
  await expect(page.getByRole('img', { name: /Thinking and concentration/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Screens, motion/ })).toBeVisible();

  // And the page is honest that a fall is not necessarily a setback.
  await expect(page.getByText(/not that recovery has reversed/)).toBeVisible();
});
