module.exports = {
  apps: [
    {
      name: 'gcadastr',
      script: '/var/www/expressServer/server.js', // путь к твоему main server файлу
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/www/web/log/gcadastr.su/err.log',
      out_file: '/var/www/web/log/gcadastr.su/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true, // чтобы перезапускался при падении
    },
  ],
};