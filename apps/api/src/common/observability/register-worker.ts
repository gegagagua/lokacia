// Side-effect entry: import FIRST in worker.ts so OpenTelemetry patches ioredis/pg before they load.
import { initObservability } from './index';
initObservability('lokacia-worker');
