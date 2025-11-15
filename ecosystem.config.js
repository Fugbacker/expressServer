export default {
  apps: [
    {
      name: 'expressServer',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/www/web/log/expressServer/err.log',
      out_file: '/var/www/web/log/expressServer/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};