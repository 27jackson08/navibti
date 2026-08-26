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
  await expect(page.getByText("Today's limits").or(page.getByText('Today’s limits'))).toBeVisible();

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
