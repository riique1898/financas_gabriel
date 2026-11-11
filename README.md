# Saldo — app de finanças pessoais

Aplicativo móvel híbrido feito com Ionic Vue, TypeScript e Capacitor. A autenticação, os lançamentos, o perfil e as fotos ficam associados ao usuário no Supabase. Os gráficos usam Vue ApexCharts.

## Requisitos

- Node.js 20.19+ ou 22.12+
- Android Studio com Android SDK instalado
- Projeto Supabase

## Configurar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No **SQL Editor**, execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql). Isso cria as tabelas `receitas`, `despesas`, `profiles`, as políticas RLS e o bucket `avatars` com acesso restrito para envio.
3. Em **Project Settings → API**, copie a URL do projeto e a chave `anon`/public.
4. Copie `.env.example` para `.env` e informe:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica
   ```

Nunca coloque a chave `service_role` no aplicativo.

## Rodar no navegador

```bash
npm install
npm run dev
```

## Abrir no Android Studio

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Na primeira execução, `android:add` cria o projeto nativo Capacitor. Depois, abra o projeto `android/` no Android Studio e execute no emulador ou dispositivo. Nas próximas alterações do app web, rode `npm run android:sync` para atualizar os arquivos usados no app Android.

## Funcionalidades

- Cadastro, login e logout com Supabase Auth.
- Receitas e despesas com criação, edição, exclusão, listagem e validação.
- Dashboard com saldo, totais, maior categoria, quantidade de lançamentos e proporção de despesas.
- Gráfico de pizza por categoria e gráfico mensal de receitas/despesas.
- Filtro por mês, busca e filtro por tipo.
- Perfil editável com nome e foto selecionada pela câmera/galeria, armazenados no Supabase.
- Tema escuro e layout responsivo para celular.

Os dados exibidos no dashboard são filtrados pelo mês selecionado. Cada tabela e arquivo de perfil usa políticas RLS para limitar o acesso ao dono da conta.
