import { useState, useEffect, useRef } from 'react';
import { streamJobEvents, getAuthToken, JobEvent } from '../../services/cliJobService';

interface UseJobExecutionReturn {
  showJobExecution: boolean;
  jobId: string | null;
  jobOutput: Array<{ type: 'stdout' | 'stderr' | 'info'; text: string }>;
  jobStatus: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'error';
  jobExitCode: number | null;
  setShowJobExecution: (show: boolean) => void;
  startJob: (jobId: string) => Promise<void>;
  resetJob: () => void;
}

export const useJobExecution = (): UseJobExecutionReturn => {
  const [showJobExecution, setShowJobExecution] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobOutput, setJobOutput] = useState<Array<{ type: 'stdout' | 'stderr' | 'info'; text: string }>>([]);
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'error'>('idle');
  const [jobExitCode, setJobExitCode] = useState<number | null>(null);
  const unsubscribeJobRef = useRef<(() => void) | null>(null);

  const startJob = async (newJobId: string) => {
    try {
      const token = await getAuthToken();
      
      setJobId(newJobId);
      setJobStatus('running');
      setJobOutput([]);
      setShowJobExecution(true);

      // Subscribe to job events
      const unsubscribe = streamJobEvents(newJobId, token, (event: JobEvent) => {
        if (event.event === 'stdout') {
          setJobOutput((prev) => [...prev, { type: 'stdout', text: event.chunk || '' }]);
        } else if (event.event === 'stderr') {
          setJobOutput((prev) => [...prev, { type: 'stderr', text: event.chunk || '' }]);
        } else if (event.event === 'start') {
          setJobOutput((prev) => [...prev, { type: 'info', text: `Starting: ${event.message || ''}\n` }]);
          setJobStatus('running');
        } else if (event.event === 'exit') {
          setJobExitCode(event.code ?? null);
          setJobStatus(event.code === 0 ? 'completed' : 'failed');
          if (unsubscribeJobRef.current) {
            unsubscribeJobRef.current();
            unsubscribeJobRef.current = null;
          }
        } else if (event.event === 'error') {
          setJobOutput((prev) => [...prev, { type: 'stderr', text: `Error: ${event.message || ''}\n` }]);
          setJobStatus('error');
          if (unsubscribeJobRef.current) {
            unsubscribeJobRef.current();
            unsubscribeJobRef.current = null;
          }
        }
      });

      unsubscribeJobRef.current = unsubscribe;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setJobOutput((prev) => [...prev, { type: 'stderr', text: `Error starting job: ${errorMessage}\n` }]);
      setJobStatus('error');
    }
  };

  const resetJob = () => {
    if (unsubscribeJobRef.current) {
      unsubscribeJobRef.current();
      unsubscribeJobRef.current = null;
    }
    setJobId(null);
    setJobOutput([]);
    setJobStatus('idle');
    setJobExitCode(null);
  };

  // Cleanup job subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeJobRef.current) {
        unsubscribeJobRef.current();
      }
    };
  }, []);

  return {
    showJobExecution,
    jobId,
    jobOutput,
    jobStatus,
    jobExitCode,
    setShowJobExecution,
    startJob,
    resetJob,
  };
};




