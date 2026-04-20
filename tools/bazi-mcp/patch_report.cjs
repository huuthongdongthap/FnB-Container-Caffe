const fs = require('fs');

const extracted = fs.readFileSync('extracted_bazi_html.html', 'utf-8');

// Extract the sections we want
const startIdx = extracted.indexOf('<div class="section">');
const endIdxStaff = extracted.indexOf('<!-- 7. Lịch Giải Ngân -->');
const startIdxCalendar = extracted.indexOf('<!-- 10. Hoàng Lịch Khai Trương -->');

// Reconstruct
const constructionHtml = extracted.substring(startIdx, endIdxStaff) + extracted.substring(endIdxStaff, extracted.indexOf('<!-- 8. Timeline Thi Công -->')) + extracted.substring(extracted.indexOf('<!-- 8. Timeline Thi Công -->'), extracted.indexOf('<!-- 9. Nhân Sự -->'));
const calendarHtml = extracted.substring(startIdxCalendar);

let report = fs.readFileSync('generate-report.js', 'utf-8');

const targetStr = `        </div>\n\n        <div class="section" style="text-align:center; background:#f0f0f0;">\n            <h2>📂 Bàn Giao Dữ Liệu Thi Công</h2>`;

if (report.includes(targetStr)) {
    report = report.replace(targetStr, `        </div>\n\n${constructionHtml}\n\n${calendarHtml}\n\n        <div class="section" style="text-align:center; background:#f0f0f0;">\n            <h2>📂 Bàn Giao Dữ Liệu Thi Công</h2>`);
    fs.writeFileSync('generate-report.js', report);
    console.log("Successfully patched generate-report.js");
} else {
    console.log("Could not find target string in generate-report.js");
}
