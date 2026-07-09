import React, { useState, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface TypstRendererProps {
  content: string;
  height?: number;
}

export const TypstRenderer: React.FC<TypstRendererProps> = ({ content, height = 300 }) => {
  const [calculatedHeight, setCalculatedHeight] = useState(height);
  const rendererId = React.useMemo(() => Math.random().toString(36).substring(7), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMessage = (e: MessageEvent) => {
      try {
        if (e.data && e.data.type === 'typst-height' && e.data.id === rendererId) {
          setCalculatedHeight(e.data.height);
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [rendererId]);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script type="module" src="https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js"></script>
        <style>
          html, body {
            background-color: transparent;
            color: #E2E8F0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          #content {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding: 0;
            margin: 0;
          }
          svg {
            max-width: 100%;
            height: auto;
            background: transparent !important;
            border-radius: 0;
            padding: 0;
            border: none;
            box-shadow: none;
            margin: 0;
          }
          .loader {
            color: #94A3B8;
            font-size: 14px;
            font-style: italic;
            text-align: center;
            margin-top: 30px;
            width: 100%;
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
          function notifyHeight() {
            setTimeout(function() {
              const body = document.body;
              const html = document.documentElement;
              const height = Math.max(
                body.scrollHeight, body.offsetHeight, 
                html.clientHeight, html.scrollHeight, html.offsetHeight
              );
              
              if (window.parent) {
                window.parent.postMessage({ type: 'typst-height', id: '${rendererId}', height: height }, '*');
              }
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'typst-height', id: '${rendererId}', height: height }));
              }
            }, 100);
          }

          window.onload = function() {
            function render() {
              try {
                window.$typst.setCompilerInitOptions({
                  getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
                });
                window.$typst.setRendererInitOptions({
                  getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
                });

                const typstConfig = "#set page(width: auto, height: auto, margin: 4pt, fill: none)\\n#set text(fill: rgb(\\"E2E8F0\\"), size: 14pt)\\n";
                const mainContent = typstConfig + ${JSON.stringify(content)};

                window.$typst.svg({ mainContent }).then(function(svg) {
                  document.getElementById('content').innerHTML = svg;
                  notifyHeight();
                }).catch(function(err) {
                  document.getElementById('content').innerHTML = '<div class="error"><b>Error de Compilación:</b><br/>' + String(err).replace(/\\n/g, '<br/>') + '</div>';
                  notifyHeight();
                });
              } catch(e) {
                document.getElementById('content').innerHTML = '<div class="error"><b>Error:</b><br/>' + String(e) + '</div>';
                notifyHeight();
              }
            }
            
            var checkCount = 0;
            var timer = setInterval(function() {
              checkCount++;
              if (window.$typst) {
                clearInterval(timer);
                render();
              } else if (checkCount > 100) {
                clearInterval(timer);
                document.getElementById('content').innerHTML = '<div class="error">No se pudo cargar el compilador Typst.</div>';
                notifyHeight();
              }
            }, 100);
          };
        </script>
      </body>
    </html>
  `;

  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'typst-height' && data.id === rendererId) {
        setCalculatedHeight(data.height);
      }
    } catch (err) {}
  };

  if (Platform.OS === 'web') {
    return (
      <iframe
        srcDoc={html}
        style={{ 
          border: 'none', 
          width: '100%', 
          height: `${calculatedHeight}px`, 
          backgroundColor: 'transparent',
        }}
      />
    );
  }

  return (
    <View style={{ height: calculatedHeight, overflow: 'hidden', backgroundColor: 'transparent' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        onMessage={onWebViewMessage}
      />
    </View>
  );
};
