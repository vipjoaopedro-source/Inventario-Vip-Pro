package br.com.contagem.mercadorias;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CadastroStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
