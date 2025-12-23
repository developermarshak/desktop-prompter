import React from 'react';
import { X, CheckCircle, XCircle, Clock, Terminal } from 'lucide-react';

interface JobExecutionModalProps {
  show: boolean;
  jobId: string | null;
  output: Array<{ type: 'stdout' | 'stderr' | 'info'; text: string }>;
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'error';
  exitCode: number | null;
  onClose: () => void;
}

export const JobExecutionModal: React.FC<JobExecutionModalProps> = ({
  show,
  jobId,
  output,
  status,
  exitCode,
  onClose,
}) => {
  const outputRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  React.useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  if (!show) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-zinc-400" />
            <h3 className="text-lg font-semibold text-white">Codex Execution</h3>
            {jobId && (
              <span className="text-xs text-zinc-500 font-mono">Job: {jobId.slice(0, 8)}...</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            {status === 'running' && (
              <div className="flex items-center gap-1.5 text-xs text-blue-400">
                <Clock className="w-4 h-4 animate-spin" />
                Running
              </div>
            )}
            {status === 'completed' && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle className="w-4 h-4" />
                Completed
              </div>
            )}
            {(status === 'failed' || status === 'error') && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <XCircle className="w-4 h-4" />
                {status === 'failed' ? `Failed (${exitCode})` : 'Error'}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Output Area */}
        <div
          ref={outputRef}
          className="flex-1 overflow-auto bg-black p-4 font-mono text-sm"
        >
          {output.length === 0 ? (
            <div className="text-zinc-600 text-center py-8">
              {status === 'queued' ? 'Job queued, waiting to start...' : 'Output will appear here...'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {output.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.type === 'stderr'
                      ? 'text-red-400'
                      : line.type === 'info'
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }
                >
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};




