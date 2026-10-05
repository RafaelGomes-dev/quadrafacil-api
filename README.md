# QuadraFacil API

API REST do **QuadraFacil**, um "Airbnb de quadras esportivas": conecta jogadores/organizadores que
querem reservar uma quadra (society, futsal, campo, vôlei, beach tennis, basquete) a gestores/proprietários
que administram a agenda e os pagamentos dessas quadras.

## Descrição do projeto

Hoje, reservar uma quadra costuma passar por WhatsApp, conferência manual de Pix e risco de dois grupos
marcarem o mesmo horário por engano. O QuadraFacil resolve isso com busca por filtros, reserva online,
pagamento integrado (simulado nesta etapa) e bloqueio automático de horário, evitando conflitos e no-show.

Esta API fornece o backend para:

- **Jogador/organizador**: buscar quadras, ver horários livres, criar reserva e pagar.
- **Gestor/proprietário**: cadastrar quadras e acompanhar reservas/ocupação.

## Stack utilizada

- Node.js + Express 5 (CommonJS)
- dotenv (variáveis de ambiente)
- cors
- nodemon (ambiente de desenvolvimento)
- Dados em memória (mock) — sem banco de dados nesta etapa

## Pré-requisitos

- Node.js 18 ou superior
- npm 9 ou superior

## Instalação de dependências

```bash
npm install
```

## Comandos para rodar localmente

```bash
# ambiente de desenvolvimento (reinicia automaticamente com nodemon)
npm run dev

# produção
npm start
```

A API sobe por padrão em `http://localhost:3001`.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste se necessário:

| Variável       | Descrição                                                | Valor padrão            |
| -------------- | -------------------------------------------------------- | ----------------------- |
| `PORT`         | Porta em que a API escuta                                | `3001`                  |
| `NODE_ENV`     | Ambiente de execução                                     | `development`           |
| `DATABASE_URL` | URL de conexão com o banco (ainda não usada nesta etapa) | -                       |
| `API_SECRET`   | Segredo usado para assinaturas/tokens futuros            | -                       |
| `CORS_ORIGIN`  | Origem do frontend liberada no CORS                      | `http://localhost:5173` |

## Estrutura de pastas

```
quadrafacil-api/
├── server.js                  → ponto de entrada: carrega .env e inicia o servidor HTTP
├── src/
│   ├── app.js                 → configuração do Express (middlewares, rotas, 404, errorHandler)
│   ├── routes/                → define os endpoints HTTP e os associa aos controllers
│   │   ├── index.js           → agrega todas as rotas sob o prefixo /api e expõe /health
│   │   ├── quadras.js
│   │   ├── reservas.js
│   │   └── pagamentos.js
│   ├── controllers/           → recebe req/res, chama os services e formata a resposta JSON
│   │   ├── quadraController.js
│   │   ├── reservaController.js
│   │   └── pagamentoController.js
│   ├── services/              → regras de negócio puras (filtros, conflito de horário, pagamento mock)
│   │   ├── quadraService.js
│   │   ├── reservaService.js
│   │   └── pagamentoService.js
│   ├── data/
│   │   └── mockData.js        → "banco de dados" em memória: quadras, reservas e pagamentos
│   ├── middlewares/
│   │   ├── cors.js            → libera apenas a origem definida em CORS_ORIGIN
│   │   └── errorHandler.js    → captura erros não tratados e responde 500 em JSON
│   └── config/
│       └── database.js        → lê DATABASE_URL do .env; PostgreSQL entra no MVP
├── .env.example                → modelo de variáveis de ambiente (versionado)
├── .env                         → variáveis reais (NÃO versionado)
└── .prettierrc                  → regras de formatação
```

## Endpoints

Base URL: `http://localhost:3001/api`

| Método | Rota                     | Descrição                                          | Status de sucesso | Status de erro                      |
| ------ | ------------------------ | -------------------------------------------------- | ----------------- | ----------------------------------- |
| GET    | `/health`                | Verifica se a API está no ar                       | 200               | -                                   |
| GET    | `/quadras`               | Lista quadras com filtros opcionais (query string) | 200               | -                                   |
| GET    | `/quadras/:id`           | Detalha uma quadra                                 | 200               | 404 (não encontrada)                |
| GET    | `/quadras/:id/horarios`  | Horários livres/ocupados de uma quadra em uma data | 200               | 400 (sem `data`), 404               |
| POST   | `/quadras`               | Cadastra uma nova quadra                           | 201               | 400 (dados inválidos)               |
| GET    | `/reservas`              | Lista reservas (aceita `?quadraId=`)               | 200               | -                                   |
| POST   | `/reservas`              | Cria uma reserva (status inicial "pendente")       | 201               | 400, 409 (conflito)                 |
| PATCH  | `/reservas/:id/cancelar` | Cancela uma reserva, liberando o horário           | 200               | 404 (não encontrada)                |
| POST   | `/pagamentos`            | Simula o pagamento e confirma a reserva vinculada  | 201               | 400, 404, 409 (pagamento duplicado) |

### GET /api/health

Resposta 200:

```json
{ "status": "API running!" }
```

### GET /api/quadras?cidade=Curitiba&esporte=society&precoMin=100&precoMax=200&data=2026-10-10&horario=19:00

Resposta 200:

```json
[
  {
    "id": 1,
    "nome": "Arena Batel Society",
    "endereco": "Rua Comendador Araújo, 540",
    "cidade": "Curitiba",
    "bairro": "Batel",
    "esporte": "society",
    "precoHora": 180,
    "estrutura": {
      "vestiario": true,
      "estacionamento": true,
      "iluminacao": true,
      "coberta": false
    },
    "fotos": ["https://picsum.photos/seed/arena-batel/600/400"],
    "horarioFuncionamento": { "abertura": "08:00", "fechamento": "23:00" },
    "descricao": "Grama sintética premium, a 5 minutos do Shopping Curitiba."
  }
]
```

### GET /api/quadras/999

Resposta 404:

```json
{ "error": "Quadra não encontrada." }
```

### GET /api/quadras/1/horarios?data=2026-10-10

Resposta 200:

```json
{
  "horariosLivres": ["07:00", "08:00", "09:00", "..."],
  "horariosOcupados": ["19:00"]
}
```

### POST /api/quadras

Request body:

```json
{
  "nome": "Arena Teste",
  "endereco": "Rua Exemplo, 123",
  "cidade": "Curitiba",
  "bairro": "Centro",
  "esporte": "society",
  "precoHora": 150,
  "estrutura": { "vestiario": true, "estacionamento": false, "iluminacao": true, "coberta": false }
}
```

Resposta 201: a quadra criada, com `id` incremental.

Resposta 400 (ex.: `precoHora` ausente ou ≤ 0):

```json
{
  "error": "Dados inválidos.",
  "detalhes": ["O campo \"precoHora\" precisa ser um número maior que zero."]
}
```

### POST /api/reservas

Request body:

```json
{
  "quadraId": 1,
  "nomeCliente": "João Silva",
  "telefoneCliente": "41999999999",
  "data": "2026-10-15",
  "horario": "19:00"
}
```

Resposta 201: a reserva criada com `status: "pendente"`.

Resposta 409 (mesma quadra/data/horário já reservados):

```json
{ "error": "Este horário já está reservado para esta quadra." }
```

### PATCH /api/reservas/:id/cancelar

Resposta 200: a reserva com `status: "cancelada"`.

### POST /api/pagamentos

Request body:

```json
{ "reservaId": 2, "metodo": "pix" }
```

Resposta 201: o pagamento criado com `status: "aprovado"` (a reserva vinculada passa para `"confirmada"`).

Uma segunda tentativa de pagamento para a mesma reserva retorna 409 e não cria outra cobrança.

## Fluxo de branches e padrão de commits

- `main`: código estável, pronto para entrega.
- `develop`: integração das features antes de ir para `main`.
- `feat/<nome-da-feature>`, `docs/<assunto>`, `style/<assunto>`: branches de trabalho, sempre a partir de `develop`,
  mescladas de volta com `merge --no-ff`.

Commits seguem [Conventional Commits](https://www.conventionalcommits.org/) em português:

```
feat: adiciona rota de listagem de quadras
fix: corrige validação de preço por hora
docs: atualiza README com tabela de endpoints
refactor: extrai validação de reserva para o service
chore: configura prettier
```

## Equipe

| Nome        | Função      | GitHub      |
| ----------- | ----------- | ----------- |
| Rafael Maluf | Trello | RafaMaluf |
| Henry Mendes | Protótipo | HenryMendesr |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |
