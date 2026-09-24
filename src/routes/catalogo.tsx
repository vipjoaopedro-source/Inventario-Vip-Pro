import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import catalogoExemplo from "@/assets/produtos.txt.asset.json";
import {
  parseProdutos,
  salvarProdutos,
  type Produto,
} from "@/lib/contagem";
import {
  ARQUIVO_CADASTRO,
  lerCadastroPastaPadrao,
  selecionarPastaCadastro,
  suportaPastaPadrao,
} from "@/lib/cadastro-pasta";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Cadastro de produtos | Contagem de Mercadorias" },
      {
        name: "description",
        content:
          "Importe o cadastro de produtos em TXT com as colunas CODIGO SEQ, EMBALAGEM, CODIGO DE BARRAS e DESCRIÇÃO.",
      },
      { property: "og:title", content: "Cadastro de produtos" },
      {
        property: "og:description",
        content: "Importação do cadastro de produtos em arquivo TXT.",
      },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [totalSalvo, setTotalSalvo] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [ocupado, setOcupado] = useState(false);
  const [pasta, setPasta] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const noAparelho = suportaPastaPadrao();

  async function buscarNaPastaPadrao() {
    setOcupado(true);
    setStatus(`Atualizando ${ARQUIVO_CADASTRO}...`);
    const resultado = await lerCadastroPastaPadrao();
    if (resultado.texto) {
      await aplicarTexto(resultado.texto, resultado.caminho ?? "pasta selecionada");
      return;
    }
    setStatus(resultado.erro ?? "Cadastro não encontrado.");
    setOcupado(false);
  }

  async function escolherPasta() {
    setOcupado(true);
    setStatus("Selecione a pasta onde está o cadastro.");
    const resultado = await selecionarPastaCadastro();
    if (resultado.texto) {
      setPasta(resultado.caminho?.split("/")[0] ?? "Pasta selecionada");
      await aplicarTexto(resultado.texto, resultado.caminho ?? "pasta selecionada");
      return;
    }
    setStatus(resultado.erro ?? "Pasta não selecionada.");
    setOcupado(false);
  }

  async function aplicarTexto(texto: string, origem: string) {
    setOcupado(true);
    setStatus("Lendo arquivo...");
    try {
      const lidos = parseProdutos(texto);
      if (lidos.length === 0) {
        setStatus("Nenhum produto encontrado no arquivo.");
        return;
      }
      await salvarProdutos(lidos);
      setProdutos(lidos);
      setTotalSalvo(lidos.length);
      setStatus(`${lidos.length.toLocaleString("pt-BR")} produtos importados de ${origem}.`);
    } catch {
      setStatus("Não foi possível ler o arquivo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="tela">
      <Cabecalho titulo="Cadastro" subtitulo="Produtos disponíveis para contagem" voltarPara="/" />

      <div className="space-y-5 px-4 py-5">
        <div className="cartao p-4">
          <p className="font-display text-4xl text-primary">
            {totalSalvo.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            produtos no aparelho
          </p>
        </div>

        <div className="cartao space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Arquivo TXT ou CSV com cabeçalho: <br />
            <span className="text-foreground">
              CODIGO SEQ, EMBALAGEM, CODIGO DE BARRAS, DESCRIÇÃO
            </span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="hidden"
            onChange={async (e) => {
              const arquivo = e.target.files?.[0];
              if (!arquivo) return;
              const texto = await arquivo.text();
              await aplicarTexto(texto, arquivo.name);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-primario"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
          >
            Escolher arquivo
          </button>
          <button
            type="button"
            className="btn-secundario w-full"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setStatus("Baixando cadastro...");
              try {
                const resposta = await fetch(catalogoExemplo.url);
                await aplicarTexto(await resposta.text(), "cadastro enviado");
              } catch {
                setStatus("Não foi possível baixar o cadastro.");
                setOcupado(false);
              }
            }}
          >
            Usar cadastro que você enviou
          </button>
          {status ? <p className="text-sm text-primary">{status}</p> : null}
        </div>

        <div className="cartao space-y-3 p-4">
          <p className="text-sm font-semibold">Pasta do cadastro</p>
          <p className="text-xs text-muted-foreground">
            Escolha a pasta que contém <span className="text-foreground">{ARQUIVO_CADASTRO}</span>.
            {pasta ? <> Pasta atual: <span className="text-foreground">{pasta}</span>.</> : null}
          </p>
          {noAparelho ? (
            <div className="space-y-2">
              <button type="button" className="btn-primario w-full" disabled={ocupado} onClick={() => void escolherPasta()}>
                Selecionar pasta do cadastro
              </button>
              {pasta ? (
                <button type="button" className="btn-secundario w-full" disabled={ocupado} onClick={() => void buscarNaPastaPadrao()}>
                  Atualizar cadastro
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Disponível no aplicativo instalado no celular. Aqui, use "Escolher arquivo" acima e
              selecione o {ARQUIVO_CADASTRO}.
            </p>
          )}
        </div>


        {produtos.length > 0 ? (
          <section>
            <h2 className="mb-2 text-lg">Amostra</h2>
            <ul className="space-y-2">
              {produtos.slice(0, 20).map((p) => (
                <li key={p.ean} className="cartao p-3">
                  <p className="text-sm font-semibold">{p.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.ean}
                    {p.embalagem ? ` · ${p.embalagem}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
