import { useState, type FormEvent } from 'react';
import { WorldGlobe } from './WorldGlobe';
import type { PulseCollection } from './demoData';
import { useParticipation } from './useParticipation';
import './liveExperience.css';

const EMPTY_GEOGRAPHY:PulseCollection={type:'FeatureCollection',features:[]};
const count=(value:string)=>Intl.NumberFormat('pt-BR').format(BigInt(value));
function duration(ms:number){const seconds=Math.ceil(ms/1000);return `${Math.floor(seconds/3600)}h ${String(Math.floor(seconds/60)%60).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;}

export default function LiveExperience(){
  const live=useParticipation();
  const [name,setName]=useState('');
  const [rankingOpen,setRankingOpen]=useState(()=>window.innerWidth>760);
  const [balancesOpen,setBalancesOpen]=useState(false);
  const [mapReady,setMapReady]=useState(false);
  const [mapError,setMapError]=useState('');
  const [mapVersion,setMapVersion]=useState(0);
  async function select(event:FormEvent){event.preventDefault();await live.select(name);}
  return <main className="live-world" aria-label="World Pulse participação">
    <WorldGlobe key={mapVersion} scale={0} population={EMPTY_GEOGRAPHY} selected={null} cityLights={false}
      onReady={()=>{setMapReady(true);setMapError('');}} onZoom={()=>{}} onFps={()=>{}}
      onTap={()=>void live.tap()} onTagPick={()=>{}} onFailure={setMapError}/>
    <div className="live-shade" aria-hidden="true"/>
    <header className="live-header">
      <div className="live-brand">WORLD<span>PULSE</span><small>PARTICIPAÇÃO EM TESTE</small></div>
      <span className="live-connection" role="status" data-testid="live-connection">{live.ready?'Sessão conectada':live.error?'Conexão indisponível':'Conectando…'}</span>
    </header>
    <nav className="live-navigation" aria-label="Painéis de participação">
      <button aria-expanded={rankingOpen} aria-controls="live-ranking" onClick={()=>{setRankingOpen(v=>!v);setBalancesOpen(false);}}>Top 10</button>
      <button aria-expanded={balancesOpen} aria-controls="live-balances" onClick={()=>{setBalancesOpen(v=>!v);setRankingOpen(false);}}>Meus saldos</button>
    </nav>
    {rankingOpen&&<aside id="live-ranking" className="live-panel live-ranking" aria-label="Ranking atual">
      <div className="live-panel-title"><h1>Top 10 agora</h1><button aria-label="Fechar ranking" onClick={()=>setRankingOpen(false)}>×</button></div>
      <p>Uma participação por hashtag com saldo positivo.</p>
      {live.rankingError&&<p role="status">Leitura indisponível. A última leitura pode estar desatualizada.</p>}
      {!live.ranking&&!live.rankingError&&<p>Carregando ranking…</p>}
      {live.ranking&&<>
        <small>Leitura: <time dateTime={new Date(live.ranking.asOfMs).toISOString()}>{new Date(live.ranking.asOfMs).toLocaleTimeString('pt-BR')}</time> · atualização a cada 5s</small>
        {live.ranking.ranking.length===0?<p>Nenhuma hashtag registrada ainda.</p>:<ol>
          {live.ranking.ranking.map(tag=><li key={tag.id}>
            <button disabled={!live.ready||live.selecting} onClick={()=>void live.select(tag.name)} aria-label={`Selecionar ${tag.name}`}>
              <span style={{color:tag.color}}>{tag.name}</span><strong>{count(tag.activeParticipants)}</strong>
            </button>
          </li>)}
        </ol>}
      </>}
    </aside>}
    {balancesOpen&&<aside id="live-balances" className="live-panel live-balances" aria-label="Meus saldos">
      <div className="live-panel-title"><h2>Seu tempo</h2><button aria-label="Fechar saldos" onClick={()=>setBalancesOpen(false)}>×</button></div>
      <p>Todos os saldos continuam diminuindo com a página fechada.</p>
      {live.balances.length===0?<p>Nenhum saldo confirmado ainda.</p>:<ul>{live.balances.map(balance=><li key={balance.tagId} data-live-tag={balance.name}>
        <button disabled={!live.ready||live.selecting} style={{color:balance.color}} onClick={()=>void live.select(balance.name??'')}>{balance.name??'Hashtag'}</button>
        <strong>{duration(live.remaining(balance.tagId))}</strong>
        <small>Histórico: {count(balance.creditedSeconds)} {balance.creditedSeconds==='1'?'segundo':'segundos'}</small>
      </li>)}</ul>}
    </aside>}
    <section className="live-controls" aria-label="Sua participação">
      <p className="live-geography" data-testid="live-geography">{mapError?'Mapa indisponível. Seus saldos continuam acessíveis.':mapReady?'Mapa aguardando geografia confiável. Nenhuma posição é inventada.':'Carregando mapa…'}</p>
      {mapError&&<button onClick={()=>{setMapReady(false);setMapError('');setMapVersion(v=>v+1);}}>Recarregar mapa</button>}
      <form onSubmit={select}>
        <label htmlFor="live-name">Sua hashtag</label>
        <div className="live-form-row"><input id="live-name" value={name} onChange={e=>setName(e.target.value)} maxLength={34} placeholder="#o_que_te_move" autoComplete="off" required/>
          <button type="submit" disabled={!live.ready||live.selecting}>Participar</button></div>
      </form>
      <div className="live-contribution">
        <div><strong data-testid="live-selected" style={{color:live.selected?.color}}>{live.selected?.name??'Escolha uma hashtag'}</strong>
          <span data-testid="live-selected-balance">{live.selected?duration(live.remaining(live.selected.id)):'Cada tap adiciona 1 segundo'}</span></div>
        <button className="live-tap" disabled={!live.ready||live.selecting||!live.selected} onClick={()=>void live.tap()}>+1 segundo</button>
      </div>
      <div className="live-queue"><span><b data-testid="live-pending">{live.pending}</b> taps aguardando confirmação</span>
        <button disabled={!live.ready||live.syncing||live.pending===0} onClick={()=>void live.sync()}>{live.syncing?'Sincronizando…':'Sincronizar'}</button></div>
      {live.error&&<p role="alert">{live.error}</p>}
      {!live.ready&&!live.quarantined&&live.error&&<button onClick={()=>void live.connect()}>Tentar conectar</button>}
      {live.quarantined&&<div className="live-quarantine"><p>A fila anterior foi preservada. Descartá-la pode perder taps ainda não reconhecidos.</p>
        <button onClick={()=>void live.discard()}>Descartar fila antiga e reconectar</button></div>}
      <details><summary>Como funciona e privacidade</summary>
        <p>Selecione uma hashtag e toque no planeta ou em +1 segundo. Arrastar e aproximar só navegam. Segundos extras não multiplicam participações no ranking.</p>
        <p>Este navegador usa uma sessão pseudônima. Após 30 dias sem retorno e com todos os saldos zerados, o histórico individual é consolidado nos totais por hashtag. Limpar cookies pode impedir sua recuperação.</p>
        <p>A origem geográfica ainda está indisponível. O mapa não contém participantes simulados nesta experiência.</p>
      </details>
    </section>
  </main>;
}
