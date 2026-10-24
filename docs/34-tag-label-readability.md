# Cores persistidas e nomes legíveis (#83)

A cor aleatória da hashtag continua sendo a mesma no banco e no mapa. Ela não
garante contraste suficiente como texto pequeno: por exemplo, azul `#5d5de5`
fica escuro sobre o painel `#10212d`.

A experiência integrada calcula luminância sRGB para a tinta dos nomes. Se a
relação no fundo do painel ficar abaixo de 4,5:1, usa a tinta clara `#e6f3f4`.
Um marcador lateral conserva a cor original; nome e quantidade permanecem em
texto. Isso vale para ranking, saldos, seleção e lista de hashtags por países.
Não modifica a paleta persistida, as contagens ou o renderer geográfico.

Testes cobrem azul escuro, fundo igual, branco, laranja e ausência/formato inválido.
O navegador verifica tinta clara e marcador azul simultaneamente em desktop e
celular emulado. O cálculo usa o fundo do painel; não é certificação WCAG de
todo o produto nem substitui QA de foco, leitores de tela ou hardware físico.
