# Suprimo

Cotações do almoxarifado: o auxiliar cota com vários fornecedores, o sistema monta o **mapa comparativo** e o chefe escolhe e assina.
Site estático em HTML, CSS e JavaScript puro (ES modules). Sem framework, sem build, sem servidor. Os dados ficam no navegador (IndexedDB).

## Rodar

Módulos ES não abrem por duplo clique; use um servidor estático qualquer na raiz:

    npm start          # python3 -m http.server 8000
    # ou: python3 -m http.server 8000

Abra http://localhost:8000. Na primeira vez, **Carregar demonstração** cria uma cotação de material elétrico com 3 fornecedores (um não cotou um item, outro cotou em unidade diferente). Tudo da demonstração aparece marcado como *Exemplo* e sai com um clique em Ajustes.

## Testar

    npm test           # node --test, sem dependências

Cobre as regras do mapa (menor preço por linha, custo total com frete, incompleta fora da sugestão, desempate por prazo, unidade divergente, validade vencida, compra dividida), o leitor da lista colada, decisão e justificativa, fila, numeração, backup, migrações do esquema e o store.

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
      lib/       formatação pt-BR (Intl), ícones SVG, template HTML que escapa tudo, BrasilAPI
      styles/    CSS em camadas: reset, tokens, base, layout, components, utilities, print
    tests/       node:test
    docs/        decisões de arquitetura

Por que cada escolha: [docs/decisoes.md](docs/decisoes.md).

## Dependências externas

Só duas: as fontes do Google Fonts (Inter e JetBrains Mono) e a BrasilAPI (consulta de CNPJ). Não há chave de API.
