import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAutoTemplates } from "./useAutoTemplates";
import "./index.css";

// ============================
// ORIGINAL DATA (for find & replace)
// ============================
const ORIG = {
  clinica: "Clínica Moreira",
  kanban: "Clínica de Odontologia",
  assistente: "Maria",
  endereco: "Rua das Flores, 123 — Centro, São Paulo/SP",
  telefone: "(11) 9999-9999",
  pagamento: "PIX, dinheiro, cartão (débito/crédito)",
  convenios: "Bradesco Saúde, Unimed, SulAmérica, Amil",
  horSemana: "Segunda a Sexta: 08h às 19h",
  horSabado: "Sábado: 08h às 11h",
  horFechado: "Domingo e Feriados: Fechado",
  horCurto: "Seg-Sex 08h às 19h · Sáb 08h às 11h",
  endAlt: "Av. das Palmeiras, 1500 - Jardim América, São Paulo - SP",
  telAlt: "(11) 4456-7890",
  chatwootAccount: "Beatus Midias",
  instanceId: "fc4016b078767d4b3c25b39b62bbf1c8fc027622d27e9cd2451e2dcc8e636635",
  profs: [
    { slug: "dra-ana-costa", nome: "Dra. Ana Costa", esp: "Clínico Geral, Limpeza" },
    { slug: "dr-ricardo-lima", nome: "Dr. Ricardo Lima", esp: "Implantes, Cirurgia" },
    { slug: "dra-beatriz-souza", nome: "Dra. Beatriz Souza", esp: "Ortodontia" },
    { slug: "dr-felipe-torres", nome: "Dr. Felipe Torres", esp: "Endodontia (Canal)" },
  ],
};

// ============================
// PROCESSING ENGINE
// ============================
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function buildProfTable(profs) {
  let h = "| ID (`id_profissional`) | Profissional       | Especialidade          |\\n  |------------------------|--------------------|------------------------|";
  profs.forEach(p => {
    h += `\\n  | \`${p.slug}\`${" ".repeat(Math.max(1, 23 - p.slug.length - 3))}| ${p.nome}${" ".repeat(Math.max(1, 19 - p.nome.length))}| ${p.especialidade}${" ".repeat(Math.max(1, 23 - p.especialidade.length))}|`;
  });
  return h;
}

function buildProcTable(procs) {
  let h = "| ID (`id_procedimento`) | Procedimento                | Duração (min) | Valor                  |\\n  |------------------------|-----------------------------|---------------|------------------------|";
  procs.forEach(p => {
    h += `\\n  | \`${p.slug}\`${" ".repeat(Math.max(1, 23 - p.slug.length - 3))}| ${p.nome}${" ".repeat(Math.max(1, 28 - p.nome.length))}| ${p.duracao}${" ".repeat(Math.max(1, 14 - String(p.duracao).length))}| ${p.valor}${" ".repeat(Math.max(1, 23 - p.valor.length))}|`;
  });
  return h;
}

function processTemplate(jsonStr, cfg) {
  let s = jsonStr;
  s = s.replaceAll("Clínica Moreira", cfg.clinica);
  s = s.replaceAll("Clínica de Odontologia", cfg.kanban || cfg.clinica);
  s = s.replaceAll(ORIG.endereco, cfg.endereco);
  s = s.replaceAll(ORIG.endAlt, cfg.endereco);
  s = s.replaceAll(ORIG.telefone, cfg.telefone);
  s = s.replaceAll(ORIG.telAlt, cfg.telefone);
  s = s.replaceAll(ORIG.horSemana, cfg.horSemana);
  s = s.replaceAll(ORIG.horSabado, cfg.horSabado);
  s = s.replaceAll(ORIG.horFechado, cfg.horFechado);
  s = s.replaceAll(ORIG.horCurto, cfg.horCurto);
  s = s.replaceAll(ORIG.pagamento, cfg.pagamento);
  s = s.replaceAll(ORIG.convenios, cfg.convenios);
  s = s.replaceAll("Você é a Maria", `Você é a ${cfg.assistente}`);
  s = s.replaceAll("Voce e a Maria", `Voce e a ${cfg.assistente}`);
  s = s.replaceAll("Sou a Maria", `Sou a ${cfg.assistente}`);
  s = s.replaceAll("a Maria,", `a ${cfg.assistente},`);
  s = s.replaceAll("a Maria", `a ${cfg.assistente}`);
  s = s.replaceAll("**Maria**:", `**${cfg.assistente}**:`);
  ORIG.profs.forEach((op, i) => {
    const np = i < cfg.profs.length ? cfg.profs[i] : cfg.profs[0];
    s = s.replaceAll(op.nome, np.nome);
    s = s.replaceAll(op.slug, np.slug);
  });
  const profTableRegex = /\| ID \(`id_profissional`\).*?\| `dr-felipe-torres`[^|]*\|/s;
  if (profTableRegex.test(s)) s = s.replace(profTableRegex, buildProfTable(cfg.profs));
  const procTableRegex = /\| ID \(`id_procedimento`\).*?\| `extracao`[^|]*\|/s;
  if (procTableRegex.test(s)) s = s.replace(procTableRegex, buildProcTable(cfg.procs));
  s = s.replaceAll('#1 - Beatus Midias', '<SELECIONE SUA CONTA>');
  s = s.replaceAll('"cachedResultName": "#1 - Beatus Midias"', '"cachedResultName": "<SELECIONE SUA CONTA>"');
  s = s.replaceAll(ORIG.instanceId, "");
  let data;
  try { data = JSON.parse(s); } catch { return s; }
  if (data.nodes) {
    data.nodes.forEach(node => {
      if (node.credentials) {
        Object.values(node.credentials).forEach(c => {
          if (typeof c === "object" && c !== null) c.id = "";
        });
      }
    });
  }
  if (data.nodes) {
    data.nodes.forEach(node => {
      if (node.name === "ID agendas") {
        node.parameters.assignments.assignments = cfg.profs.map(p => ({
          id: crypto.randomUUID(),
          name: p.slug,
          value: p.calendarId || "SEU_CALENDAR_ID@group.calendar.google.com",
          type: "string"
        }));
      }
      if (node.name === "Disponibilidade") {
        const dayMap = { segunda: "segunda", terca: "terça", quarta: "quarta", quinta: "quinta", sexta: "sexta", sabado: "sábado" };
        node.parameters.assignments.assignments = cfg.profs.map(p => {
          const disp = {};
          Object.entries(dayMap).forEach(([k, v]) => {
            disp[v] = (p.disponibilidade?.[k] || []).map(s => ({ inicio: s.inicio, fim: s.fim }));
          });
          return { id: crypto.randomUUID(), name: p.slug, value: "=" + JSON.stringify(disp), type: "object" };
        });
      }
      if (node.name === "Criar funil" && node.parameters?.name) {
        node.parameters.name = cfg.kanban || cfg.clinica;
      }
      // Injetar contexto da empresa no system prompt do agente
      if (node.name === "Agente IA Vendedora" && node.parameters?.options?.systemMessage) {
        let extra = buildEmpresaContext(cfg.empresa);
        extra += buildUnidadesContext(cfg.unidades, cfg.profs, cfg.endereco);
        if (extra) {
          node.parameters.options.systemMessage = node.parameters.options.systemMessage
            .replace(/<\/informacoes-sistema>/, extra + "\n</informacoes-sistema>");
        }
      }
    });
  }
  delete data.id;
  delete data.versionId;
  data.meta = { templateCredsSetupCompleted: true };
  return JSON.stringify(data, null, 2);
}

// Gera o bloco de contexto da empresa para injetar no prompt
function buildEmpresaContext(empresa) {
  if (!empresa) return '';
  const linhas = [];
  if (empresa.anos) linhas.push(`  **Tempo de mercado**: ${empresa.anos} anos`);
  if (empresa.qualidade) linhas.push(`  **Principal diferencial**: ${empresa.qualidade}`);
  if (empresa.historia) linhas.push(`  **História da empresa**:\n  ${empresa.historia.replace(/\n/g, '\n  ')}`);
  if (empresa.obs) linhas.push(`  **Observações importantes**:\n  ${empresa.obs.replace(/\n/g, '\n  ')}`);
  if (!linhas.length) return '';
  return `\n\n# SOBRE A EMPRESA\n\n<sobre-empresa>\n${linhas.join('\n\n')}\n</sobre-empresa>`;
}

// Gera o bloco de unidades para injetar no prompt
function buildUnidadesContext(unidades, profs, endPrincipal) {
  if (!unidades || unidades.length === 0) return '';
  const temNome = unidades.some(u => u.nome);
  if (!temNome) return '';

  const secoes = unidades.map((u, i) => {
    const nome = u.nome || `Unidade ${i + 1}`;
    const end = u.endereco || endPrincipal || 'Endereço principal';
    const profsDaUnidade = (profs || []).filter(p => p.unidadeId === u.id).map(p => p.nome).filter(Boolean);
    const profsStr = profsDaUnidade.length > 0
      ? `\n    Profissionais: ${profsDaUnidade.join(', ')}`
      : '';
    return `  **Unidade ${i + 1} — ${nome}**\n  Endereço: ${end}${profsStr}`;
  });

  return `\n\n# UNIDADES DE ATENDIMENTO\n\n<unidades>\n${secoes.join('\n\n')}\n</unidades>`;
}

// ============================
// DEFAULT DATA
// ============================
const defaultHorarios = {
  segunda: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  terca: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  quarta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  quinta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  sexta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  sabado: [{ inicio: "08:00", fim: "12:00" }],
};

const defaultProcs = [
  { slug: "avaliacao", nome: "Avaliação inicial", duracao: 30, valor: "Gratuita" },
  { slug: "limpeza", nome: "Limpeza dental (profilaxia)", duracao: 45, valor: "A partir de R$ 350" },
  { slug: "clareamento", nome: "Clareamento", duracao: 60, valor: "A partir de R$ 800" },
  { slug: "restauracao", nome: "Restauração", duracao: 45, valor: "A partir de R$ 200" },
  { slug: "canal", nome: "Canal (endodontia)", duracao: 90, valor: "A partir de R$ 600" },
  { slug: "implante", nome: "Implante unitário", duracao: 120, valor: "A partir de R$ 3.000" },
  { slug: "ortodontia", nome: "Ortodontia (aparelho)", duracao: 45, valor: "A partir de R$ 250/mês" },
  { slug: "extracao", nome: "Extração simples", duracao: 30, valor: "A partir de R$ 180" },
];

const TEMPLATE_FILES = [
  "00__Configurac_o_es_IA_Vendedora.json",
  "01__Agente_Cli_nica.json",
  "02__Buscar_janelas_profissional.json",
  "03__Criar_evento_com_profissional.json",
  "04__Buscar_agendamentos_do_contato.json",
  "05__Atualizar_agendamento.json",
  "06__Cancelar_agendamento.json",
  "07__Escalar_humano_v2.json",
  "08__Follow-up_qualificados___no-show___lembretes___po_s-venda.json",
  "_KANBAN_CLI_NICAS__INSTALADOR.json",
];

const STEPS = [
  { icon: "🏥", label: "Negócio" },
  { icon: "🏢", label: "Unidades" },
  { icon: "📖", label: "Empresa" },
  { icon: "🕐", label: "Horários" },
  { icon: "🤖", label: "Persona IA" },
  { icon: "👨‍⚕️", label: "Profissionais" },
  { icon: "💉", label: "Serviços" },
  { icon: "✅", label: "Resultado" },
];

// ============================
// TOAST
// ============================
function Toast({ message, type, onClose }) {
  return (
    <div className={`toast ${type}`} role="alert">
      <span>{type === "success" ? "✅" : "❌"}</span>
      <span>{message}</span>
    </div>
  );
}

// ============================
// STEP 0 — TEMPLATES
// ============================
function StepTemplates({ templates, onFiles, autoLoading, autoError }) {
  const fileInputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const loaded = Object.keys(templates).length;
  const autoLoaded = loaded > 0 && !autoLoading;

  return (
    <div>
      <h2 className="section-title"><span className="icon">📂</span> Templates</h2>

      {/* Status do carregamento automático */}
      {autoLoading && (
        <div className="alert alert-info" style={{ marginBottom: 20, marginTop: 0 }}>
          <span className="alert-icon">⏳</span>
          <div className="alert-content">
            <div className="alert-title">Carregando templates automaticamente...</div>
            <div className="alert-body">Buscando arquivos em <code style={{ color: 'var(--primary)' }}>public/templates/clinica/</code></div>
          </div>
        </div>
      )}

      {autoLoaded && (
        <div className="alert alert-success" style={{ marginBottom: 20, marginTop: 0 }}>
          <span className="alert-icon">✅</span>
          <div className="alert-content">
            <div className="alert-title">{loaded} template(s) carregado(s) automaticamente!</div>
            <div className="alert-body">
              Arquivos lidos de <code style={{ color: 'var(--success)', fontFamily: 'monospace', fontSize: 11 }}>public/templates/clinica/</code>.<br />
              Para trocar, substitua os arquivos na pasta e recarregue a página.
            </div>
          </div>
        </div>
      )}

      {autoError && loaded === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20, marginTop: 0 }}>
          <span className="alert-icon">📁</span>
          <div className="alert-content">
            <div className="alert-title">Nenhum template encontrado na pasta</div>
            <div className="alert-body">
              Coloque os JSONs em <code style={{ fontFamily: 'monospace', fontSize: 11 }}>public/templates/clinica/</code> e atualize o <code style={{ fontFamily: 'monospace', fontSize: 11 }}>manifest.json</code>.<br />
              Ou faça upload manual abaixo.
            </div>
          </div>
        </div>
      )}

      {/* Lista dos arquivos carregados */}
      {loaded > 0 && (
        <div className="file-list" style={{ marginBottom: 20 }}>
          {TEMPLATE_FILES.map(f => {
            const isLoaded = Object.keys(templates).some(k => k === f || k.includes(f.slice(0, 15)));
            return (
              <div key={f} className={`file-item ${isLoaded ? 'loaded' : 'missing'}`}>
                <span>{isLoaded ? '✅' : '⬜'}</span>
                <code>{f}</code>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload manual (override/adicionar) */}
      <div
        className={`upload-zone ${drag ? 'drag-over' : ''}`}
        style={{ padding: '28px 24px' }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      >
        <span className="upload-icon" style={{ fontSize: 32 }}>📎</span>
        <div className="upload-title" style={{ fontSize: 14 }}>
          {loaded > 0 ? 'Adicionar ou substituir arquivos' : 'Clique ou arraste os JSONs aqui'}
        </div>
        <div className="upload-sub">Upload manual — sobrescreve arquivos da pasta</div>
        <input ref={fileInputRef} type="file" accept=".json" multiple style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
      </div>
    </div>
  );
}

// ============================
// STEP 1 — NEGÓCIO
// ============================
function StepNegocio({ negocio, setNegocio }) {
  const update = (k, v) => setNegocio(n => ({ ...n, [k]: v }));
  return (
    <div>
      <h2 className="section-title"><span className="icon">🏥</span> Dados do Negócio</h2>
      <p className="section-desc">
        Preencha as informações do estabelecimento. Esses dados serão usados pela IA para atender os clientes.
      </p>
      <div className="form-group">
        <div className="field">
          <label className="field-label">Tipo de Negócio</label>
          <select className="select" value={negocio.tipo} onChange={e => update("tipo", e.target.value)}>
            <option>Clínica Odontológica</option>
            <option>Clínica Médica</option>
            <option>Clínica Estética</option>
            <option>Clínica Veterinária</option>
            <option>Consultório</option>
            <option>Outro</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Nome do Estabelecimento <span className="required">*</span></label>
          <input className="input" placeholder="Ex: Clínica Sorriso Perfeito"
            value={negocio.nome} onChange={e => update("nome", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Endereço Completo <span className="required">*</span></label>
          <input className="input" placeholder="Ex: Rua das Flores, 123 — Centro, São Paulo/SP"
            value={negocio.endereco} onChange={e => update("endereco", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Telefone / WhatsApp</label>
          <input className="input" placeholder="Ex: (11) 99999-9999"
            value={negocio.telefone} onChange={e => update("telefone", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Formas de Pagamento</label>
          <input className="input" placeholder="PIX, dinheiro, cartão (débito/crédito)"
            value={negocio.pagamento} onChange={e => update("pagamento", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Convênios Aceitos <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(deixe vazio se não aceitar)</span></label>
          <input className="input" placeholder="Ex: Bradesco Saúde, Unimed, SulAmérica"
            value={negocio.convenios} onChange={e => update("convenios", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ============================
// STEP 1.5 — SOBRE A EMPRESA
// ============================
function StepEmpresa({ empresa, setEmpresa }) {
  const update = (k, v) => setEmpresa(e => ({ ...e, [k]: v }));
  return (
    <div>
      <h2 className="section-title"><span className="icon">📖</span> Sobre a Empresa</h2>
      <p className="section-desc">
        Essas informações são injetadas diretamente no prompt da IA para enriquecer o atendimento e dar mais contexto sobre o negócio.
      </p>
      <div className="form-group">
        <div className="field">
          <label className="field-label">
            Quantos anos está no mercado
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <input className="input" placeholder="Ex: 12 anos"
            value={empresa.anos} onChange={e => update("anos", e.target.value)} />
          <span className="input-hint">A IA usará isso para transmitir credibilidade e experiência.</span>
        </div>

        <div className="field">
          <label className="field-label">
            Uma qualidade importante
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <input className="input" placeholder="Ex: Atendimento humanizado e sem filas de espera"
            value={empresa.qualidade} onChange={e => update("qualidade", e.target.value)} />
          <span className="input-hint">Principal diferencial ou ponto forte que deve ser destacado ao cliente.</span>
        </div>

        <div className="field">
          <label className="field-label">
            História da empresa
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <textarea className="textarea" rows={4}
            placeholder="Ex: Fundada em 2012 pelo Dr. Carlos Silva, a clínica nasceu com o objetivo de oferecer odontologia de qualidade acessível à comunidade de São Paulo..."
            value={empresa.historia} onChange={e => update("historia", e.target.value)} />
          <span className="input-hint">Conte brevemente a origem e missão. A IA poderá usar isso ao apresentar a empresa.</span>
        </div>

        <div className="field">
          <label className="field-label">
            Observações que a IA precisa saber
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <textarea className="textarea" rows={4}
            placeholder="Ex: Não atendemos planos odontológicos. Em caso de urgência, temos horários reservados às segundas e quartas pela manhã. O estacionamento é gratuito para pacientes..."
            value={empresa.obs} onChange={e => update("obs", e.target.value)} />
          <span className="input-hint">Regras específicas, políticas, informações que a IA deve mencionar quando relevante.</span>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginTop: 4 }}>
        <span className="alert-icon">🧠</span>
        <div className="alert-content">
          <div className="alert-title">Como funciona</div>
          <div className="alert-body">
            Essas informações são inseridas automaticamente no system prompt do agente, dentro de uma seção <code style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 11 }}>&lt;sobre-empresa&gt;</code>. Todos os campos são opcionais.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// STEP 2 — HORÁRIOS
// ============================
function StepHorarios({ horarios, setHorarios }) {
  const update = (k, v) => setHorarios(h => ({ ...h, [k]: v }));
  return (
    <div>
      <h2 className="section-title"><span className="icon">🕐</span> Horários de Funcionamento</h2>
      <p className="section-desc">
        Configure os horários do estabelecimento. A IA usará essas informações para agendar corretamente.
      </p>
      <div className="form-group">
        <div className="field">
          <label className="field-label">Dias de Semana <span className="required">*</span></label>
          <input className="input" placeholder="Segunda a Sexta: 08h às 18h"
            value={horarios.semana} onChange={e => update("semana", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Sábado</label>
          <input className="input" placeholder="Sábado: 08h às 12h"
            value={horarios.sabado} onChange={e => update("sabado", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Fechado</label>
          <input className="input" placeholder="Domingo e Feriados: Fechado"
            value={horarios.fechado} onChange={e => update("fechado", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Formato Curto <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(usado em lembretes)</span></label>
          <input className="input" placeholder="Seg-Sex 08h às 18h · Sáb 08h às 12h"
            value={horarios.curto} onChange={e => update("curto", e.target.value)} />
          <span className="input-hint">Versão compacta para mensagens automáticas.</span>
        </div>
      </div>
    </div>
  );
}

// ============================
// STEP 3 — PERSONA IA
// ============================
function StepPersona({ persona, setPersona, negocio }) {
  return (
    <div>
      <h2 className="section-title"><span className="icon">🤖</span> Persona da IA</h2>
      <p className="section-desc">
        Defina o nome da assistente virtual que irá atender os pacientes via WhatsApp.
      </p>
      <div className="field">
        <label className="field-label">Nome da Assistente Virtual <span className="required">*</span></label>
        <input className="input" placeholder="Ex: Ana, Julia, Sofia..."
          value={persona.nome} onChange={e => setPersona({ nome: e.target.value })} />
      </div>

      {persona.nome && (
        <div className="alert alert-info" style={{ marginTop: 20 }}>
          <span className="alert-icon">👋</span>
          <div className="alert-content">
            <div className="alert-title">Prévia da apresentação</div>
            <div className="alert-body">
              <em>"Olá! Sou a <strong style={{ color: "var(--text)" }}>{persona.nome}</strong>, da <strong style={{ color: "var(--text)" }}>{negocio.nome || "sua clínica"}</strong>. Como posso te ajudar hoje?"</em>
            </div>
          </div>
        </div>
      )}

      <div className="alert alert-warning">
        <span className="alert-icon">💡</span>
        <div className="alert-content">
          <div className="alert-title">Dica de nome</div>
          <div className="alert-body">
            Escolha um nome feminino simples e simpático. Nomes curtos como Ana, Lia, Mel ou Sofia funcionam muito bem e passam proximidade.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// STEP 1 — UNIDADES
// ============================
function StepUnidades({ unidades, setUnidades, negocio }) {
  const add = () => setUnidades(u => [...u, { id: crypto.randomUUID(), nome: '', endereco: '' }]);
  const remove = (id) => setUnidades(u => u.filter(x => x.id !== id));
  const update = (id, field, val) => setUnidades(u => u.map(x => x.id === id ? { ...x, [field]: val } : x));

  return (
    <div>
      <h2 className="section-title"><span className="icon">🏢</span> Unidades de Atendimento</h2>
      <p className="section-desc">
        Cadastre as unidades do cliente. Cada profissional poderá ser vinculado a uma unidade específica.
      </p>

      {unidades.map((u, i) => (
        <div key={u.id} className="prof-card">
          <div className="prof-card-header">
            <div className="prof-number">
              <div className="prof-badge">#{i + 1}</div>
              <span className="prof-card-title">{u.nome || `Unidade ${i + 1}`}</span>
            </div>
            {unidades.length > 1 && (
              <button onClick={() => remove(u.id)} className="btn btn-danger btn-sm">Remover</button>
            )}
          </div>
          <div className="prof-fields">
            <div className="field">
              <label className="field-label">Nome da Unidade <span className="required">*</span></label>
              <input className="input"
                placeholder="Ex: Unidade Centro, Filial Vila Madalena, Clínica Norte..."
                value={u.nome} onChange={e => update(u.id, 'nome', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">
                Endereço da Unidade
                <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
              </label>
              <input className="input"
                placeholder={negocio.endereco || 'Deixe vazio para usar o endereço principal'}
                value={u.endereco} onChange={e => update(u.id, 'endereco', e.target.value)} />
              <span className="input-hint">Se vazio, usa o endereço do negócio cadastrado anteriormente.</span>
            </div>
          </div>
        </div>
      ))}

      <button onClick={add} className="btn btn-outline btn-full">+ Adicionar Unidade</button>

      {unidades.length === 1 && (
        <div className="alert alert-info" style={{ marginTop: 20 }}>
          <span className="alert-icon">💡</span>
          <div className="alert-content">
            <div className="alert-title">Cliente com uma só unidade?</div>
            <div className="alert-body">
              Preencha o nome e clique em Próximo. Se o cliente não tiver unidades separadas, pode deixar em branco — a IA usará apenas o endereço principal.
            </div>
          </div>
        </div>
      )}

      {unidades.length > 1 && (
        <div className="alert alert-success" style={{ marginTop: 16 }}>
          <span className="alert-icon">ℹ️</span>
          <div className="alert-content">
            <div className="alert-title">{unidades.length} unidades cadastradas</div>
            <div className="alert-body">Na etapa de Profissionais você poderá vincular cada profissional à sua unidade.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================
// STEP 4 — PROFISSIONAIS
// ============================
function StepProfissionais({ profs, setProfs, unidades }) {
  const addProf = () => setProfs(p => [...p, { nome: "", especialidade: "", calendarId: "", unidadeId: "", disponibilidade: { ...defaultHorarios } }]);
  const removeProf = (i) => setProfs(p => p.filter((_, idx) => idx !== i));
  const updateProf = (i, field, val) => setProfs(p => {
    const np = [...p]; np[i] = { ...np[i], [field]: val }; return np;
  });

  const temUnidades = unidades.some(u => u.nome);

  return (
    <div>
      <h2 className="section-title"><span className="icon">👨‍⚕️</span> Profissionais</h2>
      <p className="section-desc">
        Cadastre os profissionais disponíveis para agendamento.
        {temUnidades && <> Selecione a unidade de cada um.</>}
      </p>

      {profs.map((p, i) => (
        <div key={i} className="prof-card">
          <div className="prof-card-header">
            <div className="prof-number">
              <div className="prof-badge">#{i + 1}</div>
              <span className="prof-card-title">{p.nome || `Profissional ${i + 1}`}</span>
            </div>
            {profs.length > 1 && (
              <button onClick={() => removeProf(i)} className="btn btn-danger btn-sm">Remover</button>
            )}
          </div>
          <div className="prof-fields">
            <div className="field">
              <label className="field-label">Nome Completo <span className="required">*</span></label>
              <input className="input" placeholder="Ex: Dr. Marcos Silva"
                value={p.nome} onChange={e => updateProf(i, "nome", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Especialidade <span className="required">*</span></label>
              <input className="input" placeholder="Ex: Clínico Geral, Limpeza"
                value={p.especialidade} onChange={e => updateProf(i, "especialidade", e.target.value)} />
            </div>
            {temUnidades && (
              <div className="field">
                <label className="field-label">
                  Unidade de Atendimento
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
                </label>
                <select className="select" value={p.unidadeId || ''}
                  onChange={e => updateProf(i, 'unidadeId', e.target.value)}>
                  <option value="">Todas as unidades</option>
                  {unidades.filter(u => u.nome).map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                <span className="input-hint">
                  {unidades.find(u => u.id === p.unidadeId)?.endereco
                    ? `📍 ${unidades.find(u => u.id === p.unidadeId).endereco}`
                    : ''}
                </span>
              </div>
            )}
            <div className="field">
              <label className="field-label">ID do Google Calendar</label>
              <input className="input" placeholder="Ex: abc123@group.calendar.google.com"
                value={p.calendarId} onChange={e => updateProf(i, "calendarId", e.target.value)} />
              <span className="input-hint">Encontre em: Google Calendar → Configurações do calendário → ID do calendário</span>
            </div>
            {p.nome && (
              <div className="slug-preview">
                <span className="slug-label">Slug gerado:</span>
                <code>{generateSlug(p.nome)}</code>
              </div>
            )}
          </div>
        </div>
      ))}

      <button onClick={addProf} className="btn btn-outline btn-full">+ Adicionar Profissional</button>
    </div>
  );
}

// ============================
// STEP 5 — SERVIÇOS
// ============================
function StepServicos({ procs, setProcs }) {
  const addProc = () => setProcs(p => [...p, { slug: "", nome: "", duracao: 30, valor: "" }]);
  const removeProc = (i) => setProcs(p => p.filter((_, idx) => idx !== i));
  const updateProc = (i, field, val) => setProcs(p => {
    const np = [...p];
    np[i] = { ...np[i], [field]: val };
    if (field === "nome") np[i].slug = generateSlug(val);
    return np;
  });

  return (
    <div>
      <h2 className="section-title"><span className="icon">💉</span> Serviços / Procedimentos</h2>
      <p className="section-desc">
        Configure os procedimentos oferecidos, com duração e valores.
      </p>

      {procs.map((p, i) => (
        <div key={i} className="proc-row">
          <div className="proc-fields">
            <div className="field proc-field-name">
              <label className="field-label" style={{ fontSize: 10 }}>Nome <span className="required">*</span></label>
              <input className="input" style={{ padding: "10px 12px", fontSize: 13 }}
                placeholder="Ex: Limpeza dental" value={p.nome}
                onChange={e => updateProc(i, "nome", e.target.value)} />
            </div>
            <div className="field proc-field-min">
              <label className="field-label" style={{ fontSize: 10 }}>Minutos</label>
              <input className="input" style={{ padding: "10px 12px", fontSize: 13 }}
                type="number" value={p.duracao}
                onChange={e => updateProc(i, "duracao", parseInt(e.target.value) || 0)} />
            </div>
            <div className="field proc-field-value">
              <label className="field-label" style={{ fontSize: 10 }}>Valor</label>
              <input className="input" style={{ padding: "10px 12px", fontSize: 13 }}
                placeholder="R$ 200" value={p.valor}
                onChange={e => updateProc(i, "valor", e.target.value)} />
            </div>
            <button onClick={() => removeProc(i)} className="btn btn-ghost" style={{ alignSelf: "flex-end", marginBottom: 2 }}>✕</button>
          </div>
        </div>
      ))}

      <button onClick={addProc} className="btn btn-outline btn-full" style={{ marginTop: 8 }}>
        + Adicionar Serviço
      </button>
    </div>
  );
}

// ============================
// STEP 6 — RESULTADO
// ============================
function StepResultado({ results, profs, procs, onReset }) {
  const downloadFile = (filename, content) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    if (!results) return;
    Object.entries(results).forEach(([fn, content], i) => {
      setTimeout(() => downloadFile(fn, content), i * 300);
    });
  };

  const count = results ? Object.keys(results).length : 0;

  return (
    <div>
      <h2 className="section-title"><span className="icon">🎉</span> Workflows Gerados!</h2>
      <p className="section-desc">
        Seus <strong style={{ color: "var(--success)" }}>{count} workflows</strong> estão prontos para importar no n8n.
      </p>

      <div className="stats-grid">
        {[
          { val: profs.filter(p => p.nome).length, label: "Profissionais" },
          { val: procs.filter(p => p.nome).length, label: "Serviços" },
          { val: count, label: "Workflows" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <button onClick={downloadAll} className="btn btn-success btn-full btn-lg" style={{ marginBottom: 20 }}>
        ⬇ Baixar Todos os Workflows (.json)
      </button>

      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        <span className="alert-icon">📝</span>
        <div className="alert-content">
          <div className="alert-title">Próximos passos</div>
          <div className="alert-body" style={{ lineHeight: 2 }}>
            1) Importe os JSONs no n8n<br />
            2) Configure as credenciais: <strong style={{ color: "var(--text)" }}>Postgres, Chatwoot, OpenAI, Google Calendar</strong><br />
            3) No workflow 00: selecione a conta Chatwoot e execute<br />
            4) Nos workflows 01-08: configure triggers e credenciais<br />
            5) Nos workflows 02-06: atualize os IDs dos calendários Google<br />
            6) Teste com a etiqueta <code style={{ color: "var(--primary)", fontFamily: "monospace" }}>testando-agente</code>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        {results && Object.entries(results).map(([fn, content]) => (
          <div key={fn} className="workflow-item">
            <div className="workflow-info">
              <div className="workflow-name">{fn}</div>
              <div className="workflow-size">{(content.length / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => downloadFile(fn, content)} className="download-btn">
              ⬇ Baixar
            </button>
          </div>
        ))}
      </div>

      <button onClick={onReset} className="btn btn-outline btn-full">
        🔄 Gerar para outro cliente
      </button>
    </div>
  );
}

// ============================
// MAIN APP
// ============================
export default function App() {
  const [step, setStep] = useState(0); // 0=Negócio,1=Unidades,2=Empresa,3=Horários,4=Persona,5=Profs,6=Serviços,7=Resultado
  const { templates, loading: autoLoading, error: autoError } = useAutoTemplates('clinica');
  const [results, setResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const [negocio, setNegocio] = useState({
    tipo: "Clínica Odontológica",
    nome: "", endereco: "", telefone: "",
    pagamento: "PIX, dinheiro, cartão (débito/crédito)",
    convenios: "",
  });

  const [horarios, setHorarios] = useState({
    semana: "Segunda a Sexta: 08h às 18h",
    sabado: "Sábado: 08h às 12h",
    fechado: "Domingo e Feriados: Fechado",
    curto: "Seg-Sex 08h às 18h · Sáb 08h às 12h",
  });

  const [persona, setPersona] = useState({ nome: "" });

  const [profs, setProfs] = useState([
    { nome: "", especialidade: "", calendarId: "", disponibilidade: { ...defaultHorarios } },
  ]);

  const [procs, setProcs] = useState([...defaultProcs]);

  const [empresa, setEmpresa] = useState({
    anos: "", qualidade: "", historia: "", obs: "",
  });

  const [unidades, setUnidades] = useState([
    { id: crypto.randomUUID(), nome: '', endereco: '' },
  ]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };



  const handleGenerate = useCallback(() => {
    setProcessing(true);
    setTimeout(() => {
      const cfg = {
        clinica: negocio.nome,
        kanban: negocio.nome,
        endereco: negocio.endereco,
        telefone: negocio.telefone,
        pagamento: negocio.pagamento,
        convenios: negocio.convenios || "Nenhum",
        horSemana: horarios.semana,
        horSabado: horarios.sabado,
        horFechado: horarios.fechado,
        horCurto: horarios.curto,
        assistente: persona.nome,
        profs: profs.filter(p => p.nome).map(p => ({ ...p, slug: generateSlug(p.nome) })),
        procs: procs.filter(p => p.nome),
        empresa,
        unidades,
      };
      const generated = {};
      Object.entries(templates).forEach(([filename, content]) => {
        try { generated[filename] = processTemplate(content, cfg); }
        catch { generated[filename] = content; }
      });
      setResults(generated);
      setProcessing(false);
      setStep(7);
      showToast("Workflows gerados com sucesso! 🚀");
    }, 800);
  }, [templates, negocio, horarios, persona, profs, procs, empresa, unidades]);

  const canNext = () => {
    switch (step) {
      case 0: return negocio.nome && negocio.endereco;
      case 1: return true; // Unidades — opcional
      case 2: return true; // Empresa — todos opcionais
      case 3: return horarios.semana;
      case 4: return persona.nome;
      case 5: return profs.some(p => p.nome && p.especialidade);
      case 6: return procs.some(p => p.nome);
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === 6) handleGenerate();
    else setStep(s => s + 1);
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  const renderContent = () => {
    switch (step) {
      case 0: return <StepNegocio negocio={negocio} setNegocio={setNegocio} />;
      case 1: return <StepUnidades unidades={unidades} setUnidades={setUnidades} negocio={negocio} />;
      case 2: return <StepEmpresa empresa={empresa} setEmpresa={setEmpresa} />;
      case 3: return <StepHorarios horarios={horarios} setHorarios={setHorarios} />;
      case 4: return <StepPersona persona={persona} setPersona={setPersona} negocio={negocio} />;
      case 5: return <StepProfissionais profs={profs} setProfs={setProfs} unidades={unidades} />;
      case 6: return <StepServicos procs={procs} setProcs={setProcs} />;
      case 7: return <StepResultado results={results} profs={profs} procs={procs} onReset={() => { setStep(0); setResults(null); }} />;
      default: return null;
    }
  };

  return (
    <div className="app-wrapper">
      <div className="container">
        {/* Header */}
        <header className="header">
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', marginBottom: 16, transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            ← Todos os nichos
          </Link>
          <div className="header-badge">
            <span>⚡</span>
            <span>Powered by n8n + AI</span>
          </div>
          <h1 className="header-title">IA Vendedora — Configurador</h1>
          <p className="header-subtitle">Configure e gere os workflows n8n personalizados para seu cliente</p>
          {/* Status dos templates */}
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 12px', borderRadius: 100,
            background: autoLoading ? 'rgba(59,130,246,0.1)' : autoError ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            border: autoLoading ? '1px solid rgba(59,130,246,0.2)' : autoError ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(16,185,129,0.2)',
            color: autoLoading ? 'var(--primary)' : autoError ? 'var(--warning)' : 'var(--success)',
          }}>
            {autoLoading ? '⏳ Carregando templates...' : autoError ? `⚠️ Sem templates (${Object.keys(templates).length} carregados)` : `✅ ${Object.keys(templates).length} templates prontos`}
          </div>
        </header>

        {/* Step Tabs */}
        <nav className="stepper" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <button
              key={i}
              id={`step-tab-${i}`}
              className={`step-btn ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
              onClick={() => i < step ? setStep(i) : undefined}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="step-icon">{i < step ? "✅" : s.icon}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Progress */}
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Content */}
        <div className="card">
          {renderContent()}
        </div>

        {/* Navigation */}
        {step < 7 && (
          <div className="navigation">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)} className="btn btn-outline" id="btn-back">
                ← Voltar
              </button>
            ) : <div />}
            <button
              id="btn-next"
              onClick={handleNext}
              disabled={!canNext() || processing || (autoLoading && Object.keys(templates).length === 0)}
              className="btn btn-primary"
            >
              {processing
                ? <><div className="spinner" /> Gerando...</>
                : step === 6
                  ? "Gerar Workflows 🚀"
                  : "Próximo →"
              }
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
