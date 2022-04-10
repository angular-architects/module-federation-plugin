export type DoneFn = () => void;
export type Task = (done: DoneFn) => void;

const queue: Task[] = [];

// tslint:disable-next-line: no-shadowed-variable
function peek<T>(queue: Array<T>): T {
    if (queue.length === 0) {
        return null;
    }
    return queue[queue.length - 1];
}

function startNext(): void {
    if (queue.length === 0) {
        return;
    }
    queue.pop();
    const task = peek(queue);
    if (task) {
        task(startNext);
    }
}

export function enqueuTask(task: Task): void {
    if (queue.length === 0) {
        queue.unshift(task);
        task(startNext);
    }
    else {
        queue.unshift(task);
    }
}
