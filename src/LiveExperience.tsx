import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import { WorldGlobe } from "./WorldGlobe";
import type { PulseCollection } from "./demoData";
import { useParticipation } from "./useParticipation";
import { tagLabelStyle } from "./tagLabel";
import { countryTagPage } from "./countryComposition";
import { WorldLoading } from "./WorldLoading";
import { RegionalPointLayer } from "./RegionalPointLayer";
import type { RegionRow } from "./regionalTypes";
import { countryLanguage, languages, type Language } from "./liveCopy";
import "./liveExperience.css";
const EMPTY: PulseCollection = { type: "FeatureCollection", features: [] };
function duration(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export default function LiveExperience() {
  const [panel, setPanel] = useState<
    "ranking" | "countries" | "balances" | null
  >(null);
  const live = useParticipation(panel === "countries");
  const [map, setMap] = useState<MapInstance | null>(null),
    [mapReady, setMapReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [mapVersion, setMapVersion] = useState(0);
  const [name, setName] = useState(""),
    [countryPick, setCountryPick] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [focus, setFocus] = useState(false);
  const [language, setLanguage] = useState<Language | "auto">("auto");
  const locale =
    language === "auto"
      ? countryLanguage(live.countryPreference.country)
      : language;
  const t = languages[locale];
  const count = (value: string) =>
    Intl.NumberFormat(locale).format(BigInt(value));
  const help = useRef<HTMLDialogElement>(null),
    helpButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const focusId = focus && live.selected ? live.selected.id : null;
  const countryRows = useMemo(
    () => countryTagPage(live.countrySnapshot, countryPick, search, page),
    [live.countrySnapshot, countryPick, search, page],
  );
  const ownTags =
    live.regional.cell && live.countryPreference.available
      ? [
          ...live.balances.map((row) => ({
            id: row.tagId,
            name: row.name ?? "",
            color: row.color ?? "#ddd",
          })),
          ...(live.selected ? [live.selected] : []),
        ].filter(
          (tag, index, rows) =>
            live.remaining(tag.id) > 0 &&
            rows.findIndex((row) => row.id === tag.id) === index,
        )
      : [];
  const signature = JSON.stringify(
    ownTags.map((tag) => ({
      cell: live.regional.cell!,
      tagId: tag.id,
      name: tag.name,
      color: tag.color,
      participants: "1",
    })),
  );
  const ownPoints = useMemo(
    () => JSON.parse(signature) as RegionRow[],
    [signature],
  );
  async function select(e: FormEvent) {
    e.preventDefault();
    await live.select(name);
  }
  function toggle(next: typeof panel) {
    setPanel(panel === next ? null : next);
  }
  return (
    <main
      className="live-world"
      aria-label="World Pulse"
      data-ready={live.ready}
      data-pending={live.pending}
      data-regional-active={ownPoints.length > 0}
    >
      <WorldGlobe
        key={mapVersion}
        ariaLabel="World Pulse globe"
        scale={0}
        population={EMPTY}
        selected={null}
        cityLights={false}
        onReady={(instance) => {
          setMap(instance);
          setMapReady(true);
          setMapError("");
        }}
        onCountryPick={(code) => {
          setCountryPick(code);
          setSearch("");
          setPage(0);
          setPanel("countries");
        }}
        onZoom={() => {}}
        onFps={() => {}}
        onRegionPick={(tag) => void live.select(tag)}
        onTap={() => void live.tap()}
        onTagPick={() => {}}
        onFailure={setMapError}
      />
      <RegionalPointLayer
        map={map}
        snapshot={live.regional.snapshot}
        own={ownPoints}
        tagId={focusId}
      />
      <WorldLoading
        ready={mapReady || Boolean(mapError)}
        label={t.connecting}
      />
      <div className="live-shade" aria-hidden="true" />
      <header className="live-header">
        <div className="live-brand">
          WORLD<span>PULSE</span>
        </div>
        <button
          ref={helpButton}
          className="live-help-button"
          aria-label={t.help}
          aria-haspopup="dialog"
          onClick={() => help.current?.showModal()}
        >
          ?
        </button>
      </header>
      <nav className="live-navigation" aria-label="World Pulse">
        <button
          aria-expanded={panel === "ranking"}
          aria-controls="live-ranking"
          onClick={() => toggle("ranking")}
        >
          Top 10
        </button>
        <button
          aria-expanded={panel === "countries"}
          aria-controls="live-countries-panel"
          onClick={() => toggle("countries")}
        >
          {t.countries}
        </button>
        <button
          aria-expanded={panel === "balances"}
          aria-controls="live-balances"
          onClick={() => toggle("balances")}
        >
          {t.balances}
        </button>
      </nav>
      {panel === "ranking" && (
        <aside
          id="live-ranking"
          className="live-panel live-ranking"
          aria-label={t.ranking}
        >
          <div className="live-panel-title">
            <h1>{t.ranking}</h1>
            <button aria-label={t.close} onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          {live.rankingError ? (
            <p role="status">{t.unavailable}</p>
          ) : !live.ranking ? (
            <p>{t.loading}</p>
          ) : !live.ranking.ranking.length ? (
            <p>{t.empty}</p>
          ) : (
            <ol>
              {live.ranking.ranking.map((tag) => (
                <li key={tag.id}>
                  <button
                    disabled={!live.ready || live.selecting}
                    aria-label={tag.name}
                    onClick={() => void live.select(tag.name)}
                  >
                    <span style={tagLabelStyle(tag.color)}>{tag.name}</span>
                    <strong>{count(tag.activeParticipants)}</strong>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      )}
      {panel === "balances" && (
        <aside
          id="live-balances"
          className="live-panel live-balances"
          aria-label={t.balances}
        >
          <div className="live-panel-title">
            <h2>{t.balances}</h2>
            <button aria-label={t.close} onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          {live.balancesLimited && <p>{t.limited}</p>}
          {!live.balances.length ? (
            <p>{t.empty}</p>
          ) : (
            <ul>
              {live.balances.map((row) => (
                <li key={row.tagId} data-live-tag={row.name}>
                  <button
                    disabled={!live.ready || live.selecting}
                    style={tagLabelStyle(row.color)}
                    onClick={() => void live.select(row.name ?? "")}
                  >
                    {row.name}
                  </button>
                  <strong>{duration(live.remaining(row.tagId))}</strong>
                  <small>
                    {t.history}: {count(row.creditedSeconds)}s
                  </small>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      {panel === "countries" && (
        <aside
          id="live-countries-panel"
          className="live-panel live-ranking"
          aria-label={t.countries}
        >
          <div className="live-panel-title">
            <h2>{countryPick ?? t.countries}</h2>
            <button aria-label={t.close} onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          <button
            disabled={!live.selected}
            aria-pressed={focus}
            onClick={() => {
              setFocus((v) => !v);
              setPage(0);
            }}
          >
            {focus ? t.all : t.focus}
          </button>
          {countryPick && (
            <button
              onClick={() => {
                setCountryPick(null);
                setPage(0);
              }}
            >
              {t.all}
            </button>
          )}
          {live.countryError || !live.countryPreference.available ? (
            <p>{t.unavailable}</p>
          ) : !live.countrySnapshot ? (
            <p>{t.loading}</p>
          ) : (
            <>
              <label className="live-search-label" htmlFor="country-search">
                {t.search}
              </label>
              <input
                id="country-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                maxLength={33}
                placeholder="#hashtag"
              />
              {focusId ? (
                <ul>
                  {live.countrySnapshot.tags
                    .find((tag) => tag.id === focusId)
                    ?.countries.map((country) => (
                      <li key={country.countryCode}>
                        <span>
                          {country.countryCode === "ZZ"
                            ? t.unknown
                            : country.countryCode === "OTHER"
                              ? t.other
                              : country.countryCode}
                        </span>
                        <strong>{count(country.activeParticipants)}</strong>
                      </li>
                    ))}
                </ul>
              ) : (
                <ul>
                  {countryRows.rows.map((tag) => (
                    <li key={tag.id}>
                      <button
                        disabled={!live.ready || live.selecting}
                        aria-label={tag.name}
                        onClick={() => void live.select(tag.name)}
                      >
                        <span style={tagLabelStyle(tag.color)}>{tag.name}</span>
                        <strong>{count(tag.participants)}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!focusId && (
                <div className="live-country-pages">
                  <button
                    disabled={countryRows.page === 0}
                    onClick={() => setPage(countryRows.page - 1)}
                    aria-label={t.previous}
                  >
                    ‹
                  </button>
                  <span>
                    {countryRows.page + 1} / {countryRows.pages}
                  </span>
                  <button
                    disabled={countryRows.page + 1 >= countryRows.pages}
                    onClick={() => setPage(countryRows.page + 1)}
                    aria-label={t.next}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      )}
      <section className="live-controls" aria-label="World Pulse controls">
        <div className="live-location-row">
          <span id="location-label">{t.location}</span>
          <button
            role="switch"
            aria-checked={live.regional.shared}
            aria-labelledby="location-label"
            aria-describedby="location-privacy"
            aria-busy={live.regional.busy}
            className="live-location-switch"
            disabled={
              live.regional.busy ||
              (!live.regional.shared &&
                (!live.ready || !live.countryPreference.available))
            }
            onClick={() =>
              live.regional.shared
                ? void live.regional.withdraw()
                : live.regional.locate()
            }
          >
            <span />
          </button>
        </div>
        {live.regional.error && (
          <p role="status">
            {live.regional.error === "imprecise_location"
              ? t.locationImprecise
              : t.locationError}
          </p>
        )}
        <form onSubmit={select}>
          <label className="sr-only" htmlFor="live-name">
            {t.hashtag}
          </label>
          <div className="live-form-row">
            <input
              id="live-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={34}
              placeholder={t.placeholder}
              autoComplete="off"
              required
            />
            <button type="submit" disabled={!live.ready || live.selecting}>
              {t.enter}
            </button>
          </div>
        </form>
        <div className="live-contribution">
          <div>
            <strong
              data-testid="live-selected"
              style={tagLabelStyle(live.selected?.color)}
            >
              {live.selected?.name ?? t.choose}
            </strong>
            {live.selected && (
              <span data-testid="live-selected-balance">
                {duration(live.remaining(live.selected.id))}
              </span>
            )}
          </div>
          <button
            className="live-tap"
            aria-label="+1"
            disabled={!live.ready || live.selecting || !live.selected}
            onClick={() => void live.tap()}
          >
            +1
          </button>
        </div>
        {!live.persistent && <p role="status">{t.storageError}</p>}
        {live.error && (
          <p role="alert">
            {live.error.includes("hashtag") ? t.invalid : t.connectionError}
          </p>
        )}
        {!live.ready && !live.quarantined && live.error && (
          <button onClick={() => void live.connect()}>{t.retry}</button>
        )}
        {live.quarantined && (
          <div>
            <p>{t.queueError}</p>
            <button onClick={() => void live.discard()}>{t.discard}</button>
          </div>
        )}
        {mapError && (
          <button
            onClick={() => {
              setMap(null);
              setMapReady(false);
              setMapError("");
              setMapVersion((v) => v + 1);
            }}
          >
            {t.retry}
          </button>
        )}
      </section>
      <dialog
        ref={help}
        className="live-help"
        aria-labelledby="help-title"
        onClose={() => helpButton.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) help.current?.close();
        }}
      >
        <div className="live-help-content">
          <div className="live-panel-title">
            <h2 id="help-title">{t.help}</h2>
            <button aria-label={t.close} onClick={() => help.current?.close()}>
              ×
            </button>
          </div>
          <p>{t.intro}</p>
          <p>{t.mapHelp}</p>
          <p>{t.rankingHelp}</p>
          <p id="location-privacy">{t.privacy}</p>
          <p>{t.withdrawal}</p>
          <p>{t.syncHelp}</p>
          <p>{t.retention}</p>
          <a
            href="https://github.com/Faysk/world-pulse"
            target="_blank"
            rel="noreferrer"
          >
            {t.source} ↗
          </a>
          <p>{t.languageHelp}</p>
          <label htmlFor="live-language">{t.language}</label>
          <select
            id="live-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language | "auto")}
          >
            <option value="auto">{t.auto}</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
            <option value="es">Español</option>
          </select>
        </div>
      </dialog>
    </main>
  );
}
