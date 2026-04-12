const fs = require('fs');

const extracted = fs.readFileSync('extracted_bazi_html.html', 'utf-8');

// Extract the sections we want
const startIdx = extracted.indexOf('<!-- 6. Hạng Mục Thi Công + Phong Thủy -->');
const endIdxStaff = extracted.indexOf('<!-- 9. Nhân Sự -->');
const startIdxCalendar = extracted.indexOf('<!-- 10. Hoàng Lịch Khai Trương -->');

let injectedHTML = '\n' + extracted.substring(0, endIdxStaff) + '\n' + extracted.substring(startIdxCalendar);

let report = fs.readFileSync('generate-report.js', 'utf-8');

// Replace the end of Tương hợp nhân sự to inject the new code before the download section
const targetStr = `        </div>\n\n        <div class="section" style="text-align:center; background:#f0f0f0;">\n            <h2>📂 Bàn Giao Dữ Liệu Thi Công</h2>`;

if (report.includes(targetStr)) {
    report = report.replace(targetStr, `        </div>\n\n${injectedHTML}\n\n        <div class="section" style="text-align:center; background:#f0f0f0;">\n            <h2>📂 Bàn Giao Dữ Liệu Thi Công</h2>`);
    fs.writeFileSync('generate-report.js', report);
    console.log("Successfully patched generate-report.js");
} else {
    console.log("Could not find target string in generate-report.js");
}
