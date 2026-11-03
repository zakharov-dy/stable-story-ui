Test the web page at {URL} (state "{STATE}") in the browser of the chrome-test MCP server. The only browser is the chrome-test MCP server. Do not take screenshots. Do not open any other URL than {URL}, except the design mockup address of the design check below.

This run does one thing: the design check, the comparison of the page with the design mockup. The technical checks (console, network, HTTP, overflow, fonts, page state, chart hover, tone colors) belong to `browser-smoke` and are not done here.

Viewports to test, in this order: {VIEWPORTS}.

Steps, for each viewport:
1. new_page or navigate_page to {URL} (the first time), resize_page to the viewport, reload the page, and wait until it has loaded and hydrated (the fingerprint needs the hydrated page).
2. Run the design check on the page. It leaves the page tab on the mockup. For the next viewport, navigate_page back to {URL} and reload.
3. Give the design check one entry with status pass, fail or skipped and short evidence (the numbers you saw).
4. If the check needs a tool you do not have, mark it skipped and add the tool to "missing_tools".

Checks (ids):
- design: compare the page with the design mockup of the same state and width. {DESIGN_PLAN}
  The mockup has its own demo numbers: never compare numbers. Compare structure and styles only. Procedure for a viewport that has a mockup URL:
  a. On the page (still on {URL}, loaded at the viewport), run evaluate_script with the function below, with no arguments. It must return mode "stored". If it returns anything else, the design check of this viewport is skipped with that answer as evidence: no differences, "design_diffs_total" 0, no second attempt by hand.
  b. In the same tab, navigate_page to the mockup URL, then wait for it to load. The viewport stays the same. A 404 for support.js and font requests to a font host in the mockup are normal here and are not defects. Do not check the network or the console of the mockup.
  c. Run evaluate_script with the same function, again with no arguments. It must return mode "compared" with "diffs" (at most 200), "total" (all differences) and "notInMockup" (page blocks the mockup does not draw; they are already among the differences, as presence: copy them like the others and name them in the evidence). Mode "error", or any other answer (for example window.name was lost and the call returned mode "stored" again), means the design check is skipped for this viewport; put the answer in the evidence, add no differences from memory and do not rebuild the data by hand. You may run the whole procedure a–c once more from the start (navigate back to {URL} and reload first); if that does not give mode "compared" either, the check stays skipped.
  d. Copy every item of "diffs" into "design_diffs" with source "fingerprint": viewport, block, property, design, page as returned, and fill "note" yourself: what the difference means and the likely cause (a few words). Do not select, merge, reorder or drop any of them. Never reconstruct, retype, shorten or edit any value of the fingerprint or of its differences (a CSS shorthand such as "12px 20px 12px" for "12px 20px 12px 20px" is an edit too): copy each item exactly as returned, character for character. The script checks the items against the fingerprint and discards the whole viewport if one was altered. Only "note" is yours.
  e. You may add up to 10 more differences of structure that the fingerprint cannot see (a missing or extra element, a different order of items, a different label), found by comparing take_snapshot of the page and of the mockup (take the page snapshot before step a). Add them with source "model" and the viewport, block, property, design, page and note filled; do not add anything you are not sure of, and never add a difference in numbers.
  f. Set "design_diffs_total" of the viewport to "total" plus the number of "model" items you added. The design check is pass when that total is 0, fail otherwise (the evidence has the total and the count of blocks compared). The script decides the final status afterwards: it makes the check pass when every difference is on its accepted list, so do not try to judge that yourself.
  For a viewport without a mockup URL the design check is skipped with the evidence given above, "design_diffs_total" is 0 and nothing else is done.
  The function:
  {FINGERPRINT}

Return the report as one JSON block, once, in this shape (field names exact, arrays where shown):
{"url": "{URL}", "state": "{STATE}", "viewports": [{"viewport": "1440x900", "design_diffs_total": 0, "checks": [{"id": "design", "status": "pass", "evidence": "0 differences in 10 blocks"}]}], "design_diffs": [{"viewport": "1440x900", "block": "header", "property": "sec-title.fontSize", "design": "28px", "page": "24px", "note": "smaller title on the page", "source": "fingerprint"}], "missing_tools": [], "notes": ""}
"viewports" has one entry per tested viewport, each with the one check "design" and its design_diffs_total. "design_diffs" is an array, empty when there are none. Do not repeat the report and do not add text after it.
