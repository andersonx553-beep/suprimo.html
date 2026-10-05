# Decisões de arquitetura

Cada decisão em poucas linhas: o que foi escolhido e por quê.

## Domínio separado da interface
`src/domain/` só tem funções puras (sem DOM, sem armazenamento). O mapa comparativo, a decisão, a fila e o leitor de lista são testados com `node:test` sem navegador. A interface só mostra o resultado de `compararCotacao`.

## Dinheiro em centavos inteiros
Preço unitário e frete são inteiros em centavos. A conta é `Math.round(centavos × quantidade)`, então 0,10 + 0,20 dá exatamente 0,30. O backup recusa preço que não seja inteiro. Formatação só na borda (`lib/formato.js`, `Intl` pt-BR).

## Persistência: IndexedDB com adaptador
`data/banco.js` tem dois adaptadores com a mesma interface: IndexedDB (real) e memória (testes e navegadores sem IndexedDB, com aviso). Os arquivos anexados (PDF e imagem) ficam no IndexedDB como Blob, fora do backup JSON. Trocar por outro armazenamento no futuro é trocar o adaptador, sem mexer em telas.

## Esquema versionado e migrações
`data/esquema.js` tem `VERSAO_ATUAL` e um mapa `MIGRACOES` (versão n → n+1). Valem para o que está no banco ao abrir e para backups antigos importados. Backup de versão mais nova que o sistema é recusado com mensagem clara. Mudou o formato? Aumente a versão e escreva a migração; há testes do runner.

## IDs estáveis, número sequencial separado
Cada entidade tem `id` que nunca muda; a cotação tem também `numero` (COT-0001). O contador fica nos ajustes e só avança: apagar a COT-0003 não faz o número voltar. As rotas usam o número (`#/cotacoes/COT-0001/mapa`).

## Store pequeno com eventos
`state/store.js` guarda tudo em memória (poucos milhares de registros no máximo), grava no adaptador a cada mudança e emite um evento. A tela inteira se redesenha no evento, exceto em mudanças marcadas `silencioso` (edição campo a campo), para não tirar o foco de quem está digitando.

## HTML escapado por padrão
`lib/html.js` tem a tag `html` que escapa todo valor interpolado; só vira HTML o que veio de outra `html` ou de `bruto()` (usado apenas nos SVGs dos ícones). Nenhuma tela usa `innerHTML` direto; só `montar()`.

## Roteamento por hash
`#/cotacoes`, `#/cotacoes/COT-0001/mapa`, `#/fornecedores`, `#/ajustes`. Voltar e avançar do navegador funcionam e o link vale dentro do mesmo navegador.

## CSS em camadas
`@layer reset, tokens, base, layout, components, utilities, print`, um arquivo por camada. Cores, espaços (escala de 4 px), tipografia (`clamp()`), raios e sombras são tokens em `tokens.css`; o tema escuro e o claro trocam só os valores via `light-dark()` (segue o aparelho ou `data-theme` manual). Estados por atributo (`[aria-selected]`, `[data-status]`, `[data-estado]`), nomes em BEM, propriedades lógicas e container queries onde o componente muda conforme o espaço (tabelas que viram lista, propostas com arquivo ao lado). Sem `!important` fora dos utilitários.

## Visual
Segue o Suprimo 5: tema escuro por padrão, destaque âmbar `#f5a524`, Inter e JetBrains Mono, cartões arredondados, fundo em grade sutil, navegação no topo (barra inferior no celular). Âmbar só marca o que pede ação; verde é o menor preço e o concluído; vermelho é o vencido.

## Regras do mapa que merecem registro
- Sugestão = menor custo total (itens + frete) entre propostas que cotaram **todos** os itens, na unidade pedida. Empate: menor prazo de entrega.
- Proposta incompleta ou com unidade diferente fica fora da sugestão, mas pode ganhar itens na compra dividida (só nas células comparáveis).
- Menor preço da linha só é marcado com pelo menos duas células comparáveis.
- Justificativa obrigatória quando a escolha não é o menor custo total. Compra dividida mais barata que a sugestão não exige.
- Menos propostas que o mínimo: aviso, nunca bloqueio.
- Último preço pago vem só de cotações **concluídas**; preço novo mais de 15% acima dispara o alerta.

## Importar orçamento (PDF com texto)
- **Tudo no navegador, sem API e sem IA.** O pdfjs lê cada trecho de texto com a posição (x, y); `importacao/linhas.js` reconstrói linhas e colunas; `importacao/interpretar.js` aplica regras: expressões regulares para formatos fixos (CNPJ com dígitos verificadores, e-mail, telefone, data, R$) e rótulo próximo para o resto (Validade, Prazo, Pagamento, Frete, Desconto, Subtotal, Total). Itens vêm da tabela pelo cabeçalho (colunas por posição, coluna de fotos ignorada); sem cabeçalho, plano B por linha.
- **`extrairOrcamento(pdf)` é a única porta de entrada.** Devolve o mesmo JSON do gabarito. OCR ou IA no futuro entram como outra função com o mesmo retorno; conferência, validação e gravação não mudam. Só `extrair.js` fala com o pdfjs.
- **pdfjs embutido em `vendor/pdfjs/` (versão legacy).** Sem CDN e sem build. A versão "moderna" usa `Math.sumPrecise`, que muitos navegadores ainda não têm; a legacy roda nos mais antigos. O pdfjs é carregado só quando a tela de importar abre. `pdfjs-dist` fica só em devDependencies, para os testes de node.
- **Não corrige em silêncio.** `validar.js` só aponta: quantidade × unitário = total, soma dos itens = subtotal, subtotal − desconto + frete = total (tolerância de 1 centavo), validade anterior à emissão, orçamento vencido, CNPJ inválido. O valor lido continua como está até a pessoa mudar.
- **Nada é salvo antes de "Confirmar orçamento".** A confirmação grava documento, PDF, fornecedor novo, itens novos, proposta e convite de uma vez; se algo falhar no meio, desfaz o que já gravou.
- **Duplicidade:** o SHA-256 do arquivo é único (índice único no IndexedDB, não só checagem na tela). CNPJ + número de orçamento repetido só avisa, porque pode ser uma nova versão. Remover a proposta libera o PDF para importar de novo.
- **Sem backend.** O projeto não tem servidor: o PDF fica no IndexedDB junto com os outros anexos (a coleção `documentos` faz o papel de `orcamento_documentos`). Se um dia houver Supabase, trocar é trocar o adaptador de `data/banco.js` (bucket privado `orcamentos` para o PDF, só o caminho no registro).
- **Esquema v2** (migração 1→2): proposta ganha `status` ("confirmada"), `origem` ("manual" | "importada"), `descontoCentavos`, `freteTipo` e os dados do orçamento; nasce `documentos`. O desconto entra no custo total do mapa.

## Fora do escopo (de propósito)
Leitura automática de orçamento, login, servidor ou sincronização, integração com outros sistemas, busca de fornecedores por API. O link "Procurar no Google Maps" só abre a pesquisa, sem API.
