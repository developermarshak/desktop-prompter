export interface CLIJobRequest {
  tool: 'aider' | 'codex' | 'claude_code' | 'cursor';
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeout_sec?: number;
  interactive?: boolean;
}

export interface CLIJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'error';
  created_at: number;
  started_at?: number;
  completed_at?: number;
  exit_code?: number;
  error?: string;
}

export interface JobEvent {
  event: 'stdout' | 'stderr' | 'exit' | 'error' | 'start' | 'status';
  job_id: string;
  chunk?: string;
  code?: number;
  message?: string;
  status?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export class CLIJobError extends Error {
  constructor(
    message: string,
    public errorCode?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'CLIJobError';
  }
}

export async function createCLIJob(
  request: CLIJobRequest,
  token: string
): Promise<{ job_id: string; status: string; created_at: number }> {
  const response = await fetch(`${API_BASE_URL}/api/cli-jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new CLIJobError(
      error.error || error.message || 'Failed to create job',
      error.error,
      error
    );
  }

  return response.json();
}

export async function getCLIJob(jobId: string, token: string): Promise<CLIJob> {
  const response = await fetch(`${API_BASE_URL}/api/cli-jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get job');
  }

  return response.json();
}

export function streamJobEvents(
  jobId: string,
  token: string,
  onEvent: (event: JobEvent) => void
): () => void {
  const eventSource = new EventSource(
    `${API_BASE_URL}/api/cli-jobs/${jobId}/events?token=${encodeURIComponent(token)}`
  );

  eventSource.onmessage = (e) => {
    try {
      const event: JobEvent = JSON.parse(e.data);
      onEvent(event);
    } catch (error) {
      console.error('Failed to parse event:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}

// Get or create auth token
export async function getAuthToken(userId: string = 'default-user'): Promise<string> {
  // Check if we have a token in localStorage
  const storedToken = localStorage.getItem('prompter_auth_token');
  if (storedToken) {
    return storedToken;
  }

  // Generate a new token from the backend
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to get auth token');
    }

    const data = await response.json();
    const token = data.token;
    
    // Store token for future use
    localStorage.setItem('prompter_auth_token', token);
    
    return token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw error;
  }
}
