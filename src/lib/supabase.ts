import { createClient } from '@supabase/supabase-js'

/**
 * Projeto Torrão. Estes valores ficam no código de propósito.
 *
 * A chave anon é publishable: o Vite embute qualquer `VITE_*` no bundle, então
 * ela já é legível por qualquer visitante do site. Guardá-la só num env var não
 * esconderia nada — só criaria o risco de o deploy subir sem ela e a tela nascer
 * branca. Quem protege o dado é a RLS do banco, não o segredo desta chave.
 *
 * A `service_role` NUNCA entra aqui nem em variável de build — essa sim ignora RLS.
 *
 * Para apontar o app para outro projeto (staging, por exemplo), defina
 * VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY: elas têm precedência.
 */
const URL_PADRAO = 'https://wqihhxcfjwgjrqrlvkrc.supabase.co'
const CHAVE_PADRAO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxaWhoeGNmandnanJxcmx2a3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODY5NDAsImV4cCI6MjEwMTM2Mjk0MH0.uYvZnw8J3Nt1jcXhDLSeCh_UNT4QEZKSjJlrPFZA5n0'

const url = import.meta.env.VITE_SUPABASE_URL || URL_PADRAO
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY || CHAVE_PADRAO

export const supabase = createClient(url, chave)
