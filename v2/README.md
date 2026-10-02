# Suprimo 2.2: cotações

Foco só em cotações. A integração com o Almox fica para o futuro (a camada de repositórios já deixa o caminho aberto).

Site estático em HTML, CSS e JavaScript com ES modules. Sem build e sem dependências.

## Rodar

Módulos ES não abrem direto por `file://`; use um servidor local na pasta `v2/`:

    cd v2 && python3 -m http.server 8000

Abra http://localhost:8000. A primeira abertura carrega a cotação de exemplo (COT-0001, marcada como exemplo).
Publicação: o fluxo `.github/workflows/pages.yml` copia esta pasta para `/v2/` no GitHub Pages (o Suprimo atual continua na raiz).

## Testes (mapa comparativo, lista colada, fila Hoje, desempenho, CNPJ)

    cd v2 && node --test tests/*.test.mjs

## Estrutura

    index.html
    css/        tokens (cores, tema escuro), base, componentes, cotacao, impressao
    js/dominio/ regras puras: mapa.js, lista-colada.js, unidades.js, status.js, convite.js, formato.js
    js/dados/   armazenamento.js (localStorage), anexos.js (IndexedDB), repos.js (repositórios), backup.js, brasilapi.js, exemplo.js
    js/ui/      telas: hoje, cotacao (+abas/), lista-cotacoes, fornecedores, precos, ajustes, folha-impressao
    tests/      node:test

As telas só falam com `js/dados/repos.js`; na fase 3 esse arquivo troca para Firestore.
