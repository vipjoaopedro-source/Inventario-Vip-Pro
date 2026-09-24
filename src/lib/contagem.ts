import { get, set } from "idb-keyval";

export type Produto = {
  ean: string;
  descricao: string;
  codigo?: string;
  embalagem?: string;
};

export type ItemContagem = {
  id: string;
  ean: string;
  descricao: string;
  quantidade: number;
  observacao?: string;
  criadoEm: number;
};

export type ModoContagem = "normal" | "unitaria";

export type Contagem = {
  id: string;
  area: string;
  contador: string;
  modo?: ModoContagem;
  criadoEm: number;
  finalizadaEm?: number;
  /** Quando o TXT dessa contagem foi gerado (botão "Gerar arquivo"). */
  geradaEm?: number;
  itens: ItemContagem[];
};

export type Config = {
  usuario: string;
  digitarArea: boolean;
  prefixo: string;
  meio: string;
  senhaApagar: string;
  /** Senha para entrar nas Configurações. */
  senhaConfig: string;
  /** Acima deste valor, a quantidade pede confirmação. */
  limiteQtd: number;
  altoContraste: boolean;
  somAtivo: boolean;
};

export const CONFIG_PADRAO: Config = {
  usuario: "",
  digitarArea: true,
  prefixo: "00",
  meio: "20",
  senhaApagar: "1234",
  senhaConfig: "1234",
  limiteQtd: 999,
  altoContraste: false,
  somAtivo: true,
};

export type ArquivoGerado = {
  id: string;
  nome: string;
  conteudo: string;
  criadoEm: number;
  caminho?: string | undefined;
  linhas: number;
};

const KEY_PRODUTOS = "mc:produtos";
const KEY_TOTAL_PRODUTOS = "mc:produtos:total";
const KEY_CADASTRO_EM = "mc:produtos:atualizadoEm";
const KEY_CONTAGENS = "mc:contagens";
const KEY_AREAS = "mc:areas";
const KEY_CONFIG = "mc:config";
const KEY_ARQUIVOS = "mc:arquivos";
const CONFIG_LOCAL = "mc:config:local";

export async function carregarCadastroAtualizadoEm(): Promise<number | null> {
  return (await get<number>(KEY_CADASTRO_EM)) ?? null;
}

export async function carregarArquivos(): Promise<ArquivoGerado[]> {
  return (await get<ArquivoGerado[]>(KEY_ARQUIVOS)) ?? [];
}

export async function registrarArquivo(arq: Omit<ArquivoGerado, "id">) {
  const lista = await carregarArquivos();
  await set(KEY_ARQUIVOS, [{ ...arq, id: novoId() }, ...lista].slice(0, 100));
}

export function aplicarTema(config: Pick<Config, "altoContraste">) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("alto-contraste", config.altoContraste);
}

let backupTimer: ReturnType<typeof setTimeout> | undefined;
/** Cópia de segurança das contagens na pasta Contagens (só no aparelho). */
function agendarBackup(contagens: Contagem[]) {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    void import("./cadastro-pasta").then(({ salvarNaPastaContagens }) =>
      salvarNaPastaContagens("backup-contagens.json", JSON.stringify(contagens)),
    );
  }, 3000);
}


export function novoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function separarLinha(linha: string, sep: string) {
  return linha.split(sep).map((p) => p.trim().replace(/^"|"$/g, ""));
}

/**
 * Converte o texto do cadastro em produtos.
 * Detecta o separador (, ; tab |) e identifica as colunas pelo cabeçalho
 * (CODIGO SEQ, EMBALAGEM, CODIGO DE BARRAS, DESCRIÇÃO). Sem cabeçalho,
 * assume código de barras na primeira coluna e descrição na segunda.
 */
export function parseProdutos(texto: string): Produto[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return [];

  const primeira = linhas[0] ?? "";
  const temSeparador = [";", ",", "\t", "|"].some((c) => primeira.includes(c));

  // Alguns cadastros não usam separador: código sequencial, embalagem, EAN
  // e descrição ocupam posições fixas, separados apenas por espaços.
  if (!temSeparador) {
    const produtos: Produto[] = [];
    const vistos = new Set<string>();
    for (const linha of linhas) {
      const partes = linha.trim().match(/^(\d+)\s+(\d+)\s+(\d{8,14})\s+(.+?)\s*$/);
      if (!partes) continue;
      const [, codigo = "", embalagem = "", ean = "", descricao = ""] = partes;
      if (!ean || vistos.has(ean)) continue;
      vistos.add(ean);
      produtos.push({ ean, codigo, embalagem, descricao: descricao.trim() || ean });
    }
    return produtos;
  }

  let sep = ";";
  for (const c of [";", ",", "\t", "|"]) {
    if (primeira.split(c).length > primeira.split(sep).length) sep = c;
  }

  const cabecalho = separarLinha(primeira, sep).map(normalizar);
  const acharCol = (testes: RegExp[]) =>
    cabecalho.findIndex((h) => testes.some((t) => t.test(h)));

  let idxEan = acharCol([/barra/, /^ean/, /gtin/]);
  let idxDesc = acharCol([/descri/, /produto/, /nome/]);
  let idxCodigo = acharCol([/codigo seq/, /^cod/, /^seq/]);
  let idxEmb = acharCol([/embalag/, /^emb/, /unidade/, /^un$/]);
  const temCabecalho = idxEan >= 0 || idxDesc >= 0;

  if (!temCabecalho) {
    idxEan = 0;
    idxDesc = 1;
    idxCodigo = -1;
    idxEmb = -1;
  }

  const corpo = temCabecalho ? linhas.slice(1) : linhas;
  const produtos: Produto[] = [];
  const vistos = new Set<string>();

  for (const linha of corpo) {
    const partes = separarLinha(linha, sep);
    const ean = (idxEan >= 0 ? partes[idxEan] : "") ?? "";
    const codigo = (idxCodigo >= 0 ? partes[idxCodigo] : "") ?? "";
    const chave = ean || codigo;
    if (!chave) continue;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const descricao = ((idxDesc >= 0 ? partes[idxDesc] : "") ?? "").trim();
    const embalagem = ((idxEmb >= 0 ? partes[idxEmb] : "") ?? "").trim();
    produtos.push({
      ean: chave,
      descricao: descricao || chave,
      ...(codigo ? { codigo } : {}),
      ...(embalagem ? { embalagem } : {}),
    });
  }
  return produtos;
}

export async function carregarProdutos(): Promise<Produto[]> {
  return (await get<Produto[]>(KEY_PRODUTOS)) ?? [];
}

export async function salvarProdutos(produtos: Produto[]) {
  await set(KEY_PRODUTOS, produtos);
  await set(KEY_TOTAL_PRODUTOS, produtos.length);
  await set(KEY_CADASTRO_EM, Date.now());
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/**
 * Localiza por código de barras ou código sequencial. Zeros à esquerda não
 * alteram a identificação, pois alguns leitores os acrescentam ao GTIN.
 */
export function localizarProduto(produtos: Produto[], leitura: string) {
  const lida = somenteDigitos(leitura);
  if (!lida) return undefined;
  const canonica = lida.replace(/^0+(?=\d)/, "");
  return produtos.find((produto) => {
    const codigos = [produto.ean, produto.codigo ?? ""];
    return codigos.some((codigo) => {
      const normalizado = somenteDigitos(codigo);
      return normalizado === lida || normalizado.replace(/^0+(?=\d)/, "") === canonica;
    });
  });
}

export async function carregarQuantidadeProdutos(): Promise<number | null> {
  return (await get<number>(KEY_TOTAL_PRODUTOS)) ?? null;
}

export async function carregarContagens(): Promise<Contagem[]> {
  return (await get<Contagem[]>(KEY_CONTAGENS)) ?? [];
}

export async function salvarContagens(contagens: Contagem[]) {
  await set(KEY_CONTAGENS, contagens);
  agendarBackup(contagens);
}

export async function carregarAreas(): Promise<string[]> {
  return (await get<string[]>(KEY_AREAS)) ?? [];
}

export async function salvarAreas(areas: string[]) {
  await set(KEY_AREAS, areas);
}

export async function carregarConfig(): Promise<Config> {
  if (typeof window !== "undefined") {
    try {
      const local = window.localStorage.getItem(CONFIG_LOCAL);
      if (local) return { ...CONFIG_PADRAO, ...(JSON.parse(local) as Partial<Config>) };
    } catch {
      // Continua para o armazenamento principal quando a cópia local não estiver disponível.
    }
  }
  return { ...CONFIG_PADRAO, ...((await get<Partial<Config>>(KEY_CONFIG)) ?? {}) };
}

export async function salvarConfig(config: Config) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CONFIG_LOCAL, JSON.stringify(config));
  }
  await set(KEY_CONFIG, config);
}

export function carregarConfigImediata(): Config {
  if (typeof window === "undefined") return CONFIG_PADRAO;
  try {
    const local = window.localStorage.getItem(CONFIG_LOCAL);
    return local ? { ...CONFIG_PADRAO, ...(JSON.parse(local) as Partial<Config>) } : CONFIG_PADRAO;
  } catch {
    return CONFIG_PADRAO;
  }
}

export function buscarProdutos(produtos: Produto[], termo: string, limite = 30) {
  const t = termo.trim().toLowerCase();
  if (!t) return [];
  const resultado: Produto[] = [];
  for (const p of produtos) {
    if (p.ean.includes(t) || p.descricao.toLowerCase().includes(t)) {
      resultado.push(p);
      if (resultado.length >= limite) break;
    }
  }
  return resultado;
}

export function totalItens(c: Contagem) {
  return c.itens.reduce((s, i) => s + i.quantidade, 0);
}

function dataBr(ts: number) {
  return new Date(ts).toLocaleString("pt-BR");
}

export function contagemParaCsv(c: Contagem) {
  const linhas = [
    "area;contador;ean;descricao;quantidade;observacao;data",
    ...c.itens.map((i) =>
      [
        c.area,
        c.contador,
        i.ean,
        i.descricao.replace(/;/g, " "),
        String(i.quantidade).replace(".", ","),
        (i.observacao ?? "").replace(/;/g, " "),
        dataBr(i.criadoEm),
      ].join(";"),
    ),
  ];
  return linhas.join("\r\n");
}

function so_digitos(s: string) {
  return s.replace(/\D/g, "");
}

function pad(valor: string, tamanho: number) {
  return so_digitos(valor).slice(-tamanho).padStart(tamanho, "0");
}

/** Código da área no arquivo: número seguido de zero, completado até 3 dígitos.
 *  8 → 080, 17 → 170, 138 → 138, 670 → 670. */
function codigoArea(area: string) {
  const d = so_digitos(area);
  return (d ? d + "0" : "000").slice(0, 3).padStart(3, "0");
}

/** Soma as quantidades por código de barras. */
export function acumularPorEan(itens: ItemContagem[]) {
  const mapa = new Map<string, { ean: string; descricao: string; quantidade: number }>();
  for (const i of itens) {
    const atual = mapa.get(i.ean);
    if (atual) atual.quantidade += i.quantidade;
    else mapa.set(i.ean, { ean: i.ean, descricao: i.descricao, quantidade: i.quantidade });
  }
  return [...mapa.values()];
}

/** Base do nome do arquivo: nome do usuário + DDMMAA + HHMMSS. */
export function nomeBaseArquivo(usuario: string, ts = Date.now()) {
  const d = new Date(ts);
  const dois = (n: number) => String(n).padStart(2, "0");
  const data = `${dois(d.getDate())}${dois(d.getMonth() + 1)}${dois(d.getFullYear() % 100)}`;
  const hora = `${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}`;
  const base = usuario.trim() ? `${usuario.trim()}${data}${hora}` : `coleta${data}${hora}`;
  return base.replace(/[\\/:*?"<>|]/g, "");
}

/**
 * Arquivo de coleta: prefixo(2) + área(3) + fixo(2) + código de barras + quantidade(7).
 * Ex.: 00 670 20 7898270966927 0000004
 * O nome do usuário vai apenas no nome do arquivo, não no conteúdo.
 */
export function contagensParaTxt(contagens: Contagem[], config: Config) {
  const linhas: string[] = [];
  for (const c of contagens) {
    const area = codigoArea(c.area);
    for (const item of acumularPorEan(c.itens)) {
      const qtd = pad(String(Math.round(item.quantidade)), 7);
      const ean = so_digitos(item.ean).padStart(13, "0");
      linhas.push(`${pad(config.prefixo, 2)}${area}${pad(config.meio, 2)}${ean}${qtd}`);
    }
  }
  return linhas.join("\r\n") + "\r\n";
}

export function baixarArquivo(nome: string, conteudo: string, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Salva na subpasta "Contagens" da pasta escolhida; se não der, na pasta Documentos. */
async function salvarNoAparelho(
  nome: string,
  conteudo: string,
): Promise<{ ok: boolean; caminho?: string; erro?: string }> {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return { ok: false };
  const { salvarNaPastaContagens } = await import("./cadastro-pasta");
  const naPasta = await salvarNaPastaContagens(nome, conteudo);
  if (naPasta.texto) return { ok: true, caminho: naPasta.caminho ?? "Contagens/" + nome };
  if (naPasta.erro && naPasta.codigo === "folder_not_selected") {
    return { ok: false, erro: "Selecione primeiro a pasta do cadastro nas configurações." };
  }
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  try {
    await Filesystem.writeFile({
      path: nome,
      data: conteudo,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return { ok: true, caminho: "Documentos/" + nome };
  } catch (e) {
    return { ok: false, erro: naPasta.erro ?? "Não consegui gravar o arquivo." };
  }
}

export async function compartilhar(
  nome: string,
  conteudo: string,
  tipo = "text/csv",
): Promise<{ ok: boolean; caminho?: string; erro?: string }> {
  const salvo = await salvarNoAparelho(nome, conteudo);
  if (salvo.ok) return salvo;
  const arquivo = new File([conteudo], nome, { type: tipo });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [arquivo] }) && nav.share) {
    await nav.share({ files: [arquivo], title: nome });
    return { ok: true, caminho: "compartilhado" };
  }
  baixarArquivo(nome, conteudo, `${tipo};charset=utf-8`);
  return { ok: true, caminho: "download" };
}
