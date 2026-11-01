import test from "node:test";
import assert from "node:assert/strict";
import {
  networkSelection,
  radarLinks,
  networkPeriods,
} from "../src/networkSources.ts";
import { searchPresence } from "../build/search-presence.mjs";
test("shared filters are bounded and never allow arbitrary third-party URLs", () => {
  const selection = networkSelection("?region=pt&period=1d&lang=pt");
  assert.equal(selection.region.id, "pt");
  assert.equal(selection.period, "1d");
  assert.equal(selection.language, "pt");
  const fallback = networkSelection(
    "?region=https://evil.test&period=never&lang=xyz",
  );
  assert.equal(fallback.region.id, "");
  assert.equal(fallback.period, "7d");
  assert.equal(fallback.language, "en");
  for (const period of networkPeriods) {
    const links = radarLinks("pt", period),
      url = new URL(links.embed);
    assert.equal(url.origin, "https://radar.cloudflare.com");
    assert.equal(url.pathname, "/embed/TrafficVolumeXY");
    assert.equal(url.searchParams.get("location"), "pt");
    assert.equal(url.searchParams.get("dateRange"), period);
    assert.equal(url.searchParams.get("ref"), "/traffic/pt");
  }
  assert.equal(
    new URL(radarLinks("evil", "1d").embed).searchParams.has("location"),
    false,
  );
});
test("network entry has independent canonical metadata and obeys public build gate", () => {
  for (const [env, indexable] of [
    [{}, false],
    [{ VERCEL_ENV: "production", WP_ALPHA_RELEASE: "true" }, true],
  ]) {
    const html = searchPresence(env).transformIndexHtml(
      "<!-- wp:network-head -->",
    );
    assert.match(html, /canonical" href="https:\/\/map.faysk.dev\/network\/"/);
    assert.match(html, /Network Pulse/);
    assert.ok(!html.includes("wp:network-head"));
    assert.match(
      html,
      indexable ? /content="index, follow/ : /content="noindex, nofollow/,
    );
  }
});
