const fs = require('fs');
const path = require('path');

const oldPath = path.join(__dirname, 'dist', 'assets', 'node_modules');
const newPath = path.join(__dirname, 'dist', 'assets', 'vendor');

if (fs.existsSync(oldPath)) {
  console.log('Renaming dist/assets/node_modules to dist/assets/vendor to bypass Vercel ignore rules...');
  if (fs.existsSync(newPath)) {
    fs.rmSync(newPath, { recursive: true, force: true });
  }
  fs.renameSync(oldPath, newPath);
  console.log('Successfully renamed assets folder!');
} else {
  console.log('dist/assets/node_modules not found. Skipping rename.');
}

const swPath = path.join(__dirname, 'dist', 'sw.js');
if (fs.existsSync(swPath)) {
  console.log('Injecting dynamic cache name into dist/sw.js...');
  let content = fs.readFileSync(swPath, 'utf8');
  content = content.replace(/const\s+CACHE_NAME\s*=\s*['"][^'"]+['"];/, `const CACHE_NAME = "faf-${Date.now()}";`);
  fs.writeFileSync(swPath, content, 'utf8');
  console.log('Successfully injected dynamic cache name!');
} else {
  console.log('dist/sw.js not found. Skipping cache name injection.');
}

// Post-process JavaScript bundles to replace import.meta with a safe CJS equivalent
const jsDir = path.join(__dirname, 'dist', '_expo', 'static', 'js', 'web');
if (fs.existsSync(jsDir)) {
  console.log('Post-processing JS bundles to resolve import.meta syntax errors...');
  const files = fs.readdirSync(jsDir);
  let processedCount = 0;
  for (const file of files) {
    if (file.startsWith('entry-') && file.endsWith('.js')) {
      const filePath = path.join(jsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('import.meta') || content.includes('assets/node_modules') || content.includes('assets%2Fnode_modules')) {
        content = content.replace(/import\.meta/g, '({env:{MODE:"production"}})');
        content = content.replace(/assets\/node_modules/g, 'assets/vendor');
        content = content.replace(/assets%2Fnode_modules/g, 'assets%2Fvendor');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully patched ${file}`);
        processedCount++;
      }
    }
  }
  if (processedCount === 0) {
    console.log('No import.meta references found in JS bundles.');
  }
} else {
  console.log('Web JS directory not found. Skipping bundle post-processing.');
}

