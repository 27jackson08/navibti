import { expect, test } from '@playwright/test';

/**
 * The critical flows. Two of these exist because getting them wrong is the
 * worst thing this product could do: generating guidance on a day when someone
 * needs an ambulance, and leaking a revoked link.
 */

test('a check-in produces a plan and a packet', async ({ page }) => {
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

test('a revoked share link stops working immediately', async ({ page }) => {
  await page.goto('/maya/sharing');

  await page.getByRole('button', { name: 'School' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill('E2E test link');
  await page.getByRole('button', { name: 'Create link' }).click();

  const link = page.getByRole('link', { name: /\/s\// }).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();

  await page.goto(href!);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('School accommodations');

  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'Revoke' }).first().click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('no longer active').first()).toBeVisible();

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
