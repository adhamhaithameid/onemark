import { storageContract } from './contract.js';
import { MemoryStorage } from '../src/index.js';

storageContract('memory', async () => new MemoryStorage());
