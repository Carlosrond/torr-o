/**
 * Traduz erro técnico para o que a equipe leiga consegue agir em cima.
 * Devolve também o texto original quando ele foi traduzido — fica pequeno na tela,
 * é o que o Carlos manda no print quando pede ajuda.
 */
export function traduzirErro(mensagem: string): { titulo: string; detalhe: string | null } {
  const m = mensagem.toLowerCase()

  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed|err_internet|err_network/.test(m)) {
    return { titulo: 'Sem conexão com a internet. Confira o sinal e tente de novo.', detalhe: mensagem }
  }
  if (/row-level security|42501|permission denied|not allowed/.test(m)) {
    return { titulo: 'Você não tem permissão para essa ação. Fale com o administrador.', detalhe: mensagem }
  }
  if (/jwt|token|refresh_token|sessão inválida|session/.test(m)) {
    return { titulo: 'Sua sessão expirou. Saia e entre de novo.', detalhe: mensagem }
  }
  if (/50[0-4]|internal server error|bad gateway|service unavailable|timeout|timed out/.test(m)) {
    return { titulo: 'O servidor demorou a responder. Espere um instante e tente de novo.', detalhe: mensagem }
  }
  // mensagem já em PT-BR (as nossas) passa direto, sem detalhe duplicado
  return { titulo: mensagem, detalhe: null }
}
