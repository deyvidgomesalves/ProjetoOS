# Sistema de OS e E-mails

Aplicação web simples e funcional para **cadastrar Ordens de Serviço (OS)** e **guardar os e-mails dos
clientes**, com pesquisa rápida e cópia dos endereços em um clique (para colar direto em **Para**/**CC** do
Outlook).

> Banco de dados real (SQLite em arquivo no uso local ou Postgres/Supabase na hospedagem).
> Nada é guardado apenas no navegador — os dados ficam no servidor e continuam lá depois de fechar o
> navegador, trocar de computador ou reiniciar o servidor.

---

## O que o sistema faz

- **Login com dois perfis**: `admin` (acesso total) e `usuario` (somente consulta).
- **Tela principal** com campo de pesquisa (`Pesquisar OS, cliente, obra ou fornecedor...`) e botão `+ Nova OS`.
- **Lista/tabela** com OS, Cliente, Obra, quantidade de e-mails e ação **Abrir**.
- **Nova OS**: número da OS, cliente, obra, observação (opcional) e **vários e-mails** (nome opcional, e-mail e
  **fornecedor obrigatório**).
- **Detalhes da OS**: dados + **filtro por fornecedor** + tabela de e-mails (Nome, E-mail, Fornecedor, Ação) +
  botão grande **COPIAR TODOS OS E-MAILS** e **Copiar** individual.
- **Editar OS**: altera os dados e adiciona/edita/remove e-mails (inclusive o fornecedor).
- **Excluir OS**: com confirmação (“Tem certeza que deseja excluir esta OS?”) — os e-mails vão junto.
- **Pesquisa** por número da OS, cliente, obra ou fornecedor (sem diferenciar maiúsculas/minúsculas e aceitando
  parte do texto; pesquisar “Priner” traz as OS que têm e-mails desse fornecedor).

### Filtro por fornecedor e cópia

Na tela da OS existe o filtro **Fornecedor: [Todos ▼]** (montado com os fornecedores daquela OS):

- **Todos**: os e-mails de todos os fornecedores são exibidos e o botão **📋 COPIAR TODOS OS E-MAILS** copia
  todos os endereços.
- **Fornecedor selecionado** (ex.: Priner): só os e-mails dele são exibidos, o botão passa a mostrar
  **📋 COPIAR E-MAILS DO FORNECEDOR** e copia **somente** os endereços daquele fornecedor.

A cópia leva **somente os e-mails, separados por ponto e vírgula**:

```
carlos@empresa.com.br; maria@empresa.com.br; joao@empresa.com.br
```

Depois de copiar aparece a confirmação **✓ Todos os e-mails foram copiados!** (ou
“✓ E-mails do fornecedor "Priner" foram copiados!” quando há filtro). O botão **Copiar** individual de cada
e-mail continua funcionando normalmente.

O que **não** existe (de propósito, para manter simples): dashboard, relatórios, status, cadastro de usuários
pela interface, histórico, notificações e gráficos.

---

## Acesso ao sistema (login)

O sistema tem **dois usuários fixos** (não há tela de cadastro de usuários):

| Usuário | Senha | Perfil | Pode fazer |
| --- | --- | --- | --- |
| `admin` | `admin2004` | Administrador | Pesquisar, abrir, **criar**, **editar**, **excluir** OS; **adicionar/editar/excluir** e-mails; copiar (um ou todos) |
| `usuario` | `123456` | Somente consulta | Pesquisar, abrir a OS, visualizar e-mails e **copiar** (um ou todos) |

O perfil de consulta **não** consegue criar, editar ou excluir nada — nem pela interface (os botões não
aparecem) nem pela API (a resposta é **403**). Pesquisar, visualizar e copiar funcionam normalmente para os
dois perfis.

Como funciona por dentro (simples de propósito):

- As senhas são guardadas apenas como **hash scrypt** (nunca em texto puro na comparação).
- O login cria um **cookie de sessão assinado (HMAC)**, válido por 12 horas por padrão (`SESSION_TTL_HOURS`).
- Não há tabela de usuários: os dois perfis vêm da configuração inicial (variáveis abaixo).
- Cada tentativa de senha funciona em tempo constante e o login é bloqueado temporariamente (429) depois de
  várias tentativas erradas seguidas.

Para trocar as senhas, edite o `.env`:

```env
ADMIN_PASSWORD=minha-senha-forte
USER_PASSWORD=senha-do-time
```

Ou use um hash pronto (mais seguro, evita deixar a senha em texto no arquivo):

```bash
npm run hash -- "minha-senha-forte"
# copie o resultado para ADMIN_PASSWORD_HASH / USER_PASSWORD_HASH no .env
```

---

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| API | Node.js + Express 5 + TypeScript |
| Banco | SQLite (arquivo, padrão local) **ou** Postgres/Supabase (`DATABASE_URL`) |
| Testes | `node:test` (API) + Vitest (front) |

O build do site é servido pela própria API, então **o projeto inteiro roda como um único serviço** — o que
facilita a hospedagem e gera um único link para compartilhar.

---

## Requisitos

- **Node.js 22.5 ou superior** (recomendado Node 24 LTS) — https://nodejs.org
- npm (instalado junto com o Node)

Confira com:

```bash
node --version
npm --version
```


---

## Como rodar localmente

```bash
# 1. Entre na pasta do projeto
cd os-emails

# 2. Instale as dependências (raiz, server e web de uma vez)
npm install

# 3. (Opcional) Crie OS de exemplo para ver a interface pronta
npm run seed

# 4. Suba API + site em modo desenvolvimento
npm run dev
```

Depois abra **http://localhost:5173** (site em modo dev, com atualização automática).
A API responde em **http://localhost:3000** e o site em dev repassa `/api` para ela automaticamente.

### Rodando como em produção (build único)

```bash
npm run build   # compila a API (server/dist) e o site (web/dist)
npm start       # sobe tudo em http://localhost:3000
```

Nesse modo o site e a API ficam na **mesma porta (3000)** — é exatamente o que rodará na hospedagem.

---

## Como usar

1. Acesse o endereço do sistema e faça **login** (`admin` para usar todas as funções ou `usuario` para consulta).
2. Clique em **+ Nova OS** (disponível apenas para o administrador).
2. Preencha **Número da OS**, **Cliente** e **Obra** (observação é opcional).
3. Em **E-mails do cliente**, clique em **+ Adicionar e-mail** e informe nome (opcional), e-mail e o
   **fornecedor** (obrigatório — escolha um já cadastrado na lista ou digite um novo).
   Dica: você pode **colar vários e-mails de uma vez** (`a@x.com; b@y.com`) e cada um vira uma linha.
4. Clique em **Salvar OS**.
5. Na tela principal, pesquise (`12345`, `empresa abc`, `Obra XPTO`, `Priner`...) e clique na linha para abrir.
6. Na tela da OS, use o filtro **Fornecedor: [Todos ▼]** para ver só os e-mails de um fornecedor.
7. Use **📋 COPIAR TODOS OS E-MAILS** (ou **📋 COPIAR E-MAILS DO FORNECEDOR**, quando houver filtro) e cole no
   Outlook, ou copie um e-mail individual pelo botão **Copiar**.

---

## Banco de dados

### Opção 1 — SQLite (padrão, sem configuração)

Nada a fazer: os dados ficam no arquivo `server/data/os.sqlite`. Ideal para uso local na sua máquina ou
em um servidor com disco persistente.

- Trocar o arquivo: `DB_FILE=./meu-banco.sqlite` no `.env`.

### Opção 2 — Postgres / Supabase (recomendado na hospedagem)

1. Crie um projeto no [Supabase](https://supabase.com) (ou Neon/Railway).
2. Copie a **connection string** (Supabase: *Settings → Database → Connection string → Pooler*).
3. Crie um arquivo `.env` na raiz (copie de `.env.example`):

```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://postgres.SEU_PROJETO:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
PGSSL=require
```

4. Rode `npm run dev` / `npm start`. A API cria as tabelas automaticamente.
   Se preferir criar na mão, execute o conteúdo de **`supabase/schema.sql`** no *SQL Editor*.

### Estrutura das tabelas

**os** (Ordem de Serviço)

| coluna | tipo | observação |
| --- | --- | --- |
| id | inteiro (PK) | gerado automaticamente |
| numero_os | texto | obrigatório |
| cliente | texto | obrigatório |
| obra | texto | obrigatório (antes era chamado de “tag”) |
| observacao | texto | opcional |
| created_at | data/hora | preenchido pela API |
| updated_at | data/hora | atualizado a cada edição |

**emails** (e-mails do cliente — uma OS tem vários)

| coluna | tipo | observação |
| --- | --- | --- |
| id | inteiro (PK) | gerado automaticamente |
| os_id | inteiro (FK → os.id) | apagado em cascata com a OS |
| nome | texto | **opcional** (pode ficar vazio) |
| email | texto | obrigatório |
| fornecedor | texto | **obrigatório** no cadastro |
| created_at | data/hora | preenchido pela API |

#### Atualização de bancos antigos (sem perder dados)

Ao abrir o banco, o servidor ajusta automaticamente bancos criados por versões anteriores:

1. a coluna **`tag`** da OS é renomeada para **`obra`** (os valores continuam os mesmos);
2. a coluna **`fornecedor`** é criada na tabela de e-mails e os registros antigos ficam com o valor
   **`Não informado`** — que aparece na tela normalmente e pode ser editado depois pelo administrador.

Nenhum dado é apagado. O log do servidor mostra o que foi ajustado, por exemplo:
`[migração] coluna "tag" renomeada para "obra".`


---

## Scripts disponíveis

Na raiz do projeto:

| Comando | O que faz |
| --- | --- |
| `npm install` | instala as dependências da raiz, do `server` e do `web` |
| `npm run dev` | sobe API (3000) e site em modo dev (5173) ao mesmo tempo |
| `npm run build` | gera o build de produção da API e do site |
| `npm start` | sobe o sistema completo em `http://localhost:3000` |
| `npm test` | roda os testes da API e do front |
| `npm run seed` | insere 3 OS de exemplo (não faz nada se já houver OS; use `-- --force` para forçar) |
| `npm run db:clear` | apaga todas as OS e e-mails (mantém a estrutura) |
| `npm run hash -- "senha"` | gera o hash scrypt de uma senha (para usar em `ADMIN_PASSWORD_HASH`/`USER_PASSWORD_HASH`) |

---

## Testes

```bash
npm test                      # tudo
npm test --workspace server   # API: CRUD, pesquisa, validações, cascata e persistência
npm test --workspace web      # front: utilitários de cópia/validação de e-mails
```

Os testes cobrem:

- **API (40 testes)**: login dos dois perfis, senha errada, sessão (`/auth/me`), logout, token adulterado/expirado,
  bloqueio por tentativas repetidas, **permissões por perfil** (o usuário comum recebe 401 sem login e 403 nas
  operações de escrita, e continua podendo pesquisar/abrir), CRUD completo de OS (com **obra**) e e-mails
  (com **fornecedor obrigatório**), pesquisa por número/cliente/obra/fornecedor, lista de fornecedores,
  validações (400), 404, exclusão em cascata, **persistência após fechar e reabrir o banco** e a
  **migração de banco antigo** (tag → obra e criação do fornecedor sem perder dados).
- **Front (31 testes)**: filtro por fornecedor e texto do botão de cópia (todos x filtrado), regras de perfil
  (quem pode cadastrar/editar) e utilitários de cópia/validação de e-mails (incluindo o formato
  `a@x.com; b@y.com`).

---

## Estrutura de pastas

```
os-emails/
├─ server/                    # API Express + banco
│  ├─ src/
│  │  ├─ index.ts             # sobe o servidor
│  │  ├─ app.ts               # rotas, arquivos estáticos (site) e tratamento de erros
│  │  ├─ config.ts            # lê .env e decide o driver do banco / usuários do login
│  │  ├─ auth.ts              # usuários (senha em hash scrypt) e sessão assinada
│  │  ├─ repository.ts        # consultas de OS e e-mails
│  │  ├─ validation.ts        # validação/normalização dos dados
│  │  ├─ middleware/auth.ts   # exige login (requireAuth) e perfil admin (requireAdmin)
│  │  ├─ db/                  # drivers SQLite e Postgres, schema e migrações
│  │  ├─ routes/              # endpoints /api/auth e /api
│  │  ├─ seed.ts              # dados de exemplo
│  │  └─ tests/               # testes da API (node:test)
│  └─ data/                   # arquivo do SQLite (criado automaticamente)
├─ web/                       # interface React
│  └─ src/
│     ├─ pages/               # Login, Home (pesquisa), Nova OS, Detalhes, Editar
│     ├─ components/          # tabela, formulário, lista de e-mails, avisos, modais
│     └─ lib/                 # api, sessão/permissões, cópia, utilidades
├─ supabase/schema.sql        # tabelas para Postgres/Supabase

---

## API (resumo)

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/login` | login (usuário + senha); devolve o cookie de sessão |
| POST | `/api/auth/logout` | encerra a sessão |
| GET | `/api/auth/me` | usuário logado (usado pela interface ao abrir a página) |
| GET | `/api/health` | status do servidor e driver do banco (não exige login) |
| GET | `/api/os?q=texto` | lista/pesquisa OS (número, cliente, obra ou fornecedor) com a contagem de e-mails |
| GET | `/api/fornecedores` | fornecedores já cadastrados (sugestões no cadastro) |
| POST | `/api/os` | cria a OS com os e-mails enviados **(somente admin)** |
| GET | `/api/os/:id` | detalhes da OS + e-mails (com fornecedor) |
| PUT | `/api/os/:id` | edita a OS e sincroniza a lista de e-mails **(somente admin)** |
| DELETE | `/api/os/:id` | exclui a OS e os e-mails vinculados **(somente admin)** |
| POST | `/api/os/:id/emails` | adiciona um e-mail à OS (exige `fornecedor`) **(somente admin)** |
| PUT | `/api/emails/:id` | edita um e-mail (nome, e-mail e fornecedor) **(somente admin)** |
| DELETE | `/api/emails/:id` | remove um e-mail **(somente admin)** |

Todas as rotas de OS e e-mails exigem **login**. As operações de escrita respondem **403** quando quem
tentou é o perfil de consulta (e **401** se não houver sessão). Os campos `obra` (na OS) e `fornecedor`
(em cada e-mail) são obrigatórios.

Para criar uma OS:

```bash
# 1) Login (guarda o cookie em cookies.txt)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin2004"}'

# 2) Criar a OS (com obra e fornecedor em cada e-mail)
curl -b cookies.txt -X POST http://localhost:3000/api/os \
  -H "Content-Type: application/json" \
  -d '{"numero_os":"12345","cliente":"Empresa ABC","obra":"Obra XPTO",
       "emails":[{"nome":"Carlos","email":"carlos@empresa.com.br","fornecedor":"Priner"},
                 {"email":"compras@empresa.com.br","fornecedor":"Empresa 2"}]}'
```

---

## Deploy (link público para outras pessoas)

### Opção A — Render (API + site no mesmo link) — recomendado

1. Suba o projeto para o GitHub:

```bash
git init
git add .
git commit -m "Sistema de OS e e-mails"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/os-emails.git
git push -u origin main
```

2. Crie um banco no Supabase (grátis) e copie a `DATABASE_URL`.
3. No [Render](https://render.com): **New + → Blueprint**, selecione o repositório
   (o arquivo `deploy/render.yaml` já vem pronto) ou use **New + → Web Service** com:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**: `DB_DRIVER=postgres`, `DATABASE_URL=...`, `PGSSL=require` e
     `SESSION_SECRET=um-texto-longo-e-aleatorio` (mantém as sessões válidas entre deploys).
     Se quiser trocar as senhas de acesso, informe também `ADMIN_PASSWORD` / `USER_PASSWORD`.
4. Ao final o Render entrega um link do tipo `https://os-emails.onrender.com` — compartilhe com a equipe.

> O `PORT` é definido automaticamente pelo Render; a aplicação já respeita essa variável.

### Opção B — Site na Vercel + API no Render

- **API**: publique o repositório no Render como acima (o site também será servido lá, mas pode ser ignorado).
- **Site**: na Vercel, **Import Project** → *Root Directory* = `web`, *Build Command* = `npm run build`,
  *Output Directory* = `dist`, e variável de ambiente `VITE_API_URL=https://sua-api.onrender.com`.
- **CORS**: na API, defina `CORS_ORIGIN=https://seu-site.vercel.app` para liberar o acesso.

### Outras hospedagens

Qualquer serviço que rode Node (Railway, Fly.io, VPS, Docker) funciona:
`npm install → npm run build → npm start`. Mantenha `DATABASE_URL` apontando para o Postgres e os dados
ficam permanentemente salvos.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `PORT` | não | porta do servidor (padrão `3000`) |
| `SESSION_SECRET` | recomendada | segredo que assina o cookie de sessão (sem ela, um segredo aleatório é gerado a cada start e todos precisam logar de novo) |
| `SESSION_TTL_HOURS` | não | validade da sessão em horas (padrão `12`) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | não | usuário administrador (padrão `admin` / `admin2004`) |
| `ADMIN_PASSWORD_HASH` | não | hash scrypt do administrador (tem prioridade sobre `ADMIN_PASSWORD`) |
| `USER_USER` / `USER_PASSWORD` | não | usuário de consulta (padrão `usuario` / `123456`) |
| `USER_PASSWORD_HASH` | não | hash scrypt do usuário de consulta (prioridade sobre `USER_PASSWORD`) |
| `DB_DRIVER` | não | `sqlite` (padrão) ou `postgres` (automático se `DATABASE_URL` existir) |
| `DB_FILE` | não | caminho do arquivo SQLite (padrão `server/data/os.sqlite`) |
| `DATABASE_URL` | só para Postgres | string de conexão do banco online |
| `PGSSL` | não | `require` para Supabase/Neon |
| `CORS_ORIGIN` | não | libera a API para outro domínio (só se site e API forem separados) |
| `VITE_API_URL` | não | (no site) URL da API quando hospedada em outro endereço |

---

## Problemas comuns

| Situação | Solução |
| --- | --- |
| `SELF_SIGNED_CERT_IN_CHAIN` ao rodar `npm install` (rede corporativa com proxy inspecionando TLS) | Libere `registry.npmjs.org` no proxy ou rode `npm config set strict-ssl false`. Alternativa: exporte as CAs raiz do Windows para um `.pem` e defina `NODE_EXTRA_CA_CERTS=C:\caminho\ca.pem` |
| Porta 3000 já está em uso | Rode com outra porta: `set PORT=3100 && npm start` (Windows) ou `PORT=3100 npm start` (Linux/macOS) |
| O site abre mas a lista não carrega | Confira se a API está rodando (`/api/health`) e se o endereço está correto em `VITE_API_URL` |
| Quero começar com o banco vazio | `npm run db:clear` (apaga as OS e e-mails de exemplo) |
| Já existiam OS/e-mails cadastrados antes da troca de TAG por Obra | Nada a fazer: ao subir o sistema a coluna é renomeada para `obra` e os e-mails antigos ficam com fornecedor **`Não informado`** (edite quando quiser). O log mostra `[migração] ...` |
| Preciso logar de novo depois de cada restart/deploy | Defina `SESSION_SECRET` no `.env` (sem ele o segredo de assinatura muda a cada start) |
| Esqueci/troquei as senhas | Ajuste `ADMIN_PASSWORD` / `USER_PASSWORD` no `.env` (ou gere um hash com `npm run hash -- "senha"` e use `*_PASSWORD_HASH`) |
| Erro de banco ao subir em produção | Confirme `DATABASE_URL` (com `PGSSL=require`) e se as tabelas foram criadas — rode `supabase/schema.sql` no SQL Editor |

├─ deploy/render.yaml         # blueprint de deploy no Render
└─ .env.example               # modelo de configuração
```
