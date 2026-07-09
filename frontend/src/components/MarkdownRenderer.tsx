import React, { useState, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MarkdownRendererProps {
  content: string;
  height?: number;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, height = 150 }) => {
  const [calculatedHeight, setCalculatedHeight] = useState(height);
  const rendererId = React.useMemo(() => Math.random().toString(36).substring(7), []);

  const safeContent = React.useMemo(() => {
    return JSON.stringify(content).replace(/\\/g, '\\\\');
  }, [content]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMessage = (e: MessageEvent) => {
      try {
        if (e.data && e.data.type === 'markdown-height' && e.data.id === rendererId) {
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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/marked@5.1.2/marked.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10.2.4/dist/mermaid.min.js"></script>
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
            padding: 0;
            margin: 0;
          }
          .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
            padding-top: 4px;
            padding-bottom: 4px;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #FFFFFF;
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 700;
          }
          h1 { font-size: 1.4em; }
          h2 { font-size: 1.25em; }
          h3 { font-size: 1.1em; }
          p {
            margin-top: 0;
            margin-bottom: 12px;
            line-height: 1.5;
            font-size: 16px;
          }
          ul, ol {
            margin-top: 0;
            margin-bottom: 12px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 4px;
            line-height: 1.4;
            font-size: 16px;
          }
          code {
            font-family: monospace;
            background-color: rgba(255, 255, 255, 0.1);
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 0.9em;
          }
          pre {
            background-color: rgba(0, 0, 0, 0.3);
            border: 1px solid #222222;
            border-radius: 8px;
            padding: 12px;
            overflow-x: auto;
            margin-top: 0;
            margin-bottom: 12px;
          }
          pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
            font-size: 0.9em;
          }
          .mermaid {
            background-color: transparent;
            display: flex;
            justify-content: center;
            margin-top: 12px;
            margin-bottom: 12px;
          }
        </style>
      </head>
      <body>
        <div id="content"></div>
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
                window.parent.postMessage({ type: 'markdown-height', id: '${rendererId}', height: height }, '*');
              }
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markdown-height', id: '${rendererId}', height: height }));
              }
            }, 150);
          }

          window.onload = function() {
            try {
              const rawContent = ${safeContent};
              
              let html = marked.parse(rawContent);
              const contentDiv = document.getElementById('content');
              contentDiv.innerHTML = html;

              if (window.mermaid) {
                const mermaidBlocks = contentDiv.querySelectorAll('pre code.language-mermaid');
                if (mermaidBlocks.length > 0) {
                  mermaidBlocks.forEach(function(block) {
                    const pre = block.parentElement;
                    const div = document.createElement('div');
                    div.className = 'mermaid';
                    div.textContent = block.textContent;
                    pre.replaceWith(div);
                  });
                  mermaid.initialize({ startOnLoad: false, theme: 'dark' });
                  mermaid.run();
                }
              }

              if (window.renderMathInElement) {
                renderMathInElement(contentDiv, {
                  delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\\\(', right: '\\\\)', display: false },
                    { left: '\\\\[', right: '\\\\]', display: true }
                  ],
                  throwOnError: false
                });
              }

              notifyHeight();
            } catch (e) {
              document.getElementById('content').innerHTML = '<div style="color: #ff4444;">Error de renderizado: ' + e.message + '</div>';
              notifyHeight();
            }
          };
        </script>
      </body>
    </html>
  `;

  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markdown-height' && data.id === rendererId) {
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
