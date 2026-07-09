import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface TypstRendererProps {
  content: string;
  height?: number;
}

export const TypstRenderer: React.FC<TypstRendererProps> = ({ content, height = 300 }) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script type="module" src="https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js"></script>
        <style>
          body {
            background-color: #1A1A1A;
            color: #E2E8F0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 16px;
            overflow-x: auto;
          }
          #content {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          svg {
            max-width: 100%;
            height: auto;
            background: #242424 !important;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #333;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            margin-bottom: 20px;
          }
          .loader {
            color: #94A3B8;
            font-size: 14px;
            font-style: italic;
            text-align: center;
            margin-top: 30px;
          }
          .error {
            color: #EF4444;
            font-size: 14px;
            background-color: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            padding: 12px;
            border-radius: 8px;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div id="content">
          <div class="loader">Compilando Typst...</div>
        </div>
        <script>
          window.onload = function() {
            function render() {
              try {
                window.$typst.setCompilerInitOptions({
                  getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
                });
                window.$typst.setRendererInitOptions({
                  getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
                });

                const mainContent = ${JSON.stringify(content)};
                window.$typst.svg({ mainContent }).then(function(svg) {
                  document.getElementById('content').innerHTML = svg;
                }).catch(function(err) {
                  document.getElementById('content').innerHTML = '<div class="error"><b>Error de Compilación:</b><br/>' + String(err).replace(/\\n/g, '<br/>') + '</div>';
                });
              } catch(e) {
                document.getElementById('content').innerHTML = '<div class="error"><b>Error:</b><br/>' + String(e) + '</div>';
              }
            }
            
            var checkCount = 0;
            var timer = setInterval(function() {
              checkCount++;
              if (window.$typst) {
                clearInterval(timer);
                render();
              } else if (checkCount > 100) { // 10 seconds timeout
                clearInterval(timer);
                document.getElementById('content').innerHTML = '<div class="error">No se pudo cargar el compilador Typst (tiempo de espera agotado). Verifica tu conexión a internet.</div>';
              }
            }, 100);
          };
        </script>
      </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <iframe
        srcDoc={html}
        style={{ 
          border: 'none', 
          width: '100%', 
          height: `${height}px`, 
          backgroundColor: '#1A1A1A',
          borderRadius: 8 
        }}
      />
    );
  }

  return (
    <View style={{ height, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1A1A1A' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#1A1A1A' }}
        scrollEnabled={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
      />
    </View>
  );
};
