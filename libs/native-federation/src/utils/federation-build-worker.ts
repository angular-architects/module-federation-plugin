import { parentPort, workerData } from 'worker_threads';
import { runEsbuild } from './angular-esbuild-adapter';

async function run() {
  try {
    const result = await runEsbuild(workerData.options);
    parentPort?.postMessage({ success: true, result });
  } catch (error) {
    parentPort?.postMessage({ success: false, error: error.message });
  }
}

run();
