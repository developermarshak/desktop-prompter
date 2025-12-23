export type TerminalQueuedWrite = {
  data: string;
  delayMs?: number;
};

const pendingById = new Map<string, TerminalQueuedWrite[]>();
const subscribers = new Set<() => void>();

export const enqueueTerminalWrite = (
  id: string,
  data: string,
  delayMs?: number,
) => {
  const queue = pendingById.get(id);
  const entry: TerminalQueuedWrite = { data, delayMs };
  if (queue) {
    queue.push(entry);
  } else {
    pendingById.set(id, [entry]);
  }
  subscribers.forEach((listener) => listener());
};

export const drainTerminalWrites = (id: string): TerminalQueuedWrite[] => {
  const queue = pendingById.get(id);
  if (!queue) {
    return [];
  }
  pendingById.delete(id);
  return queue;
};

export const subscribeTerminalQueue = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};
