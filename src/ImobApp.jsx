import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAutoTemplates } from "./useAutoTemplates";

// ============================
// ORIGINAL DATA
// ============================
const ORIG = {
  imob: "Imobiliária Modelo",
  assistente: "Maria",
  endereco: "Av. Brasil, 1000 — Centro, São Paulo/SP",
  telefone: "(11) 99999-9999",
  horSemana: "Segunda a Sexta: 08h às 18h",
  horSabado: "Sábado: 09h às 13h",
  horFechado: "Domingo e Feriados: Fechado",
  horCurto: "Seg-Sex 08h às 18h · Sáb 09h às 13h",
  profs: [
    { slug: "carlos-mendes", nome: "Carlos Mendes", esp: "Venda Residencial" },
    { slug: "fernanda-lima", nome: "Fernanda Lima", esp: "Locação" },
    { slug: "roberto-alves", nome: "Roberto Alves", esp: "Alto Padrão, Comercial" },
    { slug: "patricia-santos", nome: "Patrícia Santos", esp: "Lançamentos" },
  ],
};

function generateSlug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

function buildProfTable(profs) {
  let h = "| ID (`id_profissional`) | Corretor           | Segmento               |\\n  |------------------------|--------------------|------------------------|";
  profs.forEach(p => {
    h += `\\n  | \`${p.slug}\`${" ".repeat(Math.max(1, 23 - p.slug.length - 3))}| ${p.nome}${" ".repeat(Math.max(1, 19 - p.nome.length))}| ${p.segmento}${" ".repeat(Math.max(1, 23 - p.segmento.length))}|`;
  });
  return h;
}

function buildServTable(servs) {
  let h = "| ID (`id_atendimento`) | Atendimento                     | Duração (min) | Observação                   |\\n  |-----------------------|---------------------------------|---------------|------------------------------|";
  servs.forEach(p => {
    h += `\\n  | \`${p.slug}\`${" ".repeat(Math.max(1, 22 - p.slug.length - 3))}| ${p.nome}${" ".repeat(Math.max(1, 32 - p.nome.length))}| ${p.duracao}${" ".repeat(Math.max(1, 14 - String(p.duracao).length))}| ${p.obs}${" ".repeat(Math.max(1, 29 - p.obs.length))}|`;
  });
  return h;
}

function processTemplate(jsonStr, cfg) {
  let s = jsonStr;
  s = s.replaceAll("Imobiliária Modelo", cfg.imob);
  s = s.replaceAll(ORIG.endereco, cfg.endereco);
  s = s.replaceAll(ORIG.telefone, cfg.telefone);
  s = s.replaceAll(ORIG.horSemana, cfg.horSemana);
  s = s.replaceAll(ORIG.horSabado, cfg.horSabado);
  s = s.replaceAll(ORIG.horFechado, cfg.horFechado);
  s = s.replaceAll(ORIG.horCurto, cfg.horCurto);
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
  const pt = /\| ID \(`id_profissional`\).*?\| `patricia-santos`[^|]*\|/s;
  if (pt.test(s)) s = s.replace(pt, buildProfTable(cfg.profs));
  const st = /\| ID \(`id_atendimento`\).*?\| `avaliacao-imovel`[^|]*\|/s;
  if (st.test(s)) s = s.replace(st, buildServTable(cfg.servs));
  let data;
  try { data = JSON.parse(s); } catch { return s; }
  if (data.nodes) {
    data.nodes.forEach(node => {
      if (node.credentials) Object.values(node.credentials).forEach(c => { if (typeof c === "object" && c !== null) c.id = ""; });
      if (node.name === "ID agendas") {
        node.parameters.assignments.assignments = cfg.profs.map(p => ({
          id: crypto.randomUUID(), name: p.slug,
          value: p.calendarId || "SEU_CALENDAR_ID@group.calendar.google.com", type: "string"
        }));
      }
      if (node.name === "Disponibilidade") {
        const dm = { segunda: "segunda", terca: "terça", quarta: "quarta", quinta: "quinta", sexta: "sexta", sabado: "sábado" };
        node.parameters.assignments.assignments = cfg.profs.map(p => {
          const d = {};
          Object.entries(dm).forEach(([k, v]) => { d[v] = (p.disponibilidade?.[k] || []).map(x => ({ inicio: x.inicio, fim: x.fim })); });
          return { id: crypto.randomUUID(), name: p.slug, value: "=" + JSON.stringify(d), type: "object" };
        });
      }
      if (node.name === "Criar funil" && node.parameters?.name) node.parameters.name = cfg.imob;
      // Injetar contexto da empresa no system prompt
      if (node.name === "Agente IA Vendedora" && node.parameters?.options?.systemMessage) {
        const extra = buildEmpresaContext(cfg.empresa);
        if (extra) {
          node.parameters.options.systemMessage = node.parameters.options.systemMessage
            .replace(/<\/informacoes-sistema>/, extra + "\n</informacoes-sistema>");
        }
      }
      if (node.name === "Resetar atributos" && node.parameters?.assignments) {
        node.parameters.assignments.assignments = node.parameters.assignments.assignments.map(a => ({ ...a, value: "" }));
      }
    });
  }
  delete data.id; delete data.versionId;
  data.meta = { templateCredsSetupCompleted: true };
  return JSON.stringify(data, null, 2);
}

// Gera bloco de contexto da empresa para injetar no prompt
function buildEmpresaContext(empresa) {
  if (!empresa) return '';
  const linhas = [];
  if (empresa.anos) linhas.push(`  **Tempo de mercado**: ${empresa.anos} anos`);
  if (empresa.qualidade) linhas.push(`  **Principal diferencial**: ${empresa.qualidade}`);
  if (empresa.historia) linhas.push(`  **História da imobiliária**:\n  ${empresa.historia.replace(/\n/g, '\n  ')}`);
  if (empresa.obs) linhas.push(`  **Observações importantes**:\n  ${empresa.obs.replace(/\n/g, '\n  ')}`);
  if (!linhas.length) return '';
  return `\n\n# SOBRE A EMPRESA\n\n<sobre-empresa>\n${linhas.join('\n\n')}\n</sobre-empresa>`;
}

// ============================
// DEFAULTS
// ============================
const defaultHorarios = {
  segunda: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  terca: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  quarta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  quinta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  sexta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
  sabado: [{ inicio: "09:00", fim: "13:00" }],
};

const defaultServs = [
  { slug: "visita-imovel", nome: "Visita ao imóvel", duracao: 60, obs: "Presencial no imóvel" },
  { slug: "ligacao-corretor", nome: "Ligação com corretor", duracao: 30, obs: "Por telefone" },
  { slug: "reuniao-escritorio", nome: "Reunião no escritório", duracao: 45, obs: "Presencial no escritório" },
  { slug: "videochamada", nome: "Atendimento por videochamada", duracao: 30, obs: "Online via Google Meet" },
  { slug: "avaliacao-imovel", nome: "Avaliação de imóvel para venda", duracao: 60, obs: "Visita técnica ao imóvel" },
];

const STEPS = [
  { icon: "🏠", label: "Imobiliária" },
  { icon: "📖", label: "Empresa" },
  { icon: "🕐", label: "Horários" },
  { icon: "🤖", label: "Persona IA" },
  { icon: "👔", label: "Corretores" },
  { icon: "🏷️", label: "Atendimentos" },
  { icon: "✅", label: "Resultado" },
];

// ============================
// STEP COMPONENTS
// ============================
function StepTemplates({ templates, onFiles, autoLoading, autoError }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const loaded = Object.keys(templates).length;
  const autoLoaded = loaded > 0 && !autoLoading;

  return (
    <div>
      <h2 className="section-title"><span className="icon">📂</span> Templates</h2>

      {autoLoading && (
        <div className="alert" style={{ marginBottom: 20, marginTop: 0, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="alert-icon">⏳</span>
          <div className="alert-content">
            <div className="alert-title" style={{ color: 'var(--imob-primary)' }}>Carregando templates automaticamente...</div>
            <div className="alert-body">Buscando arquivos em <code style={{ color: 'var(--imob-primary)', fontFamily: 'monospace', fontSize: 11 }}>public/templates/imobiliaria/</code></div>
          </div>
        </div>
      )}

      {autoLoaded && (
        <div className="alert alert-success" style={{ marginBottom: 20, marginTop: 0 }}>
          <span className="alert-icon">✅</span>
          <div className="alert-content">
            <div className="alert-title">{loaded} template(s) carregado(s) automaticamente!</div>
            <div className="alert-body">
              Arquivos lidos de <code style={{ color: 'var(--success)', fontFamily: 'monospace', fontSize: 11 }}>public/templates/imobiliaria/</code>.<br />
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
              Coloque os JSONs em <code style={{ fontFamily: 'monospace', fontSize: 11 }}>public/templates/imobiliaria/</code> e atualize o <code style={{ fontFamily: 'monospace', fontSize: 11 }}>manifest.json</code>.<br />
              Ou faça upload manual abaixo.
            </div>
          </div>
        </div>
      )}

      {loaded > 0 && (
        <div className="file-list" style={{ marginBottom: 20 }}>
          {Object.keys(templates).map(fn => (
            <div key={fn} className="file-item loaded" style={{ color: 'var(--imob-primary)', background: 'rgba(245,158,11,0.08)' }}>
              <span>✅</span><code>{fn}</code>
            </div>
          ))}
        </div>
      )}

      <div
        className={`upload-zone ${drag ? 'drag-over' : ''}`}
        style={{ padding: '28px 24px' }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      >
        <span className="upload-icon" style={{ fontSize: 32 }}>📎</span>
        <div className="upload-title" style={{ fontSize: 14 }}>
          {loaded > 0 ? 'Adicionar ou substituir arquivos' : 'Clique ou arraste os JSONs aqui'}
        </div>
        <div className="upload-sub">Upload manual — sobrescreve arquivos da pasta</div>
        <input ref={fileRef} type="file" accept=".json" multiple style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
      </div>
    </div>
  );
}

function StepNegocio({ negocio, setNegocio }) {
  const update = (k, v) => setNegocio(n => ({ ...n, [k]: v }));
  return (
    <div>
      <h2 className="section-title"><span className="icon">🏠</span> Dados da Imobiliária</h2>
      <p className="section-desc">Informações do negócio que a IA usará para atender e qualificar leads.</p>
      <div className="form-group">
        <div className="field">
          <label className="field-label">Nome da Imobiliária <span className="required">*</span></label>
          <input className="input imob-focus" placeholder="Ex: Nova Casa Imóveis" value={negocio.nome} onChange={e => update("nome", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Endereço do Escritório <span className="required">*</span></label>
          <input className="input imob-focus" placeholder="Ex: Av. Paulista, 1000 — Bela Vista, São Paulo/SP" value={negocio.endereco} onChange={e => update("endereco", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Telefone / WhatsApp</label>
          <input className="input imob-focus" placeholder="Ex: (11) 99999-9999" value={negocio.telefone} onChange={e => update("telefone", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function StepEmpresa({ empresa, setEmpresa }) {
  const update = (k, v) => setEmpresa(e => ({ ...e, [k]: v }));
  return (
    <div>
      <h2 className="section-title"><span className="icon">📖</span> Sobre a Imobiliária</h2>
      <p className="section-desc">
        Essas informações são injetadas diretamente no prompt da IA para enriquecer o atendimento e transmitir mais confiança aos leads.
      </p>
      <div className="form-group">
        <div className="field">
          <label className="field-label">
            Quantos anos está no mercado
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <input className="input imob-focus" placeholder="Ex: 15 anos"
            value={empresa.anos} onChange={e => update("anos", e.target.value)} />
          <span className="input-hint">A IA usará isso para transmitir credibilidade e experiência no mercado imobiliário.</span>
        </div>

        <div className="field">
          <label className="field-label">
            Uma qualidade importante
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <input className="input imob-focus" placeholder="Ex: Especialistas em imóveis de alto padrão na zona sul"
            value={empresa.qualidade} onChange={e => update("qualidade", e.target.value)} />
          <span className="input-hint">Principal diferencial que deve ser reforçado ao qualificar os leads.</span>
        </div>

        <div className="field">
          <label className="field-label">
            História da imobiliária
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <textarea className="textarea imob-focus" rows={4}
            placeholder="Ex: Fundada em 2009 por João e Maria Silva, a Nova Casa Imóveis surgiu com o propósito de transformar a experiência de comprar e vender imóveis em São Paulo..."
            value={empresa.historia} onChange={e => update("historia", e.target.value)} />
          <span className="input-hint">A IA pode usar essa história para criar conexão e confiança com o lead.</span>
        </div>

        <div className="field">
          <label className="field-label">
            Observações que a IA precisa saber
            <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span>
          </label>
          <textarea className="textarea imob-focus" rows={4}
            placeholder="Ex: Trabalhamos apenas com imóveis acima de R$ 500k. Temos parceria com os principais bancos para financiamento. Atendemos também imóveis fora de SP mediante consulta..."
            value={empresa.obs} onChange={e => update("obs", e.target.value)} />
          <span className="input-hint">Regras, políticas ou informações que a IA deve considerar ao qualificar e atender os leads.</span>
        </div>
      </div>

      <div className="alert" style={{ marginTop: 4, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <span className="alert-icon">🧠</span>
        <div className="alert-content">
          <div className="alert-title" style={{ color: "var(--imob-primary)" }}>Como funciona</div>
          <div className="alert-body">
            Essas informações são inseridas automaticamente no system prompt do agente dentro de uma seção <code style={{ color: 'var(--imob-primary)', fontFamily: 'monospace', fontSize: 11 }}>&lt;sobre-empresa&gt;</code>. Todos os campos são opcionais.
          </div>
        </div>
      </div>
    </div>
  );
}

function StepHorarios({ horarios, setHorarios }) {
  const update = (k, v) => setHorarios(h => ({ ...h, [k]: v }));
  return (
    <div>
      <h2 className="section-title"><span className="icon">🕐</span> Horários de Atendimento</h2>
      <p className="section-desc">A IA usará essas informações para agendar dentro do horário correto.</p>
      <div className="form-group">
        <div className="field">
          <label className="field-label">Dias de Semana <span className="required">*</span></label>
          <input className="input imob-focus" value={horarios.semana} onChange={e => update("semana", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Sábado</label>
          <input className="input imob-focus" value={horarios.sabado} onChange={e => update("sabado", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Fechado</label>
          <input className="input imob-focus" value={horarios.fechado} onChange={e => update("fechado", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Formato Curto <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(para lembretes)</span></label>
          <input className="input imob-focus" value={horarios.curto} onChange={e => update("curto", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function StepPersona({ persona, setPersona, negocio }) {
  return (
    <div>
      <h2 className="section-title"><span className="icon">🤖</span> Persona da IA</h2>
      <p className="section-desc">Nome da assistente virtual que atenderá os leads via WhatsApp.</p>
      <div className="field">
        <label className="field-label">Nome da Assistente <span className="required">*</span></label>
        <input className="input imob-focus" placeholder="Ex: Ana, Julia, Sofia..." value={persona.nome} onChange={e => setPersona({ nome: e.target.value })} />
      </div>
      {persona.nome && (
        <div className="alert" style={{ marginTop: 20, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <span className="alert-icon">🏡</span>
          <div className="alert-content">
            <div className="alert-title" style={{ color: "var(--imob-primary)" }}>Prévia</div>
            <div className="alert-body">
              <em>"Olá! Sou a <strong style={{ color: "var(--text)" }}>{persona.nome}</strong>, da <strong style={{ color: "var(--text)" }}>{negocio.nome || "sua imobiliária"}</strong>. Como posso ajudar você a encontrar o imóvel ideal?"</em>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepCorretores({ corretores, setCorretores }) {
  const add = () => setCorretores(c => [...c, { nome: "", segmento: "", calendarId: "", disponibilidade: { ...defaultHorarios } }]);
  const remove = i => setCorretores(c => c.filter((_, j) => j !== i));
  const update = (i, f, v) => setCorretores(c => { const n = [...c]; n[i] = { ...n[i], [f]: v }; return n; });

  return (
    <div>
      <h2 className="section-title"><span className="icon">👔</span> Corretores</h2>
      <p className="section-desc">Cadastre os corretores disponíveis para agendamento de visitas e reuniões.</p>
      {corretores.map((c, i) => (
        <div key={i} className="prof-card" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
          <div className="prof-card-header">
            <div className="prof-number">
              <div className="prof-badge" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "var(--imob-primary)" }}>#{i + 1}</div>
              <span className="prof-card-title" style={{ color: "var(--imob-primary)" }}>{c.nome || `Corretor ${i + 1}`}</span>
            </div>
            {corretores.length > 1 && <button onClick={() => remove(i)} className="btn btn-danger btn-sm">Remover</button>}
          </div>
          <div className="prof-fields">
            <div className="field">
              <label className="field-label">Nome Completo <span className="required">*</span></label>
              <input className="input imob-focus" placeholder="Ex: Carlos Mendes" value={c.nome} onChange={e => update(i, "nome", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Segmento <span className="required">*</span></label>
              <input className="input imob-focus" placeholder="Ex: Venda Residencial, Locação, Alto Padrão" value={c.segmento} onChange={e => update(i, "segmento", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">ID do Google Calendar</label>
              <input className="input imob-focus" placeholder="abc123@group.calendar.google.com" value={c.calendarId} onChange={e => update(i, "calendarId", e.target.value)} />
              <span className="input-hint">Encontre em: Google Calendar → Configurações → ID do calendário</span>
            </div>
            {c.nome && (
              <div className="slug-preview">
                <span className="slug-label">Slug gerado:</span>
                <code style={{ color: "var(--imob-primary)" }}>{generateSlug(c.nome)}</code>
              </div>
            )}
          </div>
        </div>
      ))}
      <button onClick={add} className="btn btn-outline btn-full">+ Adicionar Corretor</button>
    </div>
  );
}

function StepAtendimentos({ servs, setServs }) {
  const add = () => setServs(s => [...s, { slug: "", nome: "", duracao: 30, obs: "" }]);
  const remove = i => setServs(s => s.filter((_, j) => j !== i));
  const update = (i, f, v) => setServs(s => {
    const n = [...s]; n[i] = { ...n[i], [f]: v };
    if (f === "nome") n[i].slug = generateSlug(v);
    return n;
  });

  return (
    <div>
      <h2 className="section-title"><span className="icon">🏷️</span> Tipos de Atendimento</h2>
      <p className="section-desc">Configure os tipos de atendimento oferecidos (visita, ligação, reunião...).</p>
      {servs.map((s, i) => (
        <div key={i} className="proc-row" style={{ borderColor: "rgba(245,158,11,0.12)" }}>
          <div className="proc-fields">
            <div className="field proc-field-name">
              <label className="field-label" style={{ fontSize: 10 }}>Nome <span className="required">*</span></label>
              <input className="input imob-focus" style={{ padding: "10px 12px", fontSize: 13 }} placeholder="Visita ao imóvel" value={s.nome} onChange={e => update(i, "nome", e.target.value)} />
            </div>
            <div className="field proc-field-min">
              <label className="field-label" style={{ fontSize: 10 }}>Min</label>
              <input className="input imob-focus" style={{ padding: "10px 12px", fontSize: 13 }} type="number" value={s.duracao} onChange={e => update(i, "duracao", parseInt(e.target.value) || 0)} />
            </div>
            <div className="field proc-field-value">
              <label className="field-label" style={{ fontSize: 10 }}>Observação</label>
              <input className="input imob-focus" style={{ padding: "10px 12px", fontSize: 13 }} placeholder="Presencial" value={s.obs} onChange={e => update(i, "obs", e.target.value)} />
            </div>
            <button onClick={() => remove(i)} className="btn btn-ghost" style={{ alignSelf: "flex-end", marginBottom: 2 }}>✕</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="btn btn-outline btn-full" style={{ marginTop: 8 }}>+ Adicionar Atendimento</button>
    </div>
  );
}

function StepResultado({ results, corretores, servs, onReset }) {
  const downloadFile = (fn, c) => {
    const b = new Blob([c], { type: "application/json" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = fn; a.click(); URL.revokeObjectURL(u);
  };
  const downloadAll = () => { if (!results) return; Object.entries(results).forEach(([fn, c], i) => setTimeout(() => downloadFile(fn, c), i * 300)); };
  const count = results ? Object.keys(results).length : 0;

  return (
    <div>
      <h2 className="section-title"><span className="icon">🏠</span> Workflows Prontos!</h2>
      <p className="section-desc">
        <strong style={{ color: "var(--success)" }}>{count} workflows</strong> personalizados prontos para importar no n8n.
      </p>
      <div className="stats-grid">
        {[
          { val: corretores.filter(c => c.nome).length, label: "Corretores" },
          { val: servs.filter(s => s.nome).length, label: "Atendimentos" },
          { val: count, label: "Workflows" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-value" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <button onClick={downloadAll} className="btn btn-full btn-lg" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, marginBottom: 20, boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>
        ⬇ Baixar Todos os Workflows (.json)
      </button>
      <div className="alert" style={{ marginBottom: 20, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <span className="alert-icon">📝</span>
        <div className="alert-content">
          <div className="alert-title" style={{ color: "var(--imob-primary)" }}>Próximos passos</div>
          <div className="alert-body" style={{ lineHeight: 2 }}>
            1) Importe os JSONs no n8n<br />
            2) Configure credenciais: <strong style={{ color: "var(--text)" }}>Postgres, Chatwoot, OpenAI, Google Calendar</strong><br />
            3) No workflow 00: selecione a conta Chatwoot e execute<br />
            4) Nos workflows 01-08: configure triggers e credenciais<br />
            5) Nos workflows 02-06: atualize os IDs dos calendários<br />
            6) Teste com a etiqueta <code style={{ color: "var(--imob-primary)", fontFamily: "monospace" }}>testando-agente</code>
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
            <button onClick={() => downloadFile(fn, content)} className="download-btn" style={{ color: "var(--imob-primary)", background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.2)" }}>
              ⬇ Baixar
            </button>
          </div>
        ))}
      </div>
      <button onClick={onReset} className="btn btn-outline btn-full">🔄 Gerar para outra imobiliária</button>
    </div>
  );
}

// ============================
// MAIN
// ============================
export default function ImobApp() {
  const [step, setStep] = useState(0); // 0=Imobiliária, 1=Empresa, 2=Horários, 3=Persona, 4=Corretores, 5=Atendimentos, 6=Resultado
  const { templates, loading: autoLoading, error: autoError } = useAutoTemplates('imobiliaria');
  const [results, setResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const [negocio, setNegocio] = useState({ nome: "", endereco: "", telefone: "" });
  const [horarios, setHorarios] = useState({
    semana: "Segunda a Sexta: 08h às 18h",
    sabado: "Sábado: 09h às 13h",
    fechado: "Domingo e Feriados: Fechado",
    curto: "Seg-Sex 08h às 18h · Sáb 09h às 13h",
  });
  const [persona, setPersona] = useState({ nome: "" });
  const [corretores, setCorretores] = useState([{ nome: "", segmento: "", calendarId: "", disponibilidade: { ...defaultHorarios } }]);
  const [servs, setServs] = useState([...defaultServs]);
  const [empresa, setEmpresa] = useState({ anos: "", qualidade: "", historia: "", obs: "" });

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleGenerate = useCallback(() => {
    setProcessing(true);
    setTimeout(() => {
      const cfg = {
        imob: negocio.nome, endereco: negocio.endereco, telefone: negocio.telefone,
        horSemana: horarios.semana, horSabado: horarios.sabado, horFechado: horarios.fechado, horCurto: horarios.curto,
        assistente: persona.nome,
        profs: corretores.filter(c => c.nome).map(c => ({ ...c, slug: generateSlug(c.nome) })),
        servs: servs.filter(s => s.nome),
        empresa,
      };
      const gen = {};
      Object.entries(templates).forEach(([fn, content]) => { try { gen[fn] = processTemplate(content, cfg); } catch { gen[fn] = content; } });
      setResults(gen); setProcessing(false); setStep(6);
      showToast("Workflows gerados com sucesso! 🚀");
    }, 800);
  }, [templates, negocio, horarios, persona, corretores, servs, empresa]);

  const canNext = () => {
    switch (step) {
      case 0: return negocio.nome && negocio.endereco;
      case 1: return true; // Empresa — todos opcionais
      case 2: return horarios.semana;
      case 3: return persona.nome;
      case 4: return corretores.some(c => c.nome && c.segmento);
      case 5: return servs.some(s => s.nome);
      default: return true;
    }
  };

  const handleNext = () => { if (step === 5) handleGenerate(); else setStep(s => s + 1); };
  const progress = (step / (STEPS.length - 1)) * 100;

  const renderContent = () => {
    switch (step) {
      case 0: return <StepNegocio negocio={negocio} setNegocio={setNegocio} />;
      case 1: return <StepEmpresa empresa={empresa} setEmpresa={setEmpresa} />;
      case 2: return <StepHorarios horarios={horarios} setHorarios={setHorarios} />;
      case 3: return <StepPersona persona={persona} setPersona={setPersona} negocio={negocio} />;
      case 4: return <StepCorretores corretores={corretores} setCorretores={setCorretores} />;
      case 5: return <StepAtendimentos servs={servs} setServs={setServs} />;
      case 6: return <StepResultado results={results} corretores={corretores} servs={servs} onReset={() => { setStep(0); setResults(null); }} />;
      default: return null;
    }
  };

  return (
    <div className="app-wrapper imob-theme">
      <div className="container">
        <header className="header">
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', marginBottom: 16, transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            ← Todos os nichos
          </Link>
          <div className="header-badge" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "var(--imob-primary)" }}>
            <span>🏠</span><span>Imobiliária · n8n + AI</span>
          </div>
          <h1 className="header-title" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            IA Vendedora — Imobiliária
          </h1>
          <p className="header-subtitle">Configure e gere os workflows n8n para imobiliária</p>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 12px', borderRadius: 100,
            background: autoLoading ? 'rgba(245,158,11,0.1)' : autoError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: autoLoading ? '1px solid rgba(245,158,11,0.2)' : autoError ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)',
            color: autoLoading ? 'var(--imob-primary)' : autoError ? 'var(--danger)' : 'var(--success)',
          }}>
            {autoLoading ? '⏳ Carregando templates...' : autoError ? `⚠️ Sem templates` : `✅ ${Object.keys(templates).length} templates prontos`}
          </div>
        </header>

        <nav className="stepper">
          {STEPS.map((s, i) => (
            <button key={i} id={`imob-step-${i}`}
              className={`step-btn ${i === step ? "active imob-active" : ""} ${i < step ? "done" : ""}`}
              onClick={() => i < step ? setStep(i) : undefined}
              disabled={i > step}
            >
              <span className="step-icon">{i < step ? "✅" : s.icon}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f59e0b, #ef4444)" }} />
        </div>

        <div className="card">{renderContent()}</div>

        {step < 6 && (
          <div className="navigation">
            {step > 0
              ? <button onClick={() => setStep(s => s - 1)} className="btn btn-outline" id="imob-btn-back">← Voltar</button>
              : <div />}
            <button id="imob-btn-next" onClick={handleNext}
              disabled={!canNext() || processing || (autoLoading && Object.keys(templates).length === 0)}
              className="btn" style={{
                background: canNext() && !processing ? "linear-gradient(135deg, #f59e0b, #d97706)" : "rgba(245,158,11,0.3)",
                color: canNext() && !processing ? "#000" : "rgba(0,0,0,0.4)",
                fontWeight: 700, opacity: 1,
                cursor: canNext() && !processing ? "pointer" : "not-allowed",
                boxShadow: canNext() && !processing ? "0 4px 16px rgba(245,158,11,0.3)" : "none",
              }}>
              {processing ? <><div className="spinner" style={{ borderColor: "rgba(0,0,0,0.3)", borderTopColor: "#000" }} /> Gerando...</> : step === 5 ? "Gerar Workflows 🚀" : "Próximo →"}
            </button>
          </div>
        )}
      </div>
      {toast && (
        <div className={`toast ${toast.type}`} role="alert">
          <span>{toast.type === "success" ? "✅" : "❌"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
