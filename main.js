const { program } = require('commander');
const http = require('http');
const fs = require('fs').promises;
const { XMLBuilder } = require('fast-xml-parser');

// Налаштування XML парсера
const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  arrayNodeName: "bank",
  suppressEmptyNode: true,
});

// Конфігурація командного рядка
program
  .requiredOption('-i, --input <path>', 'шлях до JSON файлу з даними')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера', parseInt)
  .parse(process.argv);

const options = program.opts();

// Асинхронна функція для читання JSON файлу
async function readDataFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Cannot find input file');
    }
    throw error;
  }
}

// Функція для обробки та фільтрації даних банків
function processBanksData(banksData, queryParams) {
  let result = banksData;

  // Фільтрація за статусом "Нормальний" (COD_STATE = 1)
  if (queryParams.normal === 'true') {
    result = result.filter(bank => bank.COD_STATE === 1);
  }

  // Визначення полів для виводу
  const showMfo = queryParams.mfo === 'true';
  const showState = queryParams.normal === 'true';

  // Форматування даних для XML
  return result.map(bank => {
    const bankOutput = {};
    if (showMfo) {
      bankOutput.mfo_code = bank.MFO;
    }
    bankOutput.name = bank.NAME;
    if (showState) {
      bankOutput.state_code = bank.COD_STATE;
    }
    return bankOutput;
  });
}

// Створення HTTP сервера
const server = http.createServer(async (req, res) => {
  console.log(`Отримано запит: ${req.method} ${req.url}`);

  if (req.method === 'GET') {
    try {
      // Парсинг URL та параметрів запиту
      const url = new URL(req.url, `http://${options.host}:${options.port}`);
      const queryParams = Object.fromEntries(url.searchParams);

      // Читання та обробка даних
      const rawData = await readDataFile(options.input);
      const processedData = processBanksData(rawData, queryParams);

      // Формування XML відповіді
      const xmlObject = {
        banks: {
          bank: processedData
        }
      };

      const xmlResponse = xmlBuilder.build(xmlObject);

  
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(xmlResponse);

    } catch (error) {
      console.error('Помилка обробки запиту:', error.message);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Помилка сервера: ${error.message}`);
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Метод не підтримується');
  }
});


server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено на http://${options.host}:${options.port}`);
  console.log(`Використовується файл даних: ${options.input}`);
});