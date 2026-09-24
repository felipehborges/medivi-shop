# MEDIVI — revisão de fidelidade visual

Data: 23 de setembro de 2026.

## Referência e escopo

A revisão compara a implementação de `apps/demo` com o pacote **Design form awaiting scope.zip**, fornecido pelo usuário: protótipo `design/Medivi Armory.dc.html`, especificação `README.md`, capturas `01` a `12` e ícones `design/mk`. O pacote identifica `apps/demo` como destino do design. Seus documentos foram usados como referência visual, sem substituir a solicitação do usuário.

Antes das alterações, o checkout local foi atualizado por fast-forward de `efb2ee4` para o commit já disponível em `origin/master`, `45c850b`, que contém essa aplicação. As correções desta revisão estão em `apps/demo`; não alteram o backend, pagamentos reais nem a aplicação comercial `apps/web`.

## Divergências corrigidas

| Área | Correção aplicada |
| --- | --- |
| Sistema visual | Fontes Grenze Gotisch, Grenze e Gentium Book Plus; pesos, entrelinhas e espaçamentos; paleta de ferro, osso, bronze, cera e pergaminho; cantos retos e granulação. |
| Cabeçalho e navegação | Marca gótica com espadas, faixa de anúncio, três destinos principais, contadores romanos, seletor EN/PT em placa e menu móvel. |
| Início | Proporções do hero, moldura com quatro rebites, fotografia com tratamento tonal, etiqueta inclinada sobreposta, credenciais, faixa do mercador, cinco departamentos e composição assimétrica dos cinco destaques. A animação recorta apenas a moldura, sem cortar a etiqueta. |
| Catálogo e departamentos | Grade de seis colunas no desktop com diferentes larguras de peças, alturas e crops, selos de raridade, procedência, divisórias e filtros em placas. Busca e navegação por departamento permanecem sincronizadas com a URL. |
| Produto | Moldura, tabela de procedência, hierarquia do título, marca do fabricante, nota em pergaminho, preço, quantidade, variantes e peças relacionadas. Removidas miniaturas repetidas da mesma imagem. |
| Ampliação | Lupa acompanha o recorte real da fotografia; diálogo acessível por clique, toque ou teclado, com fechamento por Escape e devolução do foco. |
| Carrinho | Manifesto em pergaminho, dois pregos superiores, linhas de mercadorias, quantidades, valores e transporte; composição própria para telas pequenas. |
| Checkout | Campos em coluna, opções de transporte com ícones, resumo em pergaminho e total atualizado. Seleção por rádio mantém semântica e foco visível sem introduzir um controle visual estranho à referência. |
| Pagamento demonstrativo | Três meios de quitação, seleção em losango, total e botão de cera para selar. A simulação de recusa foi preservada em uma seção secundária. |
| Confirmação | Pergaminho central, selo, título e número de entrada em uma linha; confirmação utiliza o pedido gravado, inclusive após recarregar. |
| Favoritos | Livro de vigia com imagens de 250 px no desktop, nome e preço alinhados, ações e estado vazio coerentes. |
| Administração | Quatro indicadores, livro de estoque, estados e tabela adaptável. Controles de visibilidade, reinicialização e pedidos recentes preservados em seções secundárias. |
| Rodapé e estados | Composição em três colunas, navegação por departamentos, selo da guilda, créditos dos ícones, estados vazios e página não encontrada na mesma linguagem visual. |

Os SVGs do pacote foram incorporados com sua licença e atribuição. Não foram geradas imagens substitutas ou adotados ícones genéricos para os detalhes do design.

## UX e acessibilidade

- Link para pular ao conteúdo, foco visível, nomes acessíveis e menu com estado expandido; Escape devolve o foco ao acionador.
- Contadores e marca fecham o menu móvel ao navegar. Idioma persiste após recarregar.
- Quantidades respeitam o estoque e a remoção de uma linha é explícita.
- Endereço demonstrativo e transporte são mantidos entre etapas; o valor do transporte participa do total gravado.
- Guarda contra submissão duplicada; recusa simulada preserva o carrinho.
- Redução de movimento respeitada; alvos principais de toque com pelo menos 44 px.

## Validação

- Build de produção concluído, com 26 páginas estáticas geradas, incluindo os 13 produtos.
- ESLint e verificação TypeScript sem erros.
- Cinco testes do estado da loja aprovados.
- Dez testes de navegador aprovados: compra demonstrativa completa, recusa, persistência, tradução, favoritos, navegação/filtros, limites de estoque, menu móvel, lupa e diálogo por teclado.
- Rotas principais verificadas em **360, 768, 1024 e 1440 px**, sem transbordamento horizontal, imagens visíveis quebradas ou erros JavaScript nas rotas testadas.
- Passada visual nas capturas de início, catálogo, produtos com e sem variantes, carrinho, checkout, pagamento, confirmação, favoritos e administração, além da conferência do hero no navegador com animações ativas.

Os testes salvam capturas completas de celular e desktop em `apps/demo/test-results/`; essa pasta é ignorada pelo Git e é recriada a cada execução. Para reproduzir: `pnpm --filter @medivi/demo test:e2e`. O teste inicia a aplicação na porta 3101 por padrão; `PLAYWRIGHT_BASE_URL` permite verificar uma versão de produção já servida.

## Diferenças deliberadamente preservadas

O catálogo existente tem variantes e quantidades próprias. Preços e estoque continuam vindo desses dados, não dos números estáticos do protótipo; por isso os indicadores administrativos podem diferir da captura original. Busca, ordenação, seleção de variantes e controles demonstrativos existentes foram mantidos com a direção visual aprovada.

A validação automatizada foi feita no Chromium. Esta revisão não inclui certificação em todos os navegadores nem publicação em produção.
