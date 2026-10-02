// Um único conjunto de ícones de linha: 24x24, traço de 1,6, pontas arredondadas.
const D = {
  hoje: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14.5 9.5H17M14.5 15.5H17"/>',
  cotacoes: '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/>',
  fornecedores: '<path d="M3.5 7.5h10v9h-10zM13.5 10.5h4l3 3v3h-7z"/><circle cx="7.5" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>',
  precos: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-6.3 6.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.3"/>',
  ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  whatsapp: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/><path d="M9.2 9.2c.3 2.4 2.3 4.4 4.7 4.7l1.2-1.2-1.9-1-.9.7a3.5 3.5 0 0 1-1.6-1.6l.7-.9-1-1.9z"/>',
  email: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
  imprimir: '<path d="M7 9V4h10v5M7 17H4.5v-7h15v7H17"/><rect x="7" y="14" width="10" height="6"/>',
  clipe: '<path d="M18.5 11.5l-6.4 6.4a4 4 0 0 1-5.7-5.7l7-7a2.7 2.7 0 0 1 3.8 3.8l-7 7a1.3 1.3 0 0 1-1.9-1.9l6.3-6.3"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  baixar: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  subir: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  seta: '<path d="M9 5l7 7-7 7"/>',
  lua: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  sol: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  lixeira: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
  copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
  arquivo: '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M14 3.5V8h4"/>',
};

export function icone(nome, tam = 18) {
  return `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${D[nome] ?? ""}</svg>`;
}
