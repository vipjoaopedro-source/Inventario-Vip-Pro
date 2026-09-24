import { Capacitor, registerPlugin } from "@capacitor/core";

export const PASTA_PADRAO = "Inventario Vip Pro";
export const ARQUIVO_CADASTRO = "Cadastro.txt";

function ehNativo() {
  return Capacitor.isNativePlatform();
}

export function suportaPastaPadrao() {
  return ehNativo();
}

function comLimite<T>(p: Promise<T>, ms = 8000): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

export type ResultadoCadastro = {
  texto: string | null;
  caminho?: string;
  erro?: string;
  codigo?: string;
};

type CadastroStoragePlugin = {
  lerCadastro(): Promise<ResultadoCadastro>;
  selecionarPasta(): Promise<ResultadoCadastro>;
  pastaSelecionada(): Promise<{ selecionada: boolean; nome?: string }>;
  salvarArquivo(opcoes: { nome: string; conteudo: string }): Promise<ResultadoCadastro>;
};

const CadastroStorage = registerPlugin<CadastroStoragePlugin>("CadastroStorage");

export async function lerCadastroPastaPadrao(): Promise<ResultadoCadastro> {
  if (!ehNativo()) return { texto: null, erro: "Disponível apenas no aplicativo instalado." };
  const resultado = await comLimite(CadastroStorage.lerCadastro(), 30000);
  return resultado ?? {
    texto: null,
    codigo: "timeout",
    erro: "A leitura demorou demais. Feche o aplicativo, abra novamente e tente outra vez.",
  };
}

export async function selecionarPastaCadastro(): Promise<ResultadoCadastro> {
  if (!ehNativo()) return { texto: null, erro: "Disponível apenas no aplicativo instalado." };
  const resultado = await comLimite(CadastroStorage.selecionarPasta(), 120000);
  return resultado ?? { texto: null, codigo: "timeout", erro: "A seleção da pasta demorou demais." };
}

export async function obterPastaCadastro() {
  if (!ehNativo()) return { selecionada: false as const };
  return (await comLimite(CadastroStorage.pastaSelecionada(), 5000)) ?? { selecionada: false as const };
}

/** Grava o arquivo gerado na subpasta "Contagens" dentro da pasta escolhida. */
export async function salvarNaPastaContagens(
  nome: string,
  conteudo: string,
): Promise<ResultadoCadastro> {
  if (!ehNativo()) return { texto: null, erro: "Disponível apenas no aplicativo instalado." };
  const resultado = await comLimite(CadastroStorage.salvarArquivo({ nome, conteudo }), 30000);
  return resultado ?? { texto: null, codigo: "timeout", erro: "A gravação demorou demais." };
}
