import { useState, useEffect } from "react";

/**
 * Busca automaticamente os templates JSON da pasta public/templates/{nicho}/
 * lendo o manifest.json da pasta. Retorna { templates, loading, error }.
 *
 * Para adicionar/remover templates:
 *   1. Coloque/remova o arquivo JSON em public/templates/{nicho}/
 *   2. Atualize o manifest.json da mesma pasta
 */
export function useAutoTemplates(nicho) {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1. Lê o manifest para saber quais arquivos existem
        const manifestRes = await fetch(`/templates/${nicho}/manifest.json`);
        if (!manifestRes.ok) throw new Error("manifest.json não encontrado");
        const fileList = await manifestRes.json();

        // 2. Busca cada arquivo em paralelo
        const entries = await Promise.all(
          fileList.map(async (filename) => {
            try {
              const res = await fetch(`/templates/${nicho}/${encodeURIComponent(filename)}`);
              if (!res.ok) return null;
              const text = await res.text();
              JSON.parse(text); // valida JSON
              return [filename, text];
            } catch {
              return null; // arquivo não encontrado ou JSON inválido — ignora
            }
          })
        );

        if (cancelled) return;

        const loaded = Object.fromEntries(entries.filter(Boolean));
        setTemplates(loaded);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [nicho]);

  // Permite que o usuário ainda faça upload manual (override/adicionar)
  const mergeTemplates = (newFiles) => {
    setTemplates(prev => ({ ...prev, ...newFiles }));
  };

  return { templates, setTemplates: mergeTemplates, loading, error };
}
