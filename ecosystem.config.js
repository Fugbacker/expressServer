module.exports = {
  apps: [
    {
      name: 'expressServer',          // любое имя процесса
      script: 'yarn',                // команда запуска
      args: 'start',                 // аргумент yarn
      env: {
        NODE_ENV: 'production',
        PORT: 3000,                  // порт, который будет слушать сервер
      },
      error_file: '/var/www/expressServer/log/err.log',  // ошибки
      out_file: '/var/www/expressServer/log/out.log',    // обычный вывод
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,              // объединять все логи в один
      autorestart: true,             // перезапуск при падении
      watch: false                   // можно включить, если нужен автообновление при изменении файлов
    },
  ],
};
