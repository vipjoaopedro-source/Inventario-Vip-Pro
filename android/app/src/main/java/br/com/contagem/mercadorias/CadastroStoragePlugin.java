package br.com.contagem.mercadorias;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;

@CapacitorPlugin(name = "CadastroStorage")
public class CadastroStoragePlugin extends Plugin {
    private static final String PREFS = "cadastro_storage";
    private static final String CHAVE_URI = "pasta_uri";
    private static final String CHAVE_NOME = "pasta_nome";

    @PluginMethod
    public void selecionarPasta(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "pastaEscolhida");
    }

    @ActivityCallback
    private void pastaEscolhida(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            responderErro(call, "selection_cancelled", "Nenhuma pasta foi selecionada.");
            return;
        }
        Uri uri = data.getData();
        try {
            int flags = data.getFlags() &
                (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
            String nome = nomePasta(uri);
            getContext().getSharedPreferences(PREFS, 0).edit()
                .putString(CHAVE_URI, uri.toString())
                .putString(CHAVE_NOME, nome)
                .apply();
            executarLeitura(call, uri, nome);
        } catch (SecurityException erro) {
            responderErro(call, "permission_denied", "O Android não concedeu acesso permanente à pasta escolhida.");
        }
    }

    @PluginMethod
    public void lerCadastro(PluginCall call) {
        String salva = getContext().getSharedPreferences(PREFS, 0).getString(CHAVE_URI, null);
        String nome = getContext().getSharedPreferences(PREFS, 0).getString(CHAVE_NOME, "Pasta selecionada");
        if (salva == null) {
            if (lerLegado(call)) return;
            responderErro(call, "folder_not_selected", "Escolha a pasta Inventario Vip Pro para o app ler o cadastro sozinho.");
            return;
        }
        executarLeitura(call, Uri.parse(salva), nome);
    }

    @PluginMethod
    public void salvarArquivo(PluginCall call) {
        String nome = call.getString("nome");
        String conteudo = call.getString("conteudo");
        if (nome == null || conteudo == null) {
            responderErro(call, "invalid_args", "Nome ou conteúdo do arquivo não informado.");
            return;
        }
        String salva = getContext().getSharedPreferences(PREFS, 0).getString(CHAVE_URI, null);
        String nomePasta = getContext().getSharedPreferences(PREFS, 0).getString(CHAVE_NOME, "Pasta selecionada");
        if (salva == null) {
            responderErro(call, "folder_not_selected", "Selecione primeiro a pasta do cadastro.");
            return;
        }
        Uri pastaUri = Uri.parse(salva);
        ContentResolver resolver = getContext().getContentResolver();
        try {
            String treeId = DocumentsContract.getTreeDocumentId(pastaUri);
            Uri pastaDoc = DocumentsContract.buildDocumentUriUsingTree(pastaUri, treeId);
            Uri filhos = DocumentsContract.buildChildDocumentsUriUsingTree(pastaUri, treeId);

            Uri saida = null;
            String[] colunas = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
            };
            try (Cursor cursor = resolver.query(filhos, colunas, null, null, null)) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2))
                            && normalizar(cursor.getString(1)).equals("contagens")) {
                            saida = DocumentsContract.buildDocumentUriUsingTree(pastaUri, cursor.getString(0));
                            break;
                        }
                    }
                }
            }
            if (saida == null) {
                saida = DocumentsContract.createDocument(
                    resolver, pastaDoc, DocumentsContract.Document.MIME_TYPE_DIR, "Contagens");
            }
            if (saida == null) {
                responderErro(call, "folder_create_failed", "Não consegui criar a subpasta Contagens.");
                return;
            }
            Uri arquivo = null;
            String saidaId = DocumentsContract.getDocumentId(saida);
            Uri filhosSaida = DocumentsContract.buildChildDocumentsUriUsingTree(pastaUri, saidaId);
            try (Cursor c2 = resolver.query(filhosSaida, colunas, null, null, null)) {
                if (c2 != null) {
                    while (c2.moveToNext()) {
                        if (nome.equals(c2.getString(1))) {
                            arquivo = DocumentsContract.buildDocumentUriUsingTree(pastaUri, c2.getString(0));
                            break;
                        }
                    }
                }
            }
            if (arquivo == null) {
                String mime = nome.endsWith(".json") ? "application/octet-stream" : "text/plain";
                arquivo = DocumentsContract.createDocument(resolver, saida, mime, nome);
            }
            if (arquivo == null) {
                responderErro(call, "file_create_failed", "Não consegui criar o arquivo na pasta Contagens.");
                return;
            }
            try (java.io.OutputStream out = resolver.openOutputStream(arquivo, "wt")) {
                if (out == null) throw new IOException("saída indisponível");
                out.write(conteudo.getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
            JSObject resposta = new JSObject();
            resposta.put("texto", nome);
            resposta.put("caminho", nomePasta + "/Contagens/" + nome);
            call.resolve(resposta);
        } catch (IOException | SecurityException | IllegalArgumentException erro) {
            responderErro(call, "write_failed", "Não consegui gravar o arquivo na pasta Contagens.");
        }
    }

    @PluginMethod
    public void pastaSelecionada(PluginCall call) {
        String nome = getContext().getSharedPreferences(PREFS, 0).getString(CHAVE_NOME, null);
        JSObject resultado = new JSObject();
        resultado.put("selecionada", nome != null);
        if (nome != null) resultado.put("nome", nome);
        call.resolve(resultado);
    }

    private void executarLeitura(PluginCall call, Uri pastaUri, String nomePasta) {
        ContentResolver resolver = getContext().getContentResolver();
        Uri filhos;
        try {
            String id = DocumentsContract.getTreeDocumentId(pastaUri);
            filhos = DocumentsContract.buildChildDocumentsUriUsingTree(pastaUri, id);
        } catch (Exception erro) {
            responderErro(call, "folder_unreadable", "A pasta salva não está mais disponível. Selecione-a novamente.");
            return;
        }

        Uri arquivoUri = null;
        String arquivoNome = null;
        String[] colunas = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        };
        try (Cursor cursor = resolver.query(filhos, colunas, null, null, null)) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String id = cursor.getString(0);
                    String nome = cursor.getString(1);
                    String tipo = cursor.getString(2);
                    String normalizado = normalizar(nome);
                    boolean arquivo = !DocumentsContract.Document.MIME_TYPE_DIR.equals(tipo);
                    if (arquivo && (normalizado.equals("cadastro") || normalizado.equals("cadastro.txt")
                        || normalizado.startsWith("cadastro"))) {
                        arquivoUri = DocumentsContract.buildDocumentUriUsingTree(pastaUri, id);
                        arquivoNome = nome;
                        if (normalizado.equals("cadastro") || normalizado.equals("cadastro.txt")) break;
                    }
                }
            }
        } catch (Exception erro) {
            responderErro(call, "folder_unreadable", "Não consegui abrir a pasta salva. Selecione-a novamente.");
            return;
        }

        if (arquivoUri == null) {
            responderErro(call, "file_not_found", "A pasta selecionada não contém Cadastro ou Cadastro.txt.");
            return;
        }

        try (InputStream entrada = resolver.openInputStream(arquivoUri)) {
            if (entrada == null) throw new IOException("arquivo indisponível");
            byte[] bytes = lerBytes(entrada);
            if (bytes.length == 0) {
                responderErro(call, "empty_file", "O arquivo de cadastro está vazio.");
                return;
            }
            String texto = decodificar(bytes);
            JSObject resposta = new JSObject();
            resposta.put("texto", texto);
            resposta.put("caminho", nomePasta + "/" + arquivoNome);
            resposta.put("pasta", nomePasta);
            call.resolve(resposta);
        } catch (IOException | SecurityException erro) {
            responderErro(call, "read_failed", "Encontrei o arquivo, mas não consegui fazer a leitura.");
        }
    }

    /** Android 6 a 10: tenta ler direto de /Inventario Vip Pro sem escolher a pasta. */
    private boolean lerLegado(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT >= 30) return false;
        String perm = android.Manifest.permission.READ_EXTERNAL_STORAGE;
        if (androidx.core.content.ContextCompat.checkSelfPermission(getContext(), perm)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            androidx.core.app.ActivityCompat.requestPermissions(getActivity(), new String[]{perm}, 4711);
            return false;
        }
        java.io.File raiz = android.os.Environment.getExternalStorageDirectory();
        java.io.File[] pastas = raiz.listFiles();
        if (pastas == null) return false;
        for (java.io.File pasta : pastas) {
            if (!pasta.isDirectory() || !normalizar(pasta.getName()).equals("inventario vip pro")) continue;
            java.io.File[] arquivos = pasta.listFiles();
            if (arquivos == null) return false;
            for (java.io.File f : arquivos) {
                String n = normalizar(f.getName());
                if (f.isFile() && n.startsWith("cadastro")) {
                    try (InputStream in = new java.io.FileInputStream(f)) {
                        byte[] bytes = lerBytes(in);
                        if (bytes.length == 0) return false;
                        JSObject r = new JSObject();
                        r.put("texto", decodificar(bytes));
                        r.put("caminho", pasta.getName() + "/" + f.getName());
                        call.resolve(r);
                        return true;
                    } catch (IOException e) {
                        return false;
                    }
                }
            }
        }
        return false;
    }

    private String nomePasta(Uri uri) {
        try {
            String id = DocumentsContract.getTreeDocumentId(uri);
            int separador = id.lastIndexOf(':');
            String caminho = separador >= 0 ? id.substring(separador + 1) : id;
            int barra = caminho.lastIndexOf('/');
            return barra >= 0 ? caminho.substring(barra + 1) : caminho;
        } catch (Exception erro) {
            return "Pasta selecionada";
        }
    }

    private byte[] lerBytes(InputStream entrada) throws IOException {
        try (ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
            byte[] bloco = new byte[8192];
            int tamanho;
            while ((tamanho = entrada.read(bloco)) != -1) saida.write(bloco, 0, tamanho);
            return saida.toByteArray();
        }
    }

    private String decodificar(byte[] bytes) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException erro) {
            return new String(bytes, Charset.forName("windows-1252"));
        }
    }

    private String normalizar(String valor) {
        return Normalizer.normalize(valor, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "").replaceAll("\\s+", " ")
            .trim().toLowerCase(Locale.ROOT);
    }

    private void responderErro(PluginCall call, String codigo, String mensagem) {
        JSObject resposta = new JSObject();
        resposta.put("texto", JSObject.NULL);
        resposta.put("codigo", codigo);
        resposta.put("erro", mensagem);
        call.resolve(resposta);
    }
}