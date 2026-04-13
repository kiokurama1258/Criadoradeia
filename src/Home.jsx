import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="app-wrapper">
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 20px 48px', position: 'relative', zIndex: 1 }}>
        <header className="header" style={{ paddingBottom: 12 }}>
          <div className="header-badge">
            <span>⚡</span>
            <span>Configurador de Workflows n8n</span>
          </div>
          <h1 className="header-title">IA Vendedora</h1>
          <p className="header-subtitle">
            Selecione o nicho do seu cliente para configurar e gerar os workflows personalizados
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 12 }}>
          {/* Clínica */}
          <Link to="/clinica" id="card-clinica" style={{ textDecoration: "none" }}>
            <div className="home-card clinica-card">
              <div className="home-card-icon">🏥</div>
              <h2 className="home-card-title">Clínica / Consultório</h2>
              <p className="home-card-desc">
                Configure a IA para clínicas odontológicas, médicas, estéticas ou veterinárias.
                Gerencie profissionais, serviços e agendamentos.
              </p>
              <div className="home-card-tags">
                <span className="tag tag-blue">Odontologia</span>
                <span className="tag tag-blue">Medicina</span>
                <span className="tag tag-blue">Estética</span>
                <span className="tag tag-blue">Veterinária</span>
              </div>
              <div className="home-card-cta clinica-cta">
                Configurar Clínica →
              </div>
            </div>
          </Link>

          {/* Imobiliária */}
          <Link to="/imobiliaria" id="card-imobiliaria" style={{ textDecoration: "none" }}>
            <div className="home-card imob-card">
              <div className="home-card-icon">🏠</div>
              <h2 className="home-card-title">Imobiliária</h2>
              <p className="home-card-desc">
                Configure a IA para imobiliárias. Gerencie corretores por segmento, tipos de atendimento e qualificação de leads.
              </p>
              <div className="home-card-tags">
                <span className="tag tag-amber">Venda</span>
                <span className="tag tag-amber">Locação</span>
                <span className="tag tag-amber">Alto Padrão</span>
                <span className="tag tag-amber">Lançamentos</span>
              </div>
              <div className="home-card-cta imob-cta">
                Configurar Imobiliária →
              </div>
            </div>
          </Link>
        </div>

        {/* How it works */}
        <div className="card" style={{ marginTop: 32 }}>
          <h2 className="section-title" style={{ marginBottom: 20, fontSize: 17 }}>
            <span className="icon">⚙️</span> Como funciona
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
            {[
              { step: "01", icon: "📂", title: "Upload", desc: "Envie os JSONs dos workflows originais do n8n" },
              { step: "02", icon: "✏️", title: "Configure", desc: "Preencha os dados do seu cliente em cada etapa" },
              { step: "03", icon: "⚡", title: "Gere", desc: "Clique em gerar e os arquivos são processados" },
              { step: "04", icon: "⬇", title: "Baixe", desc: "Faça download e importe direto no n8n" },
            ].map(item => (
              <div key={item.step} style={{ textAlign: "center", padding: "16px 8px" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
                  PASSO {item.step}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
