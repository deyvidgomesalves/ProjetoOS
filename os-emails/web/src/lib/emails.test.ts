import { describe, expect, it } from 'vitest';
import {
  FORNECEDOR_NAO_INFORMADO,
  TODOS_OS_FORNECEDORES,
  copyAllButtonLabel,
  copyAllSuccessMessage,
  createEmailRow,
  emailInitials,
  extractEmailsFromText,
  filterEmailsByFornecedor,
  isValidEmail,
  joinEmailsForCopy,
  listFornecedores,
  splitEmailsText,
  toEmailRows,
  uniqueEmails,
  validateEmailRows,
} from './emails';

describe('joinEmailsForCopy', () => {
  it('junta os e-mails separados por ponto e vírgula', () => {
    const text = joinEmailsForCopy([
      { email: 'carlos@empresa.com.br' },
      { email: 'maria@empresa.com.br' },
      { email: 'joao@empresa.com.br' },
    ]);

    expect(text).toBe('carlos@empresa.com.br; maria@empresa.com.br; joao@empresa.com.br');
  });

  it('ignora espaços extras e e-mails vazios', () => {
    expect(joinEmailsForCopy([{ email: ' a@b.com ' }, { email: '   ' }, { email: 'c@d.com' }])).toBe('a@b.com; c@d.com');
  });

  it('devolve texto vazio quando não há e-mails', () => {
    expect(joinEmailsForCopy([])).toBe('');
  });
});

describe('splitEmailsText', () => {
  it('separa e-mails colados com ponto e vírgula, vírgula ou espaço', () => {
    expect(splitEmailsText('a@x.com; b@y.com, c@z.com')).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
  });

  it('devolve lista vazia para texto vazio', () => {
    expect(splitEmailsText('   ')).toEqual([]);
  });
});

describe('isValidEmail', () => {
  it('aceita e-mails válidos', () => {
    expect(isValidEmail('carlos@empresa.com.br')).toBe(true);
    expect(isValidEmail(' compras@metalurgica.ind.br ')).toBe(true);
  });

  it('recusa e-mails inválidos', () => {
    expect(isValidEmail('sem-arroba')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});

describe('emailInitials', () => {
  it('usa as iniciais do nome', () => {
    expect(emailInitials('Carlos Silva', 'carlos@empresa.com.br')).toBe('CS');
    expect(emailInitials('Carlos', 'carlos@empresa.com.br')).toBe('C');
  });

  it('usa o começo do e-mail quando não há nome', () => {
    expect(emailInitials(null, 'compras@empresa.com.br')).toBe('CO');
  });
});

describe('validateEmailRows', () => {
  it('não aponta erro em linhas vazias', () => {
    expect(validateEmailRows([createEmailRow()])).toEqual({});
  });

  it('aponta e-mail inválido', () => {
    const rows = [createEmailRow('Carlos', 'carlos-empresa')];
    const errors = validateEmailRows(rows);
    expect(errors[rows[0]!.key]?.email).toBe('E-mail inválido.');
  });

  it('aponta e-mail repetido (ignorando maiúsculas)', () => {
    const rows = [createEmailRow('A', 'a@b.com', 'Priner'), createEmailRow('B', 'A@B.com', 'Priner')];
    const errors = validateEmailRows(rows);
    expect(errors[rows[0]!.key]).toBeUndefined();
    expect(errors[rows[1]!.key]?.email).toBe('E-mail repetido.');
  });

  it('aponta e-mail ausente quando só o nome foi preenchido', () => {
    const rows = [createEmailRow('Carlos', '')];
    const errors = validateEmailRows(rows);
    expect(errors[rows[0]!.key]?.email).toBe('Informe o e-mail.');
  });
});

describe('toEmailRows', () => {
  it('converte os e-mails da API para linhas do formulário', () => {
    const rows = toEmailRows([
      {
        id: 7,
        os_id: 1,
        nome: 'Carlos',
        email: 'carlos@empresa.com.br',
        fornecedor: 'Priner',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 8,
        os_id: 1,
        nome: null,
        email: 'compras@empresa.com.br',
        fornecedor: 'Empresa 2',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(rows).toEqual([
      { id: 7, key: 'email-7', nome: 'Carlos', email: 'carlos@empresa.com.br', fornecedor: 'Priner' },
      { id: 8, key: 'email-8', nome: '', email: 'compras@empresa.com.br', fornecedor: 'Empresa 2' },
    ]);
  });
});

describe('fornecedor obrigatório', () => {
  it('aponta erro quando o fornecedor não foi informado', () => {
    const rows = [createEmailRow('Carlos', 'carlos@empresa.com.br')];
    const errors = validateEmailRows(rows);
    expect(errors[rows[0]!.key]?.fornecedor).toBe('Informe o fornecedor.');
  });

  it('não aponta erro quando o fornecedor foi informado', () => {
    const errors = validateEmailRows([createEmailRow('Carlos', 'carlos@empresa.com.br', 'Priner')]);
    expect(errors).toEqual({});
  });
});

describe('listFornecedores', () => {
  it('lista os fornecedores sem repetir, em ordem alfabética', () => {
    expect(
      listFornecedores([
        { fornecedor: 'Priner' },
        { fornecedor: 'Empresa 2' },
        { fornecedor: 'priner' },
        { fornecedor: 'Empresa 3' },
      ]),
    ).toEqual(['Empresa 2', 'Empresa 3', 'Priner']);
  });

  it('trata fornecedor vazio como "Não informado"', () => {
    expect(listFornecedores([{ fornecedor: '' }, { fornecedor: null }])).toEqual([FORNECEDOR_NAO_INFORMADO]);
  });
});

describe('filterEmailsByFornecedor', () => {
  const emails = [
    { nome: 'Carlos', email: 'carlos@empresa.com.br', fornecedor: 'Priner' },
    { nome: 'João', email: 'joao@empresa.com.br', fornecedor: 'Priner' },
    { nome: 'Maria', email: 'maria@empresa2.com.br', fornecedor: 'Empresa 2' },
  ];

  it('devolve todos quando o filtro é "Todos"', () => {
    expect(filterEmailsByFornecedor(emails, TODOS_OS_FORNECEDORES)).toHaveLength(3);
  });

  it('devolve somente os e-mails do fornecedor escolhido', () => {
    expect(filterEmailsByFornecedor(emails, 'Priner')).toEqual([emails[0], emails[1]]);
    expect(filterEmailsByFornecedor(emails, 'Empresa 2')).toEqual([emails[2]]);
  });

  it('não devolve nada para um fornecedor sem e-mails', () => {
    expect(filterEmailsByFornecedor(emails, 'Empresa 9')).toEqual([]);
  });
});

describe('texto do botão e mensagem de cópia', () => {
  it('sem filtro usa "todos os e-mails"', () => {
    expect(copyAllButtonLabel(TODOS_OS_FORNECEDORES)).toBe('COPIAR TODOS OS E-MAILS');
    expect(copyAllButtonLabel('')).toBe('COPIAR TODOS OS E-MAILS');
    expect(copyAllSuccessMessage(TODOS_OS_FORNECEDORES, 3)).toBe('✓ Todos os e-mails foram copiados!');
  });

  it('com filtro avisa que é do fornecedor', () => {
    expect(copyAllButtonLabel('Priner')).toBe('COPIAR E-MAILS DO FORNECEDOR');
    expect(copyAllSuccessMessage('Priner', 2)).toContain('Priner');
    expect(copyAllSuccessMessage('Priner', 2)).toContain('2');
  });
});

describe('uniqueEmails', () => {
  it('remove repetidos ignorando maiúsculas e espaços', () => {
    expect(uniqueEmails(['A@b.com', ' a@B.com ', 'c@d.com'])).toEqual(['A@b.com', 'c@d.com']);
  });
});

describe('extractEmailsFromText', () => {
  it('extrai e-mails no formato "Nome <email>"', () => {
    expect(
      extractEmailsFromText('Carlos <carlos@empresa.com.br>; Maria <maria@empresa.com.br>'),
    ).toEqual(['carlos@empresa.com.br', 'maria@empresa.com.br']);
  });

  it('extrai e-mails separados por ponto e vírgula, vírgula ou espaço', () => {
    expect(extractEmailsFromText('carlos@empresa.com.br; maria@empresa.com.br, joao@empresa.com.br')).toEqual([
      'carlos@empresa.com.br',
      'maria@empresa.com.br',
      'joao@empresa.com.br',
    ]);
  });

  it('ignora textos que não são e-mail', () => {
    expect(extractEmailsFromText('Carlos Maria; sem-arroba')).toEqual([]);
  });
});
