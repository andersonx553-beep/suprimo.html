# Suprimo

Cotações do almoxarifado: o auxiliar importa e confere orçamentos, compara as propostas e registra o fornecedor selecionado. O mapa em PDF é apresentado pelo responsável ao **síndico**, que assina a aprovação da cotação. O pedido ao fornecedor é feito depois pelo responsável via WhatsApp, fora do Suprimo.
Site estático em HTML, CSS e JavaScript puro (ES modules), sem build próprio. Cotações, fornecedores e ajustes sincronizam em tempo real pelo Firebase Authentication e Firestore. PDFs, XMLs e imagens são armazenados em bucket privado Cloudflare R2 e ficam disponíveis nos aparelhos conectados; o IndexedDB é usado como cache local.

## Rodar

Módulos ES não abrem por duplo clique; use um servidor estático qualquer na raiz:

    npm start          # python3 -m http.server 8000
    # ou: python3 -m http.server 8000

Abra http://localhost:8000. Na primeira vez, **Carregar demonstração** cria uma cotação de material elétrico com 3 fornecedores (um não cotou um item, outro cotou em unidade diferente). Tudo da demonstração aparece marcado como *Exemplo* e sai com um clique em Ajustes.

## Firebase e sincronização

O app usa o projeto Firebase `suprimo-fb90d`, login Google e Firestore. O acesso está restrito a `andersonx553@gmail.com`, com e-mail verificado. A chave web que aparece em `src/lib/firebase.js` identifica o app; a segurança depende das regras do Firestore, não de esconder essa chave.

Antes de usar o site publicado:

1. Em **Authentication → Sign-in method**, confirme que Google está ativado.
2. Em **Authentication → Settings → Authorized domains**, inclua o domínio exato onde o Suprimo está hospedado. `localhost` é usado no desenvolvimento.
3. Em **Firestore Database → Rules**, publique o conteúdo de `firestore.rules`. Até publicar, as leituras e gravações serão negadas.
4. Publique o site no **Cloudflare Pages**, como o Almox Aqua: conecte este repositório, use `exit 0` como comando de build e `.` como diretório de saída (a raiz do projeto). Depois, em **Authentication → Settings → Authorized domains**, cadastre o domínio `*.pages.dev` exibido pelo Cloudflare (ou seu domínio próprio).
5. No Cloudflare, crie um bucket **R2** (por exemplo, `suprimo-arquivos`). Em Pages → projeto Suprimo → Settings → Bindings, adicione um vínculo **R2 bucket** com variável `ARQUIVOS` e selecione esse bucket. Em Variables and Secrets, crie `FIREBASE_PROJECT_ID` com valor `suprimo-fb90d`. Repita os vínculos para produção e preview se usar os dois ambientes e faça novo deploy.
6. O endpoint privado de arquivos é atendido por Pages Functions somente em `/api/*`. Ele valida o token Firebase, restringe a conta autorizada e grava cada arquivo no prefixo do UID. Não exponha o bucket publicamente. O cliente deve acessar o mesmo domínio do Pages para evitar CORS.

No primeiro acesso, se houver dados locais e a nuvem estiver vazia, o Suprimo mostra a quantidade encontrada e pede confirmação antes de copiar os registros e os anexos. O app também oferece baixar um backup local. Se já houver dados na nuvem, não mescla nem substitui os registros locais automaticamente; durante a conexão, arquivos locais vinculados a cotações existentes são enviados somente quando ainda não existem no R2. Arquivos antigos só podem ser recuperados do aparelho em que ainda estão armazenados.

## Testar

    npm install        # só para os testes de leitura de PDF (pdfjs-dist em devDependencies)
    npm test           # node --test

Cobre a importação de orçamento (extração do PDF de `tests/fixtures` comparada campo a campo com o gabarito, validações, duplicidade, migração v1→v2 e gravação com desfazer), as regras do mapa (menor preço por linha, custo total com frete, incompleta fora da sugestão, desempate por prazo, unidade divergente, validade vencida, compra dividida), o leitor da lista colada, decisão e justificativa, fila, numeração, backup, migrações do esquema e o store.

Roteiro de navegador da importação de orçamento (PC e celular), com o site no ar e o Playwright instalado:

    python3 -m http.server 8000                      # em outro terminal
    URL=http://localhost:8000/index.html npm run test:e2e -- /pasta/das/capturas

## Importar orçamento

Em uma cotação aberta, aba **Propostas → Importar orçamento**. Aceita PDF, JPG, PNG e **XML de orçamento**, até 10 MB. PDFs com texto usam extração direta; se nenhuma linha de item for reconhecida, a leitura tenta OCR. PDFs digitalizados e imagens usam OCR com Tesseract.js no navegador (até 12 páginas). Na primeira leitura por OCR, o navegador baixa o núcleo WASM e os idiomas português/inglês; precisa de conexão. O arquivo é processado localmente, sem enviar o orçamento ao serviço de OCR. Fotos nítidas, bem iluminadas e alinhadas dão resultado melhor. A tela mostra o arquivo ao lado dos dados: **confira sempre os códigos, descrições, quantidades e valores reconhecidos**. Nada é salvo antes de **Confirmar orçamento**. PDF com senha ainda precisa de uma cópia sem senha.

Você pode selecionar **até três XMLs de uma vez** na mesma cotação. O Suprimo abre a conferência de cada arquivo em sequência: confirme ou pule o orçamento atual para seguir ao próximo. Cada confirmação grava uma proposta separada; uma falha no arquivo seguinte não apaga as propostas já confirmadas. Para cada XML, você pode anexar o PDF correspondente na conferência. PDF, JPG e PNG continuam sendo importados individualmente.

O formato próprio `orcamentoSuprimo` versão 1 continua disponível para exportação e reimportação. Veja [um exemplo de cinco itens](tests/fixtures/orcamento-hidraulica-exemplo.xml). Nesse formato, valores são inteiros em centavos (`3500` = R$ 35,00), quantidades usam ponto decimal e datas são `AAAA-MM-DD`. Outros XMLs de orçamento com campos reconhecíveis de fornecedor, proposta, condições e itens também preenchem a conferência. Neles, valores monetários são valores em reais; campos ausentes ou não reconhecidos ficam em branco, sem estimativa. XML de NF-e não é tratado como proposta. Formatos específicos que não permitam identificar os itens precisam de um arquivo de exemplo para adaptar o mapeamento. Você pode importar o XML, anexar o PDF original do mesmo orçamento na conferência (até 25 MB) e confirmar os dois juntos. O PDF aparece primeiro em **Propostas → Arquivo original** para seu chefe visualizar; o XML também fica anexado. Se tiver importado só o XML, ainda pode anexar o PDF depois na proposta. Após revisar uma importação, **Baixar XML conferido** produz um XML que o Suprimo pode reimportar. O orçamento convertido de um PDF deve ser revisado campo a campo antes de ser usado.

Frete ausente permanece **não informado** e suspende a sugestão automática de vencedor enquanto uma proposta comparável tiver esse dado pendente (0,00 só quando incluso). A validade expressa em dias é preservada como texto e pede confirmação da data final. Produtos com marcas ou descrições diferentes exigem que a pessoa confirme a correspondência técnica; o Suprimo não declara equivalência por conta própria. O relatório impresso destaca a seleção registrada, reproduz as descrições originais e reserva a assinatura ao síndico. Sem seleção registrada, a impressão sai marcada como rascunho e não traz campo de aprovação.

Ao importar o segundo orçamento da mesma cotação, o Suprimo normaliza abreviações (por exemplo, `ADAPT`/`ADAP`) e medidas (`40x11/2`/`40MM X 1 1/2`) para ligar automaticamente os pares claros. Medidas divergentes e tipos de produto diferentes não são ligados. A conferência reúne possíveis equivalências em uma lista para aprovação conjunta e permite adicionar em grupo os itens sem similar; as descrições originais permanecem intactas. Revise os pares incertos antes de confirmar, especialmente registros e conexões com características diferentes.

## Publicar

É só arquivo estático: a raiz do repositório já é o site.

- **GitHub Pages**: Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
- **Cloudflare Pages**: conecte o repositório; use `exit 0` como comando de build, `.` como diretório de saída e a raiz como diretório do projeto. Configure também o binding R2 `ARQUIVOS` e a variável `FIREBASE_PROJECT_ID` conforme a seção Firebase acima; sem isso, anexos remotos não funcionam.

## Estrutura

    index.html
    src/
      domain/    regras puras, sem DOM: mapa, decisão, lista colada, status, fila, numeração, convite, precos
      data/      esquema versionado + migrações, IndexedDB (e memória), catálogo, demonstração
      state/     store pequeno com eventos; as telas reagem a mudanças
      ui/        telas, abas e componentes (funções que renderizam e ligam eventos)
      importacao/ leitura de orçamento em PDF/imagem/XML: extrair, ocr, xml, interpretar, validar, mapear, aplicar
      lib/       formatação pt-BR (Intl), ícones SVG, template HTML que escapa tudo, BrasilAPI, carregador do pdfjs
    vendor/pdfjs pdfjs-dist (legacy) embutido, sem CDN
    vendor/tesseract Tesseract.js v7 e worker; núcleo WASM/idiomas obtidos no primeiro OCR
      styles/    CSS em camadas: reset, tokens, base, layout, components, utilities, print
    tests/       node:test
    docs/        decisões de arquitetura

Por que cada escolha: [docs/decisoes.md](docs/decisoes.md).

## Dependências externas

As fontes do Google Fonts (Inter e JetBrains Mono), a BrasilAPI (consulta de CNPJ) e, na primeira utilização do OCR, os pacotes WASM/idiomas do Tesseract.js via CDN. O código do pdfjs (`vendor/pdfjs`) e o Tesseract.js (`vendor/tesseract`) acompanham o repositório. Não há chave de API nem variável de ambiente.
