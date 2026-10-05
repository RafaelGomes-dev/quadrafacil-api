/**
 * Dados mock em memória do QuadraFacil.
 *
 * Ainda não existe banco de dados nesta etapa do projeto (ver src/config/database.js).
 * Estas listas simulam as tabelas "quadras", "reservas" e "pagamentos" e são
 * mutadas diretamente pelos services durante a vida do processo. Ao reiniciar
 * o servidor os dados voltam ao estado inicial definido aqui.
 */

const quadras = [
  {
    id: 1,
    nome: 'Arena Batel Society',
    endereco: 'Rua Comendador Araújo, 540',
    cidade: 'Curitiba',
    bairro: 'Batel',
    esporte: 'society',
    precoHora: 180,
    estrutura: {
      vestiario: true,
      estacionamento: true,
      iluminacao: true,
      coberta: false,
    },
    fotos: ['https://picsum.photos/seed/arena-batel/600/400'],
    horarioFuncionamento: { abertura: '08:00', fechamento: '23:00' },
    descricao: 'Grama sintética premium, a 5 minutos do Shopping Curitiba.',
  },
  {
    id: 2,
    nome: 'Quadra Boa Vista Futsal',
    endereco: 'Av. Paraná, 2100',
    cidade: 'Curitiba',
    bairro: 'Boa Vista',
    esporte: 'futsal',
    precoHora: 120,
    estrutura: {
      vestiario: true,
      estacionamento: false,
      iluminacao: true,
      coberta: true,
    },
    fotos: ['https://picsum.photos/seed/boa-vista-futsal/600/400'],
    horarioFuncionamento: { abertura: '09:00', fechamento: '22:00' },
    descricao: 'Quadra coberta, piso emborrachado, ideal para jogos à noite.',
  },
  {
    id: 3,
    nome: 'Campo do Bacacheri',
    endereco: 'Rua João Bettega, 1900',
    cidade: 'Curitiba',
    bairro: 'Bacacheri',
    esporte: 'campo',
    precoHora: 250,
    estrutura: {
      vestiario: true,
      estacionamento: true,
      iluminacao: false,
      coberta: false,
    },
    fotos: ['https://picsum.photos/seed/bacacheri-campo/600/400'],
    horarioFuncionamento: { abertura: '07:00', fechamento: '18:00' },
    descricao: 'Campo de grama natural com medidas oficiais, ideal para peladas de domingo.',
  },
  {
    id: 4,
    nome: 'Beach Sports Água Verde',
    endereco: 'Rua Francisco Rocha, 300',
    cidade: 'Curitiba',
    bairro: 'Água Verde',
    esporte: 'beach tennis',
    precoHora: 90,
    estrutura: {
      vestiario: true,
      estacionamento: true,
      iluminacao: true,
      coberta: false,
    },
    fotos: ['https://picsum.photos/seed/agua-verde-beach/600/400'],
    horarioFuncionamento: { abertura: '08:00', fechamento: '23:00' },
    descricao: 'Quadra de areia com iluminação noturna para beach tennis e vôlei de praia.',
  },
  {
    id: 5,
    nome: 'Ginásio Santa Felicidade',
    endereco: 'Av. Manoel Ribas, 4500',
    cidade: 'Curitiba',
    bairro: 'Santa Felicidade',
    esporte: 'basquete',
    precoHora: 140,
    estrutura: {
      vestiario: true,
      estacionamento: true,
      iluminacao: true,
      coberta: true,
    },
    fotos: ['https://picsum.photos/seed/santa-felicidade-ginasio/600/400'],
    horarioFuncionamento: { abertura: '08:00', fechamento: '22:00' },
    descricao: 'Ginásio coberto com piso de taco, usado também para vôlei.',
  },
  {
    id: 6,
    nome: 'Quadra Xapinhal Vôlei',
    endereco: 'Rua Nicarágua, 780',
    cidade: 'Curitiba',
    bairro: 'Xaxim',
    esporte: 'volei',
    precoHora: 100,
    estrutura: {
      vestiario: false,
      estacionamento: true,
      iluminacao: true,
      coberta: true,
    },
    fotos: ['https://picsum.photos/seed/xaxim-volei/600/400'],
    horarioFuncionamento: { abertura: '09:00', fechamento: '21:00' },
    descricao: 'Quadra de vôlei coberta no coração do Xaxim, com arquibancada pequena.',
  },
  {
    id: 7,
    nome: 'Arena Cidade Industrial',
    endereco: 'Rua Nicolau Kluppel, 1200',
    cidade: 'Curitiba',
    bairro: 'Cidade Industrial',
    esporte: 'society',
    precoHora: 160,
    estrutura: {
      vestiario: true,
      estacionamento: true,
      iluminacao: true,
      coberta: false,
    },
    fotos: ['https://picsum.photos/seed/cic-arena/600/400'],
    horarioFuncionamento: { abertura: '08:00', fechamento: '23:30' },
    descricao: 'Duas quadras society lado a lado, boa opção para campeonatos entre amigos.',
  },
  {
    id: 8,
    nome: 'Quadra Portão Futsal',
    endereco: 'Av. República Argentina, 3500',
    cidade: 'Curitiba',
    bairro: 'Portão',
    esporte: 'futsal',
    precoHora: 110,
    estrutura: {
      vestiario: true,
      estacionamento: true,
      iluminacao: true,
      coberta: true,
    },
    fotos: ['https://picsum.photos/seed/portao-futsal/600/400'],
    horarioFuncionamento: { abertura: '08:00', fechamento: '22:00' },
    descricao: 'Quadra coberta com piso de madeira, perto do Shopping Palladium.',
  },
];

const reservas = [
  {
    id: 1,
    quadraId: 1,
    nomeCliente: 'Lucas Ferreira',
    telefoneCliente: '41999990000',
    data: '2026-10-10',
    horario: '19:00',
    status: 'confirmada',
    criadaEm: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 2,
    quadraId: 2,
    nomeCliente: 'Mariana Souza',
    telefoneCliente: '41998887777',
    data: '2026-10-11',
    horario: '20:00',
    status: 'pendente',
    criadaEm: '2026-10-02T15:30:00.000Z',
  },
];

const pagamentos = [
  {
    id: 1,
    reservaId: 1,
    metodo: 'pix',
    valor: 180,
    status: 'aprovado',
    criadaEm: '2026-10-01T12:05:00.000Z',
  },
];

let proximoIdQuadra = quadras.length + 1;
let proximoIdReserva = reservas.length + 1;
let proximoIdPagamento = pagamentos.length + 1;

/** Gera o próximo ID incremental de quadra. */
function gerarProximoIdQuadra() {
  return proximoIdQuadra++;
}

/** Gera o próximo ID incremental de reserva. */
function gerarProximoIdReserva() {
  return proximoIdReserva++;
}

/** Gera o próximo ID incremental de pagamento. */
function gerarProximoIdPagamento() {
  return proximoIdPagamento++;
}

module.exports = {
  quadras,
  reservas,
  pagamentos,
  gerarProximoIdQuadra,
  gerarProximoIdReserva,
  gerarProximoIdPagamento,
};
