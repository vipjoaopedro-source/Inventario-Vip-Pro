import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { carregarArquivos, compartilhar, type ArquivoGerado } from "@/lib/contagem";

export const Route = createFileRoute("/arquivos")({
  head: () => ({
    meta: [
      { title: "Arquivos gerados | Contagem de Mercadorias" },
      { name: "description", content: "Histórico dos arquivos TXT de contagem já gerados no aparelho." },
      { property: "og:title", content: "Arquivos gerados" },
      { property: "og:description", content: "Veja e gere novamente os arquivos de contagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Arquivos,
});

function Arquivos() {
  const [lista, setLista] = useState<ArquivoGerado[] | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    void carregarArquivos().then(setLista);
  }, []);

  async function gerarDeNovo(a: ArquivoGerado) {
    const r = await compartilhar(a.nome, a.conteudo, "text/plain");
    setAviso(r.ok ? `Arquivo ${a.nome} salvo em: ${r.caminho}` : (r.erro ?? "Não consegui gerar o arquivo."));
  }

  return (
    <div className="tela">
      <Cabecalho titulo="Arquivos gerados" subtitulo="Histórico de exportações" voltarPara="/" />
      <div className="space-y-3 px-4 py-5">
        {aviso ? <p className="text-sm text-success">{aviso}</p> : null}
        {lista && lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum arquivo gerado ainda.</p>
        ) : null}
        <ul className="space-y-2">
          {lista?.map((a) => (
            <li key={a.id} className="cartao space-y-2 p-4">
              <p className="break-all text-sm font-semibold">{a.nome}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.criadoEm).toLocaleString("pt-BR")} · {a.linhas} linhas
              </p>
              <button type="button" className="btn-secundario w-full" onClick={() => void gerarDeNovo(a)}>
                Gerar de novo
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
