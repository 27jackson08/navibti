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
  await sameRow.getByRole('button', { name: /^Revoke the link/ }).click();
  await sameRow.getByRole('button', { name: /^Confirm revoking/ }).click();
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
  await expect(page.locator('main').getByText(/Receipt confirmed/)).toBeVisible();

  const item = page.locator('li').filter({ hasText: 'No back-to-back meetings' });
  await item.getByRole('button', { name: /We can.{1,3}t do this/ }).click();
  await item.getByRole('button', { name: 'We do not have the staff to cover it' }).click();

  await expect(page.locator('main').getByText(/aren.{1,3}t possible/)).toBeVisible();

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

  // Now revoke the link, which is what actually happens: links last days and a
  // term lasts months. The manager's own undo goes through their token, so from
  // here it is unreachable — and the report is still holding the plan down.
  await page.goto('/tom/sharing');
  const shareRow = page.locator('li').filter({ hasText: label });
  await shareRow.getByRole('button', { name: /^Revoke the link/ }).click();
  await shareRow.getByRole('button', { name: /^Confirm revoking/ }).click();
  await expect(shareRow.getByText('no longer active')).toBeVisible();

  const dead = await page.goto(href!);
  expect(dead?.status()).toBe(404);

  // The patient can still withdraw it, because it is their plan.
  await page.goto('/tom/today');
  await page
    .locator('li')
    .filter({ hasText: 'No back-to-back meetings' })
    .getByRole('button', { name: /This is available again/ })
    .click();

  await expect(page.getByText('Reported unavailable', { exact: true })).toBeHidden();

  const restored = await page
    .locator('article')
    .filter({ hasText: 'Thinking and concentration' })
    .locator('.tabular-nums')
    .first()
    .textContent();

  expect(Number(restored)).toBe(Number(before));
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

test('the check-in offers to read itself aloud, and does not start unbidden', async ({ page }) => {
  await page.goto('/act/amara');
  await page.goto('/amara/check-in');

  // Speech has to be asked for. Starting unbidden is its own assault on someone
  // with a headache.
  const spoken = await page.evaluate(() => window.speechSynthesis?.speaking ?? false);
  expect(spoken).toBe(false);

  const toggle = page.getByRole('button', { name: 'Read questions aloud' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(page.getByRole('button', { name: /Reading aloud/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // And the choice survives leaving the page.
  await page.goto('/amara/check-in');
  await expect(page.getByRole('button', { name: /Reading aloud/ })).toBeVisible();
});

test('packets can be printed', async ({ page }) => {
  await page.goto('/act/maya');
  await page.goto('/maya/packet/school');
  await expect(page.getByRole('button', { name: /Print or save as PDF/ })).toBeVisible();
});

test('an adult is not told about classrooms', async ({ page }) => {
  await page.goto('/act/tom');
  await page.goto('/tom/today');

  await expect(page.getByText('Returning to work')).toBeVisible();
  await expect(page.getByText('Return to School / Learn')).toHaveCount(0);

  // The guideline text is still shown verbatim, with the mapping marked as ours.
  await expect(page.getByText(/mapping is ours, not the guideline/)).toBeVisible();

  // And a student still sees the ladder named for them.
  await page.goto('/act/maya');
  await page.goto('/maya/today');
  await expect(page.getByText('Returning to school')).toBeVisible();
});

test('a clinician can set a hard limit, and it overrides the plan', async ({ page }, testInfo) => {
  const label = `caps ${testInfo.project.name}`;

  await page.goto('/act/tom');
  await page.goto('/tom/today');
  const before = await page
    .locator('article')
    .filter({ hasText: 'Physical activity' })
    .locator('.tabular-nums')
    .first()
    .textContent();
  expect(Number(before)).toBeGreaterThan(10);

  await page.goto('/tom/sharing');
  await page.getByRole('button', { name: 'Clinician' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  const href = await page
    .locator('li')
    .filter({ hasText: label })
    .getByRole('link')
    .first()
    .getAttribute('href');

  await page.goto(href!);

  // Tom is on return-to-learn, which needs no clearance at any step — so he is
  // not offered one.
  await expect(page.getByRole('heading', { name: /Record a clearance decision/ })).toHaveCount(0);
  await expect(page.getByText(/needs no medical clearance at any step/)).toBeVisible();

  const row = page.locator('li').filter({ hasText: 'Physical activity' });
  await row.getByRole('button', { name: '10 min', exact: true }).click();
  await page.getByRole('button', { name: 'Record these limits' }).click();

  await page.goto('/tom/today');
  const after = await page
    .locator('article')
    .filter({ hasText: 'Physical activity' })
    .locator('.tabular-nums')
    .first()
    .textContent();

  expect(Number(after)).toBe(10);
  await expect(
    page.locator('article').filter({ hasText: 'Physical activity' }).getByText(/Set directly by a clinician/),
  ).toBeVisible();
});

test('the response carries a real content security policy', async ({ page }) => {
  // Asserting the middleware file exists would prove nothing: 'strict-dynamic'
  // breaks Next outright if the nonce is not propagated to its own hydration
  // scripts, and the page would render blank while every unit test stayed
  // green. So this reads the served headers and the served HTML.
  const response = await page.goto('/maya/today');
  const headers = response!.headers();

  const csp = headers['content-security-policy'];
  expect(csp, 'no CSP header').toBeTruthy();
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("'unsafe-inline'; script-src");
  expect(csp, 'production must not allow eval').not.toContain("'unsafe-eval'");

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['strict-transport-security']).toContain('max-age=');

  // The nonce in the policy has to be the one the document actually used, or
  // the browser drops every script and the page is dead.
  //
  // Read from the raw body, not the DOM: browsers deliberately hide the nonce
  // attribute from getAttribute and from selectors so that a CSS-based
  // injection cannot read it back out. A `script[nonce="..."]` locator matches
  // nothing even when the attribute was served.
  const nonce = /'nonce-([a-zA-Z0-9]+)'/.exec(csp)?.[1];
  expect(nonce, 'CSP names no nonce').toBeTruthy();
  expect(await response!.text(), 'no script carries the nonce the CSP names').toContain(
    `nonce="${nonce}"`,
  );

  // And the page is alive, which is the thing a broken policy would take away.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a share URL never travels in a Referer header', async ({ page }) => {
  // The token in the path is the entire access control for that document.
  const response = await page.goto('/s/not-a-real-token');
  expect(response!.headers()['referrer-policy']).toBe('no-referrer');
});

test('a change made by a control is announced, and focus survives it', async ({ page }, testInfo) => {
  // Both of these are invisible to axe, which scans a static snapshot. The
  // whole packet re-renders on the server after a response, so the control the
  // user just pressed stops existing — focus lands on <body> and a screen
  // reader user is told nothing at all about what their click did.
  //
  // Lives with the journeys rather than the a11y suite because it mutates the
  // shared store, and that suite runs three times over one server.
  //
  // Maya, not Daniel: the red-flag journey records a red flag against Daniel,
  // and the store carries red flags forward on purpose, so from that point on
  // he has no packet at all and there is nothing here to acknowledge. Not Tom
  // either — the response-loop test owns him. Whatever this one flags, it
  // unflags before it finishes.
  const label = `announce check ${testInfo.project.name}`;

  await page.goto('/act/maya');
  await page.goto('/maya/sharing');
  await page.getByRole('button', { name: 'Caregiver' }).click();
  await page.getByPlaceholder('Ms Okafor, Year 11 tutor').fill(label);
  await page.getByRole('button', { name: 'Create link' }).click();

  const status = page.locator('[role="status"]');
  await expect(status, 'nothing announced the new link').toContainText(/link created/i);

  const href = await page
    .locator('li')
    .filter({ hasText: label })
    .getByRole('link')
    .first()
    .getAttribute('href');

  await page.goto(href!);
  await page.getByRole('button', { name: /Confirm we.{1,3}ve received this/ }).click();
  await expect(status, 'nothing announced the receipt').toContainText(/receipt confirmed/i);

  // Addressed by position, not by a filter on the control itself: that button
  // replaces itself with the reason panel on click, so a locator defined as
  // "the item that has one" stops matching the item it just acted on and
  // quietly slides to the next accommodation.
  const flagButtons = page.getByRole('button', { name: /^We can.{1,3}t do this/ });
  const itemText = (await flagButtons.first().getAttribute('aria-label'))!.replace(
    /^We can.{1,3}t do this: /,
    '',
  );

  await flagButtons.first().click();
  // Only one panel is ever open, so this is unambiguous at page scope.
  await page.getByRole('button', { name: 'We do not have the staff to cover it' }).click();

  await expect(status, 'nothing announced the report').toContainText(/reported as not possible/i);

  // Not merely "not body": focus must be on the confirmation itself, which is
  // the only thing still on the page describing what just happened.
  const landed = await page.evaluate(() => document.activeElement?.getAttribute('role') ?? 'none');
  expect(landed, 'focus fell off the page after the item re-rendered').toBe('status');

  // And it clears when the user moves on, rather than sitting over the page
  // for the rest of the session.
  await page.locator('h1').first().click();
  await expect(status).toBeHidden();

  // It also does not follow them to the next page. The region lives in the root
  // layout, so a client-side navigation does not unmount it — "reported as not
  // possible" would otherwise still be sitting over a page where nothing was.
  await page.getByRole('button', { name: /^We can.{1,3}t do this/ }).first().click();
  await page.getByRole('button', { name: 'The timetable cannot change this term' }).click();
  await expect(status).toBeVisible();

  await page.goto('/maya/today');
  await expect(status).toBeHidden();
  await page.goBack();

  // No template placeholder survives to the page. Reading the library entry
  // straight for this echo-back put "{{hours}}" in front of a recipient, in the
  // one document the whole slot machinery exists to keep clean.
  expect(await page.locator('body').innerText()).not.toContain('{{');

  // Each undo names the item it restores, which is how they are told apart.
  await expect(
    page.getByRole('button', { name: `Actually, we can: ${itemText}` }),
  ).toBeVisible();

  // Put Maya back, so the next test sees the plan this one found. Two items
  // were flagged by now, and the list shrinks under the loop as each is undone.
  const undo = page.getByRole('button', { name: /^Actually, we can:/ });
  for (let remaining = await undo.count(); remaining > 0; remaining--) {
    await undo.first().click();
    await expect(undo).toHaveCount(remaining - 1);
  }
  await expect(page.locator('main').getByText(/aren.{1,3}t possible/)).toBeHidden();
});

test('every clinical output says where it comes from', async ({ page }) => {
  // "Citations on every output" is one of four things this project does not
  // cut, and the clinician summary had cut it — the one document read by the
  // audience most likely to want to check a threshold. Asserted on the rendered
  // page, because that is where the claim is made.
  for (const path of ['/maya/packet/school', '/maya/packet/caregiver', '/maya/clinician']) {
    await page.goto(path);

    const sources = page.getByRole('heading', { name: 'Where this comes from' });
    await expect(sources, `${path} cites nothing`).toBeVisible();

    const listed = page.locator('footer ol li');
    expect(await listed.count(), `${path} has an empty source list`).toBeGreaterThan(0);
    await expect(listed.first()).toContainText(/\d{4}/);
  }
});

test('a packet prints as a letter, not as a screenshot of an app', async ({ page }) => {
  // A school packet exists to be printed and filed. The print stylesheet said
  // it stripped "the app furniture" and stripped only the palette — every
  // printed letter carried the reading-comfort toolbar across the top.
  await page.goto('/maya/packet/school');
  await page.emulateMedia({ media: 'print' });

  await expect(page.getByText('Reading comfort')).toBeHidden();
  await expect(page.getByRole('button', { name: /^Print/ })).toBeHidden();
  await expect(page.getByRole('link', { name: /Back to today/ })).toBeHidden();

  // The document itself survives, including what makes it a document.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Where this comes from' })).toBeVisible();

  // Tinted panels go white on paper, so nothing depends on a colour a school
  // printer will not reproduce. Resolved to rendered pixels rather than to the
  // token string: the browser normalises #ffffff to #fff, and comparing the
  // declared text would have failed on a correct page.
  const painted = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const read = (tone: string) => {
      probe.style.background = `var(--nv-${tone})`;
      return getComputedStyle(probe).backgroundColor;
    };
    const values = ['caution-surface', 'critical-surface', 'steady-surface', 'ground'].map(read);
    probe.remove();
    return values;
  });
  for (const value of painted) expect(value).toBe('rgb(255, 255, 255)');
});
