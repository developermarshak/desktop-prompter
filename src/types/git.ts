export interface GitDiffFile {
  path: string;
  status: string;
  oldContent: string;
  newContent: string;
  isBinary: boolean;
}

export interface GitDiffResponse {
  root: string;
  files: GitDiffFile[];
}
