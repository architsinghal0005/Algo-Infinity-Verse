const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        // Skip node_modules and .git
        if (isDirectory && !['node_modules', '.git', '.agents', '.claude'].includes(f)) {
            walkDir(dirPath, callback);
        } else if (!isDirectory && dirPath.endsWith('.html')) {
            // Skip partials that might contain critical above-the-fold content
            if (!dirPath.includes('navbar.html') && !dirPath.includes('footer.html')) {
                callback(dirPath);
            }
        }
    });
}

let modifiedCount = 0;

walkDir('.', function(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find all img tags
    // This regex looks for <img ... >
    // It replaces <img with <img loading="lazy" only if loading= isn't already present
    const newContent = content.replace(/<img\b([^>]*?)>/gi, (match, attributes) => {
        if (!attributes.match(/loading\s*=\s*['"](lazy|eager)['"]/i)) {
            modifiedCount++;
            return `<img loading="lazy"${attributes}>`;
        }
        return match;
    });

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
});

console.log(`\nProcess completed. Modified ${modifiedCount} <img> tags.`);
