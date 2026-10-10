import { test, expect } from '@playwright/test';

test('edit updates searchable text and corrects folder type, with cancel leaving data unchanged', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Details for Claude workspace'}).click();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Renamed Claude root');
  await page.getByLabel('Description',{exact:true}).fill('Orchestration home for the winter release.');
  await page.getByLabel('Tags',{exact:true}).fill('agents, winter');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('textbox',{name:'Search your space'}).fill('orchestration');
  await expect(page.getByRole('heading',{name:'Renamed Claude root',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Details for Renamed Claude root'}).click();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Must not save');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Renamed Claude root',exact:true}).last()).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading',{name:'Renamed Claude root',exact:true})).toBeVisible();
});

test('archive, trash, Undo and restore keep original items recoverable', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Details for SQLite documentation'}).click();
  await page.getByRole('button',{name:'Archive',exact:true}).click();
  await expect(page.getByRole('heading',{name:'SQLite documentation',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/^Archive/}).click();
  await expect(page.getByRole('heading',{name:'SQLite documentation',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Details for SQLite documentation'}).click();
  await page.getByRole('button',{name:'Remove item',exact:true}).click();
  await page.getByRole('alert').getByRole('button',{name:'Remove item',exact:true}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByRole('button',{name:/^All items/}).click();
  await page.getByRole('button',{name:'Details for SQLite documentation'}).click();
  await page.getByRole('button',{name:'Remove item',exact:true}).click();
  await page.getByRole('alert').getByRole('button',{name:'Remove item',exact:true}).click();
  await page.getByRole('button',{name:/^Trash/}).click();
  await page.getByRole('button',{name:'Details for SQLite documentation'}).click();
  await page.getByRole('button',{name:'Restore',exact:true}).click();
  await expect(page.getByRole('heading',{name:'SQLite documentation',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/^All items/}).click();
  await expect(page.getByRole('heading',{name:'SQLite documentation',exact:true})).toBeVisible();
});

test('saved filters persist across reload and command palette opens them by keyboard', async ({page}) => {
  await page.goto('/'); await page.getByRole('textbox',{name:'Search your space'}).fill('type:folder tag:ai');
  await expect(page.getByRole('heading',{name:'Claude workspace',exact:true})).toBeVisible();
  await expect(page.locator('.item-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Save search',exact:true}).click();
  await page.getByLabel('Search name').fill('Agent workspaces');
  await page.getByRole('dialog').getByRole('button',{name:'Save search',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('button',{name:'Delete saved search Agent workspaces'})).toBeVisible(); await page.keyboard.press('Control+Shift+P');
  await expect(page.getByRole('textbox',{name:'Find a command'})).toBeFocused();
  await page.getByRole('textbox',{name:'Find a command'}).fill('Agent workspaces'); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox',{name:'Search your space'})).toHaveValue('type:folder tag:ai');
  await expect(page.locator('.item-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Delete saved search Agent workspaces'}).click();
  await expect(page.getByRole('button',{name:'Delete saved search Agent workspaces'})).toHaveCount(0);
});

test('related suggestions show shared evidence and open the connected item', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Details for Brand & visual identity'}).click();
  const connected = page.locator('.related-items');
  await expect(connected).toContainText('Shared tag: #design');
  await page.screenshot({path:'test-results/related-items.png',animations:'disabled'});
  await connected.getByRole('button',{name:/Designing for the quiet moments/}).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label','Details for Designing for the quiet moments');
});
