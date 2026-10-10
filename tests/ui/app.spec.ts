import { test, expect } from '@playwright/test';

test('search retrieves the Claude root folder by its description and shows its path', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Your space.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search your space' }).fill('claude root folder');
  await expect(page.getByRole('heading', { name: 'Claude workspace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details for Claude workspace' }).click();
  await expect(page.getByRole('dialog')).toContainText('C:\\Projects\\Claude');
  await page.screenshot({ path: 'test-results/search-detail.png', animations: 'disabled' });
});
test('capture succeeds, persists, and is found from the control panel', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /Add to space/ }).click();
  await page.getByRole('textbox', { name: 'Link or folder path' }).fill('C:\\Projects\\MyAgents');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Root folder for my experimental agent orchestration.');
  await page.getByRole('textbox', { name: 'Tags (optional)' }).fill('agents, development');
  await page.screenshot({ path: 'test-results/capture.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByRole('heading', { name: 'A little less to remember.' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('textbox', { name: 'Search your space' }).fill('orchestration');
  await expect(page.getByRole('heading', { name: 'MyAgents' })).toBeVisible();
  await expect(page.locator('.card-tags').getByRole('button', { name: 'agents', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('textbox', { name: 'Search your space' }).fill('orchestration');
  await expect(page.getByRole('heading', { name: 'MyAgents' })).toBeVisible();
});
test('favorites and deletion work, including explicit removal confirmation', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Favorite SQLite documentation', exact: true }).click();
  await page.getByRole('button', { name: /^Favorites/ }).click();
  await expect(page.getByRole('heading', { name: 'SQLite documentation' })).toBeVisible();
  await page.getByRole('button', { name: 'Details for SQLite documentation' }).click();
  await page.getByRole('button', { name: 'Remove item', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('original link or file is untouched');
  await page.getByRole('alert').getByRole('button', { name: 'Remove item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SQLite documentation' })).toHaveCount(0);
});
test('settings switches providers and saves configurable model preferences', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: /Ollama A model/ }).click();
  await page.getByLabel('Chat model').fill('qwen3:8b');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'New captures' })).toBeVisible();
  await page.getByRole('tab', { name: 'Your data' }).click();
  await expect(page.getByText('API keys are never included.', { exact: false })).toBeVisible();
});
test('library layout and empty search state remain usable', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Claude workspace', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/library.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: 'Search your space' }).fill('zzzxxyynothing');
  await expect(page.getByRole('heading', { name: 'Not here. Yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(page.getByRole('heading', { name: 'Claude workspace', exact: true })).toBeVisible();
});
