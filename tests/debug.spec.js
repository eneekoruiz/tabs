import { test, expect } from '@playwright/test';

test('Debug Blackbird lyrics', async ({ page }) => {
  await page.goto('/');
  const heroSearch = page.locator('#exploreSearchInput');
  await expect(heroSearch).toBeVisible();

  await heroSearch.fill('Blackbird');
  const songCard = page.locator('.song-card', { hasText: /Blackbird/i }).locator('.btn-load-explore-song').first();
  await expect(songCard).toBeVisible({ timeout: 10000 });
  await songCard.click();

  const lyricsContainer = page.locator('.lyrics-chords-container');
  await expect(lyricsContainer).toBeVisible({ timeout: 10000 });
  
  // Wait a bit for rendering
  await page.waitForTimeout(2000);
  
  const html = await lyricsContainer.innerHTML();
  console.log("INNER HTML OF LYRICS CONTAINER:");
  console.log(html.substring(0, 500)); // Print start
  console.log("... [snip] ...");
  console.log(html.substring(html.length - 2000)); // Print end
});
