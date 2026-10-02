export function baixarTexto(nome, texto, tipo = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
