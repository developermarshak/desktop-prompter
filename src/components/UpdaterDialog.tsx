import React, { useEffect, useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdaterDialogProps {
  checkOnMount?: boolean;
}

export const UpdaterDialog: React.FC<UpdaterDialogProps> = ({
  checkOnMount = true
}) => {
  const [update, setUpdate] = useState<Update | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = async () => {
    try {
      setError(null);

      const update = await check();

      if (update?.available) {
        console.log(
          `Update available: ${update.currentVersion} -> ${update.version}`
        );
        setUpdate(update);
      } else {
        console.log('No update available');
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    }
  };

  const installUpdate = async () => {
    if (!update) return;

    try {
      setDownloading(true);
      setError(null);

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress(0);
            break;
          case 'Progress':
            if (event.data && typeof event.data === 'object' && 'chunkLength' in event.data) {
              // Track progress - this is an approximation
              setDownloadProgress((prev) => Math.min(prev + 5, 90));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      // Update installed successfully, relaunch
      await relaunch();
    } catch (err) {
      console.error('Failed to install update:', err);
      setError(err instanceof Error ? err.message : 'Failed to install update');
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (checkOnMount) {
      // Check for updates 5 seconds after app starts
      const timer = setTimeout(() => {
        checkForUpdate();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [checkOnMount]);

  if (!update && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4">
        {error ? (
          <>
            <h2 className="text-xl font-semibold text-red-400 mb-4">
              Update Error
            </h2>
            <p className="text-zinc-300 mb-6">{error}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setUpdate(null);
                }}
                className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">
              Update Available
            </h2>
            <p className="text-zinc-300 mb-2">
              A new version is available: <strong>{update?.version}</strong>
            </p>
            <p className="text-zinc-400 text-sm mb-6">
              Current version: {update?.currentVersion}
            </p>

            {downloading && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-zinc-400 mb-2">
                  <span>Downloading...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUpdate(null)}
                disabled={downloading}
                className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50"
              >
                Later
              </button>
              <button
                onClick={installUpdate}
                disabled={downloading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50"
              >
                {downloading ? 'Installing...' : 'Update Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
