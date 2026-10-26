import { useMemo, useState, type FormEvent } from 'react';
import type { Map as MapInstance } from 'maplibre-gl';
import { WorldGlobe } from './WorldGlobe';
import type { PulseCollection } from './demoData';
import { useParticipation } from './useParticipation';
import {tagLabelStyle} from './tagLabel';
import {countryTagPage} from './countryComposition';
import './liveExperience.css';
import {WorldLoading} from './WorldLoading';
import {RegionalPointLayer} from './RegionalPointLayer';
import type {RegionRow} from './regionalTypes';

const EMPTY_GEOGRAPHY:PulseCollection={type:'FeatureCollection',features:[]};
const numberFormat=Intl.NumberFormat('pt-BR');
const count=(value:string)=>numberFormat.format(BigInt(value));
function duration(ms:number){const seconds=Math.ceil(ms/1000);return `${Math.floor(seconds/3600)}h ${String(Math.floor(seconds/60)%60).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;}

export default function LiveExperience(){
  const [countriesOpen,setCountriesOpen]=useState(false);
  const live=useParticipation(countriesOpen);
  const [map,setMap]=useState<MapInstance|null>(null);
  const [countryPick,setCountryPick]=useState<string|null>(null);

  const [focusSelected,setFocusSelected]=useState(false);
  const [countrySearch,setCountrySearch]=useState('');
  const [countryPage,setCountryPage]=useState(0);
  const focusId=focusSelected&&live.selected?live.selected.id:null;
  const countryRows=useMemo(()=>countryTagPage(live.countrySnapshot,countryPick,countrySearch,countryPage),[live.countrySnapshot,countryPick,countrySearch,countryPage]);
  const countryTag=live.countrySnapshot?.tags.find(tag=>tag.id===live.selected?.id);
  const [name,setName]=useState('');
  const [rankingOpen,setRankingOpen]=useState(()=>window.innerWidth>760);
  const [balancesOpen,setBalancesOpen]=useState(false);
  const [mapReady,setMapReady]=useState(false);
  const [mapError,setMapError]=useState('');
  const [mapVersion,setMapVersion]=useState(0);
  const ownTags=live.regional.cell&&live.countryPreference.available?[...live.balances.map(row=>({id:row.tagId,name:row.name??'',color:row.color??'#63d7bd'})),...(live.selected?[live.selected]:[])].filter((tag,index,rows)=>live.remaining(tag.id)>0&&rows.findIndex(row=>row.id===tag.id)===index):[];
  const ownSignature=JSON.stringify(ownTags.map(tag=>({cell:live.regional.cell!,tagId:tag.id,name:tag.name,color:tag.color,participants:'1'})));
  const ownPoints=useMemo(()=>JSON.parse(ownSignature) as RegionRow[],[ownSignature]);
  async function select(event:FormEvent){event.preventDefault();await live.select(name);}
  return <main className="live-world" aria-label="World Pulse participação">
    <WorldGlobe key={mapVersion} ariaLabel="Globo interativo com pontos regionais" scale={0} population={EMPTY_GEOGRAPHY} selected={null} cityLights={false}
      onReady={instance=>{setMap(instance);setMapReady(true);setMapError('');}}
      onCountryPick={code=>{setCountryPick(code);setCountrySearch('');setCountryPage(0);setCountriesOpen(true);setRankingOpen(false);setBalancesOpen(false);}} onZoom={()=>{}} onFps={()=>{}}
      onRegionPick={tag=>void live.select(tag)} onTap={()=>void live.tap()} onTagPick={()=>{}} onFailure={setMapError}/>
    <RegionalPointLayer map={map} snapshot={live.regional.snapshot} own={ownPoints} tagId={focusId}/>
    <WorldLoading ready={mapReady||Boolean(mapError)}/>
    <div className="live-shade" aria-hidden="true"/>
    <header className="live-header">
      <div className="live-brand">WORLD<span>PULSE</span><small>PARTICIPAÇÃO EM TESTE</small></div>
      <span className="live-connection" role="status" data-testid="live-connection">{live.ready?'Sessão conectada':live.error?'Conexão indisponível':'Conectando…'}</span>
    </header>
    <nav className="live-navigation" aria-label="Painéis de participação">
      <button aria-expanded={rankingOpen} aria-controls="live-ranking" onClick={()=>{setRankingOpen(v=>!v);setBalancesOpen(false);setCountriesOpen(false);}}>Top 10</button>
      <button aria-expanded={countriesOpen} aria-controls="live-countries-panel" onClick={()=>{setCountriesOpen(v=>!v);setRankingOpen(false);setBalancesOpen(false);}}>Países</button>
      <button aria-expanded={balancesOpen} aria-controls="live-balances" onClick={()=>{setBalancesOpen(v=>!v);setRankingOpen(false);setCountriesOpen(false);}}>Meus saldos</button>
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
              <span style={tagLabelStyle(tag.color)}>{tag.name}</span><strong>{count(tag.activeParticipants)}</strong>
            </button>
          </li>)}
        </ol>}
      </>}
    </aside>}
    {balancesOpen&&<aside id="live-balances" className="live-panel live-balances" aria-label="Meus saldos">
      <div className="live-panel-title"><h2>Seu tempo</h2><button aria-label="Fechar saldos" onClick={()=>setBalancesOpen(false)}>×</button></div>
      <p>Todos os saldos continuam diminuindo com a página fechada.</p>
      {live.balancesLimited&&<p role="status">Mostrando até 200 saldos: a hashtag selecionada e os positivos têm prioridade. Os demais continuam no servidor; digite a hashtag para recuperar seu saldo.</p>}
      {live.balances.length===0?<p>Nenhum saldo confirmado ainda.</p>:<ul>{live.balances.map(balance=><li key={balance.tagId} data-live-tag={balance.name}>
        <button disabled={!live.ready||live.selecting} style={tagLabelStyle(balance.color)} onClick={()=>void live.select(balance.name??'')}>{balance.name??'Hashtag'}</button>
        <strong>{duration(live.remaining(balance.tagId))}</strong>
        <small>Histórico: {count(balance.creditedSeconds)} {balance.creditedSeconds==='1'?'segundo':'segundos'}</small>
      </li>)}</ul>}
    </aside>}
    {countriesOpen&&<aside id="live-countries-panel" className="live-panel live-ranking" aria-label="Participação por país">
      <div className="live-panel-title"><h2>{countryPick?'País '+countryPick:'Origens e cores'}</h2><button aria-label="Fechar países" onClick={()=>setCountriesOpen(false)}>×</button></div>
      <p>{focusId?`Foco em ${live.selected?.name}.`:'Visão geral com várias hashtags por país.'} A área não representa quantidade ou posição de pessoas.</p>
      <button disabled={!live.selected} aria-pressed={Boolean(focusId)} onClick={()=>{setFocusSelected(v=>!v);setCountryPick(null);setCountryPage(0);}}>{focusId?'Ver todas as cores':'Focar hashtag selecionada'}</button>
      <p>Faixas mostram até quatro cores principais; cinza reúne as demais hashtags. A quantização pode deixar minorias sem faixa: consulte os números e use o foco. Cores iguais podem pertencer a hashtags diferentes.</p>
      {countryPick&&<button onClick={()=>{setCountryPick(null);setCountrySearch('');setCountryPage(0);}}>Ver todas as origens</button>}
      {!live.countryPreference.available?<p>Geografia ainda desativada neste ambiente.</p>:live.countryError?<p role="status">Leitura geográfica indisponível.</p>:!live.countrySnapshot?<p>Carregando países…</p>:<>
        <small>Leitura: {new Date(live.countrySnapshot.asOfMs).toLocaleTimeString('pt-BR')} · até 5s de intervalo</small>
        {live.selected&&<p>Origens de {live.selected.name}:</p>}
        {live.selected&&(!countryTag?.countries.length?<p>Nenhuma participação ativa nesta hashtag.</p>:<ul>{countryTag.countries.map(country=><li key={country.countryCode}><span>{country.countryCode==='ZZ'?'Origem desconhecida / sem compartilhamento':country.countryCode==='OTHER'?'Outros países (grupos menores que 5)':country.countryCode}</span><strong>{count(country.activeParticipants)}</strong></li>)}</ul>)}
        {countryPick&&<p>País inspecionado: {countryPick}. Este toque não adiciona segundos.</p>}
        <label htmlFor="country-search">Buscar hashtag {countryPick?'em '+countryPick:'nesta leitura'}</label>
        <input id="country-search" value={countrySearch} maxLength={33} onChange={event=>{setCountrySearch(event.target.value);setCountryPage(0);}} placeholder="#hashtag"/>
        <p>{countryRows.total} hashtags · participações por sessão/hashtag, não pessoas únicas.</p>
        <ul>{countryRows.rows.map(tag=><li key={tag.id}><button disabled={!live.ready||live.selecting} style={tagLabelStyle(tag.color)} onClick={()=>void live.select(tag.name)}>{tag.name}</button><strong>{count(tag.participants)}</strong></li>)}</ul>
        {countryRows.total===0&&<p>Nenhuma hashtag encontrada nesta origem.</p>}
        <div className="live-country-pages"><button disabled={countryRows.page===0} onClick={()=>setCountryPage(countryRows.page-1)}>Anterior</button><span>Página {countryRows.page+1} de {countryRows.pages}</span><button disabled={countryRows.page+1>=countryRows.pages} onClick={()=>setCountryPage(countryRows.page+1)}>Próxima</button></div>
      </>}
      <p>País estimado pela conexão, sujeito a VPN e erros. Pequenos grupos são agrupados. Algumas ilhas e territórios não têm desenho nesta escala; seus totais continuam na lista.</p>
    </aside>}
    <section className="live-controls" aria-label="Sua participação">
      <p className="live-geography" data-testid="live-geography">{mapError?'Mapa indisponível. Seus saldos continuam acessíveis.':!mapReady?'Carregando mapa…':live.regional.readError?'Leitura regional indisponível. Seus taps continuam funcionando.':'Cada participação ativa forma um ponto regional. Pontos próximos formam manchas. Nenhuma posição é inventada.'}</p>
      {mapError&&<button onClick={()=>{setMap(null);setMapReady(false);setMapError('');setMapVersion(v=>v+1);}}>Recarregar mapa</button>}
      <div className="live-sharing" aria-label="Seu ponto regional">
        <strong>Seu ponto no mapa</strong>
        <p>{live.regional.cell?'Ponto público em uma célula de cerca de 55 km. Atualize se mudou de região.':'Ative para compartilhar uma célula de cerca de 55 km no mapa público, mesmo sozinho. Coordenadas exatas não são enviadas; a região ainda pode revelar informações sobre você.'}</p>
        <button disabled={!live.ready||!live.countryPreference.available||live.regional.busy} onClick={live.regional.locate}>{live.regional.busy?'Localizando…':live.regional.cell?'Atualizar meu ponto':'Ativar meu ponto'}</button>
        {live.regional.cell&&<button disabled={live.regional.busy} onClick={()=>void live.regional.withdraw()}>Remover meu ponto</button>}
        {ownPoints.length>0&&<small data-testid="live-regional-point">Seu ponto regional está ativo. {live.pending>0?'O tempo provisório aguarda confirmação.':''}</small>}
        {live.regional.cell&&!ownPoints.length&&<small>Localização regional salva. Adicione tempo para acender seu ponto.</small>}
        {live.regional.error&&<p role="status">{live.regional.error}</p>}
      </div>
      <div className="live-sharing" aria-label="Compartilhamento de país">
        <label><input type="checkbox" checked={live.shareCountry} disabled={live.consentBusy} onChange={event=>void live.setGeoConsent(event.target.checked)}/> Compartilhar meu país aproximado</label>
        <p>{live.shareCountry?'Ao participar, você compartilha seu país nos resumos, sem nome.':'Você participa sem compartilhar seu país.'} O ponto regional tem autorização separada.</p>
        {!live.countryPreference.available&&<small>O país ainda está indisponível neste ambiente; sua participação continua funcionando.</small>}
        {live.countryPreference.available&&<small>País estimado: {live.countryPreference.country==='ZZ'?'a confirmar ao participar':live.countryPreference.country} · resumos ocultam grupos menores que 5.</small>}
      </div>
      {live.consentBusy&&<small role="status">Salvando sua escolha de país…</small>}
      <form onSubmit={select}>
        <label htmlFor="live-name">Sua hashtag</label>
        <div className="live-form-row"><input id="live-name" value={name} onChange={e=>setName(e.target.value)} maxLength={34} placeholder="#o_que_te_move" autoComplete="off" required/>
          <button type="submit" disabled={!live.ready||live.selecting}>Participar</button></div>
      </form>
      <div className="live-contribution">
        <div><strong data-testid="live-selected" style={tagLabelStyle(live.selected?.color)}>{live.selected?.name??'Escolha uma hashtag'}</strong>
          <span data-testid="live-selected-balance">{live.selected?duration(live.remaining(live.selected.id)):'Cada tap adiciona 1 segundo'}</span></div>
        <button className="live-tap" disabled={!live.ready||live.selecting||!live.selected} onClick={()=>void live.tap()}>+1 segundo</button>
      </div>
      {live.pending>0&&<small className="live-provisional">Tempo exibido inclui taps ainda não confirmados. O histórico só muda após confirmação.</small>}
      <div className="live-queue"><span><b data-testid="live-pending">{live.pending}</b> taps aguardando confirmação</span>
        <button disabled={!live.ready||live.syncing||live.pending===0} onClick={()=>void live.sync()}>{live.syncing?'Sincronizando…':'Sincronizar'}</button></div>
      {!live.persistent&&<p role="status">O armazenamento está indisponível. Fechar esta aba pode perder os taps ainda não confirmados.</p>}
      {live.deliveryNotice&&<p role="status">{live.deliveryNotice}</p>}
      {live.error&&<p role="alert">{live.error}</p>}
      {!live.ready&&!live.quarantined&&live.error&&<button onClick={()=>void live.connect()}>Tentar conectar</button>}
      {live.quarantined&&<div className="live-quarantine"><p>A fila anterior foi preservada. Descartá-la pode perder taps ainda não reconhecidos.</p>
        <button onClick={()=>void live.discard()}>Descartar fila antiga e reconectar</button></div>}
      <details><summary>Como funciona e privacidade</summary>
        <p>Selecione uma hashtag e use +1 segundo ou toque no terreno sem ponto. Pontos representam regiões aproximadas, não posições exatas. Tocar um ponto seleciona a hashtag sem adicionar tempo. Arrastar e aproximar só navegam. Segundos extras não multiplicam participações no ranking.</p>
        <p>Este navegador usa uma sessão pseudônima. Após 30 dias sem retorno e com todos os saldos zerados, o histórico individual é consolidado nos totais por hashtag. Limpar cookies pode impedir sua recuperação.</p>
        <p>Opcional. Sua participação continua no ranking sem compartilhar. País atual: {live.countryPreference.country==='ZZ'?'desconhecido':live.countryPreference.country}. Retirar a opção remove seu país das próximas leituras; cópias já recebidas não podem ser apagadas.</p>
        <p>O navegador arredonda a localização para uma célula regional antes de enviar. Não enviamos coordenadas exatas ou cidade. O ponto regional aparece mesmo com uma participação; os resumos por país agrupam cinco sessões. Isso não garante anonimato: comparações entre leituras podem revelar mudanças. O mapa não contém participantes simulados.</p>
      </details>
    </section>
  </main>;
}
