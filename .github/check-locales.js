const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const baseLang = 'zh.json'; 
const baseData = JSON.parse(fs.readFileSync(path.join(localesDir, baseLang), 'utf8'));
const baseKeys = Object.keys(baseData).sort();

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== baseLang);

let hasError = false;

files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
    const keys = Object.keys(data).sort();
    
    // 检查缺失
    const missing = baseKeys.filter(k => !keys.includes(k));
    // 检查多余
    const extra = keys.filter(k => !baseKeys.includes(k));

    if (missing.length > 0 || extra.length > 0) {
        console.error(`❌ 语言包 ${file} 键不匹配！`);
        if (missing.length > 0) console.error(`   缺失键 (${missing.length}): ${missing.join(', ')}`);
        if (extra.length > 0) console.error(`   多余键 (${extra.length}): ${extra.join(', ')}`);
        hasError = true;
    }
});

if (hasError) process.exit(1);
console.log("✅ 所有语言包键集完全一致！");
