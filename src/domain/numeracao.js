// Numeração sequencial: o contador só avança, então COT-0003 nunca é reutilizado.
export const formatarNumero = (n) => `COT-${String(n).padStart(4, "0")}`;

/** @param {number} contadorAtual @returns {{numero:string, contador:number}} */
export function proximoNumero(contadorAtual) {
  const contador = (Number.isInteger(contadorAtual) ? contadorAtual : 0) + 1;
  return { numero: formatarNumero(contador), contador };
}
