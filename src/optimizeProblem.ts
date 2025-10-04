import os from 'os';
import { optimizeMatrix } from './algorithm.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, threadId, parentPort } from 'worker_threads';

if (isMainThread) {
    const numCPUs = os.cpus().length;
    console.info(`Creating ${numCPUs} worker threads`);

    const stack = Array(576)
        .fill(undefined)
        .map((_, i) => i + 1)
        .reverse();
    let completedWorkers = 0;

    for (let i = 0; i < numCPUs; i++) {
        const worker = new Worker(__filename);

        worker.on('message', (message: { type: string; counter?: number }) => {
            if (message.type === 'requestWork') {
                if (stack.length !== 0) {
                    worker.postMessage({
                        type: 'work',
                        counter: stack.pop()
                    });
                } else {
                    worker.postMessage({ type: 'terminate' });
                }
            } else if (message.type === 'workCompleted') {
                if (stack.length !== 0) {
                    worker.postMessage({
                        type: 'work',
                        counter: stack.pop()
                    });
                } else {
                    worker.postMessage({ type: 'terminate' });
                }
            }
        });

        worker.on('exit', () => {
            completedWorkers++;
            if (completedWorkers === numCPUs) {
                console.info('All workers completed their work');
            }
        });

        worker.on('error', err => {
            console.error(`Worker error: ${err}`);
        });
    }
} else {
    // Worker thread logic
    parentPort?.on('message', (message: { type: string; counter?: number }) => {
        if (message.type === 'work' && message.counter !== undefined) {
            // Log the counter received by this worker
            console.info(
                `Thread ${threadId} received counter: ${message.counter}`
            );

            const { originalMatrix } = JSON.parse(
                readFileSync(
                    `.\\problem\\problem-${message.counter}.json`,
                    'utf-8'
                )
            );
            let by: 'cell' | 'camera' = 'cell';
            let iterationWithoutChanges = 0;
            while (iterationWithoutChanges < 2) {
                if (optimizeMatrix(originalMatrix, by)) {
                    iterationWithoutChanges = 0;
                } else {
                    iterationWithoutChanges++;
                }
                by = by === 'cell' ? 'camera' : 'cell';
            }
            writeFileSync(
                `.\\problem\\problem-${message.counter}-optimized.json`,
                JSON.stringify(originalMatrix, null, 4)
            );

            parentPort?.postMessage({ type: 'workCompleted' });
        } else if (message.type === 'terminate') {
            process.exit(0);
        }
    });

    // Request initial work
    parentPort?.postMessage({ type: 'requestWork' });
}
