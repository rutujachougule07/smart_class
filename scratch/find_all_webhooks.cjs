const fs = require('fs');
const path = require('path');

function search(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === 'dist' || f === '.git') continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      search(full, results);
    } else {
      if (/\.(jsx?|tsx?|html|json|dart|css|rules)$/i.test(f)) {
        const content = fs.readFileSync(full, 'utf8');
        if (/webhook/i.test(content)) {
          results.push(path.relative(process.cwd(), full));
        }
      }
    }
  }
  return results;
}

const found = search('.');
console.log("Files containing 'webhook':", found);
