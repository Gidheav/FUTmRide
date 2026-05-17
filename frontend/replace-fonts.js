const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

walk('c:/Users/DELL/Desktop/Apps/LR-Ride/frontend/src', (filePath) => {
    if (!filePath.match(/\.(tsx|ts|css)$/)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/@import url\(https:\/\/fonts\.googleapis\.com[^\)]+\);/g, '');
    
    content = content.replace(/font-family:\s*['"]?Instrument Sans['"]?[^;]*;/g, 'font-family: system-ui, -apple-system, sans-serif;');
    content = content.replace(/font-family:\s*['"]?Instrument Serif['"]?[^;]*;/g, 'font-family: ui-serif, Georgia, serif;');
    content = content.replace(/font-family:\s*['"]?Inter['"]?[^;]*;/g, 'font-family: system-ui, -apple-system, sans-serif;');
    content = content.replace(/font-family:\s*['"]?Plus Jakarta Sans['"]?[^;]*;/g, 'font-family: system-ui, -apple-system, sans-serif;');
    content = content.replace(/const FONT = ['"]Inter,[^'"]+['"]/g, 'const FONT = "system-ui, -apple-system, sans-serif"');

    // For css variables
    content = content.replace(/--font-sans:\s*['"]Inter['"][^;]+;/g, '--font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated', filePath);
    }
});
