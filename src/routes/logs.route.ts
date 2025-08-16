import { Router } from 'express';
import { LogsController } from '../controllers/logs.controller';
import { LogsService } from '../services/logs.service';
import prisma from '../prisma/client';

const router = Router();
const logsService = new LogsService(prisma);
const logsController = new LogsController(logsService);

// Inbound operations
router.post('/inbound', logsController.createInboundLog);
router.get('/inbound', logsController.getAllInboundLogs);

// Outbound operations
router.post('/outbound', logsController.createOutboundLog);
router.get('/outbound', logsController.getAllOutboundLogs);

export default router; 