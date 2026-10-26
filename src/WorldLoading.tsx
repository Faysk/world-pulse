import "./worldLoading.css";

export function WorldLoading({
  ready = false,
  label = "Connecting the world",
}: {
  ready?: boolean;
  label?: string;
}) {
  return (
    <div
      className={`world-loading${ready ? " world-loading-ready" : ""}`}
      aria-hidden={ready}
    >
      <div className="world-loading-orbit" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <div className="world-loading-brand">
        WORLD<span>PULSE</span>
      </div>
      <p role={ready ? undefined : "status"}>
        {label}
        <span aria-hidden="true">…</span>
      </p>
      <div className="world-loading-track" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
