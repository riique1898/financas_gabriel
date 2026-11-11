<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { IonIcon } from '@ionic/vue'
import { walletOutline } from 'ionicons/icons'
import { supabase, type Entry, type EntryKind, type Profile } from './lib/supabase'

type Tab = 'inicio' | 'lancamentos' | 'perfil'
type TaggedEntry = Entry & { __kind: EntryKind }
const session = ref<any>(null)
const entries = ref<TaggedEntry[]>([])
const profile = ref<Profile | null>(null)
const tab = ref<Tab>('inicio')
const authMode = ref<'login' | 'cadastro'>('login')
const authEmail = ref('')
const authPassword = ref('')
const authName = ref('')
const authError = ref('')
const authLoading = ref(false)
const notice = ref('')
const monthFilter = ref(new Date().toISOString().slice(0, 7))
const darkMode = ref(false)
const showEntryForm = ref(false)
const editingEntry = ref<Entry | null>(null)
const formKind = ref<EntryKind>('despesa')
const formDescription = ref('')
const formAmount = ref('')
const formCategory = ref('')
const formDate = ref(new Date().toISOString().slice(0, 10))
const savingEntry = ref(false)
const profileName = ref('')
const savingProfile = ref(false)
const uploadingAvatar = ref(false)
const search = ref('')
const kindFilter = ref<'todos' | EntryKind>('todos')

const expenseCategories = ['Alimentação', 'Transporte', 'Moradia', 'Educação', 'Lazer', 'Saúde', 'Outros']
const incomeCategories = ['Salário', 'Freelance', 'Investimentos', 'Outros']
const categories = computed(() => formKind.value === 'receita' ? incomeCategories : expenseCategories)
const monthEntries = computed(() => entries.value.filter(e => e.data.startsWith(monthFilter.value)))
const monthIncome = computed(() => monthEntries.value.filter(e => e.__kind === 'receita').reduce((s, e) => s + Number(e.valor), 0))
const monthExpense = computed(() => monthEntries.value.filter(e => e.__kind === 'despesa').reduce((s, e) => s + Number(e.valor), 0))
const balance = computed(() => monthIncome.value - monthExpense.value)
const expenseRows = computed(() => monthEntries.value.filter(e => (e as any).__kind === 'despesa'))
const biggestCategory = computed(() => {
  const sums = new Map<string, number>()
  expenseRows.value.forEach(e => sums.set(e.categoria, (sums.get(e.categoria) ?? 0) + Number(e.valor)))
  return [...sums.entries()].sort((a, b) => b[1] - a[1])[0]
})
const expenseRatio = computed(() => monthIncome.value ? Math.round(monthExpense.value / monthIncome.value * 100) : 0)
const filteredEntries = computed(() => entries.value.filter(e => {
  const kindMatches = kindFilter.value === 'todos' || e.__kind === kindFilter.value
  const textMatches = `${e.descricao} ${e.categoria}`.toLocaleLowerCase('pt-BR').includes(search.value.toLocaleLowerCase('pt-BR'))
  return kindMatches && textMatches && e.data.startsWith(monthFilter.value)
}).sort((a, b) => b.data.localeCompare(a.data)))
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
const monthLabel = computed(() => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${monthFilter.value}-15T12:00:00`)))
const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T12:00:00`))

const pieOptions = computed(() => ({ chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'DM Sans, sans-serif' }, labels: [...new Set(expenseRows.value.map(e => e.categoria))], colors: ['#496c51', '#c6a76b', '#829581', '#d58b68', '#8b92b7', '#b97878', '#aab8a4'], legend: { position: 'bottom' as const, fontSize: '12px' }, dataLabels: { enabled: false }, stroke: { width: 0 }, plotOptions: { pie: { donut: { size: '72%' } } }, noData: { text: 'Sem despesas neste mês' } }))
const pieSeries = computed(() => {
  const sums = new Map<string, number>()
  expenseRows.value.forEach(e => sums.set(e.categoria, (sums.get(e.categoria) ?? 0) + Number(e.valor)))
  return [...sums.values()]
})
const recentMonths = computed(() => Array.from({ length: 6 }, (_, i) => {
  const d = new Date(`${monthFilter.value}-15T12:00:00`); d.setMonth(d.getMonth() - (5 - i))
  return d.toISOString().slice(0, 7)
}))
const barOptions = computed(() => ({ chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'DM Sans, sans-serif' }, plotOptions: { bar: { borderRadius: 5, columnWidth: '38%' } }, colors: ['#496c51', '#c98668'], dataLabels: { enabled: false }, xaxis: { categories: recentMonths.value.map(m => new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${m}-15T12:00:00`))) }, yaxis: { labels: { formatter: (v: number) => `R$${Math.round(v)}` } }, legend: { position: 'top' as const }, grid: { borderColor: '#edf0eb' }, noData: { text: 'Sem lançamentos' } }))
const barSeries = computed(() => recentMonths.value.map((m, i) => {
  const data = entries.value.filter(e => e.data.startsWith(m))
  const total = (kind: EntryKind) => data.filter(e => (e as any).__kind === kind).reduce((s, e) => s + Number(e.valor), 0)
  return { income: total('receita'), expense: total('despesa'), i }
}))
const chartData = computed(() => [{ name: 'Receitas', data: barSeries.value.map(s => s.income) }, { name: 'Despesas', data: barSeries.value.map(s => s.expense) }])
const hasBarData = computed(() => barSeries.value.some(s => s.income > 0 || s.expense > 0))

function flash(message: string) { notice.value = message; window.setTimeout(() => { if (notice.value === message) notice.value = '' }, 8000) }
async function authenticate() {
  authError.value = ''
  if (!supabase) { authError.value = 'Configure o Supabase no arquivo .env para continuar.'; return }
  if (!authEmail.value.trim() || authPassword.value.length < 6) { authError.value = 'Informe um e-mail válido e senha com pelo menos 6 caracteres.'; return }
  authLoading.value = true
  const result = authMode.value === 'login'
    ? await supabase.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPassword.value })
    : await supabase.auth.signUp({ email: authEmail.value.trim(), password: authPassword.value, options: { data: { nome: authName.value.trim() } } })
  authLoading.value = false
  if (result.error) { authError.value = result.error.message; return }
  if (authMode.value === 'cadastro' && !result.data.session) { authError.value = 'Conta criada. Confirme seu e-mail para entrar.'; authMode.value = 'login'; return }
  session.value = result.data.session
  if (session.value) await loadData()
}
async function signOut() { await supabase?.auth.signOut(); session.value = null; entries.value = []; profile.value = null; tab.value = 'inicio' }
async function loadData(): Promise<boolean> {
  if (!supabase || !session.value?.user) return false
  const userId = session.value.user.id
  const [incomeResult, expenseResult, profileResult] = await Promise.all([
    supabase.from('receitas').select('*').eq('user_id', userId).order('data', { ascending: false }),
    supabase.from('despesas').select('*').eq('user_id', userId).order('data', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ])
  entries.value = [
    ...(incomeResult.error ? [] : incomeResult.data ?? []).map(e => ({ ...e, __kind: 'receita' })),
    ...(expenseResult.error ? [] : expenseResult.data ?? []).map(e => ({ ...e, __kind: 'despesa' })),
  ] as TaggedEntry[]
  const loadedProfile = profileResult.data ?? { id: userId, nome: session.value.user.user_metadata.nome || session.value.user.email?.split('@')[0] || 'Meu perfil', avatar_url: null }
  profile.value = loadedProfile
  profileName.value = loadedProfile.nome
  const issues = [incomeResult.error, expenseResult.error, profileResult.error].filter(Boolean).map(error => error!.message)
  if (issues.length) { flash(`Falha ao carregar dados do Supabase: ${issues.join(' · ')}`); return false }
  return true
}
function openNew(kind: EntryKind) {
  editingEntry.value = null; formKind.value = kind; formDescription.value = ''; formAmount.value = ''; formCategory.value = categories.value[0]; formDate.value = new Date().toISOString().slice(0, 10); showEntryForm.value = true
}
function editEntry(entry: TaggedEntry) {
  editingEntry.value = entry; formKind.value = entry.__kind; formDescription.value = entry.descricao; formAmount.value = String(entry.valor); formCategory.value = entry.categoria; formDate.value = entry.data; showEntryForm.value = true
}
async function saveEntry() {
  if (!supabase) { flash('O Supabase não está configurado. Confira as variáveis do arquivo .env.'); return }
  if (!session.value?.user) { flash('Sua sessão expirou. Entre novamente para salvar o lançamento.'); return }
  const amount = Number(String(formAmount.value).trim().replace(',', '.'))
  if (!formDescription.value.trim() || !Number.isFinite(amount) || amount <= 0 || !formCategory.value || !formDate.value) { flash('Preencha todos os campos com um valor maior que zero.'); return }
  savingEntry.value = true
  const kind = formKind.value, table = kind === 'receita' ? 'receitas' : 'despesas'
  const payload = { descricao: formDescription.value.trim(), valor: amount, categoria: formCategory.value, data: formDate.value, user_id: session.value.user.id }
  try {
    const result = editingEntry.value
      ? await supabase.from(table).update(payload).eq('id', editingEntry.value.id).eq('user_id', session.value.user.id)
      : await supabase.from(table).insert(payload)
    if (result.error) { flash(`Não foi possível salvar no Supabase: ${result.error.message}`); return }
    const wasEditing = Boolean(editingEntry.value)
    showEntryForm.value = false
    const loaded = await loadData()
    if (loaded) flash(wasEditing ? 'Lançamento atualizado.' : 'Lançamento salvo.')
  } catch (error: any) {
    flash(`Falha de conexão ao salvar: ${error?.message || 'verifique a conexão com a internet.'}`)
  } finally { savingEntry.value = false }
}
async function deleteEntry(entry: TaggedEntry) {
  if (!supabase || !session.value?.user || !window.confirm(`Excluir “${entry.descricao}”?`)) return
  const table = entry.__kind === 'receita' ? 'receitas' : 'despesas'
  const { error } = await supabase.from(table).delete().eq('id', entry.id).eq('user_id', session.value.user.id)
  if (error) { flash(`Erro ao excluir: ${error.message}`); return }
  await loadData(); flash('Lançamento excluído.')
}
async function saveProfile() {
  if (!supabase || !session.value?.user || !profileName.value.trim()) { flash('Informe um nome para o perfil.'); return }
  savingProfile.value = true
  const { data, error } = await supabase.from('profiles').upsert({ id: session.value.user.id, nome: profileName.value.trim(), avatar_url: profile.value?.avatar_url ?? null }, { onConflict: 'id' }).select().single()
  savingProfile.value = false
  if (error) { flash(`Erro ao salvar perfil: ${error.message}`); return }
  profile.value = data; flash('Perfil atualizado no banco de dados.')
}
async function changeAvatar() {
  if (!supabase || !session.value?.user) return
  try {
    const photo = await Camera.getPhoto({ quality: 68, width: 480, allowEditing: true, resultType: CameraResultType.Base64, source: CameraSource.Prompt })
    if (!photo.base64String) return
    uploadingAvatar.value = true
    const bytes = Uint8Array.from(atob(photo.base64String), c => c.charCodeAt(0))
    const ext = photo.format || 'jpeg', path = `${session.value.user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: `image/${ext}`, upsert: true })
    if (uploadError?.message.toLowerCase().includes('bucket not found')) {
      const dataUrl = `data:image/${ext};base64,${photo.base64String}`
      const { data, error } = await supabase.from('profiles').upsert({ id: session.value.user.id, nome: profileName.value || profile.value?.nome || 'Meu perfil', avatar_url: dataUrl }, { onConflict: 'id' }).select().single()
      uploadingAvatar.value = false
      if (error) { flash(`A foto foi selecionada, mas não salvou no perfil: ${error.message}`); return }
      profile.value = data
      flash('Foto salva no perfil. O bucket avatars não existe; a imagem ficou guardada no registro do perfil.')
      return
    }
    if (uploadError) { uploadingAvatar.value = false; flash(`Erro ao enviar foto para o Supabase: ${uploadError.message}`); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
    const { data, error } = await supabase.from('profiles').upsert({ id: session.value.user.id, nome: profileName.value || profile.value?.nome || 'Meu perfil', avatar_url: avatarUrl }, { onConflict: 'id' }).select().single()
    uploadingAvatar.value = false
    if (error) { flash(`Foto enviada, mas perfil não atualizou: ${error.message}`); return }
    profile.value = data; flash('Foto do perfil atualizada.')
  } catch (error: any) { uploadingAvatar.value = false; flash(`Não foi possível abrir ou salvar a foto: ${error?.message || 'verifique as permissões de câmera e galeria.'}`) }
}
function shiftMonth(amount: number) { const d = new Date(`${monthFilter.value}-15T12:00:00`); d.setMonth(d.getMonth() + amount); monthFilter.value = d.toISOString().slice(0, 7) }
watch(darkMode, value => document.documentElement.classList.toggle('dark-theme', value))

onMounted(async () => {
  if (!supabase) return
  const { data } = await supabase.auth.getSession(); session.value = data.session
  if (session.value) await loadData()
  supabase.auth.onAuthStateChange((_event, nextSession) => { session.value = nextSession; if (nextSession) window.setTimeout(() => loadData(), 0) })
})
</script>

<template>
  <main v-if="!session" class="auth-shell">
    <section class="auth-art">
      <div class="brand"><span class="brand-mark">s</span><span>saldo</span></div>
      <div class="auth-copy"><span class="eyebrow">SUA VIDA, EM EQUILÍBRIO</span><h1>Clareza para<br>cada escolha.</h1><p>Cuide do seu dinheiro com uma visão simples, leve e feita para você.</p></div>
      <div class="auth-orbit orbit-one"></div><div class="auth-orbit orbit-two"></div>
      <div class="art-note"><span>✦</span> O próximo passo começa com uma boa visão.</div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <span class="eyebrow muted">CONTROLE FINANCEIRO PESSOAL</span>
        <h2>{{ authMode === 'login' ? 'Bom ter você por aqui.' : 'Vamos começar?' }}</h2>
        <p class="auth-subtitle">{{ authMode === 'login' ? 'Entre na sua conta para acompanhar seu dinheiro.' : 'Crie sua conta e organize suas finanças.' }}</p>
        <form @submit.prevent="authenticate" class="stack-form">
          <label v-if="authMode === 'cadastro'">Seu nome<input v-model="authName" autocomplete="name" placeholder="Como podemos chamar você?" required></label>
          <label>E-mail<input v-model="authEmail" type="email" autocomplete="email" placeholder="voce@email.com" required></label>
          <label>Senha<input v-model="authPassword" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" placeholder="Mínimo de 6 caracteres" minlength="6" required></label>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <button class="primary-button full-button" type="submit" :disabled="authLoading">{{ authLoading ? 'Aguarde…' : authMode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta' }} <span>↗</span></button>
        </form>
        <p class="auth-switch">{{ authMode === 'login' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?' }} <button @click="authMode = authMode === 'login' ? 'cadastro' : 'login'">{{ authMode === 'login' ? 'Criar conta' : 'Fazer login' }}</button></p>
      </div>
      <p class="secure-note">Seus dados ficam protegidos e associados à sua conta.</p>
    </section>
  </main>

  <div v-else class="app-frame" :class="{ 'dark-app': darkMode }">
    <aside class="sidebar">
      <div class="brand sidebar-brand"><span class="brand-mark">s</span><span>saldo</span></div>
      <div class="side-label">MENU PRINCIPAL</div>
      <nav class="side-nav">
        <button :class="{ active: tab === 'inicio' }" @click="tab = 'inicio'"><span class="nav-icon">⌂</span>Visão geral</button>
        <button :class="{ active: tab === 'lancamentos' }" @click="tab = 'lancamentos'"><span class="nav-icon">↗</span>Lançamentos</button>
        <button :class="{ active: tab === 'perfil' }" @click="tab = 'perfil'"><span class="nav-icon">◉</span>Meu perfil</button>
      </nav>
      <div class="sidebar-bottom"><div class="sidebar-tip"><span class="tip-spark">✳</span><strong>Um passo de cada vez.</strong><p>Pequenas escolhas fazem uma grande diferença.</p></div><button class="logout-button" @click="signOut"><span>↪</span> Sair da conta</button></div>
    </aside>

    <section class="main-area">
      <header class="topbar"><div class="breadcrumb">Pessoal <span>/</span> <strong>{{ tab === 'inicio' ? 'Visão geral' : tab === 'lancamentos' ? 'Lançamentos' : 'Meu perfil' }}</strong></div><div class="topbar-right"><button class="icon-button theme-button" @click="darkMode = !darkMode" :aria-label="darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'">{{ darkMode ? '☼' : '◐' }}</button><button class="user-chip" @click="tab = 'perfil'"><span class="avatar small-avatar"><img v-if="profile?.avatar_url" :src="profile.avatar_url" alt=""><span v-else>{{ (profile?.nome || 'M').slice(0, 1).toUpperCase() }}</span></span><span>{{ profile?.nome || 'Meu perfil' }}</span><span class="chevron">⌄</span></button></div></header>

      <div v-if="tab === 'inicio'" class="content dashboard-content">
        <div class="page-heading"><div><span class="eyebrow muted">SEU RESUMO FINANCEIRO</span><h1>Bom dia, {{ (profile?.nome || 'por aí').split(' ')[0] }} <span class="wave">✳</span></h1><p>Acompanhe o seu dinheiro com tranquilidade.</p></div><button class="primary-button add-button" @click="openNew('receita')"><span>＋</span> Novo lançamento</button></div>
        <div class="month-control"><button @click="shiftMonth(-1)" aria-label="Mês anterior">‹</button><strong>{{ monthLabel }}</strong><button @click="shiftMonth(1)" aria-label="Próximo mês">›</button><span class="month-dot"></span><span class="month-caption">Visão mensal</span></div>

        <section class="summary-grid">
          <article class="summary-card balance-card"><div class="card-top"><span>Saldo do período</span><span class="card-icon dark-icon"><IonIcon :icon="walletOutline" /></span></div><div class="summary-value">{{ currency(balance) }}</div><div class="card-foot"><span class="status-pill" :class="balance >= 0 ? 'positive' : 'negative'">{{ balance >= 0 ? '↗' : '↘' }} {{ balance >= 0 ? 'Saldo positivo' : 'Saldo negativo' }}</span><span class="card-note">{{ monthLabel }}</span></div><div class="balance-decoration"></div></article>
          <article class="summary-card"><div class="card-top"><span>Receitas</span><span class="card-icon income-icon">↙</span></div><div class="summary-value">{{ currency(monthIncome) }}</div><div class="card-foot"><span class="subtle-label">Entradas no período</span><span class="mini-mark income-mark">＋</span></div></article>
          <article class="summary-card"><div class="card-top"><span>Despesas</span><span class="card-icon expense-icon">↗</span></div><div class="summary-value">{{ currency(monthExpense) }}</div><div class="card-foot"><span class="subtle-label">Saídas no período</span><span class="mini-mark expense-mark">−</span></div></article>
        </section>

        <section class="chart-grid"><article class="panel chart-panel"><div class="panel-heading"><div><h3>Fluxo financeiro</h3><p>Receitas e despesas ao longo do tempo</p></div><span class="panel-tag">6 meses</span></div><div v-if="hasBarData" class="chart-box"><apexchart type="bar" height="245" :options="barOptions" :series="chartData" /></div><div v-else class="chart-empty"><span class="empty-bars"><i></i><i></i><i></i><i></i><i></i><i></i></span><strong>Seu fluxo mensal aparece aqui</strong><small>Adicione receitas ou despesas para ver o gr?fico.</small></div></article><article class="panel chart-panel category-panel"><div class="panel-heading"><div><h3>Onde você gastou</h3><p>Distribuição por categoria</p></div><span class="panel-tag">{{ expenseRows.length }} itens</span></div><div v-if="pieSeries.length" class="chart-box pie-box"><apexchart type="donut" height="245" :options="pieOptions" :series="pieSeries" /></div><div v-else class="chart-empty pie-empty"><span class="empty-donut"></span><strong>Sem despesas neste m?s</strong><small>Cadastre uma despesa para ver as categorias.</small></div></article></section>

        <section class="insight-grid"><article class="insight-card"><span class="insight-symbol">✳</span><div><span class="insight-label">MAIOR CATEGORIA DE GASTO</span><strong>{{ biggestCategory?.[0] || 'Sem despesas' }}</strong><span class="insight-detail">{{ biggestCategory ? currency(biggestCategory[1]) + ' neste mês' : 'Adicione um lançamento para começar' }}</span></div></article><article class="insight-card"><span class="insight-symbol count-symbol">#</span><div><span class="insight-label">LANÇAMENTOS NO MÊS</span><strong>{{ monthEntries.length }} <small>registros</small></strong><span class="insight-detail">Receitas e despesas juntas</span></div></article><article class="insight-card ratio-card"><span class="ratio-ring"><span>{{ expenseRatio }}<small>%</small></span></span><div><span class="insight-label">DESPESAS / RECEITAS</span><strong>{{ expenseRatio }}% da renda</strong><span class="insight-detail">{{ monthIncome ? 'Proporção de gastos no período' : 'Cadastre uma receita para calcular' }}</span></div></article></section>

        <section class="panel recent-panel"><div class="panel-heading recent-heading"><div><h3>Últimas movimentações</h3><p>Seus lançamentos mais recentes</p></div><button class="text-button" @click="tab = 'lancamentos'">Ver todos <span>↗</span></button></div><div v-if="filteredEntries.length" class="entry-list"><div v-for="entry in filteredEntries.slice(0, 4)" :key="entry.id" class="entry-row"><span class="entry-type-icon" :class="entry.__kind"><span>{{ entry.__kind === 'receita' ? '↓' : '↑' }}</span></span><div class="entry-info"><strong>{{ entry.descricao }}</strong><span>{{ entry.categoria }} <i>·</i> {{ dateLabel(entry.data) }}</span></div><strong class="entry-value" :class="entry.__kind">{{ entry.__kind === 'receita' ? '+' : '−' }} {{ currency(Number(entry.valor)) }}</strong></div></div><div v-else class="empty-state"><span>⌁</span><strong>Seu mês começa aqui.</strong><p>Adicione sua primeira receita ou despesa.</p><button class="text-button" @click="openNew('receita')">Adicionar lançamento <span>↗</span></button></div></section>
      </div>

      <div v-else-if="tab === 'lancamentos'" class="content entries-content"><div class="page-heading"><div><span class="eyebrow muted">HISTÓRICO FINANCEIRO</span><h1>Seus lançamentos</h1><p>Organize entradas e saídas em um só lugar.</p></div><div class="heading-actions"><button class="secondary-button" @click="openNew('despesa')">＋ Despesa</button><button class="primary-button add-button" @click="openNew('receita')">＋ Receita</button></div></div><div class="entry-toolbar"><label class="search-box"><span>⌕</span><input v-model="search" placeholder="Buscar lançamento"></label><select v-model="kindFilter" class="select-control"><option value="todos">Todos os tipos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select><input v-model="monthFilter" type="month" class="select-control month-input"></div><section class="panel table-panel"><div class="table-head"><span>DESCRIÇÃO</span><span>CATEGORIA</span><span>DATA</span><span>VALOR</span><span>AÇÕES</span></div><div v-for="entry in filteredEntries" :key="entry.id" class="table-row"><div class="table-description"><span class="entry-type-icon compact" :class="entry.__kind">{{ entry.__kind === 'receita' ? '↓' : '↑' }}</span><strong>{{ entry.descricao }}</strong></div><span class="category-pill">{{ entry.categoria }}</span><span class="table-date">{{ dateLabel(entry.data) }}</span><strong class="entry-value" :class="entry.__kind">{{ entry.__kind === 'receita' ? '+' : '−' }} {{ currency(Number(entry.valor)) }}</strong><div class="row-actions"><button @click="editEntry(entry)" aria-label="Editar">✎</button><button @click="deleteEntry(entry)" aria-label="Excluir">×</button></div></div><div v-if="!filteredEntries.length" class="empty-state"><span>⌁</span><strong>Nenhum lançamento por aqui.</strong><p>Ajuste os filtros ou adicione um lançamento.</p></div></section></div>

      <div v-else class="content profile-content"><div class="page-heading"><div><span class="eyebrow muted">SUA CONTA</span><h1>Meu perfil</h1><p>Suas informações pessoais e preferências.</p></div></div><section class="panel profile-panel"><div class="profile-cover"><span>SEU ESPAÇO, DO SEU JEITO</span><div class="cover-orb"></div></div><div class="profile-body"><div class="profile-photo-wrap"><button class="profile-photo" @click="changeAvatar" :disabled="uploadingAvatar"><img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="Foto de perfil"><span v-else>{{ (profile?.nome || 'M').slice(0, 1).toUpperCase() }}</span><i>{{ uploadingAvatar ? '…' : '✎' }}</i></button><span class="photo-label">Alterar foto</span></div><div class="profile-form"><div class="profile-section-title"><h3>Informações pessoais</h3><p>Atualize como seu perfil aparece no aplicativo.</p></div><label>Nome completo<input v-model="profileName" placeholder="Seu nome"></label><label>E-mail<input :value="session.user.email" disabled></label><label>Identificação da conta<input :value="session.user.id" disabled></label><div class="profile-actions"><button class="secondary-button" @click="signOut">Sair da conta</button><button class="primary-button" @click="saveProfile" :disabled="savingProfile">{{ savingProfile ? 'Salvando…' : 'Salvar alterações' }} <span>↗</span></button></div></div></div></section><section class="panel preference-panel"><div><span class="preference-icon">◐</span><div><strong>Aparência escura</strong><p>Escolha o tema que fica mais confortável para você.</p></div></div><button class="toggle" :class="{ on: darkMode }" @click="darkMode = !darkMode"><span></span></button></section></div>
    </section>
    <nav class="mobile-nav"><button :class="{ active: tab === 'inicio' }" @click="tab = 'inicio'"><span>⌂</span>Início</button><button :class="{ active: tab === 'lancamentos' }" @click="tab = 'lancamentos'"><span>↗</span>Lançamentos</button><button :class="{ active: tab === 'perfil' }" @click="tab = 'perfil'"><span>◉</span>Perfil</button></nav>

    <div v-if="showEntryForm" class="modal-backdrop" @click.self="showEntryForm = false"><section class="entry-modal"><div class="modal-top"><div><span class="eyebrow muted">{{ editingEntry ? 'ATUALIZAR REGISTRO' : 'NOVO REGISTRO' }}</span><h2>{{ editingEntry ? 'Editar lançamento' : 'Adicionar lançamento' }}</h2></div><button class="close-button" @click="showEntryForm = false">×</button></div><div class="type-switch"><button :class="{ chosen: formKind === 'despesa' }" @click="formKind = 'despesa'; formCategory = expenseCategories[0]">Despesa <span>↗</span></button><button :class="{ chosen: formKind === 'receita' }" @click="formKind = 'receita'; formCategory = incomeCategories[0]">Receita <span>↙</span></button></div><form @submit.prevent="saveEntry" class="stack-form modal-form"><label>Descrição<input v-model="formDescription" placeholder="Ex.: Mercado da semana" required maxlength="100"></label><label>Valor<input v-model="formAmount" type="number" min="0.01" step="0.01" placeholder="0,00" required></label><div class="form-pair"><label>Categoria<select v-model="formCategory" required><option v-for="category in categories" :key="category">{{ category }}</option></select></label><label>Data<input v-model="formDate" type="date" required></label></div><button class="primary-button full-button" type="submit" :disabled="savingEntry">{{ savingEntry ? 'Salvando…' : editingEntry ? 'Salvar alterações' : 'Salvar lançamento' }} <span>↗</span></button></form></section></div>
    <div v-if="notice" class="toast-message">{{ notice }}</div>
  </div>
</template>

