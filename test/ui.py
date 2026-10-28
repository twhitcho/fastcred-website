import asyncio,json
from playwright.async_api import async_playwright
BASE="file:///home/claude/fastcred-site/docs/"
MOCK=open('/home/claude/fastcred-site/test/mock.js').read()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    # ---- admin
    pg=await b.new_page(viewport={"width":1366,"height":900});errs=[]
    pg.on("pageerror",lambda e:errs.append("ADMIN "+str(e)))
    await pg.route("**/*",lambda r: r.abort() if ("fonts.g" in r.request.url or "jsdelivr" in r.request.url) else r.continue_())
    await pg.route("**/assets/config.js",lambda r:r.fulfill(body=MOCK,content_type="text/javascript"))
    await pg.goto(BASE+"admin.html");await pg.wait_for_timeout(300)
    print("login:",await pg.text_content("h2"))
    await pg.fill("#le","r@f.co.zw");await pg.fill("#lp","x");await pg.click("#lb");await pg.wait_for_timeout(400)
    print("dash:",(await pg.text_content("h1")).strip())
    await pg.screenshot(path="/home/claude/fastcred-site/test/admin_dash.png")
    for h in ["apps","loans","guarantors","messages","settings","app-a1"]:
      await pg.evaluate(f"location.hash='{h}'");await pg.wait_for_timeout(300);print(h,"->",(await pg.text_content("main h1")).strip()[:40])
    await pg.click("[data-act=reject]");await pg.click("#af_go");print("reject w/o reason blocked:",len(await pg.evaluate("__rpc"))==0)
    await pg.fill("#af_reason","Income too low");await pg.click("#af_go");await pg.wait_for_timeout(300)
    await pg.click("[data-act=approve]");await pg.fill("#af_amount","1500");await pg.select_option("#af_term","3");print("preview:",await pg.text_content("#af_prev"))
    await pg.click("#af_go");await pg.wait_for_timeout(300)
    print("rpc calls:",json.dumps(await pg.evaluate("__rpc")))
    await pg.screenshot(path="/home/claude/fastcred-site/test/admin_app.png",full_page=False)
    # ---- public site with mocked fetch
    s=await b.new_page(viewport={"width":390,"height":844});
    s.on("pageerror",lambda e:errs.append("SITE "+str(e)))
    await s.route("**/fonts.g*/**",lambda r:r.abort())
    await s.route("**/assets/config.js",lambda r:r.fulfill(body='window.FASTCRED_BACKEND={url:"https://mock.supabase.co",key:"sb_publishable_x"}',content_type="text/javascript"))
    calls=[]
    async def api(route):
      u=route.request.url;calls.append(u.split("mock.supabase.co")[1])
      if "track_application" in u:
        body={"found":True,"ref":"FC-261028-79B9D","status":"more_info","product":"SME Working Capital","amount":2000,"term":4,"reason":"your latest payslip","can_upload":True,"upload_token":"tok","balance":0,"total":0,"events":[{"at":"2026-10-28T10:00:00Z","note":"Application submitted online"}],"documents":[],"installments":[]}
      elif "submit_application" in u: body={"id":"a1","ref":"FC-261028-79B9D","upload_token":"tok"}
      elif "register_documents" in u: body=2
      else: body={"Key":"ok"}
      await route.fulfill(status=200,body=json.dumps(body),content_type="application/json",headers={"access-control-allow-origin":"*","access-control-allow-headers":"*"})
    await s.route("https://mock.supabase.co/**",api)
    await s.goto(BASE+"index.html#track");await s.wait_for_timeout(300)
    await s.fill("#t_ref","FC-261028-79B9D");await s.fill("#t_mob","0771234567");await s.click("#trkBtn");await s.wait_for_timeout(400)
    print("track:",(await s.text_content("#trkOut h2")).strip())
    await s.set_input_files("#tup_extra",{"name":"payslip.pdf","mimeType":"application/pdf","buffer":b"%PDF-1.4 x"})
    await s.click("#trkUpBtn");await s.wait_for_timeout(500)
    await s.screenshot(path="/home/claude/fastcred-site/test/site_track.png",full_page=True)
    print("site calls:",calls)
    print("scrollWidth",await s.evaluate("document.documentElement.scrollWidth"))
    print("ERRORS:",errs)
    await b.close()
asyncio.run(main())
