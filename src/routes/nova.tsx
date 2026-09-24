import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import {
  CONFIG_PADRAO,
  carregarAreas,
  carregarConfig,
  carregarContagens,
  novoId,
  salvarAreas,
  salvarContagens,
  type Config,
  type ModoContagem,
} from "@/lib/contagem";

export const Route = createFileRoute("/nova")({
  validateSearch: (search: Record<string, unknown>): { modo?: ModoContagem } => ({
    modo: search["modo"] === "unitaria" ? "unitaria" : "normal",
  }),
  head: () => ({
    meta: [
      { title: "Nova contagem | Contagem de Mercadorias" },
      {
        name: "description",
        content: "Informe a área do estoque e quem está contando antes de lançar os produtos.",
      },
      { property: "og:title", content: "Nova contagem" },
      {
        property: "og:description",
        content: "Abertura de contagem por área, como uma comanda de restaurante.",
      },
    ],
  }),
  component: Nova,
});

function Nova() {
  const navigate = useNavigate();
  const { modo } = Route.useSearch();
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [areas, setAreas] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [contador, setContador] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    void carregarAreas().then(setAreas);
    void carregarConfig().then((c) => {
      setConfig(c);
      setContador(
        c.usuario.trim() ||
          (typeof localStorage !== "undefined" ? (localStorage.getItem("mc:contador") ?? "") : ""),
      );
    });
  }, []);

  // Quando digitarArea está desmarcado, a área só entra via leitor de código de
  // barras (que "digita" os números e manda Enter no final). O campo fica
  // readOnly para o teclado do celular não abrir.
  useEffect(() => {
    if (config.digitarArea) return;
    let buffer = "";
    function onKeyDown(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA") && alvo.id !== "area") {
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        buffer = (buffer + e.key).slice(0, 4);
        setArea(buffer);
        setErro("");
      } else if (e.key === "Backspace") {
        buffer = buffer.slice(0, -1);
        setArea(buffer);
      } else if (e.key === "Enter" && buffer) {
        buffer = "";
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [config.digitarArea]);

  async function iniciar() {
    const areaFinal = area.trim();
    const apenasDigitos = areaFinal.replace(/\D/g, "");
    if (!areaFinal) {
      setErro("Informe a área da contagem.");
      return;
    }
    if (apenasDigitos.length > 4) {
      setErro("Área inválida — máximo de 4 dígitos.");
      return;
    }
    if (apenasDigitos === "" || /^0+$/.test(apenasDigitos)) {
      setErro("Área inválida — não pode ser 00, 000, 0000 ou 00000.");
      return;
    }
    if (!contador.trim()) {
      setErro("Defina o nome do usuário nas configurações antes de começar.");
      return;
    }
    if (!areas.includes(areaFinal)) {
      const atualizadas = [...areas, areaFinal];
      setAreas(atualizadas);
      await salvarAreas(atualizadas);
    }
    localStorage.setItem("mc:contador", contador.trim());
    const id = novoId();
    const contagens = await carregarContagens();
    await salvarContagens([
      ...contagens,
      {
        id,
        area: areaFinal,
        contador: contador.trim(),
        modo: modo ?? "normal",
        criadoEm: Date.now(),
        itens: [],
      },
    ]);
    void navigate({ to: "/contagem/$id", params: { id } });
  }

  return (
    <div className="tela">
      <Cabecalho
        titulo={modo === "unitaria" ? "Contagem unitária" : "Nova contagem"}
        subtitulo="Área e responsável"
        voltarPara="/"
      />

      <div className="space-y-6 px-4 py-5">
        <div>
          <label className="etiqueta" htmlFor="area">
            Área da contagem
          </label>
          <input
            id="area"
            className="campo font-display text-2xl"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus={config.digitarArea}
            readOnly={!config.digitarArea}
            placeholder={config.digitarArea ? "Ex.: 670" : "Bipe o código da área"}
            value={area}
            onChange={(e) => {
              setArea(e.target.value.replace(/\D/g, ""));
              setErro("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void iniciar();
              }
            }}
            maxLength={4}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {config.digitarArea
              ? "No arquivo a área entra com 3 dígitos."
              : "Teclado desativado: bipe o código da área com o leitor."}
          </p>
        </div>

        <div>
          <label className="etiqueta" htmlFor="contador">
            Quem está contando
          </label>
          <input
            id="contador"
            className="campo"
            placeholder="Defina nas configurações"
            value={contador}
            readOnly
            tabIndex={-1}
            maxLength={60}
          />
          {config.usuario.trim() ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Definido nas configurações.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Sem nome definido — configure nas configurações.
            </p>
          )}
        </div>

        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

        <button type="button" className="btn-primario" onClick={() => void iniciar()}>
          Começar contagem
        </button>
      </div>
    </div>
  );
}
