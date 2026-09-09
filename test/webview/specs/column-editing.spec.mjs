import { expect, test } from '@playwright/test';

import { boardSource, openBoard, saveNow } from './helpers.mjs';

const configSource = (page) => page.evaluate(() => window.ledgerboardHarness.configSource());

test.describe('direct column header editing', () => {
  test('renames a column from the board with keyboard confirmation and persists both sources', async ({ page }) => {
    await openBoard(page);

    const title = page.getByRole('button', { name: 'Edit Inbox column name' });
    await expect(title.locator('.column-edit-cue')).toHaveText('✎');
    await title.focus();
    await page.keyboard.press('Enter');

    const editor = page.getByRole('textbox', { name: 'Edit Inbox column name' });
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue('Inbox');
    await expect(page.getByRole('button', { name: 'Save column name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel column name edit' })).toBeVisible();
    await expect(page.locator('.column-edit-shortcut')).toHaveText('Enter to save · Esc to cancel');
    await editor.fill('Capture');
    await page.keyboard.press('Enter');

    await expect(page.locator('.kanban-column[data-column="inbox"] h2')).toHaveText('Capture');
    await expect(page.locator('.kanban-column[data-column="inbox"] .kanban-card')).toHaveCount(2);
    await expect(page.locator('.view-tab[data-view="settings"]')).toBeVisible();
    await saveNow(page);

    expect(await boardSource(page)).toContain('## Capture <!-- ledgerboard-column:inbox -->');
    expect(await configSource(page)).toContain('"name": "Capture"');

    await page.evaluate(() => window.ledgerboardHarness.externalChange('KANBAN-CONFIG.md'));
    await expect(page.locator('.kanban-column[data-column="inbox"] h2')).toHaveText('Capture');
    await expect(page.locator('[data-card-id="AO-001"]')).toBeVisible();
  });

  test('confirms a mouse edit when focus leaves the field and keeps mobile labels in sync', async ({ page }) => {
    await openBoard(page);

    await page.getByRole('button', { name: 'Edit Doing column name' }).click();
    const editor = page.getByRole('textbox', { name: 'Edit Doing column name' });
    await editor.fill('In progress');
    await editor.blur();

    await expect(page.locator('.kanban-column[data-column="doing"] h2')).toHaveText('In progress');
    await expect(page.locator('.mobile-column-tab').filter({ hasText: 'In progress' })).toHaveCount(1);
    await expect(page.locator('.kanban-column[data-column="doing"] .kanban-card')).toHaveCount(1);
  });

  test('cancels without dirtying the board and recovers from an invalid name', async ({ page }) => {
    await openBoard(page);

    await page.getByRole('button', { name: 'Edit Inbox column name' }).click();
    let editor = page.getByRole('textbox', { name: 'Edit Inbox column name' });
    await editor.fill('Temporary');
    await page.keyboard.press('Escape');

    await expect(page.locator('.kanban-column[data-column="inbox"] h2')).toHaveText('Inbox');
    await expect(page.locator('#unsavedIndicator')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit Inbox column name' })).toBeFocused();

    await page.getByRole('button', { name: 'Edit Inbox column name' }).click();
    editor = page.getByRole('textbox', { name: 'Edit Inbox column name' });
    await editor.fill('Next');
    await page.keyboard.press('Enter');

    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#columnEditValidationMessage')).toContainText(
      'Column names must be unique without regard to case.',
    );
    await expect(page.locator('.toast[data-tone="error"]').last()).toContainText(
      'Column names must be unique without regard to case.',
    );
    await expect(editor).toHaveValue('Next');

    await editor.fill('Capture');
    await page.keyboard.press('Enter');
    await expect(page.locator('.kanban-column[data-column="inbox"] h2')).toHaveText('Capture');
  });
});
