import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import {
  CONFIG_PADRAO,
  acumularPorEan,
  carregarConfig,
  carregarContagens,
  carregarProdutos,
  localizarProduto,
  novoId,
  salvarContagens,
  totalItens,
  type Config,
  type Contagem,
  type Produto,
} from "@/lib/contagem";
import { somErro, somOk } from "@/lib/feedback";

export const Route = createFileRoute("/contagem/$id")({
  head: () => ({
    meta: [
      { title: "Contagem em andamento | Contagem de Mercadorias" },
      {
        name: "description",
        content:
          "Lance as quantidades por código de barras na área escolhida.",
      },
      { property: "og:title", content: "Contagem em andamento" },
      {
        property: "og:description",
        content: "Lançamento de quantidades por área com geração do arquivo de coleta.",
      },
    ],
  }),
  component: Detalhe,
});

function Detalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [aviso, setAviso] = useState("");
  const [modoExcluir, setModoExcluir] = useState(false);
  const [trocandoArea, setTrocandoArea] = useState(false);
  const [areaNova, setAreaNova] = useState("");
  const [semCadastro, setSemCadastro] = useState("");
  const [confirmarQtd, setConfirmarQtd] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const qtdRef = useRef<HTMLInputElement>(null);
  const contagemRef = useRef<Contagem | null>(null);
  contagemRef.current = contagem;

  useEffect(() => {
    void (async () => {
      const todas = await carregarContagens();
      setContagem(todas.find((c) => c.id === id) ?? null);
      setProdutos(await carregarProdutos());
    })();
    void carregarConfig().then(setConfig);
  }, [id]);

  // Com "Digitar a área" desmarcado, a nova área só entra via leitor (que
  // "digita" os números e manda Enter no final). O campo fica readOnly.
  useEffect(() => {
    if (!trocandoArea || config.digitarArea) return;
    let buffer = "";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") {
        buffer = (buffer + e.key).slice(0, 4);
        setAreaNova(buffer);
        setAviso("");
      } else if (e.key === "Backspace") {
        buffer = buffer.slice(0, -1);
        setAreaNova(buffer);
      } else if (e.key === "Enter" && buffer) {
        const valor = buffer;
        buffer = "";
        void salvarArea(valor);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trocandoArea, config.digitarArea]);

  const unitaria = contagem?.modo === "unitaria";

  async function persistir(atualizada: Contagem) {
    setContagem(atualizada);
    const todas = await carregarContagens();
    await salvarContagens(todas.map((c) => (c.id === atualizada.id ? atualizada : c)));
  }

  async function lancar(produto: Produto, qtd: number) {
    if (!contagem) return;
    await persistir({
      ...contagem,
      itens: [
        {
          id: novoId(),
          ean: produto.ean,
          descricao: produto.descricao,
          quantidade: qtd,
          criadoEm: Date.now(),
        },
        ...contagem.itens,
      ],
    });
    setAviso("");
    somOk(config.somAtivo);
  }

  async function desfazer() {
    if (!contagem || contagem.itens.length === 0) return;
    const [ultimo, ...resto] = contagem.itens;
    await persistir({ ...contagem, itens: resto });
    setAviso(`Desfeito: ${ultimo?.descricao ?? ""} · ${ultimo?.quantidade ?? ""}`);
    buscaRef.current?.focus();
  }

  async function excluirProduto(produto: Produto) {
    if (!contagem) return;
    const removidos = contagem.itens.filter((i) => i.ean === produto.ean).length;
    if (removidos === 0) {
      setAviso(`${produto.descricao} não estava contado.`);
    } else {
      await persistir({
        ...contagem,
        itens: contagem.itens.filter((i) => i.ean !== produto.ean),
      });
      setAviso(`Contagem de ${produto.descricao} excluída.`);
    }
    limparEntrada();
  }

  function limparEntrada() {
    setConfirmarQtd(false);
    setSelecionado(null);
    setQuantidade("");
    setTermo("");
    buscaRef.current?.focus();
  }

  async function adicionar() {
    if (!contagem || !selecionado) return;
    const qtd = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setAviso("Informe uma quantidade válida.");
      return;
    }
    const limite = config.limiteQtd > 0 ? config.limiteQtd : 999;
    if (qtd > limite && !confirmarQtd) {
      setConfirmarQtd(true);
      somErro(config.somAtivo);
      return;
    }
    setConfirmarQtd(false);
    await lancar(selecionado, qtd);
    limparEntrada();
  }

  /** Bipagem/Enter: só agora consulta o cadastro, por EAN ou código (seq). */
  async function processarLeitura(valor: string) {
    const t = valor.replace(/\D/g, "");
    if (!t) return;
    // A atualização automática pode terminar depois que esta tela abriu.
    // Recarrega no momento da leitura para sempre consultar a base mais recente.
    const baseAtual = await carregarProdutos();
    if (baseAtual.length !== produtos.length) setProdutos(baseAtual);
    const exato = localizarProduto(baseAtual, t);
    if (!exato) {
      setSemCadastro(t);
      setTermo("");
      somErro(config.somAtivo);
      return;
    }
    if (modoExcluir) {
      await excluirProduto(exato);
      return;
    }
    if (unitaria) {
      await lancar(exato, 1);
      setTermo("");
      buscaRef.current?.focus();
      return;
    }
    setSelecionado(exato);
    setQuantidade("");
    setTimeout(() => qtdRef.current?.focus(), 0);
  }

  async function salvarArea(valor?: string) {
    const atual = contagemRef.current;
    const nova = (valor ?? areaNova).trim();
    const apenasDigitos = nova.replace(/\D/g, "");
    if (!atual || !nova) return;
    if (apenasDigitos.length > 4) {
      setAviso("Área inválida — máximo de 4 dígitos.");
      setAreaNova("");
      return;
    }
    if (apenasDigitos === "" || /^0+$/.test(apenasDigitos)) {
      setAviso("Área inválida — não pode ser 00, 000, 0000 ou 00000.");
      setAreaNova("");
      return;
    }
    await persistir({ ...atual, area: nova });
    setTrocandoArea(false);
    setAreaNova("");
    setAviso(`Área alterada para ${nova}.`);
  }

  async function finalizar() {
    if (!contagem) return;
    await persistir({ ...contagem, finalizadaEm: Date.now() });
    void navigate({ to: "/" });
  }

  if (!contagem) {
    return (
      <div className="tela">
        <Cabecalho titulo="Contagem" voltarPara="/" />
        <p className="px-4 py-6 text-sm text-muted-foreground">Contagem não encontrada.</p>
      </div>
    );
  }

  const finalizada = Boolean(contagem.finalizadaEm);
  const acumulado = acumularPorEan(contagem.itens);

  return (
    <div className="tela">
      <Cabecalho
        titulo={`AREA: ${contagem.area}`}
        subtitulo={`${contagem.contador}${unitaria ? " · unitária" : ""}`}
        voltarPara="/"
      />

      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <div className="cartao p-2 text-center">
          <span className="block font-display text-2xl text-primary">
            {totalItens(contagem).toLocaleString("pt-BR")}
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">unidades</span>
        </div>
        <div className="cartao p-2 text-center">
          <span className="block font-display text-2xl text-primary">{acumulado.length}</span>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">produtos</span>
        </div>
      </div>

      {semCadastro ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-destructive p-6 text-center text-destructive-foreground"
          autoFocus
          onClick={() => {
            setSemCadastro("");
            setTimeout(() => buscaRef.current?.focus(), 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setSemCadastro("");
              setTimeout(() => buscaRef.current?.focus(), 0);
            }
          }}
        >
          <span className="text-6xl">✕</span>
          <span className="font-display text-3xl">Produto sem cadastro</span>
          <span className="break-all text-xl">{semCadastro}</span>
          <span className="text-sm">Toque na tela ou aperte Enter para continuar</span>
        </button>
      ) : null}

      {!finalizada ? (
        <div className="space-y-3 border-b border-border px-4 py-4">
          {trocandoArea ? (
            <div className="cartao space-y-3 p-3">
              <label className="etiqueta" htmlFor="nova-area">
                Nova área
              </label>
              <input
                id="nova-area"
                className="campo font-display text-2xl"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="enter"
                autoFocus={config.digitarArea}
                readOnly={!config.digitarArea}
                placeholder={config.digitarArea ? "Ex.: 670" : "Bipe o código da área"}
                value={areaNova}
                onChange={(e) => {
                  setAreaNova(e.target.value.replace(/\D/g, ""));
                  setAviso("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void salvarArea();
                  }
                }}
                maxLength={4}
              />
              <p className="text-xs text-muted-foreground">
                {config.digitarArea
                  ? "Digite a nova área da contagem."
                  : "Teclado desativado: bipe o código da nova área."}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secundario flex-1"
                  onClick={() => {
                    setTrocandoArea(false);
                    setAreaNova("");
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primario flex-1"
                  onClick={() => void salvarArea()}
                >
                  Salvar área
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-secundario"
                onClick={() => {
                  setTrocandoArea(true);
                  setAviso("");
                }}
              >
                Trocar área
              </button>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[oklch(0.78_0.17_76)]"
              checked={modoExcluir}
              onChange={(e) => {
                setModoExcluir(e.target.checked);
                setSelecionado(null);
                setAviso("");
                buscaRef.current?.focus();
              }}
            />
            <span className={modoExcluir ? "font-semibold text-destructive" : ""}>
              Modo excluir — bipar apaga toda a contagem do produto
            </span>
          </label>

          {selecionado ? (
            <div className="cartao space-y-3 p-3">
              <div>
                <p className="text-sm font-semibold">{selecionado.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {selecionado.ean}
                  {selecionado.embalagem ? ` · ${selecionado.embalagem}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secundario w-14 text-xl"
                  onClick={() =>
                    setQuantidade((q) =>
                      String(Math.max(1, (Number((q || "0").replace(",", ".")) || 1) - 1)),
                    )
                  }
                >
                  −
                </button>
                <input
                  ref={qtdRef}
                  className="campo text-center font-display text-2xl"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="enter"
                  autoFocus
                  value={quantidade}
                  onChange={(e) => {
                    setQuantidade(e.target.value.replace(/\D/g, ""));
                    setConfirmarQtd(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void adicionar();
                    }
                  }}
                  aria-label="Quantidade"
                />
                <button
                  type="button"
                  className="btn-secundario w-14 text-xl"
                  onClick={() =>
                    setQuantidade((q) => String((Number((q || "0").replace(",", ".")) || 0) + 1))
                  }
                >
                  +
                </button>
              </div>
              {confirmarQtd ? (
                <p className="rounded-lg bg-destructive p-3 text-center text-sm font-semibold text-destructive-foreground">
                  Quantidade alta: {Number(quantidade).toLocaleString("pt-BR")}. Confira e aperte Enter de
                  novo para confirmar.
                </p>
              ) : null}
              <div>
                <button type="button" className="btn-secundario w-full" onClick={limparEntrada}>
                  Cancelar
                </button>
              </div>
              <button
                type="button"
                className="min-h-12 w-full rounded-xl border border-destructive text-sm font-semibold text-destructive"
                onClick={() => void excluirProduto(selecionado)}
              >
                Delete — excluir contagem deste produto
              </button>
            </div>
          ) : (
            <>
              <input
                ref={buscaRef}
                className="campo"
                placeholder="Código de barras"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="enter"
                value={termo}
                autoFocus
                onChange={(e) => {
                  setTermo(e.target.value.replace(/\D/g, ""));
                  setAviso("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void processarLeitura(e.currentTarget.value);
                  }
                }}
                autoComplete="off"
              />
               {produtos.length === 0 ? (
                 <p className="text-sm text-destructive">
                   Nenhum produto no aparelho — abra o cadastro para carregar a base.
                 </p>
               ) : (
                 <p className="text-xs text-muted-foreground">
                   {produtos.length.toLocaleString("pt-BR")} produtos no cadastro.
                 </p>
               )}
            </>
          )}
            </>
          )}
          {aviso ? (
            <p className={modoExcluir ? "text-sm text-destructive" : "text-sm text-success"}>
              {aviso}
            </p>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const ultimo = contagem.itens[0];
        if (!ultimo) {
          return (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Nenhum produto lançado ainda.
            </p>
          );
        }
        const totalProduto = acumulado.find((x) => x.ean === ultimo.ean)?.quantidade ?? 0;
        return (
          <div className="space-y-2 px-4 py-4">
            <p className="etiqueta">Último lançamento</p>
            <div className="cartao space-y-2 border-primary p-4">
              <p className="text-lg font-semibold leading-tight">{ultimo.descricao}</p>
              <p className="text-xs text-muted-foreground">{ultimo.ean}</p>
              <div className="flex items-end justify-between">
                <span>
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Lançado</span>
                  <span className="font-display text-4xl text-primary">
                    {ultimo.quantidade.toLocaleString("pt-BR")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    Total na área
                  </span>
                  <span className="font-display text-4xl">{totalProduto.toLocaleString("pt-BR")}</span>
                </span>
              </div>
            </div>
            {!finalizada ? (
              <button type="button" className="btn-secundario w-full" onClick={() => void desfazer()}>
                ↶ Desfazer último lançamento
              </button>
            ) : null}
          </div>
        );
      })()}

      <div className="space-y-2 px-4 pb-6">
        {!finalizada ? (
          <button type="button" className="btn-primario" onClick={() => void finalizar()}>
            Finalizar contagem
          </button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Contagem finalizada em {new Date(contagem.finalizadaEm ?? 0).toLocaleString("pt-BR")}
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Tudo é salvo automaticamente no aparelho. Gere o arquivo TXT na tela inicial.
        </p>
      </div>
    </div>
  );
}
