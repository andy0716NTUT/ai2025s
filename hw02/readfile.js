const SVGIcons2SVGFontStream = require('svgicons2svgfont');
const fs = require('graceful-fs');
const path = require('path');
const ProgressBar = require('progress');

const fontName = 'MyFont';
const outputSVGFontPath = 'final_font/fontpico.svg';
const inputFolder = 'pico';

const fontStream = new SVGIcons2SVGFontStream({
  fontName: fontName,
});

// 解決 `MaxListenersExceededWarning`
fontStream.setMaxListeners(0);

const files = fs.readdirSync(inputFolder).filter(file => path.extname(file) === '.svg');

const progressBar = new ProgressBar('[:bar] :percent :etas', {
  total: files.length,
  width: 40,
});

console.time('Font Generation Time');

fontStream
  .pipe(fs.createWriteStream(outputSVGFontPath))
  .on('finish', function () {
    console.log('\nFont successfully created!');
    console.timeEnd('Font Generation Time');
  })
  .on('error', function (err) {
    console.error('Font Stream Error:', err);
  });

// 使用動態導入 p-limit
(async () => {
  const { default: pLimit } = await import('p-limit'); 
  const limit = pLimit(5); // 限制同時處理 5 個文件

  const processFile = async (file) => {
    const unicodeMatch = file.match(/[uU]\+([0-9A-Fa-f]+)/);
    if (unicodeMatch) {
      const unicode = [String.fromCodePoint(parseInt(unicodeMatch[1], 16))];
      const name = 'icon_' + unicodeMatch[1];

      const filePath = path.join(inputFolder, file);

      try {
        // 確保文件存在且可讀
        await fs.promises.access(filePath, fs.constants.R_OK);

        const glyph = fs.createReadStream(filePath);
        glyph.metadata = { unicode, name };

        // 監聽錯誤，防止 `pipe` 失敗
        glyph.on('error', (err) => {
          console.error(`Error reading file ${filePath}:`, err);
        });

        fontStream.write(glyph);
      } catch (err) {
        console.error(`File access error: ${filePath}`, err);
      }
    }
    progressBar.tick();
  };

  await Promise.all(files.map(file => limit(() => processFile(file))));

  setImmediate(() => fontStream.end());
})();