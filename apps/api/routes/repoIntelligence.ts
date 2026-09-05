/**
 * Aegis API Routes — Repository Intelligence Engine
 */

import { Router } from 'express';
import {
  connectRepository,
  executeShowcaseQuery,
  getRepositorySnapshot,
  getRepositoryStatusHandler,
  listRepositories,
  searchRepositoryIntelligence,
} from '../controllers/repoIntelligence';

const router = Router();

router.post('/connect', connectRepository);
router.get('/', listRepositories);
router.get('/:repoId', getRepositorySnapshot);
router.get('/:repoId/status', getRepositoryStatusHandler);
router.get('/:repoId/search', searchRepositoryIntelligence);
router.post('/:repoId/showcase', executeShowcaseQuery);

export default router;
