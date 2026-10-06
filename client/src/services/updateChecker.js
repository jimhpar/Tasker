// BlackBox THC - Tasker Auto Update Checker Service
export const CURRENT_VERSION = '2.1.0';
export const PUBLISHER_NAME = 'BlackBox THC';
const DEFAULT_REPO = 'BlackBoxTHC/Tasker';
const LAST_CHECK_KEY = 'tasker_last_update_check';
const REPO_KEY = 'tasker_github_repo';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const getGitHubRepo = () => {
  return localStorage.getItem(REPO_KEY) || DEFAULT_REPO;
};

export const setGitHubRepo = (repo) => {
  localStorage.setItem(REPO_KEY, repo.trim());
};

// Compare two semver strings like "2.1.0" and "2.2.0"
export const isNewerVersion = (latest, current) => {
  const cleanL = (latest || '').replace(/^v/i, '').trim();
  const cleanC = (current || '').replace(/^v/i, '').trim();

  const lParts = cleanL.split('.').map(n => parseInt(n, 10) || 0);
  const cParts = cleanC.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
};

export const checkForUpdates = async (force = false) => {
  const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
  const now = Date.now();

  // If not forced (not manual button click) and checked within 7 days, skip
  if (!force && now - lastCheck < ONE_WEEK_MS) {
    return { hasUpdate: false, skippedWeekly: true };
  }

  const repo = getGitHubRepo();
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json'
      }
    });

    localStorage.setItem(LAST_CHECK_KEY, String(now));

    if (!res.ok) {
      if (res.status === 404) {
        return { hasUpdate: false, error: 'No releases found for this repository.' };
      }
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const data = await res.json();
    const latestVersion = (data.tag_name || data.name || '').replace(/^v/i, '');

    if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
      return {
        hasUpdate: true,
        currentVersion: CURRENT_VERSION,
        latestVersion,
        releaseName: data.name || `Tasker v${latestVersion}`,
        releaseNotes: data.body || 'New features, performance enhancements, and bug fixes.',
        releaseUrl: data.html_url || `https://github.com/${repo}/releases/latest`,
        downloadUrl: data.assets?.[0]?.browser_download_url || data.html_url
      };
    }

    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      message: 'You are using the latest version of Tasker.'
    };
  } catch (err) {
    console.warn('Update check failed:', err);
    return {
      hasUpdate: false,
      error: err.message
    };
  }
};
