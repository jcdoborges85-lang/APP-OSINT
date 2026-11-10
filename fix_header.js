const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const headerRegex = /(<header class="bg-slate-900\/90.*?<\/header>)/s;

const headerMatch = html.match(headerRegex);

if (headerMatch) {
    let headerStr = headerMatch[0];

    // We check where the header is located.
    const headerPos = html.indexOf(headerStr);
    const bodyPos = html.indexOf('<body');
    const accordionPos = html.indexOf('<div class="accordion-list">');

    console.log("bodyPos:", bodyPos);
    console.log("headerPos:", headerPos);
    console.log("accordionPos:", accordionPos);

    if (headerPos > accordionPos) {
        console.log("Header is inside accordion list or below it, moving it up.");
        // Remove it from current place
        let cleanHtml = html.replace(headerStr, '');
        // Place it right after <div id="toastNotification" ... > ... </div>
        const toastEndStr = '</div>\n\n    <!-- Header Principal -->';
        const toastEndPos = cleanHtml.indexOf('    <!-- Header Principal -->');
        if (toastEndPos !== -1) {
            cleanHtml = cleanHtml.slice(0, toastEndPos) + headerStr + '\n\n' + cleanHtml.slice(toastEndPos);
            fs.writeFileSync('index.html', cleanHtml, 'utf8');
            console.log("Header moved to correct position.");
        } else {
            console.log("Could not find toastEndPos.");
        }
    } else {
        console.log("Header is in correct position (above accordion-list).");
    }
} else {
    console.log("Header not found.");
}
