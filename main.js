const { program } = require('commander');
const http = require('http');
const fs = require('fs').promises;
const { XMLBuilder } = require('fast-xml-parser');


const xmlBuilder = new XMLBuilder({
  format: true,
  suppressEmptyNode: true,
  arrayNodeName: "bank" 
});

program
  .requiredOption('-i, --input <path>', 'шлях до JSON файлу')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера', parseInt)
  .parse(process.argv);

const options = program.opts();


fs.access(options.input)
  .then(() => {
    console.log('Файл знайдено:', options.input);
    
    const server = http.createServer(async (req, res) => {
      console.log('Отримано запит:', req.url);
      
      if (req.method === 'GET') {
        try {
          const url = new URL(req.url, `http://${options.host}:${options.port}`);
          const queryParams = Object.fromEntries(url.searchParams);
          
          console.log('Параметри запиту:', queryParams);

          const data = await fs.readFile(options.input, 'utf8');
          const banksData = JSON.parse(data);
          
          console.log('Прочитано банків:', banksData.length);

          // Фільтрація даних
          let filteredData = banksData;
          
          if (queryParams.normal === 'true') {
            filteredData = filteredData.filter(bank => bank.COD_STATE === 1);
            console.log('Після фільтрації normal:', filteredData.length);
          }

          // Форматування даних для XML
          const showMfo = queryParams.mfo === 'true';
          const showState = queryParams.normal === 'true';
          
          const xmlData = filteredData.map(bank => {
            const bankInfo = {};
            
            bankInfo.name = bank.NAME || bank.SHORTNAME || 'Невідомий банк';
            
            if (showMfo) {
              bankInfo.mfo_code = bank.MFO || '000000';
            }
      
            if (showState) {
              bankInfo.state_code = bank.COD_STATE !== undefined ? bank.COD_STATE : 0;
            }
            
            return bankInfo;
          });

          console.log('Дані для XML:', xmlData.length, 'елементів');

          const xmlObject = {
            banks: {
              bank: xmlData
            }
          };

          // Генеруємо XML
          const xmlResponse = xmlBuilder.build(xmlObject);
          console.log('XML успішно згенеровано');

         
          res.writeHead(200, { 
            'Content-Type': 'application/xml',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(xmlResponse);

        } catch (error) {
          console.error('Помилка обробки запиту:', error);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Помилка сервера: ' + error.message);
        }
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Метод не підтримується');
      }
    });

    
    server.listen(options.port, options.host, () => {
      console.log(`=== Сервер запущено ===`);
      console.log(`Адреса: http://${options.host}:${options.port}`);
      console.log(`Файл даних: ${options.input}`);
      console.log(`Для тестування відкрий в браузері:`);
      console.log(`- Всі дані: http://${options.host}:${options.port}/`);
      console.log(`- Тільки нормальні банки: http://${options.host}:${options.port}/?normal=true`);
      console.log(`- З МФО: http://${options.host}:${options.port}/?mfo=true`);
      console.log(`- Все разом: http://${options.host}:${options.port}/?mfo=true&normal=true`);
    });

  })
  .catch((error) => {
    console.error('Cannot find input file');
    process.exit(1);
  });