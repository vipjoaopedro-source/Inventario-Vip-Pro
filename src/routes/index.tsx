import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import {
  CONFIG_PADRAO,
  carregarConfig,
  carregarContagens,
  carregarQuantidadeProdutos,
  compartilhar,
  salvarContagens,
  nomeBaseArquivo,
  contagensParaTxt,
  totalItens,
  type Config,
  parseProdutos,
  salvarProdutos,
  type Contagem,
  aplicarTema,
  carregarCadastroAtualizadoEm,
  registrarArquivo,
} from "@/lib/contagem";
import {
  lerCadastroPastaPadrao,
  selecionarPastaCadastro,
  suportaPastaPadrao,
  type ResultadoCadastro,
} from "@/lib/cadastro-pasta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Contagem de Mercadorias" },
      {
        name: "description",
        content:
          "Aplicativo de contagem de estoque por área: importe o cadastro de produtos em TXT e lance as quantidades pelo celular.",
      },
      { property: "og:title", content: "Contagem de Mercadorias" },
      {
        property: "og:description",
        content: "Contagens de estoque separadas por área, direto do celular e sem internet.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const [contagens, setContagens] = useState<Contagem[] | null>(null);
  const [qtdProdutos, setQtdProdutos] = useState<number | null>(null);
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [aviso, setAviso] = useState("");
  const [statusCadastro, setStatusCadastro] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null);
  const [pedirPasta, setPedirPasta] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const senhaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirmarApagar) senhaRef.current?.focus();
  }, [confirmarApagar]);

  function aplicarResultado(resultado: ResultadoCadastro) {
    return (async () => {
      if (resultado.texto) {
        const lidos = parseProdutos(resultado.texto);
        if (lidos.length > 0) {
          await salvarProdutos(lidos);
          setQtdProdutos(lidos.length);
          setAtualizadoEm(Date.now());
          setPedirPasta(false);
          setStatusCadastro("");
        } else {
          setStatusCadastro("O cadastro foi lido, mas nenhum produto foi reconhecido.");
        }
      } else {
        const precisaPasta = ["folder_not_selected", "folder_unreadable", "permission_denied"].includes(
          resultado.codigo ?? "",
        );
        setPedirPasta(precisaPasta);
        setStatusCadastro(resultado.erro ?? "Não consegui ler o cadastro.");
      }
    })();
  }

  async function escolherPasta() {
    setLendo(true);
    await aplicarResultado(await selecionarPastaCadastro());
    setLendo(false);
  }

  useEffect(() => {
    void (async () => {
      setContagens((await carregarContagens()).sort((a, b) => b.criadoEm - a.criadoEm));
      // Nunca abre o cadastro inteiro na tela inicial: bases grandes bloqueiam a navegação.
      setQtdProdutos(await carregarQuantidadeProdutos());
      setAtualizadoEm(await carregarCadastroAtualizadoEm());
      const cfg = await carregarConfig();
      setConfig(cfg);
      aplicarTema(cfg);
      // Relê o cadastro da pasta sempre que a tela inicial abre, em segundo plano.
      if (suportaPastaPadrao()) {
        setLendo(true);
        await aplicarResultado(await lerCadastroPastaPadrao());
        setLendo(false);
      }
    })();
  }, []);

  const abertas = contagens?.filter((c) => !c.finalizadaEm) ?? [];
  const fechadas = contagens?.filter((c) => c.finalizadaEm) ?? [];
  const todas = contagens ?? [];
  const temItens = todas.some((c) => c.itens.length > 0);
  const naoGeradas = todas.filter((c) => !c.geradaEm && c.itens.length > 0);

  async function gerarArquivo() {
    if (!temItens) {
      setAviso("Nenhum produto contado ainda.");
      return;
    }
    const conteudo = contagensParaTxt(todas, config);
    const nome = `${nomeBaseArquivo(config.usuario)}.txt`;
    const resultado = await compartilhar(nome, conteudo, "text/plain");
    const agora = Date.now();
    const atualizadas = todas
      .map((c) => (c.itens.length > 0 ? { ...c, geradaEm: agora } : c))
      .sort((a, b) => b.criadoEm - a.criadoEm);
    await salvarContagens(atualizadas);
    setContagens(atualizadas);
    await registrarArquivo({
      nome,
      conteudo,
      criadoEm: agora,
      caminho: resultado.caminho,
      linhas: conteudo.split("\r\n").filter(Boolean).length,
    });
    if (resultado.ok && resultado.caminho) {
      setAviso(`Arquivo ${nome} salvo em: ${resultado.caminho}`);
    } else {
      setAviso(resultado.erro ?? `Não consegui gerar o arquivo ${nome}.`);
    }
  }

  function validarSenha() {
    const esperada = config.senhaApagar.trim() || CONFIG_PADRAO.senhaApagar;
    if (senha.trim() !== esperada) {
      setErroSenha("Senha incorreta.");
      return false;
    }
    return true;
  }

  function confirmarSenhaEExclusao() {
    if (!validarSenha()) return;
    setConfirmarApagar(false);
    setConfirmarExclusao(true);
  }

  async function apagarDados() {
    const restantes = todas
      .filter((c) => c.geradaEm)
      .sort((a, b) => b.criadoEm - a.criadoEm);
    await salvarContagens(restantes);
    setContagens(restantes);
    setConfirmarExclusao(false);
    setSenha("");
    setErroSenha("");
    setAviso(`Apagadas ${todas.length - restantes.length} contagem(ns) não gerada(s).`);
  }

  function cancelarTudo() {
    setConfirmarApagar(false);
    setConfirmarExclusao(false);
    setSenha("");
    setErroSenha("");
  }

  return (
    <div className="tela">
      <Cabecalho
        titulo="Contagem de Mercadorias"
        subtitulo="Estoque por área"
        acao={
          <Link
            to="/config"
            aria-label="Configurações"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg"
          >
            ⚙
          </Link>
        }
      />

      <div className="space-y-6 px-4 py-5">
        {pedirPasta ? (
          <div className="cartao space-y-3 border-primary p-4">
            <p className="text-sm font-semibold">Escolha a pasta Inventario Vip Pro</p>
            <p className="text-xs text-muted-foreground">
              {statusCadastro} Isso é feito uma única vez; depois o app lê o cadastro sozinho.
            </p>
            <button type="button" className="btn-primario" disabled={lendo} onClick={() => void escolherPasta()}>
              {lendo ? "Lendo cadastro…" : "Escolher pasta"}
            </button>
          </div>
        ) : null}

        <Link to="/catalogo" className="cartao flex items-center gap-3 p-4">
          <span className="text-2xl">{qtdProdutos ? "📦" : "⚠"}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Cadastro: {(qtdProdutos ?? 0).toLocaleString("pt-BR")} produtos
            </span>
            <span className="block text-xs text-muted-foreground">
              {lendo
                ? "Atualizando cadastro…"
                : !pedirPasta && statusCadastro
                  ? statusCadastro
                  : atualizadoEm
                    ? `Atualizado ${formatarQuando(atualizadoEm)}`
                    : "Ainda não carregado"}
            </span>
          </span>
          <span className="text-muted-foreground">›</span>
        </Link>

        {naoGeradas.length > 0 ? (
          <div className="cartao border-primary p-4 text-sm">
            <span className="font-semibold text-primary">⚠ {naoGeradas.length} contagem(ns)</span> ainda
            não gerada(s) em arquivo.
          </div>
        ) : null}

        <div className="space-y-2">
          <button type="button" className="btn-secundario w-full" onClick={() => void gerarArquivo()}>
            Gerar arquivo de contagem (TXT)
          </button>
          <Link to="/arquivos" className="block text-center text-sm text-muted-foreground underline">
            Arquivos já gerados
          </Link>
          {aviso ? <p className="text-sm text-success">{aviso}</p> : null}
          {!config.usuario.trim() ? (
            <p className="text-xs text-muted-foreground">
              Defina seu nome nas configurações para aparecer no arquivo.
            </p>
          ) : null}
        </div>

        <section>
          <h2 className="mb-2 text-lg">Em andamento</h2>
          {abertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma contagem aberta.</p>
          ) : (
            <ul className="space-y-2">
              {abertas.map((c) => (
                <ItemLista key={c.id} contagem={c} />
              ))}
            </ul>
          )}
        </section>

        {fechadas.length > 0 ? (
          <section>
            <h2 className="mb-2 text-lg">Finalizadas</h2>
            <ul className="space-y-2">
              {fechadas.map((c) => (
                <ItemLista key={c.id} contagem={c} />
              ))}
            </ul>
          </section>
        ) : null}

        <div className="cartao flex items-center justify-between p-4">
          <span className="text-sm font-semibold">Total de itens coletados</span>
          <span className="font-display text-3xl text-primary">
            {todas.reduce((soma, c) => soma + totalItens(c), 0).toLocaleString("pt-BR")}
          </span>
        </div>

        {confirmarExclusao ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-center">
              Deseja mesmo apagar os dados?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primario flex-1"
                onClick={() => void apagarDados()}
              >
                Sim
              </button>
              <button
                type="button"
                className="btn-secundario flex-1"
                onClick={cancelarTudo}
              >
                Não
              </button>
            </div>
          </div>
        ) : confirmarApagar ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              confirmarSenhaEExclusao();
            }}
          >
            <div>
              <label className="etiqueta" htmlFor="senha-apagar">
                Senha para apagar
              </label>
                <input
                  id="senha-apagar"
                  ref={senhaRef}
                  className="campo"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="go"
                  autoComplete="off"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value.replace(/\D/g, ""));
                    setErroSenha("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.keyCode === 13) {
                      e.preventDefault();
                      confirmarSenhaEExclusao();
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === "Enter" || e.keyCode === 13) {
                      e.preventDefault();
                      confirmarSenhaEExclusao();
                    }
                  }}
                />
              {erroSenha ? (
                <p className="mt-1 text-xs text-destructive">{erroSenha}</p>
              ) : null}
            </div>
            <button type="submit" className="btn-primario w-full">
              Confirmar
            </button>
            <button
              type="button"
              className="btn-secundario w-full"
              onClick={cancelarTudo}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="mx-auto block px-4 py-2 text-xs text-muted-foreground underline"
            onClick={() => setConfirmarApagar(true)}
          >
            Apagar dados
          </button>
        )}

      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2 p-3">
          <Link to="/nova" search={{ modo: "normal" }} className="btn-primario min-h-16 text-lg">
            + Contagem
          </Link>
          <Link to="/nova" search={{ modo: "unitaria" }} className="btn-secundario min-h-16 text-center text-lg">
            + Unitária
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatarQuando(ts: number) {
  const d = new Date(ts);
  const hoje = new Date();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `hoje ${hora}`;
  return `${d.toLocaleDateString("pt-BR")} ${hora}`;
}

function ItemLista({ contagem }: { contagem: Contagem }) {
  return (
    <li>
      <Link
        to="/contagem/$id"
        params={{ id: contagem.id }}
        className="cartao flex items-center gap-3 p-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl">
            {contagem.area}
            {contagem.modo === "unitaria" ? " · unitária" : ""}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {contagem.contador} · {new Date(contagem.criadoEm).toLocaleString("pt-BR")}
            {contagem.geradaEm ? " · ✓ arquivo gerado" : ""}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-display text-2xl text-primary">
            {totalItens(contagem).toLocaleString("pt-BR")}
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            {contagem.itens.length} itens
          </span>
        </span>
      </Link>
    </li>
  );
}
