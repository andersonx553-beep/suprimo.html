# Suprimo

Cotações do almoxarifado: o auxiliar importa e confere orçamentos, compara as propostas e registra o fornecedor selecionado. O mapa em PDF é apresentado pelo responsável ao **síndico**, que assina a aprovação da cotação. O pedido ao fornecedor é feito depois pelo responsável via WhatsApp, fora do Suprimo.
Site estático em HTML, CSS e JavaScript puro (ES modules). Sem framework, sem build, sem servidor. Os dados ficam no navegador (IndexedDB).

## Rodar

Módulos ES não abrem por duplo clique; use um servidor estático qualquer na raiz:

    npm start          # python3 -m http.server 8000
    # ou: python3 -m http.server 8000

Abra http://localhost:8000. Na primeira vez, **Carregar demonstração** cria uma cotação de material elétrico com 3 fornecedores (um não cotou um item, outro cotou em unidade diferente). Tudo da demonstração aparece marcado como *Exemplo* e sai com um clique em Ajustes.

## Testar

    npm install        # só para os testes de leitura de PDF (pdfjs-dist em devDependencies)
    npm test           # node --test

Cobre a importação de orçamento (extração do PDF de `tests/fixtures` comparada campo a campo com o gabarito, validações, duplicidade, migração v1→v2 e gravação com desfazer), as regras do mapa (menor preço por linha, custo total com frete, incompleta fora da sugestão, desempate por prazo, unidade divergente, validade vencida, compra dividida), o leitor da lista colada, decisão e justificativa, fila, numeração, backup, migrações do esquema e o store.

Roteiro de navegador da importação de orçamento (PC e celular), com o site no ar e o Playwright instalado:

    python3 -m http.server 8000                      # em outro terminal
    URL=http://localhost:8000/index.html npm run test:e2e -- /pasta/das/capturas

## Importar orçamento

Em uma cotação aberta, aba **Propostas → Importar orçamento (PDF)**. Aceita PDF com texto, até 10 MB; PDF com senha e PDF digitalizado (precisa de OCR, ainda não existe) recebem aviso e param. Os dois exemplos de orçamento Aquaville têm texto extraível; eles exercitam a leitura de tabelas, preços com três casas decimais, logística, validade relativa e pagamento. A leitura roda no navegador, sem API e sem custo. O PDF fica ao lado dos dados para conferência, e nada é salvo antes de **Confirmar orçamento**.

Frete ausente permanece **não informado** e suspende a sugestão automática de vencedor enquanto uma proposta comparável tiver esse dado pendente (0,00 só quando incluso). A validade expressa em dias é preservada como texto e pede confirmação da data final. Produtos com marcas ou descrições diferentes exigem que a pessoa confirme a correspondência técnica; o Suprimo não declara equivalência por conta própria. O relatório impresso destaca a seleção registrada, reproduz as descrições originais e reserva a assinatura ao síndico. Sem seleção registrada, a impressão sai marcada como rascunho e não traz campo de aprovação.

## Publicar

É só arquivo estático: a raiz do repositório já é o site.

- **GitHub Pages**: Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
- **Cloudflare Pages**: projeto sem comando de build e com diretório de saída `/`.

## Estrutura

    index.html
    src/
      domain/    regras puras, sem DOM: mapa, decisão, lista colada, status, fila, numeração, convite, precos
      data/      esquema versionado + migrações, IndexedDB (e memória), catálogo, demonstração
      state/     store pequeno com eventos; as telas reagem a mudanças
      ui/        telas, abas e componentes (funções que renderizam e ligam eventos)
      importacao/ leitura de orçamento em PDF: extrair, interpretar, validar, mapear, aplicar
      lib/       formatação pt-BR (Intl), ícones SVG, template HTML que escapa tudo, BrasilAPI, carregador do pdfjs
    vendor/pdfjs pdfjs-dist (legacy) embutido, sem CDN
      styles/    CSS em camadas: reset, tokens, base, layout, components, utilities, print
    tests/       node:test
    docs/        decisões de arquitetura

Por que cada escolha: [docs/decisoes.md](docs/decisoes.md).

## Dependências externas

Só duas: as fontes do Google Fonts (Inter e JetBrains Mono) e a BrasilAPI (consulta de CNPJ). O pdfjs vai junto no repositório (`vendor/pdfjs`, licença Apache-2.0). Não há chave de API nem variável de ambiente.
