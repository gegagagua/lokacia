// Side-effect entry: import FIRST in main.ts so OpenTelemetry patches http/express/pg before they load.
import { initObservability } from './index';
initObservability('lokacia-api');
