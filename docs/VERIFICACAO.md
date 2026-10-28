# Verificação da integração — 28/10/2026

## Testes automatizados

- API: `node --test`, 34 testes aprovados (22 da base e 12 da persistência).
- Front: `node --test`, 58 testes aprovados.
- Front: build Vite concluído; lint sem erros, com quatro avisos já existentes de
  `set-state-in-effect` em páginas de quadras.
- SQLite: `PRAGMA integrity_check` retornou `ok`; `foreign_key_check` não retornou violações.

## Navegador

Chrome headless, jogador em viewport mobile e gestor em desktop, dois contextos sem
cookies/localStorage compartilhados. Scripts no repo do front:

- `scripts/verificar-fluxo.mjs`: busca da Arena Batel, seleção de horário, checkout Pix
  simulado, aparecimento na lista do gestor por atualização da API, reload, cancelamento
  com motivo e liberação da vaga. Nenhum erro de JavaScript.
- `scripts/verificar-gestao.mjs`: reserva manual pelo formulário, origem WhatsApp,
  promoção salva pelo gestor e cotação de R$ 75 no servidor, revogação da conta tirando
  a Arena Batel do catálogo, reativação. Nenhum erro de JavaScript.

As reservas de teste foram canceladas (histórico mantido); a promoção temporária foi
removida e a conta da Arena Batel terminou ativa.

O servidor foi reiniciado sem apagar o arquivo SQLite e os registros anteriores
continuaram disponíveis. O teste de persistência também fecha e reabre uma conexão
de arquivo temporário, verificando reserva, seed sem duplicação e conflito preservado.

## O que não foi alegado

Não houve pagamento real, autenticação de produção, envio de mensagem, emissão fiscal,
teste de carga, validação com usuários ou implantação pública. Inteligência histórica
e projeção financeira da equipe continuam ilustrativas. Fotos novas são ilustrativas
e locais, com fontes e licenças no rodapé do site.
