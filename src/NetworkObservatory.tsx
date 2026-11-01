import { useEffect, useRef, useState } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import { WorldGlobe } from "./WorldGlobe";
import type { PulseCollection } from "./demoData";
import {
  networkRegions,
  networkPeriods,
  networkSelection,
  radarLinks,
  type NetworkPeriod,
} from "./networkSources";
import "./networkObservatory.css";
const EMPTY: PulseCollection = { type: "FeatureCollection", features: [] };
const noop = () => {};
const copy = {
  en: {
    back: "Participation map",
    eyebrow: "PUBLIC NETWORK OBSERVATORY",
    title: "The internet, in perspective.",
    intro: "Explore observed traffic. Compare the rhythm of regions over time.",
    region: "Region",
    period: "Period",
    chart: "Traffic variation",
    relative: "Relative change from the previous period",
    coverage: "Coverage",
    coverageText:
      "Traffic observed by Cloudflare. This is a sample of the internet, not its total volume.",
    comparison: "Comparison",
    comparisonText:
      "The source compares equivalent periods. A change is an observation, not proof of an event’s cause.",
    attribution: "GTA VI attribution",
    attributionText:
      "Not available. These measurements do not identify Xbox, PlayStation or individual game downloads.",
    open: "Open source chart",
    loading: "Loading the source chart…",
    fallback: "Chart missing or blocked? Open the source directly.",
    reload: "Reload chart",
    map: "Geographic navigation only · no traffic intensity is painted on the map.",
    method: "Sources & method",
    methodText:
      "Interactive chart supplied by Cloudflare Radar (CC BY 4.0). Its timestamp, legend and scale remain visible. Embeds contact Cloudflare and collect usage metrics through Cloudflare Web Analytics. No location permission is requested here.",
    exchange: "Other observation points",
    exchangeText:
      "Exchange statistics measure their own infrastructure. Their volumes are not added together or treated as a country’s total.",
    future: "Build the evidence",
    futureText:
      "This first view uses the source’s rolling comparison. An independent historical archive, event attribution and partner datasets are not yet connected.",
    github: "Method, code & contribute",
    days: ["24 hours", "7 days", "30 days"],
    language: "Language",
    chartNote:
      "Data freshness and availability are controlled by the source. No synthetic traffic or download counts are shown.",
  },
  pt: {
    back: "Mapa de participações",
    eyebrow: "OBSERVATÓRIO PÚBLICO DE REDES",
    title: "A internet, em perspectiva.",
    intro:
      "Explore o tráfego observado. Compare o ritmo das regiões ao longo do tempo.",
    region: "Região",
    period: "Período",
    chart: "Variação de tráfego",
    relative: "Variação relativa ao período anterior",
    coverage: "Cobertura",
    coverageText:
      "Tráfego observado pela Cloudflare. É uma amostra da internet, não seu volume total.",
    comparison: "Comparação",
    comparisonText:
      "A fonte compara períodos equivalentes. Uma mudança é uma observação, não prova da causa de um evento.",
    attribution: "Atribuição ao GTA VI",
    attributionText:
      "Indisponível. Estas medições não identificam Xbox, PlayStation ou downloads de jogos individuais.",
    open: "Abrir gráfico na fonte",
    loading: "Carregando o gráfico da fonte…",
    fallback: "Gráfico ausente ou bloqueado? Abra diretamente na fonte.",
    reload: "Recarregar gráfico",
    map: "Navegação geográfica · o mapa não representa intensidade de tráfego.",
    method: "Fontes e método",
    methodText:
      "Gráfico interativo fornecido pelo Cloudflare Radar (CC BY 4.0). Horário, legenda e escala da fonte permanecem visíveis. A incorporação conecta à Cloudflare e coleta métricas de uso pelo Cloudflare Web Analytics. Não pedimos localização nesta página.",
    exchange: "Outros pontos de observação",
    exchangeText:
      "Estatísticas de exchanges medem a própria infraestrutura. Os volumes não são somados nem tratados como o total de um país.",
    future: "Construindo a evidência",
    futureText:
      "Esta primeira versão usa a comparação móvel da fonte. Arquivo histórico próprio, atribuição a eventos e dados de parceiros ainda não estão conectados.",
    github: "Método, código e colaboração",
    days: ["24 horas", "7 dias", "30 dias"],
    language: "Idioma",
    chartNote:
      "Atualização e disponibilidade dependem da fonte. Não exibimos tráfego simulado nem contadores de downloads.",
  },
};
export default function NetworkObservatory() {
  const initial = useRef(networkSelection(window.location.search));
  const [region, setRegion] = useState(initial.current.region.id as string),
    [period, setPeriod] = useState<NetworkPeriod>(initial.current.period);
  const [language, setLanguage] = useState<"en" | "pt">(
      initial.current.language,
    ),
    [map, setMap] = useState<MapInstance | null>(null),
    [mapError, setMapError] = useState(false);
  const [frameVersion, setFrameVersion] = useState(0),
    [frameLoaded, setFrameLoaded] = useState(false);
  const t = copy[language],
    selected = networkRegions.find((r) => r.id === region) ?? networkRegions[0],
    links = radarLinks(region, period);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = "Network Pulse — World Pulse";
    const query = new URLSearchParams({ region, period, lang: language });
    window.history.replaceState(null, "", "/network/?" + query);
  }, [region, period, language]);
  useEffect(() => {
    setFrameLoaded(false);
  }, [links.embed, frameVersion]);
  useEffect(() => {
    if (map)
      map.flyTo({
        center: [selected.center[0], selected.center[1]],
        zoom: selected.zoom,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 1100,
      });
  }, [map, selected]);
  return (
    <main className="network-page">
      <div className="network-geography" aria-hidden="true">
        <WorldGlobe
          population={EMPTY}
          scale={1}
          selected={null}
          cityLights={false}
          onReady={setMap}
          onZoom={noop}
          onFps={noop}
          onTap={noop}
          onTagPick={noop}
          onFailure={() => setMapError(true)}
        />
      </div>
      <div className="network-shade" />
      <div className="network-content">
        <header className="network-header">
          <a href="/" className="network-brand">
            WORLD<span>PULSE</span>
            <small> / NETWORK</small>
          </a>
          <div>
            <a href="/">← {t.back}</a>
            <label className="network-language">
              <span className="network-sr">{t.language}</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "pt")}
              >
                <option value="en">EN</option>
                <option value="pt">PT</option>
              </select>
            </label>
          </div>
        </header>
        <section className="network-hero">
          <p className="network-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </section>
        <section className="network-dashboard" aria-label="Network Pulse">
          <div className="network-toolbar">
            <label>
              {t.region}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {networkRegions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {language === "pt" ? r.pt : r.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>{t.period}</legend>
              {networkPeriods.map((p, i) => (
                <button
                  key={p}
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                >
                  {t.days[i]}
                </button>
              ))}
            </fieldset>
          </div>
          <div className="network-chart-heading">
            <div>
              <p className="network-eyebrow">CLOUDFLARE RADAR</p>
              <h2>
                {t.chart}{" "}
                <span>
                  {" "}
                  / {language === "pt" ? selected.pt : selected.name}
                </span>
              </h2>
              <p>{t.relative}</p>
            </div>
            <a href={links.source} target="_blank" rel="noreferrer">
              {t.open} ↗
            </a>
          </div>
          <div className="network-frame">
            {!frameLoaded && (
              <p className="network-loading" role="status">
                {t.loading}
              </p>
            )}
            <iframe
              key={links.embed + frameVersion}
              src={links.embed}
              title={"Cloudflare Radar — " + t.chart + " — " + selected.name}
              onLoad={() => setFrameLoaded(true)}
              loading="eager"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="network-chart-footer">
            <p>{t.chartNote}</p>
            <button onClick={() => setFrameVersion((v) => v + 1)}>
              {t.reload} ↻
            </button>
          </div>
          <a
            className="network-fallback"
            href={links.source}
            target="_blank"
            rel="noreferrer"
          >
            {t.fallback} ↗
          </a>
        </section>
        <section className="network-facts" aria-label={t.method}>
          {[
            [t.coverage, t.coverageText],
            [t.comparison, t.comparisonText],
            [t.attribution, t.attributionText],
          ].map(([heading, text], i) => (
            <article key={heading}>
              <span className="network-number">0{i + 1}</span>
              <h3>{heading}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <section className="network-bottom">
          <div>
            <h2>{t.exchange}</h2>
            <p>{t.exchangeText}</p>
            <div className="network-source-links">
              <a
                href="https://stats.ams-ix.net/"
                target="_blank"
                rel="noreferrer"
              >
                AMS-IX · Amsterdam ↗
              </a>
              <a
                href="https://www.de-cix.net/en/locations/frankfurt/statistics"
                target="_blank"
                rel="noreferrer"
              >
                DE-CIX · Frankfurt ↗
              </a>
            </div>
          </div>
          <div>
            <h2>{t.future}</h2>
            <p>{t.futureText}</p>
            <a href="https://github.com/Faysk/world-pulse/issues/164">
              {t.github} ↗
            </a>
          </div>
        </section>
        <details className="network-method">
          <summary>{t.method}</summary>
          <p>{t.methodText}</p>
          <a
            href="https://radar.cloudflare.com/about#licensing-policies"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare Radar · Licensing ↗
          </a>
        </details>
        <footer className="network-footer">
          <span>WORLD PULSE / NETWORK</span>
          <span><a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a></span>
          <span>
            {mapError ? "Map unavailable · charts remain independent." : t.map}
          </span>
        </footer>
      </div>
    </main>
  );
}
