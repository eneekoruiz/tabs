import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTool } from './helpers/journeys.js';
for (const width of [375,1440]) test('all 17 tools are readable and operable at '+width+'px',async({page},info)=>{
 test.setTimeout(300000);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('.nav-tab-btn[data-tab="tools"]').click();const findings=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const name of ['metronome','tuner','dictionary','vocal','ear','capo','circle','looper','analytics','transcriber','stems','smart_band','pedalboard','arcade','bandroom','stage','spatial']){
  await openTool(page,name);const host=page.locator(name==='arcade'?'#arcade-mode-modal-container':name==='spatial'?'#spatial-xr-modal-container':'#toolModalHost');await expect(name==='arcade'?host.locator('#modal-arcade-view'):host.locator('h2').first()).toBeVisible();await expect(host.locator('button').first()).toBeVisible();const details=host.locator('#toolAdvanced');if(await details.count() && !(await details.evaluate(el=>el.open))) await details.locator(':scope > summary').click();const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();findings.push({name,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  await page.screenshot({path:info.outputPath(name+'.png')});
  await page.keyboard.press('Escape');await expect(host.locator('h2')).toHaveCount(0);
 }
 await info.attach('all-tools-accessibility.json',{body:JSON.stringify(findings,null,2),contentType:'application/json'});expect(errors).toEqual([]);expect(findings.filter(f=>f.violations.length)).toEqual([]);
});
