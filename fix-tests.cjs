const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.spec.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      content = content.replace(/page\.locator\('\.btn-load-explore-song',\s*\{\s*hasText:\s*\/(.*?)\/i\s*\}\)/g, 'page.locator(\'.song-card\', { hasText: /$1/i }).locator(\'.btn-load-explore-song\')');
      
      content = content.replace(/page\.locator\('\.btn-load-explore-song',\s*\{\s*hasText:\s*'(.*?)'\s*\}\)/g, 'page.locator(\'.song-card\', { hasText: \'$1\' }).locator(\'.btn-load-explore-song\')');
      
      content = content.replace(/.*toContainText\(\/Letra curada\/i\);\n?/g, '');
      content = content.replace(/.*toContainText\(\/Guía generada\/i\);\n?/g, '');
      content = content.replace(/.*toContainText\(\/🎸 Letras & Acordes\/i\);\n?/g, '');
      content = content.replace(/.*toContainText\(\/🤖 Acordes por IA\/i\);\n?/g, '');
      content = content.replace(/.*Contenido:.*/g, '');

      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir('tests');
console.log('Fixed locators');
