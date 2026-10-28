import asyncio,json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();s=await b.new_page(viewport={"width":390,"height":844})
    await s.route("**/fonts.g*/**",lambda r:r.abort())
    await s.route("**/assets/config.js",lambda r:r.fulfill(body='window.FASTCRED_BACKEND={url:"https://mock.supabase.co",key:"x"}',content_type="text/javascript"))
    async def api(route):
      await route.fulfill(status=200,body=json.dumps({"found":True,"ref":"FC-1","status":"disbursed","product":"SME","amount":2000,"term":4,"reason":None,"can_upload":True,"upload_token":"t","balance":1300,"total":1950,"events":[],"documents":[],"installments":[{"n":1,"due":"2026-11-28","amount":650,"paid":650,"status":"paid"}]}),content_type="application/json",headers={"access-control-allow-origin":"*","access-control-allow-headers":"*"})
    await s.route("https://mock.supabase.co/**",api)
    for h in ["home","apply","track","guarantor-form","contact","blog"]:
      await s.goto("file:///home/claude/fastcred-site/docs/index.html#"+h);await s.wait_for_timeout(250)
      if h=="track": await s.fill("#t_ref","FC-1");await s.fill("#t_mob","0771234567");await s.click("#trkBtn");await s.wait_for_timeout(300)
      w=await s.evaluate("""()=>{const W=innerWidth;const bad=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.sched-wrap,.tbl-wrap,.ribbons')}).slice(0,4).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right));return [document.documentElement.scrollWidth,bad]}""")
      print(h,w)
    await b.close()
asyncio.run(main())
