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
- Sugestão = menor custo total (itens + frete confirmado) entre propostas que cotaram **todos** os itens, na unidade pedida. Frete não informado permanece `null` e suspende a sugestão geral enquanto houver proposta comparável pendente; essa proposta não pode ser selecionada até o frete ser confirmado. Zero só significa frete confirmado sem custo. Empate: menor prazo de entrega.
- Proposta incompleta ou com unidade diferente fica fora da sugestão, mas pode ganhar itens na compra dividida (só nas células comparáveis).
- Menor preço da linha só é marcado com pelo menos duas células comparáveis.
- Justificativa obrigatória quando a escolha não é o menor custo total. Compra dividida mais barata que a sugestão não exige.
- Menos propostas que o mínimo: aviso, nunca bloqueio.
- Último preço pago vem só de cotações **concluídas**; preço novo mais de 15% acima dispara o alerta.

## Importar orçamento (PDF, JPG, PNG e XML)
- **Tudo no navegador, sem serviço que receba o orçamento.** O pdfjs lê PDFs digitais com coordenadas; `importacao/linhas.js` reconstrói linhas e colunas; `importacao/interpretar.js` aplica regras de formatos, rótulos, totais e itens. PDFs sem camada de texto e imagens passam por `importacao/ocr.js`, que renderiza cada página e usa Tesseract.js. Uma segunda passagem limpa grades extensas quando a primeira perdeu a tabela. `ocr-texto.js` recupera linhas por quantidade × preço = total. O usuário confere tudo, pois OCR pode trocar letras e dígitos mesmo quando as contas fecham.
- **`extrairDocumento(bytes)` escolhe a leitura pelo formato e camada de texto.** A extração direta `extrairOrcamento(pdf)` permanece isolada e devolve o mesmo JSON do gabarito. A UI usa o mesmo formulário de conferência para ambos os caminhos.
- **Quando um PDF tem texto, mas o layout da tabela não foi reconhecido, tenta OCR.** Se o OCR também não encontra itens ou fica indisponível, mantém os dados extraídos do texto e mostra o alerta de itens ausentes para correção. Não inventa preços.
- **XML de orçamento.** O formato do Suprimo, versão 1, continua com valores monetários em centavos inteiros e datas ISO. XMLs externos são mapeados por blocos e campos explícitos de fornecedor, cabeçalho, itens e condições; seus valores monetários são lidos em reais e convertidos para centavos. Campos não identificados ficam vazios para conferência. A entrada rejeita DTD/entidades externas e XML de NF-e como proposta. O botão "Baixar XML conferido" exporta o formato próprio. O PDF original pode ser anexado junto do XML; a gravação dos dois anexos e da proposta é desfeita se qualquer etapa falhar. O PDF aparece primeiro na proposta para consulta visual.
- **Até três XMLs na mesma seleção.** Cada arquivo passa pela própria conferência e é confirmado individualmente, com opção de pular os demais. Durante o lote, a confirmação persiste sem redesenhar a tela; a cotação atualizada passa a ser usada na sugestão de correspondência do XML seguinte. A integridade e a duplicidade são verificadas por orçamento, e os já confirmados permanecem gravados se outro arquivo falhar.
- **pdfjs embutido em `vendor/pdfjs/` (versão legacy).** Sem CDN e sem build. A versão "moderna" usa `Math.sumPrecise`, que muitos navegadores ainda não têm; a legacy roda nos mais antigos. O pdfjs é carregado só quando a tela de importar abre. `pdfjs-dist` fica só em devDependencies, para os testes de node.
- **Não corrige em silêncio.** `validar.js` só aponta: quantidade × unitário = total, soma dos itens = subtotal, subtotal − desconto + frete = total quando o frete foi informado (tolerância de 1 centavo), validade anterior à emissão, validade relativa sem data final, orçamento vencido, CNPJ inválido e possível divergência entre o número do arquivo e o do documento. O valor lido continua como está até a pessoa mudar.
- **Aprovação da cotação.** A seleção só aparece como pronta para aprovação no mapa impresso depois de registrada. O síndico assina a cotação escolhida em papel/PDF; o Suprimo não realiza o pedido. O responsável compra pelo WhatsApp após a aprovação, fora do sistema.
- **Nada é salvo antes de "Confirmar orçamento".** A confirmação grava documento, arquivo original, fornecedor novo, itens novos, proposta e convite de uma vez; se algo falhar no meio, desfaz o que já gravou.
- **Duplicidade:** o SHA-256 do arquivo é único (índice único no IndexedDB, não só checagem na tela). CNPJ + número de orçamento repetido só avisa, porque pode ser uma nova versão. Remover a proposta libera o PDF para importar de novo.
- **Sem backend.** O projeto não tem servidor: o arquivo fica no IndexedDB junto com os outros anexos (a coleção `documentos` faz o papel de `orcamento_documentos`). Se um dia houver Supabase, trocar é trocar o adaptador de `data/banco.js` (bucket privado `orcamentos` para o arquivo, só o caminho no registro).
- **Esquema v2** (migração 1→2): proposta ganha `status` ("confirmada"), `origem` ("manual" | "importada"), `descontoCentavos`, `freteTipo` e os dados do orçamento; nasce `documentos`. O desconto entra no custo total do mapa.

## Fora do escopo (de propósito)
Leitura automática de orçamento, login, servidor ou sincronização, integração com outros sistemas, busca de fornecedores por API. O link "Procurar no Google Maps" só abre a pesquisa, sem API.
