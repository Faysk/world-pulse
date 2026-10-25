# 41 — Carregamento e prévia pessoal por país

Solicitação de 25/10/2026, issue #110.

O fallback de texto da importação lazy foi substituído por um globo CSS com órbitas,
marca e indicador indeterminado. A mesma apresentação acompanha a carga do mapa e
se dissolve quando ele fica pronto; erro de mapa libera os controles. Não há
porcentagem fictícia, imagem remota ou nova dependência. `prefers-reduced-motion`
desativa animação/transição; o status de carregamento fica fora da árvore acessível
quando concluído. Não existe espera mínima artificial.

A ausência de mancha com uma sessão não era falta de saldo: o agregado público
suprime países com menos de cinco participações na mesma hashtag. Esse limiar
permanece intacto. A UI agora desenha uma **prévia pessoal, somente no navegador**,
para o país aproximado da hashtag selecionada quando há tempo positivo e escolha
de compartilhamento confirmada. O tempo pode incluir taps locais ainda pendentes,
como já indicado na interface; histórico/ranking continuam confirmados pelo servidor.

A camada `personal-country` é separada de `live-countries`, sem inserir participante
ou país em snapshots públicos, ranking ou banco. Não publica localização individual,
nem supõe cidade/GPS ou centro do país como posição de alguém: destaca o polígono
inteiro e informa “prévia só para você”. As áreas públicas continuam acima dela.
Ela acompanha cor/seleção, some ao saldo zerar, retirada ou origem desconhecida;
respostas de geometria em trânsito são canceladas logicamente para não ressuscitar
uma prévia retirada. Source/layers são removidas no unmount, e o GeoJSON é
compartilhado com a camada pública, sem segunda transferência.

Tocar essa prévia pessoal permite manter o gesto de adicionar tempo no terreno;
somente áreas públicas entram na inspeção agregada. A prévia é da hashtag
selecionada, não um mapa de todas as participações pessoais simultâneas.

Verificação: testes de navegador conferem polígono PT visível com source pública
vazia, retirada e liberação de recursos. A experiência integrada cobre saldo
positivo, recusa e saldo zerado. O teste de carregamento retém a resposta do estilo,
confere status visível e movimento reduzido, e só libera quando o mapa fica pronto.
Isso não é prova de FPS físico ou de estimativa correta em toda rede/VPN.

![Novo carregamento, captura de teste com movimento reduzido](assets/world-loading-2026-10-25.png)
