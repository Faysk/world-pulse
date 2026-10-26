import {alphaUiBuildEnabled} from './preview-gate.mjs';
export const siteOrigin='https://map.faysk.dev';
export const homeTitle='World Pulse — Live Hashtags on a World Map';
export const homeDescription='Explore live hashtags on an interactive globe. Add time to what moves you and share an approximate location to light up the map.';
export const aboutPages=[
  {lang:'en',path:'/about/',title:'About World Pulse — How the live hashtag map works',description:'How World Pulse works: active hashtags, time, approximate location, privacy and the open-source project.',heading:'A world moved by you.',intro:'World Pulse is an interactive world map of the hashtags people choose to keep active. Pick what moves you, add time and explore the places lighting up around it.',enter:'Explore the globe',how:'How it works',steps:['Enter a hashtag. Each tap adds one second to its remaining time; confirmed time keeps counting down when you leave.','You can keep several hashtags active. Only the one you are tapping receives new time.','The Top 10 counts active sessions per hashtag, not taps or verified people. A participation leaves the map and ranking when its time runs out. Updates can take about five seconds.'],privacy:'Your location, your choice',privacyText:'Location is optional. The browser is asked for permission, and coordinates are rounded on your device to a region roughly 1 km across before sending. Your name and exact coordinates are not published. An approximate region can still reveal information about you; a browser estimate can also be wrong.',withdrawal:'Switch Location off to remove your regional point and country sharing from future readings. Copies already received cannot be recalled. Your time balances remain.',session:'Time and recovery',sessionText:'A pseudonymous browser session and local queue preserve your balances and pending taps. There is no account login. Clearing browser data can prevent recovery. After 30 days without returning and with all balances at zero, individual history is consolidated into hashtag totals and the session is removed. Encrypted recovery copies have a 7-day retention target; maintenance failures can delay removal.',source:'Built in the open',sourceText:'Read the code and documentation, or report a problem on GitHub. This is an evolving public project; counts represent browser sessions and location is approximate.',github:'Code, documentation and issues',home:'World map',notice:'The live map needs JavaScript and WebGL. This page remains readable without JavaScript.'},
  {lang:'pt',path:'/pt/sobre/',title:'Sobre o World Pulse — Como funciona o mapa de hashtags',description:'Como funciona o World Pulse: hashtags ativas, tempo, localização aproximada, privacidade e o projeto aberto.',heading:'Um mundo movido por você.',intro:'World Pulse é um mapa interativo das hashtags que as pessoas escolhem manter ativas. Escolha o que move você, adicione tempo e explore os lugares que se acendem ao redor.',enter:'Explorar o globo',how:'Como funciona',steps:['Entre em uma hashtag. Cada toque adiciona um segundo ao saldo; o tempo confirmado continua diminuindo quando você sai.','Você pode manter várias hashtags ativas. Só a que recebe seus toques ganha tempo novo.','O Top 10 conta sessões ativas por hashtag, não cliques ou pessoas verificadas. A participação sai do mapa e do ranking quando o saldo acaba. As atualizações podem levar cerca de cinco segundos.'],privacy:'Sua localização, sua escolha',privacyText:'Localização é opcional. O navegador pede autorização, e as coordenadas são arredondadas no seu aparelho para uma região de aproximadamente 1 km antes do envio. Seu nome e suas coordenadas exatas não são publicados. A região ainda pode revelar informações sobre você; a estimativa do navegador também pode estar errada.',withdrawal:'Desligue Localização para retirar seu ponto regional e o compartilhamento de país das próximas leituras. Cópias já recebidas não podem ser recolhidas. Seus saldos de tempo permanecem.',session:'Tempo e recuperação',sessionText:'Uma sessão pseudônima do navegador e uma fila local preservam saldos e toques pendentes. Não há login de conta. Limpar os dados do navegador pode impedir a recuperação. Após 30 dias sem retorno e com todos os saldos zerados, o histórico individual é consolidado nos totais por hashtag e a sessão é removida. Cópias criptografadas de recuperação têm uma meta de retenção de sete dias; falhas de manutenção podem atrasar a remoção.',source:'Construído em aberto',sourceText:'Leia o código e a documentação ou relate um problema no GitHub. Este é um projeto público em evolução; as contagens representam sessões de navegador e a localização é aproximada.',github:'Código, documentação e issues',home:'Mapa mundial',notice:'O mapa ao vivo precisa de JavaScript e WebGL. Esta página continua legível sem JavaScript.'},
  {lang:'es',path:'/es/acerca/',title:'Acerca de World Pulse — Cómo funciona el mapa de hashtags',description:'Cómo funciona World Pulse: hashtags activos, tiempo, ubicación aproximada, privacidad y el proyecto abierto.',heading:'Un mundo que tú mueves.',intro:'World Pulse es un mapa interactivo de los hashtags que las personas deciden mantener activos. Elige lo que te mueve, añade tiempo y explora los lugares que se iluminan a su alrededor.',enter:'Explorar el globo',how:'Cómo funciona',steps:['Entra en un hashtag. Cada toque añade un segundo al saldo; el tiempo confirmado sigue disminuyendo cuando sales.','Puedes mantener varios hashtags activos. Solo el que recibe tus toques gana tiempo nuevo.','El Top 10 cuenta sesiones activas por hashtag, no clics ni personas verificadas. La participación sale del mapa y del ranking cuando se acaba el saldo. Las actualizaciones pueden tardar unos cinco segundos.'],privacy:'Tu ubicación, tu decisión',privacyText:'La ubicación es opcional. El navegador pide permiso, y las coordenadas se redondean en tu dispositivo a una región de aproximadamente 1 km antes de enviarlas. No se publican tu nombre ni tus coordenadas exactas. La región aún puede revelar información sobre ti; la estimación del navegador también puede ser incorrecta.',withdrawal:'Desactiva Ubicación para retirar tu punto regional y el país de las próximas lecturas. Las copias ya recibidas no pueden recuperarse. Tus saldos de tiempo permanecen.',session:'Tiempo y recuperación',sessionText:'Una sesión seudónima del navegador y una cola local conservan los saldos y los toques pendientes. No hay inicio de sesión de cuenta. Borrar los datos del navegador puede impedir la recuperación. Tras 30 días sin volver y con todos los saldos a cero, el historial individual se consolida en los totales por hashtag y se elimina la sesión. Las copias cifradas tienen un objetivo de retención de siete días; los fallos de mantenimiento pueden retrasar su eliminación.',source:'Construido en abierto',sourceText:'Consulta el código y la documentación o informa de un problema en GitHub. Este es un proyecto público en evolución; los recuentos representan sesiones de navegador y la ubicación es aproximada.',github:'Código, documentación e issues',home:'Mapa mundial',notice:'El mapa en vivo necesita JavaScript y WebGL. Esta página sigue siendo legible sin JavaScript.'}
];
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function searchHead({indexable=false,path='/',title=homeTitle,description=homeDescription,language='en',alternates=false}={}){
  const canonical=siteOrigin+path;
  return `<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta name="robots" content="${indexable?'index, follow, max-image-preview:large':'noindex, nofollow'}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
<link rel="icon" href="/icons/icon-48.png" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="/icons/icon-180.png" sizes="180x180">
<link rel="manifest" href="/site.webmanifest">
<meta name="application-name" content="World Pulse">
<meta name="apple-mobile-web-app-title" content="World Pulse">
<meta property="og:type" content="website">
<meta property="og:site_name" content="World Pulse">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${siteOrigin}/social-card.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="World Pulse — live hashtags on a shared world map">
<meta property="og:locale" content="${language==='pt'?'pt_PT':language==='es'?'es_ES':'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${siteOrigin}/social-card.png">
<meta name="twitter:image:alt" content="World Pulse — live hashtags on a shared world map">
${alternates?aboutPages.map(page=>`<link rel="alternate" hreflang="${page.lang}" href="${siteOrigin+page.path}">`).join('\n')+`\n<link rel="alternate" hreflang="x-default" href="${siteOrigin}/about/">`:''}
${path==='/'?'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'WebSite','@id':siteOrigin+'/#website',url:siteOrigin+'/',name:'World Pulse',description:homeDescription,inLanguage:['en','pt','es']},{'@type':'WebApplication','@id':siteOrigin+'/#app',url:siteOrigin+'/',name:'World Pulse',applicationCategory:'SocialNetworkingApplication',operatingSystem:'Web',description:homeDescription,image:siteOrigin+'/social-card.png'}]}).replace(/</g,'\\u003c')+'</script>':''}`;
}
export function renderAbout(page,indexable=false){
  return `<!doctype html><html lang="${page.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101112">${searchHead({indexable,path:page.path,title:page.title,description:page.description,language:page.lang,alternates:true})}<link rel="stylesheet" href="/brand.css"></head><body class="about-page"><header class="about-header"><a class="brand-link" href="/" aria-label="World Pulse"><img src="/favicon.svg" width="40" height="40" alt="">WORLD<span>PULSE</span></a><nav aria-label="Language">${aboutPages.map(p=>`<a href="${p.path}" lang="${p.lang}" hreflang="${p.lang}"${p.lang===page.lang?' aria-current="page"':''}>${p.lang==='en'?'English':p.lang==='pt'?'Português':'Español'}</a>`).join('')}</nav></header><main class="about-main"><section class="about-intro"><p class="eyebrow">WORLD PULSE</p><h1>${escape(page.heading)}</h1><p class="lead">${escape(page.intro)}</p><a class="primary-link" href="/">${escape(page.enter)} <span aria-hidden="true">↗</span></a></section><section><h2>${escape(page.how)}</h2><ol>${page.steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol></section><section><h2>${escape(page.privacy)}</h2><p>${escape(page.privacyText)}</p><p>${escape(page.withdrawal)}</p></section><section><h2>${escape(page.session)}</h2><p>${escape(page.sessionText)}</p></section><section><h2>${escape(page.source)}</h2><p>${escape(page.sourceText)}</p><a href="https://github.com/Faysk/world-pulse">${escape(page.github)} ↗</a></section></main><footer class="about-footer"><a href="/">${escape(page.home)}</a><p>${escape(page.notice)}</p></footer></body></html>`;
}
export function discoveryFiles(indexable){
  const urls=indexable?['/',...aboutPages.map(page=>page.path)]:[];
  return {
    'robots.txt':indexable?`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteOrigin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n',
    'sitemap.xml':'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(path=>`<url><loc>${siteOrigin+path}</loc></url>`).join('')+'</urlset>\n'
  };
}
export function searchPresence(env){
  const indexable=alphaUiBuildEnabled(env);
  return {name:'world-pulse-search-presence',
    transformIndexHtml:html=>html.replace('<!-- wp:search-head -->',searchHead({indexable})),
    generateBundle(){
      for(const [fileName,source]of Object.entries(discoveryFiles(indexable)))this.emitFile({type:'asset',fileName,source});
      for(const page of aboutPages)this.emitFile({type:'asset',fileName:page.path.slice(1)+'index.html',source:renderAbout(page,indexable)});
    },
    configureServer(server){server.middlewares.use((req,res,next)=>{
      const path=(req.url??'').split('?')[0],page=aboutPages.find(page=>page.path===path);
      const files=discoveryFiles(false),file=path.slice(1);
      if(!page&&!Object.hasOwn(files,file))return next();
      res.setHeader('Content-Type',page?'text/html; charset=utf-8':file.endsWith('.xml')?'application/xml; charset=utf-8':'text/plain; charset=utf-8');
      res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(page?renderAbout(page,false):files[file]);
    });}
  };
}
