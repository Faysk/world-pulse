export const english = {
  helpIntro: "Your current data first. Explore the explanations below.",
  yourLocation: "Your location",
  sharingOn: "On",
  sharingOff: "Off",
  regionHint: "Size of the region used for your public point.",
  accuracyHint:
    "Margin reported for this reading, before rounding. It can still be wrong.",
  noSavedPoint: "No saved point",
  noCurrentReading: "No reading in this tab",
  participationHeading: "Participating and ranking",
  globeHeading: "Exploring the globe",
  privacyHeading: "Location and privacy",
  providerHeading: "How location is estimated",
  sessionHeading: "Session, time and synchronization",
  providerHelp:
    "The browser chooses GPS, Wi-Fi or network data; the app cannot identify the source. We request high accuracy and reject a reported margin above 1 km, but the provider can still be wrong.",
  countryHelp:
    "Country summaries use an estimate from the connection, which can be wrong with VPNs. Groups smaller than five sessions are combined.",
  limited:
    "Showing up to 200 balances. Select a hashtag to restore older time.",
  invalid: "Use 2–32 letters, numbers or _ in your hashtag.",
  location: "Location",
  enter: "Enter",
  countries: "Countries",
  balances: "My time",
  help: "How it works",
  close: "Close",
  choose: "Choose a hashtag",
  hashtag: "Your hashtag",
  placeholder: "#what_moves_you",
  ranking: "Top 10",
  empty: "Nothing here yet.",
  loading: "Loading…",
  unavailable: "Temporarily unavailable.",
  retry: "Try again",
  history: "History",
  focus: "Focus selected hashtag",
  all: "Show all",
  search: "Search hashtags",
  previous: "Previous",
  next: "Next",
  unknown: "Unknown / not shared",
  other: "Other countries",
  connecting: "Connecting the world",
  savedRegion: "Saved point region",
  legacyLocation:
    "Your point still uses the older region (~55 km). Switch Location off and on to update.",
  reportedAccuracy: "Browser-reported accuracy",
  locationImprecise:
    "Location is too imprecise for your point. Enable precise location for this browser and try again. You can still participate without a point.",
  locationError:
    "Location could not be updated. Check browser permission and try again.",
  connectionError:
    "Connection unavailable. Your pending taps remain on this device.",
  storageError:
    "Storage unavailable. Keep this tab open to preserve pending taps.",
  queueError:
    "Your previous session has pending taps. Discarding them cannot be undone.",
  discard: "Discard old queue and reconnect",
  intro:
    "Pick a hashtag and press +1. Each tap adds one second. Your time keeps counting down, even when you leave. You can support several hashtags; only the selected one receives new taps.",
  mapHelp:
    "Each active participation becomes a regional point. Nearby points form patches. Tap a point to select its hashtag; tap empty terrain to add time. Drag and zoom to explore. No participants or positions are invented.",
  rankingHelp:
    "The ranking counts one active session per hashtag, regardless of the seconds added. When its time runs out, that participation leaves the ranking and map. Updates can take about five seconds.",
  privacy:
    "Location is optional. When enabled, it shares a public regional point and country summaries. Coordinates are rounded on your device to a region roughly 1 km across before sending; exact coordinates and your name are not published. The region can still reveal information about you, especially in sparsely populated areas.",
  withdrawal:
    "Switch Location off to remove both from future readings. Copies already received cannot be recalled. Turning this switch off does not revoke the browser permission; you can do that in browser settings.",
  retention:
    "This browser uses a pseudonymous session. After 30 days without returning, with all balances at zero, individual history is consolidated into hashtag totals and the session is removed. Encrypted recovery copies have a 7-day retention target; failed maintenance can delay removal. Clearing cookies can prevent recovery.",
  syncHelp:
    "Taps appear immediately and synchronize automatically in the background. Displayed time may include pending taps; confirmed history updates after delivery. Closing the page before confirmation may delay delivery. Cookies and local storage keep your session and pending queue.",
  source: "Code, documentation and issues on GitHub",
  languageHelp:
    "Language follows the identified country when supported. Without location, English is used. You can change it here.",
  language: "Language",
  auto: "Automatic",
};
export type Copy = typeof english;
const pt: Copy = {
  ...english,
  helpIntro: "Os dados atuais primeiro. Explore as explicações abaixo.",
  yourLocation: "Sua localização",
  sharingOn: "Ligada",
  sharingOff: "Desligada",
  regionHint: "Tamanho da região usada para exibir seu ponto público.",
  accuracyHint:
    "Margem informada nesta leitura, antes do arredondamento. Ela ainda pode estar errada.",
  noSavedPoint: "Nenhum ponto salvo",
  noCurrentReading: "Sem leitura nesta aba",
  participationHeading: "Participação e ranking",
  globeHeading: "Explorando o globo",
  privacyHeading: "Localização e privacidade",
  providerHeading: "Como a localização é estimada",
  sessionHeading: "Sessão, tempo e sincronização",
  providerHelp:
    "O navegador escolhe GPS, Wi-Fi ou dados de rede; o app não consegue identificar a fonte. Pedimos alta precisão e recusamos uma margem informada acima de 1 km, mas o provedor ainda pode errar.",
  countryHelp:
    "Os resumos por país usam uma estimativa da conexão, que pode estar errada com VPNs. Grupos menores que cinco sessões são reunidos.",
  savedRegion: "Região do ponto salvo",
  legacyLocation:
    "Seu ponto ainda usa a região antiga (~55 km). Desligue e ligue Localização para atualizar.",
  reportedAccuracy: "Margem informada pelo navegador",
  locationImprecise:
    "Localização imprecisa para seu ponto. Ative a localização precisa para este navegador e tente novamente. Você pode continuar participando sem ponto.",
  limited:
    "Mostrando até 200 saldos. Selecione uma hashtag para recuperar o tempo anterior.",
  invalid: "Use de 2 a 32 letras, números ou _ na hashtag.",
  location: "Localização",
  enter: "Entrar",
  countries: "Países",
  balances: "Meu tempo",
  help: "Como funciona",
  close: "Fechar",
  choose: "Escolha uma hashtag",
  hashtag: "Sua hashtag",
  placeholder: "#o_que_te_move",
  empty: "Nada por aqui ainda.",
  loading: "Carregando…",
  unavailable: "Temporariamente indisponível.",
  retry: "Tentar novamente",
  history: "Histórico",
  focus: "Focar hashtag selecionada",
  all: "Ver todas",
  search: "Buscar hashtags",
  previous: "Anterior",
  next: "Próxima",
  unknown: "Desconhecido / sem compartilhamento",
  other: "Outros países",
  connecting: "Conectando o mundo",
  locationError:
    "Não foi possível atualizar a localização. Confira a permissão do navegador e tente novamente.",
  connectionError:
    "Conexão indisponível. Seus taps pendentes continuam neste dispositivo.",
  storageError:
    "Armazenamento indisponível. Mantenha esta aba aberta para preservar os taps pendentes.",
  queueError:
    "A sessão anterior tem taps pendentes. Descartá-los não pode ser desfeito.",
  discard: "Descartar fila antiga e reconectar",
  intro:
    "Escolha uma hashtag e toque em +1. Cada toque adiciona um segundo. O tempo continua diminuindo mesmo quando você sai. Você pode apoiar várias hashtags; só a selecionada recebe novos taps.",
  mapHelp:
    "Cada participação ativa forma um ponto regional. Pontos próximos formam manchas. Toque em um ponto para selecionar a hashtag; toque no terreno vazio para adicionar tempo. Arraste e aproxime para explorar. Nenhuma participação ou posição é inventada.",
  rankingHelp:
    "O ranking conta uma sessão ativa por hashtag, independentemente dos segundos adicionados. Quando o saldo zera, essa participação sai do ranking e do mapa. As atualizações podem levar cerca de cinco segundos.",
  privacy:
    "Localização é opcional. Ao ligar, você compartilha um ponto regional público e os resumos por país. As coordenadas são arredondadas no seu dispositivo para uma região de cerca de 1 km antes do envio; coordenadas exatas e seu nome não são publicados. A região ainda pode revelar informações sobre você, principalmente em áreas pouco povoadas.",
  withdrawal:
    "Desligue Localização para retirar ambos das próximas leituras. Cópias já recebidas não podem ser apagadas. Desligar a chave não revoga a permissão do navegador; isso pode ser feito nas configurações dele.",
  retention:
    "Este navegador usa uma sessão pseudônima. Após 30 dias sem retorno, com todos os saldos zerados, o histórico individual é consolidado nos totais por hashtag e a sessão é removida. Cópias criptografadas de recuperação têm retenção prevista de 7 dias; falhas na manutenção podem atrasar a remoção. Limpar cookies pode impedir a recuperação.",
  syncHelp:
    "Os taps aparecem imediatamente e sincronizam automaticamente em segundo plano. O tempo exibido pode incluir taps pendentes; o histórico confirmado muda após a entrega. Fechar a página antes da confirmação pode atrasar a entrega. Cookies e armazenamento local mantêm a sessão e a fila pendente.",
  source: "Código, documentação e issues no GitHub",
  languageHelp:
    "O idioma segue o país identificado quando disponível. Sem localização, usamos inglês. Você pode alterar aqui.",
  language: "Idioma",
  auto: "Automático",
};
const es: Copy = {
  ...english,
  helpIntro: "Tus datos actuales primero. Explora las explicaciones abajo.",
  yourLocation: "Tu ubicación",
  sharingOn: "Activada",
  sharingOff: "Desactivada",
  regionHint: "Tamaño de la región usada para mostrar tu punto público.",
  accuracyHint:
    "Margen informado en esta lectura, antes del redondeo. Aún puede ser incorrecto.",
  noSavedPoint: "Ningún punto guardado",
  noCurrentReading: "Sin lectura en esta pestaña",
  participationHeading: "Participación y ranking",
  globeHeading: "Explorar el globo",
  privacyHeading: "Ubicación y privacidad",
  providerHeading: "Cómo se estima la ubicación",
  sessionHeading: "Sesión, tiempo y sincronización",
  providerHelp:
    "El navegador elige GPS, Wi-Fi o datos de red; la app no puede identificar la fuente. Pedimos alta precisión y rechazamos un margen informado superior a 1 km, pero el proveedor aún puede equivocarse.",
  countryHelp:
    "Los resúmenes por país usan una estimación de la conexión, que puede ser incorrecta con VPN. Los grupos de menos de cinco sesiones se combinan.",
  savedRegion: "Región del punto guardado",
  legacyLocation:
    "Tu punto aún usa la región anterior (~55 km). Desactiva y activa Ubicación para actualizar.",
  reportedAccuracy: "Margen informado por el navegador",
  locationImprecise:
    "Ubicación demasiado imprecisa para tu punto. Activa la ubicación precisa para este navegador e inténtalo de nuevo. Puedes seguir participando sin punto.",
  limited:
    "Se muestran hasta 200 saldos. Selecciona un hashtag para recuperar su tiempo anterior.",
  invalid: "Usa de 2 a 32 letras, números o _ en tu hashtag.",
  location: "Ubicación",
  enter: "Entrar",
  countries: "Países",
  balances: "Mi tiempo",
  help: "Cómo funciona",
  close: "Cerrar",
  choose: "Elige un hashtag",
  hashtag: "Tu hashtag",
  placeholder: "#lo_que_te_mueve",
  empty: "Todavía no hay datos.",
  loading: "Cargando…",
  unavailable: "Temporalmente no disponible.",
  retry: "Reintentar",
  history: "Historial",
  focus: "Enfocar hashtag seleccionado",
  all: "Ver todos",
  search: "Buscar hashtags",
  previous: "Anterior",
  next: "Siguiente",
  unknown: "Desconocido / sin compartir",
  other: "Otros países",
  connecting: "Conectando el mundo",
  locationError:
    "No se pudo actualizar la ubicación. Revisa el permiso del navegador e inténtalo de nuevo.",
  connectionError:
    "Conexión no disponible. Tus taps pendientes siguen en este dispositivo.",
  storageError:
    "Almacenamiento no disponible. Mantén esta pestaña abierta para conservar los taps pendientes.",
  queueError:
    "La sesión anterior tiene taps pendientes. Descartarlos no se puede deshacer.",
  discard: "Descartar cola anterior y reconectar",
  intro:
    "Elige un hashtag y pulsa +1. Cada toque añade un segundo. El tiempo sigue bajando aunque salgas. Puedes apoyar varios hashtags; solo el seleccionado recibe nuevos taps.",
  mapHelp:
    "Cada participación activa forma un punto regional. Los puntos cercanos forman manchas. Toca un punto para seleccionar su hashtag; toca terreno vacío para añadir tiempo. Arrastra y acerca para explorar. No se inventan participantes ni posiciones.",
  rankingHelp:
    "El ranking cuenta una sesión activa por hashtag, independientemente de los segundos añadidos. Al agotarse el tiempo, la participación sale del ranking y del mapa. Las actualizaciones pueden tardar unos cinco segundos.",
  privacy:
    "La ubicación es opcional. Al activarla, compartes un punto regional público y resúmenes por país. Las coordenadas se redondean en tu dispositivo a una región de aproximadamente 1 km antes de enviarse; no se publican coordenadas exactas ni tu nombre. La región aún puede revelar información sobre ti, especialmente en zonas poco pobladas.",
  withdrawal:
    "Desactiva Ubicación para retirar ambos de futuras lecturas. Las copias ya recibidas no pueden retirarse. Esto no revoca el permiso del navegador; puedes hacerlo en sus ajustes.",
  retention:
    "Este navegador usa una sesión seudónima. Tras 30 días sin volver y con todos los saldos a cero, el historial se consolida por hashtag y la sesión se elimina. Las copias cifradas de recuperación tienen una retención prevista de 7 días; fallos de mantenimiento pueden retrasar su eliminación. Borrar cookies puede impedir su recuperación.",
  syncHelp:
    "Los taps aparecen al instante y se sincronizan automáticamente. El tiempo puede incluir taps pendientes; el historial confirmado cambia tras la entrega. Cerrar antes de confirmar puede retrasar la entrega. Las cookies y el almacenamiento local conservan tu sesión y cola.",
  source: "Código, documentación e issues en GitHub",
  languageHelp:
    "El idioma sigue el país identificado cuando está disponible. Sin ubicación se usa inglés. Puedes cambiarlo aquí.",
  language: "Idioma",
  auto: "Automático",
};
export const languages = { en: english, pt, es };
export type Language = keyof typeof languages;
export function countryLanguage(country: string): Language {
  if (["PT", "BR", "AO", "MZ", "CV", "GW", "ST", "TL"].includes(country))
    return "pt";
  if (
    [
      "ES",
      "MX",
      "AR",
      "BO",
      "CL",
      "CO",
      "CR",
      "CU",
      "DO",
      "EC",
      "SV",
      "GT",
      "HN",
      "NI",
      "PA",
      "PY",
      "PE",
      "PR",
      "UY",
      "VE",
      "GQ",
    ].includes(country)
  )
    return "es";
  return "en";
}
