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

  // Pre-process: extract LaTeX blocks in TypeScript (safe escaping)
  // and replace them with placeholders so marked.js doesn't touch them
  const { processed, blocks } = React.useMemo(() => {
    const latexBlocks: string[] = [];
    let text = content;

    // Protect display math: \[...\]
    text = text.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
      latexBlocks.push(match);
      return `LATEXBLOCK${latexBlocks.length - 1}END`;
    });

    // Protect display math: $$...$$
    text = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      latexBlocks.push(match);
      return `LATEXBLOCK${latexBlocks.length - 1}END`;
    });

    // Protect inline math: $...$  (no newlines inside)
    text = text.replace(/\$[^\$\n]+\$/g, (match) => {
      latexBlocks.push(match);
      return `LATEXBLOCK${latexBlocks.length - 1}END`;
    });

    return { processed: text, blocks: latexBlocks };
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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous" />
        <script src="https://cdn.jsdelivr.net/npm/marked@5.1.2/marked.min.js" integrity="sha384-tP9zQHkeb4OfJ9PanaUpV7hxoPxP8KY4mYVYu+FK51pzcM3/idOlmVlA4kPO2SL2" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.5/dist/purify.min.js" integrity="sha384-rneZSW/1QE+3/U5/u+/7eRNi/tRc+SzS+yXy36fltr1tDN9EHaVo1Bwz2Z8o8DA4" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" integrity="sha384-cpW21h6RZv/phavutF+AuVYrr+dA8xD9zs6FwLpaCct6O9ctzYFfFr4dgmgccOTx" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10.2.4/dist/mermaid.min.js" integrity="sha384-AZNedbHjmSFvf7jCjWFJDSGZf6jOFwBAPYzmCcWNLZUf55GVtT+45K4yik/OwJIv" crossorigin="anonymous"></script>
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

          function escapeHTML(str) {
            return str
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }

          window.onload = function() {
            try {
              var processedContent = ${JSON.stringify(processed)};
              var latexBlocks = ${JSON.stringify(blocks)};

              var html = marked.parse(processedContent);
              
              // Sanitizar el HTML del markdown con DOMPurify antes de inyectar LaTeX
              var cleanHtml = DOMPurify.sanitize(html);

              // Restore LaTeX blocks after marked has finished, escaping them for safety
              for (var i = 0; i < latexBlocks.length; i++) {
                cleanHtml = cleanHtml.split('LATEXBLOCK' + i + 'END').join(escapeHTML(latexBlocks[i]));
              }

              var contentDiv = document.getElementById('content');
              contentDiv.innerHTML = cleanHtml;

              if (window.mermaid) {
                var mermaidBlocks = contentDiv.querySelectorAll('pre code.language-mermaid');
                if (mermaidBlocks.length > 0) {
                  mermaidBlocks.forEach(function(block) {
                    var pre = block.parentElement;
                    var div = document.createElement('div');
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
        sandbox="allow-scripts"
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
        source={{ html, baseUrl: 'about:blank' }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        onMessage={onWebViewMessage}
      />
    </View>
  );
};
