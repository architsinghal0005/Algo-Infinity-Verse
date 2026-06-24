const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('scratch') && !fullPath.includes('backup')) {
                results = results.concat(walk(fullPath));
            }
        } else {
            if (fullPath.endsWith('.html')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const htmlFiles = walk('.');
const brokenLinks = [];
let totalLinks = 0;

htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    
    // Find hrefs
    const hrefRegex = /href=["']([^"']+)["']/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
        const link = match[1];
        totalLinks++;
        if (
            link.startsWith('http') ||
            link.startsWith('//') ||
            link.startsWith('#') ||
            link.startsWith('mailto:') ||
            link.startsWith('tel:') ||
            link.startsWith('javascript:') ||
            link.startsWith('data:')
        ) continue;
        
        // Strip query params and hashes for file checking
        const cleanLink = link.split('?')[0].split('#')[0];
        if (!cleanLink) continue;

        let targetPath;
        if (cleanLink.startsWith('/')) {
            targetPath = path.join(__dirname, '..', cleanLink);
        } else {
            targetPath = path.resolve(dir, cleanLink);
        }
        
        if (!fs.existsSync(targetPath)) {
            brokenLinks.push(`Broken href in ${file}: ${link} (resolved to ${targetPath})`);
        }
    }

    // Find srcs
    const srcRegex = /src=["']([^"']+)["']/g;
    while ((match = srcRegex.exec(content)) !== null) {
        const link = match[1];
        totalLinks++;
        if (link.startsWith('http') || link.startsWith('//') || link.startsWith('data:')) continue;
        
        const cleanLink = link.split('?')[0].split('#')[0];
        if (!cleanLink) continue;

        let targetPath;
        if (cleanLink.startsWith('/')) {
            targetPath = path.join(__dirname, '..', cleanLink);
        } else {
            targetPath = path.resolve(dir, cleanLink);
        }

        if (!fs.existsSync(targetPath)) {
            brokenLinks.push(`Broken src in ${file}: ${link} (resolved to ${targetPath})`);
        }
    }
});

console.log(`Scanned ${htmlFiles.length} HTML files.`);
console.log(`Checked ${totalLinks} links/assets.`);
if (brokenLinks.length > 0) {
    console.log(`Found ${brokenLinks.length} broken links/assets:`);
    brokenLinks.forEach(b => console.log(b));
} else {
    console.log("No broken internal links found!");
}
