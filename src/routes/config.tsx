import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import {
  CONFIG_PADRAO,
  carregarConfigImediata,
  salvarConfig,
  aplicarTema,
  type Config,
} from "@/lib/contagem";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configurações | Contagem de Mercadorias" },
      {
        name: "description",
        content:
          "Defina o nome do usuário, o modo de informar a área e os códigos fixos do arquivo de coleta.",
      },
      { property: "og:title", content: "Configurações da contagem" },
      {
        property: "og:description",
        content: "Nome do usuário, área digitada e padrões do arquivo TXT de coleta.",
      },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<Config>(() => carregarConfigImediata());
  const [senhaCampo, setSenhaCampo] = useState(
    () => carregarConfigImediata().senhaApagar || CONFIG_PADRAO.senhaApagar,
  );
  const [usuarioCampo, setUsuarioCampo] = useState(() => carregarConfigImediata().usuario);
  const [erroSenha, setErroSenha] = useState("");
  const [senhaConfigCampo, setSenhaConfigCampo] = useState(
    () => carregarConfigImediata().senhaConfig || CONFIG_PADRAO.senhaConfig,
  );
  const [liberado, setLiberado] = useState(false);
  const [senhaEntrada, setSenhaEntrada] = useState("");
  const [erroEntrada, setErroEntrada] = useState("");

  function entrar() {
    const esperada = config.senhaConfig?.trim() || CONFIG_PADRAO.senhaConfig;
    if (senhaEntrada !== esperada) {
      setErroEntrada("Senha incorreta.");
      setSenhaEntrada("");
      return;
    }
    setLiberado(true);
  }

  async function salvarEIrParaInicio() {
    if (!senhaCampo.trim() || !senhaConfigCampo.trim()) {
      setErroSenha("As senhas são obrigatórias.");
      return;
    }
    const atualizada = {
      ...config,
      usuario: usuarioCampo.trim(),
      senhaApagar: senhaCampo.trim(),
      senhaConfig: senhaConfigCampo.trim(),
      limiteQtd: config.limiteQtd > 0 ? config.limiteQtd : CONFIG_PADRAO.limiteQtd,
    };
    setConfig(atualizada);
    await salvarConfig(atualizada);
    aplicarTema(atualizada);
    navigate({ to: "/" });
  }

  if (!liberado) {
    return (
      <div className="tela">
        <Cabecalho titulo="Configurações" subtitulo="Acesso protegido" voltarPara="/" />
        <form
          className="space-y-3 px-4 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            entrar();
          }}
        >
          <label className="etiqueta" htmlFor="senha-config">
            Senha das configurações
          </label>
          <input
            id="senha-config"
            className="campo"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="enter"
            autoComplete="off"
            autoFocus
            value={senhaEntrada}
            onChange={(e) => {
              setSenhaEntrada(e.target.value.replace(/\D/g, ""));
              setErroEntrada("");
            }}
          />
          {erroEntrada ? <p className="text-xs text-destructive">{erroEntrada}</p> : null}
          <button type="submit" className="btn-primario">
            Entrar
          </button>
          <p className="text-xs text-muted-foreground">Senha padrão: 1234.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="tela">
      <Cabecalho titulo="Configurações" subtitulo="Usuário, área e arquivo" voltarPara="/" />

      <div className="space-y-6 px-4 py-5">
        <Link to="/catalogo" className="cartao flex items-center gap-3 p-4">
          <span className="text-2xl">📦</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Cadastro de produtos</span>
            <span className="block text-xs text-muted-foreground">
              Abrir seleção e atualização do cadastro
            </span>
          </span>
          <span className="text-muted-foreground">›</span>
        </Link>

        <div>
          <label className="etiqueta" htmlFor="usuario">
            Nome do usuário
          </label>
          <input
            id="usuario"
            className="campo"
            placeholder="Ex.: Gabriel Malaquias"
            value={usuarioCampo}
            onChange={(e) => setUsuarioCampo(e.target.value)}
            maxLength={40}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Vai no nome do arquivo gerado, junto com a data e a hora.
          </p>
        </div>

        <label className="cartao flex items-start gap-3 p-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-[oklch(0.78_0.17_76)]"
            checked={config.digitarArea}
            onChange={(e) => setConfig((atual) => ({ ...atual, digitarArea: e.target.checked }))}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Digitar a área no teclado</span>
            <span className="block text-xs text-muted-foreground">
              Marcado: abre o teclado numérico para digitar o código da área. Desmarcado: a área só
              pode ser bipada pelo leitor.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta" htmlFor="prefixo">
              2 primeiros dígitos
            </label>
            <input
              id="prefixo"
              className="campo text-center"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="enter"
              value={config.prefixo}
              onChange={(e) =>
                setConfig((atual) => ({ ...atual, prefixo: e.target.value.replace(/\D/g, "") }))
              }
              maxLength={2}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="meio">
              2 dígitos após a área
            </label>
            <input
              id="meio"
              className="campo text-center"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="enter"
              value={config.meio}
              onChange={(e) =>
                setConfig((atual) => ({ ...atual, meio: e.target.value.replace(/\D/g, "") }))
              }
              maxLength={2}
            />
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="senhaApagar">
            Senha para apagar dados
          </label>
          <input
            id="senhaApagar"
            className="campo"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="enter"
            autoComplete="new-password"
            placeholder="Senha obrigatória"
            value={senhaCampo}
            onChange={(e) => {
              const valor = e.target.value.replace(/\D/g, "");
              setSenhaCampo(valor);
              if (valor.trim()) {
                setErroSenha("");
              } else {
                setErroSenha("A senha é obrigatória.");
              }
            }}
            maxLength={20}
          />
          {erroSenha ? (
            <p className="mt-1 text-xs text-destructive">{erroSenha}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Obrigatória: o botão "Apagar dados" na tela inicial só funciona com esta senha. Padrão: 1234.
            </p>
          )}
        </div>


        <div>
          <label className="etiqueta" htmlFor="senhaConfig">
            Senha para entrar nas configurações
          </label>
          <input
            id="senhaConfig"
            className="campo"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="enter"
            autoComplete="new-password"
            value={senhaConfigCampo}
            onChange={(e) => setSenhaConfigCampo(e.target.value.replace(/\D/g, ""))}
            maxLength={20}
          />
        </div>

        <div>
          <label className="etiqueta" htmlFor="limiteQtd">
            Pedir confirmação acima de
          </label>
          <input
            id="limiteQtd"
            className="campo"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="enter"
            value={String(config.limiteQtd || "")}
            onChange={(e) =>
              setConfig((a) => ({ ...a, limiteQtd: Number(e.target.value.replace(/\D/g, "")) || 0 }))
            }
            maxLength={7}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Evita lançar um código de barras no campo de quantidade por engano.
          </p>
        </div>

        <label className="cartao flex items-center gap-3 p-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[oklch(0.78_0.17_76)]"
            checked={config.somAtivo}
            onChange={(e) => setConfig((a) => ({ ...a, somAtivo: e.target.checked }))}
          />
          <span className="text-sm font-semibold">Bip e vibração na leitura</span>
        </label>

        <label className="cartao flex items-center gap-3 p-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[oklch(0.78_0.17_76)]"
            checked={config.altoContraste}
            onChange={(e) => {
              setConfig((a) => ({ ...a, altoContraste: e.target.checked }));
              aplicarTema({ altoContraste: e.target.checked });
            }}
          />
          <span className="text-sm font-semibold">Alto contraste (fundo preto)</span>
        </label>

        <p className="text-xs text-muted-foreground">
          Formato de cada linha: {config.prefixo || "00"} + área (3) + {config.meio || "20"} +
          código de barras + quantidade (7).
        </p>

        <button
          type="button"
          className="btn-primario w-full"
          onClick={() => void salvarEIrParaInicio()}
        >
          Salvar configurações
        </button>
      </div>
    </div>
  );
}
