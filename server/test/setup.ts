import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Must run before any server module reads config.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-test-'));
process.env.DATA_DIR = dir;
process.env.AI_MODE = 'off';
process.env.ALLOW_AGENT_BASH = 'true';
export const TMP = dir;
