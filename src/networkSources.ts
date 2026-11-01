export const networkRegions = [
  { id: "", name: "Worldwide", pt: "Mundo", center: [0, 20], zoom: 1.2 },
  { id: "pt", name: "Portugal", pt: "Portugal", center: [-8, 39.5], zoom: 4 },
  { id: "br", name: "Brazil", pt: "Brasil", center: [-51, -14], zoom: 2.4 },
  {
    id: "us",
    name: "United States",
    pt: "Estados Unidos",
    center: [-98, 38],
    zoom: 2.5,
  },
  {
    id: "gb",
    name: "United Kingdom",
    pt: "Reino Unido",
    center: [-3, 55],
    zoom: 3.5,
  },
  { id: "de", name: "Germany", pt: "Alemanha", center: [10, 51], zoom: 4 },
  {
    id: "nl",
    name: "Netherlands",
    pt: "Países Baixos",
    center: [5, 52],
    zoom: 5,
  },
  { id: "fr", name: "France", pt: "França", center: [2, 47], zoom: 3.5 },
  { id: "es", name: "Spain", pt: "Espanha", center: [-4, 40], zoom: 3.7 },
  { id: "jp", name: "Japan", pt: "Japão", center: [138, 37], zoom: 3 },
  {
    id: "au",
    name: "Australia",
    pt: "Austrália",
    center: [134, -25],
    zoom: 2.5,
  },
  {
    id: "nz",
    name: "New Zealand",
    pt: "Nova Zelândia",
    center: [173, -41],
    zoom: 3.5,
  },
] as const;
export const networkPeriods = ["1d", "7d", "30d"] as const;
export type NetworkPeriod = (typeof networkPeriods)[number];
export function networkSelection(search: string) {
  const params = new URLSearchParams(search);
  return {
    region:
      networkRegions.find((r) => r.id === params.get("region")) ??
      networkRegions[0],
    period: networkPeriods.find((p) => p === params.get("period")) ?? "7d",
    language: params.get("lang") === "pt" ? "pt" : "en",
  } as const;
}
export function radarLinks(region: string, period: NetworkPeriod) {
  const safeRegion = networkRegions.some((r) => r.id === region) ? region : "";
  const safePeriod = networkPeriods.includes(period) ? period : "7d";
  const path = "/traffic" + (safeRegion ? "/" + safeRegion : "");
  const query = new URLSearchParams({
    theme: "dark",
    dateRange: safePeriod,
    ...(safeRegion ? { location: safeRegion } : {}),
    ref: path,
  });
  return {
    embed: "https://radar.cloudflare.com/embed/TrafficVolumeXY?" + query,
    source:
      "https://radar.cloudflare.com" +
      path +
      "?dateRange=" +
      safePeriod +
      "#traffic-volume",
  };
}
