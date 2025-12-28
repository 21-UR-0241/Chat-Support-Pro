const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
const distDir = path.join(__dirname, '../../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build the React widget
async function buildWidget() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'ChatWidget.jsx')],
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'ChatWidget',
      outfile: path.join(distDir, 'chat-widget.js'),
      external: ['react', 'react-dom', 'lucide-react'],
      jsx: 'automatic',
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      banner: {
        js: '/* Shopify Chat Widget - Built with React */'
      }
    });
    
    console.log('✅ Widget built successfully!');
    
    // Create widget initializer script
    const initScript = `
(function() {
  // Load dependencies from CDN
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  // Initialize widget
  async function initWidget() {
    try {
      // Load Tailwind CSS
      loadCSS('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
      
      // Load React dependencies
      await loadScript('https://unpkg.com/react@18/umd/react.production.min.js');
      await loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js');
      await loadScript('https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.min.js');
      
      // Load the widget bundle
      await loadScript('${process.env.WIDGET_CDN_URL || '/dist/chat-widget.js'}');
      
      // Get configuration from data attributes
      const root = document.getElementById('shopify-chat-widget-root');
      if (!root) {
        console.error('Chat widget root element not found');
        return;
      }
      
      const config = {
        apiUrl: root.dataset.apiUrl,
        wsUrl: root.dataset.wsUrl,
        shopDomain: root.dataset.shopDomain,
        widgetColor: root.dataset.widgetColor || '#667eea',
        welcomeMessage: root.dataset.welcomeMessage || 'Hi! How can we help?'
      };
      
      // Render the widget
      const container = document.createElement('div');
      root.appendChild(container);
      
      ReactDOM.render(
        React.createElement(ChatWidget.default, config),
        container
      );
      
      console.log('Chat widget initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chat widget:', error);
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
`;
    
    fs.writeFileSync(
      path.join(distDir, 'widget-init.js'),
      initScript.trim()
    );
    
    console.log('✅ Widget initializer created!');
    
    // Create a simple HTML test file
    const testHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Widget Test</title>
</head>
<body>
  <h1>Test Page for Chat Widget</h1>
  <p>The chat widget should appear in the bottom-right corner.</p>
  
  <div 
    id="shopify-chat-widget-root"
    data-shop-domain="your-store.myshopify.com"
    data-api-url="http://localhost:3000"
    data-ws-url="ws://localhost:3000/ws"
    data-widget-color="#667eea"
    data-welcome-message="Hi! How can we help you today?"
  ></div>
  
  <script src="./widget-init.js"></script>
</body>
</html>
`;
    
    fs.writeFileSync(
      path.join(distDir, 'test.html'),
      testHTML.trim()
    );
    
    console.log('✅ Test HTML created!');
    console.log('\nFiles created in dist/:');
    console.log('  - chat-widget.js (bundled widget)');
    console.log('  - widget-init.js (initializer)');
    console.log('  - test.html (test page)');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Watch mode for development
const isWatch = process.argv.includes('--watch');

if (isWatch) {
  console.log('👀 Watching for changes...\n');
  
  esbuild.context({
    entryPoints: [path.join(__dirname, 'ChatWidget.jsx')],
    bundle: true,
    minify: false,
    format: 'iife',
    globalName: 'ChatWidget',
    outfile: path.join(distDir, 'chat-widget.js'),
    external: ['react', 'react-dom', 'lucide-react'],
    jsx: 'automatic',
    sourcemap: true,
  }).then(ctx => {
    ctx.watch();
    console.log('✅ Watching for changes...');
  });
} else {
  buildWidget();
}
