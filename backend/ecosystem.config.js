module.exports = {
  apps: [{
    name: "server",
    script: "./server.js",
    instances: "max", // Запускает столько копий, сколько ядер CPU
    exec_mode: "cluster", // Режим кластеризации
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    error_file: "./err.log",
    out_file: "./out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G" // Перезапуск если память > 1GB
  }]
};