import 'dotenv/config';
import { createServer } from 'http';
import Connection from './database/db.js';
import app from './app.js';
import { setupSocket } from './socket/handler.js';
import { startPeriodicSave } from './services/yjsManager.js';

const PORT = process.env.PORT || 9000;

Connection();

const httpServer = createServer(app);
setupSocket(httpServer);
startPeriodicSave();

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
