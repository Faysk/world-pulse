import {test,expect} from '@playwright/test';

test('Search content and localized about pages remain readable without JavaScript',async({browser},info)=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
  const page=await context.newPage();
  try{
    await page.goto('http://127.0.0.1:4173/');
    await expect(page.getByRole('heading',{name:'World Pulse',exact:true})).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://map.faysk.dev/');
    await page.getByRole('link',{name:'How it works',exact:true}).click();
    await expect(page.getByRole('heading',{name:'A world moved by you.'})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.getByRole('link',{name:'Português',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','pt');
    await expect(page.getByRole('heading',{name:'Um mundo movido por você.'})).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://map.faysk.dev/pt/sobre/');
    await page.screenshot({path:`test-artifacts/about-${info.project.name}.png`,fullPage:true});
    await page.getByRole('link',{name:'Español',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','es');
    await expect(page.getByRole('heading',{name:'Un mundo que tú mueves.'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }finally{await context.close();}
});
