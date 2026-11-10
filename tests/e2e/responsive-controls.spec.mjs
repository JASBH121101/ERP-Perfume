import { test, expect } from '@playwright/test';

test.describe('responsive account controls', () => {
  test('keeps mobile permission controls compact and aligned', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('link[href*="device-responsive.css"]').waitFor();

    await page.evaluate(() => {
      const host = document.createElement('section');
      host.className = 'access-manager-section';
      host.innerHTML = `
        <article class="panel">
          <div class="table-wrap">
            <table class="data-table mobile-record-table">
              <tbody>
                <tr>
                  <td class="user-access-controls" data-label="Seguridad y permisos">
                    <label><input type="checkbox" checked> Cambio inicial</label>
                    <button class="button button-primary button-small" type="button">Activar acceso</button>
                    <details class="user-overrides"><summary>Excepciones (0)</summary></details>
                    <button class="button button-quiet button-small" type="button">Guardar cuenta</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>`;
      document.body.append(host);
    });

    const card = page.locator('.access-manager-section .panel').last();
    const label = card.locator('.user-access-controls > label');
    const checkbox = label.locator('input[type="checkbox"]');
    const activate = card.getByRole('button', { name: 'Activar acceso' });
    const controls = card.locator('.user-access-controls');

    await expect(label).toBeVisible();
    await expect(checkbox).toBeVisible();
    await expect(activate).toBeVisible();

    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.access-manager-section .panel:last-child');
      const label = card.querySelector('.user-access-controls > label');
      const checkbox = label.querySelector('input');
      const button = card.querySelector('button');
      const cardWidth = card.getBoundingClientRect().width;
      return {
        cardWidth,
        labelWidth: label.getBoundingClientRect().width,
        checkboxWidth: checkbox.getBoundingClientRect().width,
        buttonWidth: button.getBoundingClientRect().width,
        buttonHeight: button.getBoundingClientRect().height,
        controlsDisplay: getComputedStyle(card.querySelector('.user-access-controls')).display
      };
    });

    expect(metrics.checkboxWidth).toBe(18);
    expect(metrics.labelWidth).toBeLessThan(metrics.cardWidth * 0.7);
    expect(metrics.buttonWidth).toBeLessThan(metrics.cardWidth * 0.7);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(36);
    expect(metrics.controlsDisplay).toBe('flex');
    await expect(controls).toHaveCSS('align-items', 'flex-start');
  });

  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    test(`does not introduce page-level horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.locator('link[href*="device-responsive.css"]').waitFor();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
    });
  }
});
