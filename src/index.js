require('dotenv').config();
const createApp = require('./app');
const { connectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDatabase();
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`API: http://localhost:${PORT}/api/v1`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
